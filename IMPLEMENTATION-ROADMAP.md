# Gemini Nexus 功能增强实施路线图

**基于研究报告的详细实施分析**
*生成时间: 2026-01-06*

---

## 📋 执行摘要

根据 `gemini-nexus_report.md` 的深度分析，本文档提供了针对 Gemini Nexus 项目的详细技术实施评估。重点聚焦于**三大阶段**的功能增强建议，并对每个功能进行可行性、优先级、工作量、风险和技术方案的全面分析。

### 核心结论

1. **差异化定位**: 开源 + 本地隐私 + Agent 自动化
2. **技术优势**: 已有 MCP 架构，具备快速扩展能力
3. **主要短板**: 缺乏用户友好的预设场景，规划能力较弱

---

## 🎯 Phase 1: 短期速赢策略 (0-3个月)

### 1.1 Slash Commands + Prompt Library (P0)

#### 功能描述
在侧边栏输入框中支持斜杠命令系统，类似于 Discord/Notion 的快捷操作。

**核心命令**:
- `/model <name>` - 快速切换模型
- `/role <name>` - 激活预设 Prompt 角色
- `/agent [on|off]` - 切换浏览器控制模式
- `/context [on|off]` - 切换页面上下文包含
- `/clear` - 清空对话
- `/save [name]` - 导出对话为 Markdown
- `/help` - 显示帮助信息

#### 技术可行性分析

**涉及文件**:
- `gemini-nexus/sandbox/controllers/prompt.js` (第19行) - 输入处理入口
- `gemini-nexus/sandbox/ui/chat.js` - UI 控制器
- `gemini-nexus/sandbox/controllers/slash_commands.js` (新建) - 命令处理器
- `gemini-nexus/sandbox/ui/autocomplete.js` (新建) - 自动补全UI

**实施步骤**:
1. **命令解析器** (1天)
   - 在 `prompt.js` 的 `send()` 方法第19行之后插入命令检测
   - 正则匹配 `/command args` 格式
   - 返回 `{ isCommand: bool, command: string, args: string[] }`

2. **命令处理器** (2天)
   - 创建 `SlashCommandProcessor` 类
   - 实现各命令的 handler 函数
   - `/role` 需要读取 `chrome.storage.local` 中的 `geminiPromptRoles`

3. **自动补全 UI** (2天)
   - 监听输入框 `input` 事件
   - 检测 `/` 触发自动补全下拉框
   - 使用 CSS 绝对定位在输入框上方显示候选项
   - 键盘导航支持 (↑↓ 选择, Enter 确认, Esc 取消)

4. **Prompt Library 存储** (1天)
   - 定义数据结构:
     ```javascript
     {
       geminiPromptRoles: [
         { name: 'coder', prompt: 'You are...' },
         { name: 'translator', prompt: '...' }
       ]
     }
     ```
   - 保存到 `chrome.storage.local`
   - 提供默认模板 (5-10个常用角色)

5. **设置 UI** (2天)
   - 在 `sandbox/ui/settings/sections/` 新建 `prompts.js`
   - YAML 编辑器或简单的 textarea
   - 支持导入/导出 YAML 文件

#### 优先级: **P0 (最高)**

**理由**:
- 立即可见的用户体验提升
- 技术风险极低,不涉及核心架构改动
- 开发周期短 (8个工作日)
- 展示项目的"极客"属性,符合目标用户画像

#### 工作量估算: **8人日**

| 任务 | 工作量 | 依赖 |
|------|--------|------|
| 命令解析器 | 1天 | 无 |
| 命令处理器 | 2天 | 解析器 |
| 自动补全 UI | 2天 | 无 |
| Prompt 存储 | 1天 | 无 |
| 设置界面 | 2天 | 存储 |

#### 技术风险: **低**

**潜在问题**:
- 自动补全 UI 在 PIP 窗口中的样式适配 (需测试 `inPip=true` 场景)
- YAML 解析需要引入轻量级库 (js-yaml, ~20KB)

**缓解方案**:
- 使用简单的 JSON 格式存储,UI 层支持 YAML 导入/导出即可
- PIP 窗口样式使用 CSS `max-height` 限制下拉框高度

