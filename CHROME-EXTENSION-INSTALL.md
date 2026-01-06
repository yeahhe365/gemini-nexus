# Chrome Extension 安装指南

## ✅ 构建完成！

扩展已成功编译到 `gemini-nexus/dist/` 目录。

## 📦 包含的文件

```
dist/
├── manifest.json          # 扩展清单
├── logo.png              # 扩展图标
├── metadata.json         # 元数据
├── background/           # 后台服务
│   ├── index.js
│   ├── managers/
│   ├── handlers/
│   └── ...
├── content/              # 内容脚本
│   ├── pip.js           # ⭐ PIP 窗口核心
│   ├── index.js
│   ├── toolbar/
│   └── ...
├── sidepanel/            # 侧边栏界面
│   └── index.html
├── sandbox/              # 沙箱环境
│   └── index.html
├── services/             # AI 服务提供者
├── lib/                  # 共享库
├── css/                  # 样式文件
└── assets/               # Vite 构建的资源
```

## 🚀 安装步骤

### 方法 1: Chrome 浏览器

1. **打开扩展管理页面**
   ```
   在地址栏输入: chrome://extensions/
   或: 菜单 → 更多工具 → 扩展程序
   ```

2. **启用开发者模式**
   - 点击右上角的 "开发者模式" 切换按钮
   - 确保开关变成蓝色（启用状态）

3. **加载扩展**
   - 点击 "加载已解压的扩展程序" 按钮
   - 导航到项目目录: `D:\dev\mcp\gemini-nexus\gemini-nexus\dist`
   - 选择 `dist` 文件夹
   - 点击 "选择文件夹"

4. **验证安装**
   - 扩展应该出现在列表中
   - 名称: **Gemini Nexus**
   - 版本: **4.2.3**
   - 状态: 已启用 ✅

### 方法 2: Edge 浏览器

1. **打开扩展管理页面**
   ```
   在地址栏输入: edge://extensions/
   ```

2. **启用开发人员模式**
   - 左侧边栏找到 "开发人员模式"
   - 打开开关

3. **加载扩展**
   - 点击 "加载解压缩的扩展"
   - 选择 `dist` 文件夹

## 🎯 首次使用

### 1. 配置快捷键

打开 `chrome://extensions/shortcuts`，确认以下快捷键：

- **Open Gemini Nexus Sidebar**: `Alt+S`
- **Toggle Gemini Nexus Floating Window**: `Alt+G` ⭐ (全局)

### 2. 测试侧边栏

1. 打开任意网页（如 google.com）
2. 按 `Alt+S` 或点击扩展图标
3. 侧边栏应该出现在右侧

### 3. 测试 PIP 窗口 ⭐

1. 在任意网页按 `Alt+G`
2. **预期**: 弹出 500x800px 的浮动窗口
3. 再按 `Alt+G` 切换最小化（64x64px）
4. 测试跨应用：
   - 打开 VSCode 或其他应用
   - 按 `Alt+G`（即使浏览器失焦也能工作）
   - PIP 窗口应该浮现在所有应用上方

### 4. 配置 AI 提供者

在侧边栏或 PIP 窗口中：

1. 点击设置图标
2. 选择 AI 提供者：
   - **Web Client** (免费，需要 Google 账号登录)
   - **Official API** (需要 Google AI Studio API Key)
   - **OpenAI Compatible** (支持 GPT、Claude 等)

## 🐛 常见问题

### 问题 1: 扩展无法加载

**症状**: 点击"加载已解压的扩展程序"后出现错误

**解决方案**:
1. 检查是否选择了正确的 `dist` 文件夹
2. 确认 `dist/manifest.json` 存在
3. 查看错误信息，通常会指出具体问题

### 问题 2: Alt+G 不工作

**检查**:
```
chrome://extensions/shortcuts
```

**解决方案**:
1. 确认快捷键设置为 `Alt+G`
2. 确认 "Toggle Gemini Nexus Floating Window" 的作用域是 "全局"
3. 检查是否与其他扩展快捷键冲突

### 问题 3: PIP 窗口空白

**可能原因**:
- 浏览器版本低于 Chrome 111

**检查浏览器版本**:
```
chrome://version/
```

**解决方案**:
- 升级 Chrome 到 111+ 或 Edge 111+

### 问题 4: 控制台错误

**打开开发者工具**:
1. `chrome://extensions/`
2. 找到 Gemini Nexus
3. 点击 "检查视图" → "Service Worker"
4. 查看 Console 标签页

