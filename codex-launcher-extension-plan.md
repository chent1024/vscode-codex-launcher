# Codex Launcher 扩展开发方案

## 目标

该扩展只做一个主能力：

- 用户点击扩展入口后，直接打开一个新的 `openai-codex` 聊天窗口

附带结果：

- 新会话尽量自然出现在 Codex 扩展内部历史中
- 但这不是扩展承诺的强保证能力

## 不做范围

第一版明确不做以下内容：

- 不自定义聊天 UI
- 不自定义编辑器
- 不自己保存 session
- 不读取或改写 Codex 扩展内部数据
- 不和 Codex 历史做双向同步
- 不依赖 `openai-codex:` 私有 URI 直接构造聊天窗口

## 已确认的本机前提

基于本机已安装的 `openai.chatgpt-0.4.76` 扩展，当前可依赖事实如下：

- Codex 扩展存在命令 `chatgpt.newCodexPanel`
- 该命令用于打开新的 Codex 会话窗口
- 该会话属于 `openai-codex` 体系
- 是否自动进入 Codex 历史，由 Codex 扩展内部实现决定

因此，该扩展应定位为一个很薄的桥接启动器，而不是聊天容器本身。

## 产品定义

### 核心功能

- 提供命令 `Open New Codex Chat`
- 调用 Codex 扩展打开新的聊天窗口

### 非强保证结果

- 如果 Codex 扩展内部会自动记录新建会话，则该会话会出现在其历史中
- 如果 Codex 扩展内部只在首条消息发送后记录历史，则是否出现由 Codex 自己决定

## 用户流程

### 正常流程

1. 用户点击 `Open New Codex Chat`
2. 扩展检查 `openai.chatgpt` 是否安装
3. 若未激活，则先激活该扩展
4. 检查命令 `chatgpt.newCodexPanel` 是否可用
5. 调用该命令
6. 成功打开新的 Codex 聊天窗口

### 失败流程

1. 若未安装 Codex 扩展，则提示用户安装
2. 若激活失败，则提示用户重载 VS Code 或检查扩展状态
3. 若命令缺失，则提示当前 Codex 版本不兼容
4. 若命令执行失败，则提示打开失败并附带错误摘要

## 扩展定位

该扩展本质上是：

- `Codex Launcher`

而不是：

- 聊天窗口实现者
- 会话存储实现者
- Codex 历史管理者

## 技术方案

### 主链路

主链路只做公开可见的 VS Code 扩展调用：

- `vscode.extensions.getExtension('openai.chatgpt')`
- `extension.activate()`
- `vscode.commands.getCommands(true)`
- `vscode.commands.executeCommand('chatgpt.newCodexPanel')`

### 模块划分

建议只保留 4 个模块：

1. `extension`
   - 注册命令
   - 注册 UI 入口

2. `codexBridge`
   - 查找 Codex 扩展
   - 激活 Codex 扩展
   - 调用 `chatgpt.newCodexPanel`

3. `compat`
   - 扩展可用性检查
   - 命令存在性检查

4. `messages`
   - 用户提示文案
   - 错误提示文案

## 命令设计

### 正式命令

- `yourExt.openNewCodexChat`
  - 标题：`Open New Codex Chat`

### 可选调试命令

- `yourExt.checkCodexAvailability`
  - 标题：`Check Codex Availability`

第一版建议只把前者暴露给普通用户。

## 建议的扩展清单

以下命名可以直接作为实现默认值使用。

### 基础信息

- 扩展显示名：`Codex Launcher`
- 扩展 ID：`codex-launcher`
- 发布者占位：`your-publisher`
- 主命令 ID：`codexLauncher.openNewCodexChat`
- 调试命令 ID：`codexLauncher.checkCodexAvailability`

### package.json 最小建议值

- `name`: `codex-launcher`
- `displayName`: `Codex Launcher`
- `description`: `Open a new Codex chat window from a lightweight VS Code extension bridge.`
- `version`: `0.0.1`
- `engines.vscode`: 建议不低于 `^1.96.0`
- `categories`:
  - `Other`
  - `Chat`

### activationEvents

- `onCommand:codexLauncher.openNewCodexChat`
- 如果实现调试命令，再加：
  - `onCommand:codexLauncher.checkCodexAvailability`