#### 预期价值

**用户价值**:
- 减少 50% 的重复输入操作 (如切换模型、切换模式)
- 新手用户通过 `/help` 快速了解功能
- Prompt 复用率提升 (角色模板)

**技术价值**:
- 建立命令扩展机制,后续可快速添加新命令
- 提升代码模块化程度

---

### 1.2 Agent Preset Library (P0)

#### 功能描述
将现有的浏览器控制 (MCP) 能力封装为**开箱即用的自动化场景**,降低使用门槛。

**预设场景示例**:
- "LinkedIn 自动点赞" - 自动滚动并点赞前 10 条动态
- "Amazon 价格监控" - 记录商品价格并检测变化
- "GitHub Issue 摘要" - 抓取 Issue 列表并生成表格
- "表单自动填充" - 根据用户提供的数据填写网页表单
- "网页截图存档" - 定时截图并保存到本地

#### 技术可行性分析

**涉及文件**:
- `gemini-nexus/background/control/actions/` - 现有的 MCP 工具集
- `gemini-nexus/background/managers/session_manager.js` - 会话管理器
- `gemini-nexus/sandbox/ui/presets.js` (新建) - 预设场景 UI
- `gemini-nexus/background/agents/presets/` (新建) - 预设场景脚本库

**实施步骤**:
1. **Preset 数据结构设计** (0.5天)
   ```javascript
   {
     id: 'linkedin-auto-like',
     name: 'LinkedIn Auto Liker',
     description: 'Automatically like the first 10 posts',
     category: 'social',
     systemPrompt: 'You are a LinkedIn automation agent...',
     initialMessage: 'Please like the first 10 posts on this page',
     requiredDomain: 'linkedin.com',
     enableBrowserControl: true,
     enablePageContext: true
   }
   ```

2. **Preset 执行引擎** (2天)
   - 在 `session_manager.js` 中增加 `executePreset(presetId)` 方法
   - 自动创建新会话
   - 注入 systemPrompt
   - 自动发送 initialMessage
   - 开启 browser control + page context

3. **预设场景编写** (3天)
   - 基于现有 MCP 工具,编写 5-10 个高质量 Preset
   - 每个 Preset 包含详细的 systemPrompt (指导 AI 如何使用工具)
   - 测试成功率 (目标 >80%)

4. **UI 入口** (1天)
   - 在侧边栏增加 "🤖 Agent Presets" 按钮
   - 点击弹出场景列表 (卡片式布局)
   - 显示场景名称、描述、适用网站
   - 一键激活场景

#### 优先级: **P0 (最高)**

**理由**:
- **展示现有能力**: 很多用户不知道项目已有强大的 MCP 功能
- **降低使用门槛**: 从"需要编写自然语言指令"降低为"一键点击"
- **快速见效**: 利用现有架构,无需新增底层能力

#### 工作量估算: **6.5人日**

| 任务 | 工作量 | 依赖 |
|------|--------|------|
| 数据结构设计 | 0.5天 | 无 |
| 执行引擎 | 2天 | 数据结构 |
| 编写预设场景 | 3天 | 执行引擎 |
| UI 入口 | 1天 | 无 |

#### 技术风险: **中**

**潜在问题**:
- **Preset 失败率**: 网页结构变化导致 Agent 无法找到元素
- **安全性**: 用户可能滥用自动化功能 (如刷赞、刷评论)
- **跨网站兼容性**: 同一类型网站 (如电商) 结构差异大

**缓解方案**:
- 每个 Preset 附带"成功率"和"最后测试时间"标签
- 在 systemPrompt 中加入容错逻辑 (如"如果找不到按钮,尝试搜索类似文本")
- 限制 Preset 只能在特定域名激活 (`requiredDomain`)

#### 预期价值

**用户价值**:
- 首次使用后的 "Aha Moment" (顿悟时刻)
- 工作效率提升 30-60分钟/天 (自动化重复任务)

**商业价值**:
- **差异化竞争力**: Monica/Sider 没有此类功能
- **社区贡献潜力**: 用户可以分享自己的 Preset (类似 Tampermonkey 脚本)

