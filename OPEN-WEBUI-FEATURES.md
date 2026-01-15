# Open WebUI 功能参考设计文档

本文档记录了从 Open WebUI 借鉴的功能设计，用于改进 Gemini Nexus 的用户体验。

## 已实现功能

### 1. 消息操作功能 (Message Actions)
**参考**: Open WebUI 的聊天界面设计

**实现内容**:
- ✅ 用户消息操作按钮：编辑(Edit)、删除(Delete)、复制(Copy)
- ✅ AI消息操作按钮：重新生成(Regenerate)、复制(Copy)
- ✅ 悬停显示操作按钮（减少界面杂乱）
- ✅ 按钮位置：用户消息在左侧，AI消息在内容下方

**技术实现**:
- `sandbox/render/message.js`: 在 appendMessage 函数中添加 messageIndex 参数
- `css/chat.css`: `.user-message-actions` 和 `.ai-message-actions` 样式
- `sandbox/controllers/session_flow.js`: handleEditMessage, handleRegenerateMessage, handleDeleteMessage

### 2. 对话历史管理
**参考**: Open WebUI 的会话管理方式

**实现内容**:
- ✅ 允许编辑任意用户消息
- ✅ 允许重新生成任意AI回复
- ✅ 编辑/重新生成中间消息时，删除后续对话（保持上下文一致性）
- ✅ 状态提示：显示将删除多少后续消息

**设计决策**:
- 采用"方案B"：允许编辑任意消息，但删除后续对话
- 与 ChatGPT/Open WebUI 保持一致的用户体验
- 在状态栏显示删除提示，避免用户意外丢失内容

**技术实现**:
- `sandbox/controllers/prompt.js`: 编辑时删除后续消息 (line 64-67)
- `sandbox/controllers/session_flow.js`:
  - `handleEditMessage`: 显示编辑提示 (line 148-152)
  - `handleRegenerateMessage`: 删除所有后续对话 (line 216-221)

### 3. 重新生成逻辑改进
**问题修复**: 重新生成按钮有时不显示

**根本原因**: streaming bubble 创建时没有传入 messageIndex

**修复方案**:
- 在 `handleStreamUpdate` 中计算正确的 messageIndex
- 区分普通对话和重新生成场景

```javascript
// 在创建streaming bubble时确定messageIndex
if (this.app.prompt.isRegenerating && this.app.prompt.regenerateIndex !== null) {
    messageIndex = this.app.prompt.regenerateIndex;
} else if (session) {
    messageIndex = session.messages.length;
}
```

## Open WebUI 的其他值得借鉴的功能

### 待实现功能

#### 1. 模型切换界面
- Open WebUI 顶部有模型选择下拉菜单
- 可以方便地切换不同的 AI 模型
- 建议：在设置界面或聊天顶部添加模型选择器

#### 2. 系统提示词管理
- Open WebUI 允许为每个对话设置系统提示词
- 可以保存和管理多个系统提示词模板
- 建议：在对话开始时允许设置系统提示词

#### 3. 消息搜索功能
- Open WebUI 支持在对话历史中搜索
- 可以快速定位到包含特定内容的对话
- 建议：添加对话搜索功能

#### 4. 标签和分类
- Open WebUI 支持为对话添加标签
- 可以按照标签筛选对话
- 建议：添加标签系统来组织对话

#### 5. 响应质量评估
- Open WebUI 允许用户对AI回复点赞/点踩
- 可以标记有帮助或无帮助的回复
- 建议：添加简单的反馈机制

#### 6. 高级导出选项
- Open WebUI 支持多种格式的导出
- 包括 Markdown、JSON、PDF 等
- 改进方向：当前的导出功能可以支持更多格式

#### 7. 多模态支持增强
- Open WebUI 支持文件上传（PDF、文档等）
- 当前只支持图片，可以扩展文件类型支持

## 实现优先级建议

### 高优先级
1. **模型切换界面** - 提升用户体验的核心功能
2. **系统提示词管理** - 增强AI回复质量的工具

### 中优先级
3. **消息搜索功能** - 对于大量对话的用户很有用
4. **标签和分类** - 组织对话的有效方式

### 低优先级
5. **响应质量评估** - 需要后台数据存储支持
6. **高级导出选项** - 根据用户反馈决定是否实现

## 技术考虑

### 与现有架构的整合
- 所有新功能应该与现有的 session_manager 和 UI 控制器集成
- 保持代码风格一致（模块化、事件驱动）
- 添加必要的日志便于调试

### 数据持久化
- 新功能的数据（如标签、评级）需要添加到会话存储中
- 考虑向后兼容性（旧数据到新格式的迁移）

### 性能考虑
- 搜索功能需要高效的消息索引
- 标签筛选应该在内存中完成，避免频繁读取存储
