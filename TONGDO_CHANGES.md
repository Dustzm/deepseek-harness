# TONGDO_CHANGES

通办在本衍生仓库里相对上游 DSH 的全部改动。每次吸收上游（`sync/<上游版本>` 分支整版 merge）后逐项复核：上游已提供同等能力的，删掉通办的改动并在核心仓库改用上游接口。

改动只限三类：桌面壳（产品身份、打包、登录引导）、等不到官方修复的内核缺陷、通用扩展接口（DSH 缺的换肤与覆盖接口，按 DSH 自身风格实现，不含通办业务逻辑）。

| 改动 | 类别 | 位置 | 原因 | 能否去掉 |
|---|---|---|---|---|
| 文案覆盖层 `ctx.locale.overrideTexts(source, texts)` | 通用扩展接口 | `packages/client/locale`（实现、测试 `tests/text-overrides.client.spec.ts`、中英 README） | DSH 的文案字典每个「命名空间 + 语言」只能注册一次，下游无法替换个别文案；与 `theme.overrideTokens` 对称补齐文案层 | 上游提供等价的文案覆盖接口后可去掉 |

## 核心仓库如何使用这些改动

核心仓库（`TongDo/`）通过 `pnpm-workspace.yaml` 的 `overrides` 把对应的 `@deepseek-ai/*` 包指向本仓库的构建结果，并在 `UPSTREAM.md` 登记。私有 registry 就绪前，核心仓库的 `pnpm fork:pack` 会在本仓库跑 `build:artifacts`，再把改过的包 `pnpm pack` 成 tarball 供它安装；就绪后改为发布版本 `<上游版本>-tongdo.<N>`。
