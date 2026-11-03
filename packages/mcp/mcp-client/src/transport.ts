/**
 * Transport factory: creates the appropriate MCP transport based on the
 * plugin's resolved config. Stdio spawns a child process (with credential
 * scrubbing); Streamable HTTP and legacy SSE connect to a URL, carrying the
 * optional programmatic auth provider.
 *
 * @module
 */

import type { Transport } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { SSEClientTransport, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { scrubbedParentEnv } from '@deepseek-ai/dsh-subprocess'
import type { Config } from './index.ts'

/**
 * The subprocess seam's scrubbed parent env (credential-shaped and stale
 * `DSH_*` names dropped), plus the spec's explicit env. The MCP SDK owns the
 * actual spawn, so this transport shares the scrub definition rather than the
 * spawn path.
 */
function buildChildEnv(extra: Record<string, string>): Record<string, string> {
  return { ...scrubbedParentEnv(), ...extra }
}

/**
 * Create an MCP transport from the resolved plugin config.
 *
 * @param config - Resolved plugin config discriminated on `transport`.
 * @returns A connected-ready MCP Transport (stdio, Streamable HTTP or SSE).
 */
export function createTransport(config: Config): Transport {
  switch (config.transport) {
    case 'stdio':
      return new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: buildChildEnv(config.env),
        cwd: config.cwd,
      })
    case 'streamable-http':
      return new StreamableHTTPClientTransport(new URL(config.url), {
        requestInit: { headers: config.headers },
        ...config.authProvider === undefined ? {} : { authProvider: config.authProvider },
      })
    case 'sse':
      // oxlint-disable-next-line typescript/no-deprecated -- the legacy transport exists to reach servers that never migrated off HTTP+SSE.
      return new SSEClientTransport(new URL(config.url), {
        requestInit: { headers: config.headers },
        ...config.authProvider === undefined ? {} : { authProvider: config.authProvider },
      })
  }
}
