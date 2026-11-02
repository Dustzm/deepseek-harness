# TONGDO_CHANGES

通办在本衍生仓库里相对上游 DSH 的全部改动。每次吸收上游（`sync/<上游版本>` 分支整版 merge）后逐项复核：上游已提供同等能力的，删掉通办的改动并在核心仓库改用上游接口。

改动只限三类：桌面壳（产品身份、打包、登录引导）、等不到官方修复的内核缺陷、通用扩展接口（DSH 缺的换肤与覆盖接口，按 DSH 自身风格实现，不含通办业务逻辑）。

| 改动 | 类别 | 位置 | 原因 | 能否去掉 |
|---|---|---|---|---|
| 文案覆盖层 `ctx.locale.overrideTexts(source, texts)` | 通用扩展接口 | `packages/client/locale`（实现、测试 `tests/text-overrides.client.spec.ts`、中英 README） | DSH 的文案字典每个「命名空间 + 语言」只能注册一次，下游无法替换个别文案；与 `theme.overrideTokens` 对称补齐文案层 | 上游提供等价的文案覆盖接口后可去掉 |
| 组件覆盖层 `ctx.slots.overrideComponent(source, target, component)` | 通用扩展接口 | `packages/client/ui-renderer`（`src/client/component-overrides.ts`、渲染器三处条目渲染、`registry.ts`、测试 `tests/component-overrides.client.spec.tsx`、中英 README） | DSH 的结构节点（窗口外框、侧栏、会话头、输入框外壳）只能整行替换，替换后要重写其注入数据与子扩展位授权；覆盖层只换组件，保留原注册的数据与授权，与 `overrideTokens`、`overrideTexts` 对称 | 上游提供等价的组件覆盖接口后可去掉 |
| 首次使用工作区的存放目录 `workspace-controller` 配置 `defaultWorkspaceRoot` | 通用扩展接口 | `packages/api/workspace-controller`（`src/default-directory.ts`、`src/index.ts`、测试、中英 README） | DSH 把首次使用工作区固定放在 `<文稿>/deepseek-harness/default-workspace`，下游无法改掉路径里的产品名；新增可选根目录，未设置时行为不变 | 上游提供等价配置后可去掉 |
| 首页 hero 新增扩展位 `conversation.hero.subtitle`、`conversation.hero.footer`；`hero.preview` 为空时不渲染预览角标 | 通用扩展接口 | `packages/client/ui-conversation`（`contract/slots.ts`、`apply.ts`、`EmptyHero.tsx`、`ConversationContent.tsx`、测试、中英 README） | hero 在 `conversation.content` Factory 内部，标题下与输入框下没有扩展位，下游加不了问候语、快捷入口与最近任务；预览角标无法去掉 | 上游提供等价扩展位后可去掉 |
| 会话列表默认分组方式 `ctx.uiWorkspace.setDefaultGroupBy(mode)` | 通用扩展接口 | `packages/client/ui-workspace`（`stores.ts` 的 `groupByChosen` 与 `followDefaultGroupBy`、`navigation.ts`、测试、中英 README） | 分组方式是浏览器本地视图状态，默认固定为按工作区，下游无法改起始值；客户端插件也拿不到配置行 | 上游提供等价默认值接口后可去掉 |
| 工具调用行尾操作扩展位 `tool.call.row.action` | 通用扩展接口 | `packages/client/ui-tool`（`contract/slots.ts`、`apply.ts`、`ToolCallTree.tsx` 与样式、测试、中英 README） | 通用工具行与各内置工具视图不是可扩展的行，下游无法给失败的调用加「重试」这类行内操作；新增 list 扩展位，空列表时布局不变 | 上游提供等价扩展位后可去掉 |

## 核心仓库如何使用这些改动

核心仓库（`TongDo/`）通过 `pnpm-workspace.yaml` 的 `overrides` 把对应的 `@deepseek-ai/*` 包指向本仓库的构建结果，并在 `UPSTREAM.md` 登记。私有 registry 就绪前，核心仓库的 `pnpm fork:pack` 会在本仓库跑 `build:artifacts`，再把改过的包 `pnpm pack` 成 tarball 供它安装；就绪后改为发布版本 `<上游版本>-tongdo.<N>`。
