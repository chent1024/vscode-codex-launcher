# Open Codex 扩展计划文档

## 文档目的

本文档用于记录 `open_codex` 当前扩展实现、已经完成的范围、发布前现状，以及后续迭代计划。

这份文档已经从早期“开发方案”更新为“当前状态 + 后续计划”，避免继续沿用与现状不一致的初版设计。

## 当前项目定位

`Open Codex` 是一个极简的 VS Code 扩展启动器。

主能力只有一条：

- 通过 VS Code 扩展入口触发 OpenAI ChatGPT 扩展的 `chatgpt.newCodexPanel` 命令，打开一个新的 Codex 会话

项目明确不负责：

- 自定义聊天 UI
- 管理 Codex 会话历史
- 读写 Codex 内部存储
- 构造私有 URI 打开聊天窗口
- 替代 OpenAI 官方扩展

## 当前实现状态

### 已完成

- 已实现命令 `codexLauncher.openNewCodexChat`
- 已实现对 `openai.chatgpt` 扩展的检测、激活和命令可用性检查
- 已实现标准错误码与用户提示
- 已接入 `OutputChannel` 日志
- 已提供 Activity Bar 容器与欢迎文案入口
- 已补齐发布所需基础元数据：
  - `publisher`
  - `repository`
  - `homepage`
  - `bugs`
  - `icon`
  - `CHANGELOG.md`
  - `LICENSE.txt`
- 已通过：
  - `npm run lint`
  - `npm run build`
  - `npm test`
  - `npx @vscode/vsce package`

### 当前 UI 形态

当前扩展并不是“点击 Activity Bar 图标直接执行命令”。

原因：

- VS Code 的 Activity Bar 图标本质上是 `View Container`
- 点击行为是展开容器，而不是直接执行任意命令

因此当前采用的方案是：

- 提供一个 `Open Codex` 的 Activity Bar 容器
- 在该容器内提供欢迎文案和 `Open New Codex` 命令链接

这属于 VS Code 官方能力范围内最稳定的实现方式之一。

## 当前关键文件

### `package.json`

负责：

- 扩展基础元数据
- 命令贡献
- Activity Bar 容器注册
- View 注册
- `viewsWelcome` 欢迎入口

### `src/extension.ts`

负责：

- 创建输出通道
- 注册主命令
- 创建树视图
- 串联运行入口

### `src/codexBridge.ts`

负责：

- 查找 `openai.chatgpt`
- 激活目标扩展
- 检查命令列表
- 执行 `chatgpt.newCodexPanel`

### `src/compat.ts`

负责：

- 兼容性检查
- 环境状态标准化
- 在真正打开前收敛失败原因

### `src/messages.ts`

负责：

- 错误提示文案

### `src/logger.ts`

负责：

- `OutputChannel` 日志包装
- 错误元数据序列化

### `src/sidebarActionView.ts`

负责：

- 最小树视图实现
- 当前不提供实际树节点，仅用于承接欢迎文案视图

## 当前命令与标识

### 扩展元数据

- 扩展名：`Open Codex`
- 扩展包名：`open-codex`
- 版本：`0.0.1`
- 发布者：以 `package.json` 当前值为准

### 命令

- `codexLauncher.openNewCodexChat`

### 依赖的外部扩展能力

- 扩展 ID：`openai.chatgpt`
- 命令 ID：`chatgpt.newCodexPanel`

## 运行流程

### 正常流程

1. 用户通过欢迎页链接或命令面板触发 `Open New Codex Chat`
2. 扩展查找 `openai.chatgpt`
3. 如有需要，激活目标扩展
4. 检查 `chatgpt.newCodexPanel` 是否存在
5. 执行命令打开新的 Codex 窗口
6. 输出成功日志

### 失败流程

1. 如果未安装 `openai.chatgpt`，返回 `CODEX_NOT_INSTALLED`
2. 如果激活失败，返回 `CODEX_ACTIVATION_FAILED`
3. 如果命令缺失，返回 `CODEX_COMMAND_MISSING`
4. 如果命令执行失败，返回 `CODEX_COMMAND_EXEC_FAILED`
5. 用户通过错误提示和 `Open Codex` 输出通道排查问题

## 当前限制

- 不保证新会话一定进入 Codex 历史
- 不保证兼容未来所有版本的 OpenAI 扩展
- 当前 UI 依赖 `viewsWelcome` 链接，不是“纯点击图标即执行”
- 当前尚未做真实 Marketplace 发布验证，只完成了本地打包验证

## 已知发布状态

### 已完成的发布准备

- README 已移除阻塞发布的 SVG 引用
- 已生成 PNG Marketplace 图标
- `vsce package` 已成功
- `.vsix` 已可本地安装验证

### 待完成的发布动作

- 使用真实发布者账号完成 `vsce login`
- 通过 CLI 执行 `vsce publish`
- 在 Marketplace 页面确认扩展展示效果

## 后续计划

### P0：正式发布

- 用真实 PAT 完成 `vsce login`
- 发布 `0.0.1`
- 验证 Marketplace 展示页
- 重新安装线上版本做一次回归

完成标准：

- 扩展可在 Marketplace 检索
- Marketplace 页面图标、README、版本号正常
- 用户可直接安装

### P1：交互一致性收敛

- 重新评估当前 Activity Bar 交互是否足够直观
- 如有必要，优化欢迎页文案，使其更像单一启动器
- 评估是否要增加更明确的“仅一个动作”提示

完成标准：

- 用户首次打开扩展时，不会误以为这里有完整侧边栏功能

### P2：故障排查体验增强

- 为常见错误增加更明确的操作建议
- 评估是否增加“打开输出日志”快捷入口
- 评估是否增加“安装/启用 OpenAI ChatGPT 扩展”的引导文案

完成标准：

- 缺依赖或不兼容时，用户无需看源码即可知道下一步操作

### P3：兼容性观察

- 在不同版本 VS Code 下回归
- 在不同版本 `openai.chatgpt` 扩展下回归
- 观察 `chatgpt.newCodexPanel` 命令是否保持稳定

完成标准：

- 形成一份版本兼容性观察结论

## 测试计划

### 自动化

- 保持当前 `vitest` 单元测试通过
- 发布前固定执行：
  - `npm run lint`
  - `npm run build`
  - `npm test`
  - `npx @vscode/vsce package`

### 手工验证

- 安装 OpenAI ChatGPT 扩展时，可成功打开 Codex 会话
- 未安装目标扩展时，错误提示正确
- 命令缺失时，错误提示正确
- `Open Codex` 输出通道可查看错误日志
- 安装 `.vsix` 后，扩展展示名、图标、README 均正确

## 文档维护规则

- 如果扩展入口形态发生变化，必须同步更新本文档的“当前 UI 形态”
- 如果扩展核心命令或依赖扩展 ID 发生变化，必须同步更新“当前命令与标识”
- 如果 Marketplace 发布策略发生变化，必须同步更新“已知发布状态”和“后续计划”

## 最终结论

当前 `Open Codex` 已经不是“待设计”的状态，而是：

- 功能实现完成
- 本地打包通过
- 可进入正式发布阶段

因此后续文档重点应从“如何开发”转为：

- 如何稳定发布
- 如何提升用户体验
- 如何跟踪上游扩展兼容性