**常见错误及解决**:
- `Failed to fetch` - 检查网络连接
- `API Key missing` - 配置 AI 提供者
- `Module not found` - 重新构建扩展

## 🔄 更新扩展

当你修改代码后：

1. **重新构建**
   ```bash
   cd gemini-nexus
   npm run build
   ```

2. **重新复制文件**（如果修改了 background/content/services）
   ```bash
   cp manifest.json dist/
   cp logo.png dist/
   cp -r background dist/
   cp -r content dist/
   cp -r lib dist/
   cp -r services dist/
   cp -r css dist/
   ```

3. **刷新扩展**
   - 打开 `chrome://extensions/`
   - 找到 Gemini Nexus
   - 点击刷新图标 🔄

## 📊 验证功能

### ✅ 基础功能检查清单

- [ ] 扩展图标显示在工具栏
- [ ] `Alt+S` 打开侧边栏
- [ ] 侧边栏界面正常显示
- [ ] 可以输入文本并发送 AI 请求

### ✅ PIP 窗口检查清单

- [ ] `Alt+G` 创建 PIP 窗口
- [ ] PIP 窗口显示完整界面
- [ ] 再按 `Alt+G` 切换最小化
- [ ] 在其他应用中按 `Alt+G` 也能工作
- [ ] PIP 窗口浮动在所有应用上方

### ✅ 文本选择工具检查清单

- [ ] 选中网页文字后出现浮动工具栏
- [ ] 点击 "翻译"、"总结"、"重写" 按钮工作正常
- [ ] 结果显示在工具栏面板中

### ✅ 图像工具检查清单

- [ ] 右键图片显示 "用 Gemini 分析"
- [ ] 点击后图片发送到 AI
- [ ] OCR 和截图功能正常

### ✅ 浏览器控制检查清单

- [ ] 侧边栏中打开 "Browser Control" 模式
- [ ] 可以发送页面快照给 AI
- [ ] AI 可以执行页面操作（点击、填充等）

## 🎨 自定义设置

在扩展设置中可以配置：

- ✅ AI 提供者选择
- ✅ API Keys
- ✅ 文本选择工具启用/禁用
- ✅ 图像工具启用/禁用
- ✅ 浏览器控制设置
- ✅ 外部 MCP 工具连接

## 🚨 已知限制

### PIP 窗口限制
- ⚠️ **浏览器要求**: Chrome 111+ 或 Edge 111+
- ⚠️ **受保护页面**: chrome://, edge://, chrome-extension:// 等页面上快捷键不工作
- ⚠️ **单窗口**: 同一时间只能有一个 PIP 窗口

### 浏览器控制限制
- ⚠️ **权限**: 需要 debugger 权限
- ⚠️ **性能**: 在复杂页面上可能较慢
- ⚠️ **兼容性**: 某些网站的反调试机制可能阻止操作

## 📝 开发者信息

### 目录结构
```
gemini-nexus/
├── gemini-nexus/          # 源代码
│   ├── background/
│   ├── content/
│   ├── sidepanel/
│   └── ...
└── dist/                  # 编译输出 ← 加载这个
```

### 构建脚本

可以创建一个自动化脚本 `build.sh`:

```bash
#!/bin/bash
cd gemini-nexus
npm run build
cp manifest.json dist/
cp logo.png dist/
cp metadata.json dist/
cp -r background dist/
cp -r content dist/
cp -r lib dist/
cp -r services dist/
cp -r css dist/
echo "✅ Build complete! Load dist/ folder in Chrome."
```

### 发布到 Chrome Web Store

如果你想发布扩展：

1. **打包扩展**
   ```bash
   cd dist
   zip -r gemini-nexus-4.2.3.zip .
   ```

2. **提交到 Chrome Web Store**
   - 访问: https://chrome.google.com/webstore/devconsole
   - 创建开发者账号（一次性费用 $5）
   - 上传 ZIP 文件
   - 填写商店信息
   - 提交审核

## 🎉 成功！

你的 Gemini Nexus Chrome Extension 现在已经准备好使用了！

**下一步**:
1. ⭐ 测试 PIP 窗口（`Alt+G`）
2. 🔧 配置你喜欢的 AI 提供者
3. 🎨 探索所有功能
4. 📖 查看 `PIP-TESTING-GUIDE.md` 了解详细测试步骤

**需要帮助？**
- 查看 `CLAUDE.md` 了解代码架构
- 查看 `PIP-IMPLEMENTATION-SUMMARY.md` 了解 PIP 实现细节
- 查看 `anything-copilot-analysis.md` 了解设计灵感

享受你的 AI 助手！🚀