### contributes.commands

- `codexLauncher.openNewCodexChat`
  - 标题：`Open New Codex Chat`
  - 分类：`Codex Launcher`

- `codexLauncher.checkCodexAvailability`
  - 标题：`Check Codex Availability`
  - 分类：`Codex Launcher`
  - 第一版可隐藏，不一定放到面向用户的 README

### 状态栏入口

如果要做状态栏入口，建议：

- 文案：`Codex`
- tooltip：`Open New Codex Chat`
- 点击行为：执行 `codexLauncher.openNewCodexChat`
- 展示策略：始终展示，除非你后续希望仅在工作区打开时显示

## UI 入口建议

第一版建议保留最多 2 个入口：

- 命令面板入口
- 状态栏入口

不建议第一版就增加：

- 编辑器标题栏入口
- 文件树右键入口
- 欢迎页入口
- 自定义侧边栏容器

原因是第一版功能极小，入口过多只会增加维护成本。

## 兼容性规则

运行时按如下顺序检查：

1. 是否安装 `openai.chatgpt`
2. 是否能成功激活该扩展
3. 是否存在命令 `chatgpt.newCodexPanel`
4. 是否能成功执行该命令

建议定义统一错误码：

- `CODEX_NOT_INSTALLED`
- `CODEX_ACTIVATION_FAILED`
- `CODEX_COMMAND_MISSING`
- `CODEX_COMMAND_EXEC_FAILED`

## 兼容性边界

第一版建议把兼容性策略写死，避免实现时反复摇摆。

### 支持目标

- 支持稳定版 VS Code
- 支持本机已安装的 `openai.chatgpt` 扩展
- 主路径只依赖命令 `chatgpt.newCodexPanel`

### 不做兼容承诺

- 不承诺兼容所有历史版本的 Codex 扩展
- 不承诺兼容未来改名后的 Codex 命令
- 不承诺打开后一定出现在 Codex 历史

### 建议的运行策略

- 先检测扩展是否存在
- 再检测命令是否存在
- 只要 `chatgpt.newCodexPanel` 存在，就认为该环境可用
- 若命令不存在，则直接判定当前 Codex 版本不兼容

### 版本记录建议

在 README 或调试输出中记录如下信息：

- 当前 VS Code 版本
- 检测到的 `openai.chatgpt` 版本
- `chatgpt.newCodexPanel` 是否存在

## package.json 设计建议

最小贡献项建议如下：

- `activationEvents`
  - `onCommand:yourExt.openNewCodexChat`

- `contributes.commands`
  - 注册 `yourExt.openNewCodexChat`

- `contributes.menus`
  - 仅保留命令面板入口

如果做状态栏入口，则由运行时注册 `StatusBarItem`，不需要额外复杂贡献点。

## 执行流程

建议把运行逻辑固定为单一路径，不设计多分支业务逻辑。

### 主流程

1. 用户触发 `codexLauncher.openNewCodexChat`
2. 进入 `openNewCodexChat()`
3. 调用 `findCodexExtension()`
4. 若未找到，则显示安装提示并结束
5. 调用 `activateCodexExtension()`
6. 若激活失败，则显示激活失败提示并结束
7. 调用 `ensureCodexCommandAvailable('chatgpt.newCodexPanel')`
8. 若命令不存在，则显示版本不兼容提示并结束
9. 调用 `executeCommand('chatgpt.newCodexPanel')`
10. 若执行成功，则结束
11. 若执行失败，则显示失败提示并记录日志

### 建议的函数划分

- `openNewCodexChat(): Promise<void>`
- `findCodexExtension(): Extension | undefined`
- `activateCodexExtension(extension): Promise<void>`
- `getAllCommands(): Promise<string[]>`
- `ensureCodexCommandAvailable(commandId): Promise<boolean>`
- `launchCodexChat(): Promise<void>`
- `showUserFacingError(errorCode, details?): Promise<void>`
- `logDebug(eventName, payload?): void`

### 建议的伪代码