---

### 1.3 Enhanced MCP Connection UX (P1)

#### 功能描述
简化外部 MCP 服务器的连接配置,从"手动输入 WebSocket URL"优化为"一键连接"。

**核心改进**:
- 提供 `npx gemini-nexus-bridge` 命令行工具
- 自动启动 WebSocket Proxy 并桥接 stdio MCP Server
- 预设常用 MCP Server 的连接配置 (chrome-devtools-mcp, filesystem-mcp)
- UI 显示连接状态和可用工具列表

#### 技术可行性分析

**涉及文件**:
- `gemini-nexus/cli/` (新建) - 命令行工具目录
- `gemini-nexus/cli/bridge.js` (新建) - WebSocket Proxy 实现
- `gemini-nexus/background/managers/mcp_remote_manager.js` - MCP 客户端管理器
- `gemini-nexus/sandbox/ui/settings/sections/connection.js` - 连接设置 UI

**实施步骤**:
1. **CLI 工具开发** (3天)
   - 创建 Node.js 脚本 `gemini-nexus-bridge`
   - 使用 `child_process.spawn()` 启动 stdio MCP Server
   - 实现 WebSocket Server (使用 `ws` 库)
   - 将 stdio 的 stdin/stdout 桥接到 WebSocket 消息

2. **预设配置库** (1天)
   - 定义 JSON 配置文件 `mcp-presets.json`:
     ```json
     [
       {
         "id": "chrome-devtools",
         "name": "Chrome DevTools MCP",
         "command": "npx -y @executeautomation/chrome-devtools-mcp",
         "description": "Control Chrome via DevTools Protocol",
         "defaultPort": 3007
       }
     ]
     ```

3. **UI 一键连接** (2天)
   - 在设置页面显示预设列表
   - "Start Server" 按钮 -> 调用 CLI 工具 (通过 Native Messaging)
   - 显示服务器状态 (运行中/已停止)
   - 自动填充 WebSocket URL

4. **连接状态监控** (1天)
   - 实现 WebSocket 心跳检测
   - UI 显示连接质量 (延迟、成功率)

#### 优先级: **P1 (高)**

**理由**:
- 当前 MCP 连接配置对普通用户过于复杂
- 降低门槛后,可吸引更多用户尝试 MCP 功能

#### 工作量估算: **7人日**

#### 技术风险: **中高**

**潜在问题**:
- **跨平台兼容性**: Windows/Mac/Linux 的命令执行方式不同
- **权限问题**: Chrome Extension 无法直接执行本地命令
- **端口冲突**: 多个用户同时使用默认端口

**缓解方案**:
- CLI 工具作为独立的 npm 包发布,用户需手动安装
- 使用 Chrome Native Messaging 与本地进程通信 (需额外配置)
- 自动端口分配 (检测冲突后递增端口号)

#### 预期价值

**用户价值**:
- 连接时间从 5-10 分钟降低到 30 秒
- 降低 70% 的配置错误率

---

## 🚀 Phase 2: 中期差异化策略 (3-6个月)

### 2.1 WebLLM Local Mode (P0)

#### 功能描述
集成 **MLC LLM / WebLLM**,在浏览器端直接运行轻量级模型 (Llama-3-8B, Phi-3, Gemma-2B),实现**完全离线、零隐私泄露**的 AI 助手。

**应用场景**:
- 企业内网环境 (无法访问外网)
- 处理敏感文档 (合同、财务数据、医疗记录)
- 飞机/火车上的离线工作
- API 配额用尽时的降级方案

#### 技术可行性分析

