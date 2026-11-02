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
| 工具调用行尾操作扩展位 `tool.call.row.action` | 通用扩展接口 | `packages/client/ui-tool`（`contract/slots.ts`、`apply.ts`、`ToolCallTree.tsx` 与样式、`tool-call-model.ts` 的 `toolRowHeadline`、测试、中英 README） | 通用工具行与各内置工具视图不是可扩展的行，下游无法给失败的调用加「重试」这类行内操作；新增 list 扩展位，空列表时布局不变 | 上游提供等价扩展位后可去掉 |
| Web 构建的产品标识：`DSH_CLIENT_TITLE`、`DSH_CLIENT_SHORT_TITLE` 写进 Web manifest，`DSH_CLIENT_ICON`、`DSH_CLIENT_ICON_DARK` 替换 favicon | 桌面壳（产品身份） | `apps/web`（`product-identity.ts`、`vite.config.ts`、测试 `tests/product-identity.spec.ts`）、`docs/development.md` 中英 | DSH 只把构建期标题写进页面 `<title>`，manifest 名称与 favicon 写死为 DeepSeek Harness，下游换不了产品名与图标；新增的变量未设置时产物不变，品牌内容由调用方在构建时传入 | 上游提供等价的构建期产品标识后可去掉 |
| 启动页品牌：构建期变量 `DSH_CLIENT_BOOT_MARK`、`DSH_CLIENT_BOOT_MARK_DARK`、`DSH_CLIENT_BOOT_HINT` 写成页面元数据，启动页据此用指定标志取代字标与 spinner、替换或隐藏提示 | 桌面壳（产品身份） | `apps/web/product-identity.ts`、`packages/client/web`（`boot-page.ts` 与样式、测试、中英 README）、`docs/development.md` 中英 | 启动页写死「HARNESS」字标与英文提示，在插件加载前绘制，插件改不了；未设置时启动页不变 | 上游提供等价的启动页品牌接口后可去掉 |
| 输入框上下文占用按钮可被认领：`ctx.uiConversation.claimContextMeter()` | 通用扩展接口 | `packages/client/ui-conversation`（`conversation/assembly.ts`、`apply.ts`、`contract/slots.ts`、`InputBar.tsx`、测试、中英 README） | 占用按钮写死在输入卡片下方、不经扩展位，浏览器端插件也拿不到 cordis.yml 的配置，下游把占用率放进别的控件（如模型选择器右侧的 `conversation.input.activity`）时无法去掉原按钮；认领随调用方 fiber 释放，没有认领时行为不变 | 上游提供等价接口或把按钮改为扩展位条目后可去掉 |
| 输入框模型选择器右侧的状态扩展位 `conversation.input.status` | 通用扩展接口 | `packages/client/ui-conversation`（`contract/slots.ts`、`apply.ts`、`InputBar.tsx`、测试、中英 README） | 模型选择器与发送键之间只有 single 的 `conversation.input.activity`，它是可展开整条工具栏的活动位，下游的占用率之类状态读数放进去会与真正的活动占用方冲突；新增 list 扩展位，活动展开时与辅助控件一起隐藏，空列表时布局不变 | 上游提供等价扩展位后可去掉 |

## 核心仓库如何使用这些改动

核心仓库（`TongDo/`）通过 `pnpm-workspace.yaml` 的 `overrides` 把对应的 `@deepseek-ai/*` 包指向本仓库的构建结果，并在 `UPSTREAM.md` 登记。私有 registry 就绪前，核心仓库的 `pnpm fork:pack` 会在本仓库跑 `build:artifacts`，再把改过的包 `pnpm pack` 成 tarball 供它安装；就绪后改为发布版本 `<上游版本>-tongdo.<N>`。