```text
openNewCodexChat
  log start
  extension = findCodexExtension
  if no extension
    show CODEX_NOT_INSTALLED
    return

  try activate extension
  catch
    show CODEX_ACTIVATION_FAILED
    return

  commands = getAllCommands
  if "chatgpt.newCodexPanel" not in commands
    show CODEX_COMMAND_MISSING
    return

  try execute "chatgpt.newCodexPanel"
    log success
  catch
    show CODEX_COMMAND_EXEC_FAILED
```

## 实现约束

必须遵守：

- 只使用公开的 VS Code 扩展 API
- 只把 Codex 扩展当作被调用方
- 对 Codex 内部数据结构零假设

必须避免：

- 不拼接私有 URI 来伪造 Codex 聊天页
- 不调用 Codex 扩展私有对象或内部类
- 不读取 Codex 扩展内部 session 存储
- 不承诺“打开即必定进入 Codex 历史”

## 错误处理矩阵

建议在实现前把错误行为固定，避免后续 UI 和逻辑分离。

| 错误码 | 触发条件 | 用户提示 | 日志内容 | 建议动作 |
|------|------|------|------|------|
| `CODEX_NOT_INSTALLED` | 未找到 `openai.chatgpt` 扩展 | `未检测到 Codex 扩展，请先安装 OpenAI Codex 扩展。` | 扩展未安装 | 可附带“打开扩展市场搜索” |
| `CODEX_ACTIVATION_FAILED` | `extension.activate()` 抛错 | `Codex 扩展激活失败，请尝试重载 VS Code。` | 激活异常摘要 | 可附带“Reload Window”建议 |
| `CODEX_COMMAND_MISSING` | 命令列表中没有 `chatgpt.newCodexPanel` | `当前 Codex 扩展版本不支持打开新聊天窗口。` | 缺少命令 | 建议升级 Codex 扩展 |
| `CODEX_COMMAND_EXEC_FAILED` | `executeCommand` 抛错 | `打开 Codex 聊天窗口失败，请稍后重试。` | 执行异常摘要 | 可建议查看输出面板 |

### 提示方式建议

- 主提示用 `window.showErrorMessage`
- 调试日志写入 `OutputChannel`
- 不建议第一版引入通知风暴或复杂弹窗链路

### 可选按钮建议

- `Install Codex`
- `Reload Window`
- `Open Output`

第一版可先不做按钮，只保留清晰文案。

## 日志与调试

建议保留最小调试日志：

- 是否找到 `openai.chatgpt`
- 是否成功激活
- 是否发现 `chatgpt.newCodexPanel`
- 是否成功执行打开命令
- 错误摘要

第一版不引入遥测，只做本地输出即可。

### OutputChannel 建议

- 名称：`Codex Launcher`
- 每次执行记录：
  - 开始时间
  - VS Code 版本
  - 是否找到 Codex 扩展
  - Codex 扩展版本
  - 是否存在目标命令
  - 执行结果

### 日志级别建议

- `info`
  - 检测成功
  - 激活成功
  - 命令执行成功

- `warn`
  - 扩展未安装
  - 命令缺失

- `error`
  - 激活失败
  - 命令执行失败

## 验收标准

### 必须通过

- 安装 Codex 扩展时，执行命令可以打开新的 Codex 聊天窗口
- 未安装 Codex 扩展时，能给出明确提示
- 命令缺失或执行失败时，能给出明确提示

### 可观察但不阻塞

- 新开的聊天窗口是否进入 Codex 历史

## 测试清单

实现时建议按以下清单逐项手工验证。

### 基础场景

- 已安装 Codex 扩展，执行命令成功打开新聊天窗口
- 连续执行两次命令，可连续打开两个新窗口
- 状态栏入口点击行为与命令面板一致

### 异常场景

- 未安装 Codex 扩展时，能看到明确错误提示
- Codex 扩展被禁用时，行为等同于未安装或激活失败
- Codex 扩展激活失败时，错误提示准确
- `chatgpt.newCodexPanel` 缺失时，提示当前版本不兼容
- `executeCommand` 抛错时，错误提示准确且日志可见

### 可观察场景

- 打开新聊天窗口后，是否出现在 Codex 历史中
- 打开窗口后关闭 VS Code，再打开 Codex，历史是否保留

### 回归场景

- 升级你的扩展后，主命令仍可用
- 升级 Codex 扩展后，桥接命令仍可用

