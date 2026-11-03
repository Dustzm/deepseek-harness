/** Legacy SSE transport and the programmatic auth provider on HTTP-based transports. */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Client, SSEClientTransport, StreamableHTTPClientTransport, type AuthProvider } from '@modelcontextprotocol/client'
import { afterEach, describe, expect, it } from 'vitest'
import { Config } from '../src/index.ts'
import { createTransport } from '../src/transport.ts'
import { startHttpMcpFixture, type HttpMcpFixture } from './http-fixture.ts'

/** Running legacy SSE fixture and the request headers it observed. */
interface SseFixture {
  url: string
  headers: Array<Record<string, string | string[] | undefined>>
  close: () => Promise<void>
}

/**
 * Minimal 2024-11-05 HTTP+SSE server: `GET /sse` opens the stream and
 * announces `/messages`; each POSTed JSON-RPC request is answered on the stream.
 */
async function startSseFixture(): Promise<SseFixture> {
  const headers: SseFixture['headers'] = []
  let stream: ServerResponse | undefined
  const reply = (message: unknown) => { stream?.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`) }
  const answer = (request: { id?: number | string; method: string; params?: { protocolVersion?: string } }) => {
    if (request.id === undefined) return
    switch (request.method) {
      case 'initialize':
        reply({ jsonrpc: '2.0', id: request.id, result: { protocolVersion: request.params?.protocolVersion ?? '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'sse-fixture', version: '1.0.0' } } })
        return
      case 'tools/list':
        reply({ jsonrpc: '2.0', id: request.id, result: { tools: [{ name: 'ping', description: 'Replies pong.', inputSchema: { type: 'object' } }] } })
        return
      default:
        reply({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: `unknown method ${request.method}` } })
    }
  }
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    headers.push(request.headers)
    if (request.method === 'GET' && request.url === '/sse') {
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
      response.write('event: endpoint\ndata: /messages\n\n')
      stream = response
      return
    }
    if (request.method === 'POST' && request.url === '/messages') {
      let body = ''
      request.on('data', (chunk: Buffer) => { body += chunk.toString() })
      request.on('end', () => {
        response.writeHead(202).end()
        answer(JSON.parse(body) as Parameters<typeof answer>[0])
      })
      return
    }
    response.writeHead(404).end()
  })
  const address = await new Promise<AddressInfo>((resolve) => { server.listen(0, '127.0.0.1', () => { resolve(server.address() as AddressInfo) }) })
  return {
    url: `http://127.0.0.1:${String(address.port)}/sse`,
    headers,
    close: async () => {
      stream?.end()
      server.closeAllConnections()
      await new Promise<void>((resolve) => { server.close(() => { resolve() }) })
    },
  }
}

const cleanup: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close()
})

/** Connect a client through the transport mcp-client would build and list the tools. */
async function listToolNames(config: Config): Promise<string[]> {
  const client = new Client({ name: 'spec', version: '0.0.0' }, { capabilities: {} })
  await client.connect(createTransport(config))
  cleanup.push(() => client.close())
  return (await client.listTools()).tools.map(tool => tool.name)
}

describe('legacy SSE transport', () => {
  it('accepts an sse config and builds an SSE transport', () => {
    const config = Config({ transport: 'sse', serverName: 'legacy', url: 'http://127.0.0.1:1/sse' })
    expect(config).toMatchObject({ transport: 'sse', headers: {}, failOnStartupError: false })
    // oxlint-disable-next-line typescript/no-deprecated -- asserts the legacy transport is the one built.
    expect(createTransport(config)).toBeInstanceOf(SSEClientTransport)
  })

  it('lists tools from a server over the stream and sends configured headers on every request', async () => {
    const fixture = await startSseFixture()
    cleanup.push(fixture.close)
    const config = Config({ transport: 'sse', serverName: 'legacy', url: fixture.url, headers: { 'X-Team': 'sales' } })
    expect(await listToolNames(config)).toEqual(['ping'])
    expect(fixture.headers.length).toBeGreaterThan(1)
    expect(fixture.headers.every(headers => headers['x-team'] === 'sales')).toBe(true)
  })
})

describe('programmatic auth provider', () => {
  it('keeps the provider by identity through config resolution', () => {
    const authProvider: AuthProvider = { token: () => Promise.resolve('t') }
    for (const transport of ['streamable-http', 'sse'] as const) {
      const config = Config({ transport, serverName: 'web', url: 'http://127.0.0.1:1/mcp', authProvider })
      expect(config.transport === 'stdio' ? undefined : config.authProvider).toBe(authProvider)
    }
    expect(createTransport(Config({ transport: 'streamable-http', serverName: 'web', url: 'http://127.0.0.1:1/mcp', authProvider }))).toBeInstanceOf(StreamableHTTPClientTransport)
  })

  it('authorizes Streamable HTTP requests with the provider token', async () => {
    const fixture: HttpMcpFixture = await startHttpMcpFixture()
    cleanup.push(fixture.close)
    const config = Config({ transport: 'streamable-http', serverName: 'web', url: fixture.url, authProvider: { token: () => Promise.resolve('secret-token') } })
    expect(await listToolNames(config)).toEqual(['ping'])
    expect(fixture.authorization).toContain('Bearer secret-token')
  })

  it('authorizes SSE requests with the provider token', async () => {
    const fixture = await startSseFixture()
    cleanup.push(fixture.close)
    const config = Config({ transport: 'sse', serverName: 'legacy', url: fixture.url, authProvider: { token: () => Promise.resolve('sse-token') } })
    expect(await listToolNames(config)).toEqual(['ping'])
    expect(fixture.headers.every(headers => headers.authorization === 'Bearer sse-token')).toBe(true)
  })
})