**技术栈**:
- **MLC LLM** (https://llm.mlc.ai/) - 模型编译框架
- **WebGPU** - GPU 加速推理
- **IndexedDB** - 模型权重缓存 (2-4GB)
- **Service Worker** - 后台推理任务

**性能基准** (基于 RTX 4060):
- TTFT (首 Token 延迟): <200ms
- 解码速度: 40-60 tokens/sec (Llama-3-8B-q4f16_1)
- 显存占用: 4-6GB

**实施步骤**:
1. **环境检测** (1天)
   - 检测浏览器是否支持 WebGPU (`navigator.gpu`)
   - 检测 GPU 显存大小 (最低 4GB)
   - 如不支持,禁用 Local Mode 功能

2. **模型下载与缓存** (3天)
   - 实现分片下载 (避免一次性加载 2GB)
   - 使用 Cache Storage API 永久缓存模型文件
   - 显示下载进度条 (已下载 XX MB / 总大小 XX MB)

3. **推理引擎集成** (4天)
   - 在 Service Worker 或 Offscreen Document 中初始化 WebLLM
   - 实现流式输出接口 (兼容现有 `onUpdate` 回调)
   - 支持模型卸载 (释放显存)

4. **智能路由** (2天)
   - 在 `request_dispatcher.js` 中增加路由逻辑:
     ```javascript
     if (settings.provider === 'local') {
       return localLlmProvider.stream(...);
     } else if (isPrivacySensitive(prompt)) {
       // 自动切换到本地模型
       return localLlmProvider.stream(...);
     }
     ```

5. **UI 控制** (2天)
   - 在设置中增加 "Local Mode" 开关
   - 模型选择下拉框增加 "Llama-3-8B (Local)" 选项
   - 显示推理状态 (加载模型 / 推理中 / 显存占用)

#### 优先级: **P0 (最高)**

**理由**:
- **研究报告核心推荐**: 报告将其标记为"最大的差异化惊喜点"
- **市场空白**: Monica/Sider 等竞品均为纯云端方案
- **隐私诉求**: 满足企业用户的合规需求
- **技术趋势**: WebGPU 已成为浏览器标准,2025 年是 Local LLM 元年

#### 工作量估算: **12人日**

| 任务 | 工作量 | 依赖 |
|------|--------|------|
| 环境检测 | 1天 | 无 |
| 模型下载缓存 | 3天 | 环境检测 |
| 推理引擎 | 4天 | 模型缓存 |
| 智能路由 | 2天 | 推理引擎 |
| UI 控制 | 2天 | 推理引擎 |

#### 技术风险: **高**

**潜在问题**:
- **浏览器兼容性**: WebGPU 仅 Chrome 113+, Safari/Firefox 支持不完善
- **显存不足**: 低端设备无法运行 8B 模型
- **推理速度**: CPU 推理速度仅 2-5 tokens/sec,体验极差
- **模型质量**: 8B 模型能力远弱于 GPT-4/Gemini

**缓解方案**:
- 检测设备能力,自动推荐合适的模型大小 (2B / 4B / 8B)
- 提供"混合模式": 简单任务用本地模型,复杂任务自动切换云端
- 明确告知用户 Local Mode 的能力限制

#### 预期价值

**用户价值**:
- **绝对隐私**: 数据不出域,满足 GDPR/HIPAA 合规
- **零成本**: 不消耗 API Token
- **离线可用**: 无网环境下仍可工作

**市场价值**:
- **护城河**: 技术门槛高,竞品短期内难以复制
- **B端市场**: 可向企业客户推广"私有化部署"方案

---

### 2.2 Advanced Agent Planner (P1)

#### 功能描述
升级现有的简单 Tool Calling 循环为完整的 **ReAct (Reasoning + Acting) 架构**,增强 Agent 的规划和自我修正能力。

**核心改进**:
- **视觉辅助规划**: 在规划阶段自动截图,让 LLM 基于页面快照进行决策
- **多步骤规划**: 将复杂任务拆解为子任务序列
- **自我修正**: 当工具执行失败时,自动尝试 Plan B (模糊匹配、OCR 定位)
- **进度可视化**: UI 显示 Agent 的思考过程和当前步骤

#### 技术可行性分析

**架构设计**:
```javascript
// Agent 状态机
async function agentLoop(goal) {
  let state = 'PLANNING';
  let plan = [];
  let currentStep = 0;

  while (state !== 'DONE') {
    switch (state) {
      case 'PLANNING':
        const screenshot = await captureScreenshot();
        const context = await getPageContext();
        plan = await llm.generatePlan(goal, screenshot, context);
        state = 'EXECUTING';
        break;

      case 'EXECUTING':
        const action = plan[currentStep];
        const result = await executeAction(action);

        if (result.success) {
          currentStep++;
          if (currentStep >= plan.length) state = 'DONE';
        } else {
          state = 'REFLECTING';
        }
        break;

      case 'REFLECTING':
        // 自我修正
        const newPlan = await llm.replan(goal, plan, currentStep, result.error);
        plan = newPlan;
        state = 'EXECUTING';
        break;
    }
  }
}
```

**实施步骤**:
1. **状态机框架** (2天)
   - 定义状态 (PLANNING / EXECUTING / REFLECTING / DONE)
   - 实现状态转换逻辑

2. **视觉规划** (3天)
   - 在规划阶段调用 `take_screenshot`
   - 将截图 + 文本上下文一起送给 LLM
   - Prompt Engineering: 指导 LLM 如何"看"网页并生成操作序列

3. **失败处理** (2天)
   - 捕获工具执行错误 (如 ElementNotFound)
   - 实现 Fallback 策略:
     - 模糊匹配: 寻找相似的 CSS Selector
     - OCR: 通过文字识别定位元素
     - 询问用户: 弹窗让用户手动选择元素

4. **进度 UI** (2天)
   - 在对话界面显示 Agent 的思维链
   - 格式: "🤔 Thinking: 需要找到登录按钮... ✅ Action: 点击了 #login-btn... ⚠️ Error: 按钮不存在,尝试 Plan B..."

#### 优先级: **P1 (高)**

**理由**:
- 当前简单的 Tool Calling 容易"迷路"
- 复杂任务 (如多步骤表单填写) 成功率低

#### 工作量估算: **9人日**

#### 技术风险: **中高**

**潜在问题**:
- **规划失败**: LLM 生成的计划不合理或过于模糊
- **执行卡死**: Agent 陷入无限重试循环
- **成本增加**: 每次规划都需要发送截图,Token 消耗显著增加

**缓解方案**:
- 设置最大重试次数 (3次)
- 实现"紧急停止"按钮,用户可随时中断
- 提供"简单模式"和"规划模式"两种 Agent 模式,让用户选择

#### 预期价值

**用户价值**:
- 复杂任务成功率从 30% 提升到 70%+
- Agent 行为更透明,用户有安全感

---

### 2.3 RAG + Vector Memory (P1)

#### 功能描述
为 Agent 增加**长期记忆**能力,允许跨会话检索历史信息。

**应用场景**:
- "上周我问过关于 React 的什么问题?"
- "帮我找到我收藏的那篇关于 WebGPU 的文章"
- "根据我过去的聊天记录,推荐一个合适的 Prompt 角色"

**技术方案**:
- **向量数据库**: Voyager (WASM) 或 Orama (纯 JS)
- **Embedding 模型**:
  - 方案 A: 调用 OpenAI Embedding API (需付费)
  - 方案 B: 使用 Local Embedding Model (Transformers.js + all-MiniLM-L6-v2)
- **索引内容**: 聊天历史、网页收藏、用户笔记

**实施步骤**:
1. **向量库集成** (2天)
2. **自动向量化** (2天)
3. **语义检索 UI** (2天)
4. **隐私控制** (1天)

#### 优先级: **P1 (高)**

#### 工作量估算: **7人日**

#### 技术风险: **中**

**潜在问题**:
- Embedding 成本 (如使用 API)
- 本地 Embedding 性能较差

---

## 🏰 Phase 3: 长期护城河构建 (6-12个月)

### 3.1 MCP Marketplace (P2)

#### 功能描述
构建去中心化的 MCP 工具市场,允许开发者发布和分享自定义工具。

**技术方案**:
- 基于 GitHub Gist 存储 `mcp.json` 配置文件
- 用户通过 URL 导入工具
- 内置评分和评论系统

#### 优先级: **P2 (中)**

#### 工作量估算: **15人日**

---

### 3.2 Ollama Deep Integration (P2)

#### 功能描述
深度集成 Ollama,自动检测本地运行的模型并加入模型列表。

#### 优先级: **P2 (中)**

#### 工作量估算: **8人日**

---

## 📊 优先级总览

| 功能 | 阶段 | 优先级 | 工作量 | 技术风险 | 用户价值 |
|------|------|--------|--------|----------|----------|
| Slash Commands + Prompt Library | P1 | P0 | 8天 | 低 | ⭐⭐⭐⭐ |
| Agent Preset Library | P1 | P0 | 6.5天 | 中 | ⭐⭐⭐⭐⭐ |
| Enhanced MCP Connection | P1 | P1 | 7天 | 中高 | ⭐⭐⭐ |
| **WebLLM Local Mode** | P2 | **P0** | 12天 | 高 | ⭐⭐⭐⭐⭐ |
| Advanced Agent Planner | P2 | P1 | 9天 | 中高 | ⭐⭐⭐⭐ |
| RAG + Vector Memory | P2 | P1 | 7天 | 中 | ⭐⭐⭐⭐ |
| MCP Marketplace | P3 | P2 | 15天 | 高 | ⭐⭐⭐ |
| Ollama Integration | P3 | P2 | 8天 | 中 | ⭐⭐⭐ |

---

## 🚫 明确不做的事项 (基于报告建议)

1. **DeepSeek 逆向工程**
   - 原因: API 极其便宜,逆向工程维护成本高,风险大
   - 替代方案: 在预设模型列表中添加 DeepSeek API 配置模板

2. **与 Monica/Sider 拼 UI/UX**
   - 原因: 资源不足,无法在交互细节上超越成熟商业产品
   - 替代方案: 聚焦技术深度 (本地化、自动化) 而非 UI 美观度

3. **纯云端架构**
   - 原因: 隐私问题是最大的用户顾虑
   - 坚持方向: Hybrid 架构 (云端 + 本地)

4. **过度自动化 (如 DoS 攻击、刷单)**
   - 原因: 法律风险、道德风险
   - 限制措施: Preset 仅限合法合规的自动化场景

---

## 📈 预期商业与技术价值

### 短期 (3个月内)
- **用户增长**: GitHub Star 从当前数量增长 100%
- **活跃度**: 周活跃用户数提升 50%
- **口碑**: 在 Product Hunt / Hacker News 获得曝光

### 中期 (6个月内)
- **技术领先**: 成为 GitHub 上 Star 数最高的开源 Browser Agent 项目
- **社区生态**: 出现第三方贡献的 Preset 和 MCP 工具
- **商业化**: 探索企业版订阅 (提供私有部署支持)

### 长期 (12个月内)
- **行业标准**: 影响浏览器 Agent 的技术标准制定
- **平台化**: 从工具进化为平台,允许开发者构建 Agent 应用

---

## 🎯 推荐实施顺序

### 第一批次 (立即开始)
1. **Agent Preset Library** (6.5天) - 展示现有能力,快速见效
2. **Slash Commands** (8天) - 提升日常使用体验

**目标**: 2周内发布 v4.3.0,包含上述两个功能

### 第二批次 (1-2个月后)
3. **WebLLM Local Mode** (12天) - 核心差异化功能

**目标**: 3个月内发布 v5.0.0,主打"隐私 AI 助手"

### 第三批次 (3-6个月后)
4. **Advanced Agent Planner** (9天)
5. **RAG + Vector Memory** (7天)

**目标**: 6个月内完成 Agent 能力的全面升级

---

## 📝 总结

本路线图基于对 `gemini-nexus` 现有架构的深度理解和市场竞争格局的全面分析。核心策略是:

1. **扬长避短**: 不与商业产品拼 UI,而是拼技术深度
2. **快速迭代**: 优先开发短周期、高价值的功能
3. **差异化定位**: 开源 + 本地化 + 自动化 = 独特竞争优势

**最关键的决策**: 是否投入资源开发 WebLLM Local Mode。如果答案是肯定的,这将是项目的"战略转折点",可能吸引大量隐私敏感用户和企业客户。

---

*文档生成: Claude Code*
*基于研究报告: gemini-nexus_report.md*