## 迭代顺序

1. 完成命令面板打开新 Codex 聊天窗口
2. 增加状态栏入口
3. 增加可用性检查命令
4. 打磨错误提示与日志
5. 如确有必要，再评估“带上下文打开”能力

## 逐文件实现清单

可以直接按下面的结构编码。

### `src/extension.ts`

负责：

- 创建 `OutputChannel`
- 注册 `codexLauncher.openNewCodexChat`
- 可选注册 `codexLauncher.checkCodexAvailability`
- 可选创建 `StatusBarItem`

### `src/codexBridge.ts`

负责：

- 查找 `openai.chatgpt`
- 激活目标扩展
- 查询命令是否存在
- 执行 `chatgpt.newCodexPanel`

### `src/compat.ts`

负责：

- 统一判断运行环境是否满足要求
- 返回标准化错误码
- 统一收敛兼容性检查结果

### `src/messages.ts`

负责：

- 错误提示文案
- 成功提示文案
- 可选按钮文案

### `src/logger.ts`

负责：

- 包装 `OutputChannel`
- 输出 `info/warn/error`
- 统一日志格式

## 实施任务清单

以下任务顺序可以直接作为开发顺序使用。

### 阶段 1：项目骨架

#### 任务 1.1 初始化扩展工程

- 创建基础 VS Code 扩展项目
- 写入最小 `package.json`
- 配置 TypeScript 构建
- 保证可以本地启动 Extension Development Host

完成标准：

- 扩展可被 VS Code 成功加载
- 命令面板中至少能看到 `Open New Codex Chat`

#### 任务 1.2 注册主命令

- 注册 `codexLauncher.openNewCodexChat`
- 暂时用占位实现返回提示

完成标准：

- 触发命令后能看到占位提示
- 无报错，无激活异常

### 阶段 2：桥接主链路

#### 任务 2.1 实现 Codex 扩展查找

- 实现 `findCodexExtension()`
- 只检查 `openai.chatgpt`
- 若不存在，返回 `CODEX_NOT_INSTALLED`

完成标准：

- 已安装环境下能识别到扩展
- 未安装环境下能稳定返回未安装结果

#### 任务 2.2 实现扩展激活

- 实现 `activateCodexExtension()`
- 包装激活异常
- 失败时映射到 `CODEX_ACTIVATION_FAILED`

完成标准：

- 正常环境可成功激活
- 激活失败时可被上层正确捕获

#### 任务 2.3 实现命令存在性检查

- 实现 `ensureCodexCommandAvailable('chatgpt.newCodexPanel')`
- 使用 `commands.getCommands(true)`
- 若缺失，映射为 `CODEX_COMMAND_MISSING`

完成标准：

- 目标命令存在时返回成功
- 目标命令缺失时返回标准错误

#### 任务 2.4 实现新聊天窗口打开

- 实现 `launchCodexChat()`
- 调用 `executeCommand('chatgpt.newCodexPanel')`
- 执行异常映射到 `CODEX_COMMAND_EXEC_FAILED`

完成标准：

- 正常环境可打开新 Codex 窗口
- 执行失败时返回标准错误

#### 任务 2.5 串联主流程

- 在 `openNewCodexChat()` 中串联：
  - 查找扩展
  - 激活扩展
  - 检查命令
  - 执行打开

完成标准：

- 主命令从点击到打开完整跑通
- 所有错误路径都能被覆盖

### 阶段 3：用户提示与日志

#### 任务 3.1 实现错误提示映射

- 在 `messages.ts` 中收敛错误文案
- 针对 4 类错误输出固定提示

完成标准：

- 每种错误只有一套固定文案
- 用户看到的文案简洁且可执行

#### 任务 3.2 实现 OutputChannel

- 创建 `Codex Launcher` 输出通道
- 记录关键步骤和异常摘要

完成标准：

- 每次执行都有完整日志链路
- 出错时能看到错误摘要

#### 任务 3.3 增加成功日志

- 在成功路径记录：
  - 检测到的 Codex 版本
  - 命令可用性
  - 打开成功

完成标准：

- 成功和失败路径都有日志

### 阶段 4：入口打磨

#### 任务 4.1 命令面板入口完成

- 校验命令标题和分类
- 确保命令易搜索

完成标准：

- 在命令面板输入 `Codex` 可快速找到命令

#### 任务 4.2 增加状态栏入口

- 创建状态栏按钮
- 点击执行主命令
- 配置 tooltip

完成标准：

- 状态栏入口可见
- 点击效果与命令面板一致

#### 任务 4.3 可选增加调试命令

- 注册 `codexLauncher.checkCodexAvailability`
- 输出检查结果但不打开窗口

完成标准：

- 可单独验证环境兼容性

### 阶段 5：回归验证

#### 任务 5.1 手工测试主场景

- 已安装 Codex 扩展
- 未安装 Codex 扩展
- 命令缺失
- 命令执行失败

完成标准：

- 所有场景与预期一致

#### 任务 5.2 观察历史行为

- 记录新开的聊天窗口是否进入 Codex 历史
- 若进入，记录触发时机
- 若未进入，也不作为阻塞项

完成标准：

- 得到一份历史行为观察结论

## 开发顺序建议

如果要压缩开发时间，建议严格按以下顺序推进：

1. `extension.ts` 注册命令
2. `codexBridge.ts` 跑通打开能力
3. `messages.ts` 固定错误提示
4. `logger.ts` 接入输出日志
5. 状态栏入口
6. 调试命令
7. 手工测试与 README

## 每日可交付里程碑

如果按很小步快跑开发，建议按以下里程碑推进。

### 里程碑 A

- 扩展能加载
- 命令能触发
- 占位提示可见

### 里程碑 B

- 能成功找到并激活 Codex 扩展
- 能识别 `chatgpt.newCodexPanel`

### 里程碑 C

- 命令可真正打开新的 Codex 聊天窗口

### 里程碑 D

- 错误提示和日志完善
- 状态栏入口可用

### 里程碑 E

- README 和发布材料准备完成

## Definition of Done

下面这些条件同时满足，才算第一版完成：

- 主命令可在稳定场景打开新的 Codex 聊天窗口
- 状态栏入口可用，且行为一致
- 四类标准错误均有明确提示
- 输出日志可用于排查问题
- README 明确写出依赖与限制
- 已完成手工测试清单

## README 编写清单

另开项目后，README 建议至少包含以下内容：

- 项目简介
- 安装方式
- 依赖前提：需要安装 Codex 扩展
- 使用方法：如何打开新 Codex 聊天窗口
- 已知限制：不保证历史记录行为
- 排障说明：如何查看 `Codex Launcher` 输出日志

## 后续增强任务池

这些内容不要进入第一版排期，但可以作为后续 backlog。

- 提供“检测并打开扩展市场”按钮
- 提供“Reload Window”快捷操作
- 启动前记录当前工作区信息到日志
- 启动后观察是否可安全附加上下文能力
- 增加更明确的 Codex 扩展版本兼容提示

## 发布策略

### 内部使用

如果只是自己或团队内部使用，建议：

- 直接打包成 VSIX
- 不做复杂品牌包装
- README 简洁说明依赖 `openai.chatgpt`

### 公开发布

如果准备公开发布，建议补齐：

- README
- 图标
- Marketplace 描述
- 已知限制说明
- 免责声明：该扩展依赖 OpenAI Codex 扩展，且兼容性取决于其公开命令是否保持稳定

### README 最少应说明

- 安装前提：必须安装 Codex 扩展
- 功能边界：只负责打开新 Codex 聊天窗口
- 已知限制：不保证历史记录行为
- 故障排查：如何查看 `Codex Launcher` 输出日志

## 后续可选增强

这些能力不进入第一版范围，只作为后续评估项：

- 打开新 Codex 窗口后，尝试附带当前文件上下文
- 为不同工作区显示不同入口文案
- 在命令执行前检测 Codex 扩展版本并给出更精确的兼容提示

## 最终结论

该扩展的主实现应极度收敛为：

- 一个调用 `chatgpt.newCodexPanel` 的桥接扩展

主承诺能力只有一条：

- 点击后，打开新的 Codex 聊天窗口

而“出现在 Codex 内部历史中”仅作为顺带收益观察，不写成功能承诺。
