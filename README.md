# AI Chat Exporter Pro

🤖 AI对话导出助手 - 支持多平台对话导出

## 支持平台

| 平台 | 状态 | 数据获取方式 |
|------|------|-------------|
| 豆包 (Doubao) | ✅ 已支持 | API拦截 |
| DeepSeek | ✅ 已支持 | IndexedDB |
| ChatGPT | 🚧 开发中 | IndexedDB |
| Kimi | 🚧 开发中 | API拦截 |
| 元宝 (Yuanbao) | 🚧 开发中 | API拦截 |

## 功能特性

### 导出格式
- ✅ Markdown (.md)
- ✅ HTML (.html)
- ✅ JSON (.json)
- ✅ PDF (.pdf)
- ✅ PNG长图 (.png)
- ✅ 纯文本 (.txt)

### 导出选项
- ✅ 导出当前对话
- ✅ 导出全部对话
- ✅ 批量ZIP打包
- ✅ 包含/排除思考过程
- ✅ 包含/排除时间戳
- ✅ 合并为单个文件

### 高级功能
- ✅ 图片预加载（解决跨域）
- ✅ 自动滚动加载历史
- ✅ 进度显示
- ✅ 错误重试
- ✅ 并发控制

## 安装方法

### 开发者模式安装

1. 下载最新版本：[Releases](https://github.com/liguo6825-ux/ai-chat-exporter-pro/releases)
2. 解压文件
3. 打开 Chrome/Edge 扩展管理页面：`chrome://extensions/`
4. 开启"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择解压后的文件夹

### Chrome Web Store

🚧 正在审核中...

## 使用方法

### 基本使用

1. 打开支持的AI对话平台（豆包、DeepSeek等）
2. 点击浏览器工具栏的扩展图标
3. 选择导出格式和选项
4. 点击"导出当前"或"导出全部"

### 高级选项

- **包含思考过程**: 导出AI的思考过程（如DeepSeek的THINK片段）
- **包含时间戳**: 在消息中显示发送时间
- **合并为单个文件**: 将所有对话合并到一个文件中

## 技术架构

```
ai-chat-exporter-pro/
├── src/
│   ├── core/           # 核心引擎
│   │   ├── extractor.js    # 数据提取
│   │   ├── formatter.js    # 消息格式化
│   │   └── exporter.js     # 导出引擎
│   ├── platforms/      # 平台适配器
│   │   ├── base.js         # 基础适配器
│   │   ├── doubao.js       # 豆包适配器
│   │   └── deepseek.js     # DeepSeek适配器
│   ├── utils/          # 工具函数
│   │   ├── image.js        # 图片处理
│   │   └── scroll.js       # 自动滚动
│   └── ui/             # 用户界面
│       ├── popup.html      # 弹出窗口
│       └── popup.js        # 弹出逻辑
├── assets/             # 图标资源
└── manifest.json       # 扩展配置
```

## 开发计划

### v2.0 (当前版本)
- [x] 多平台支持框架
- [x] 豆包平台适配
- [x] DeepSeek平台适配
- [x] 多种导出格式
- [x] ZIP打包
- [x] 图片预加载

### v2.1 (计划中)
- [ ] ChatGPT平台适配
- [ ] Kimi平台适配
- [ ] 元宝平台适配
- [ ] 通义千问平台适配
- [ ] 对话搜索功能

### v2.2 (计划中)
- [ ] 云端同步
- [ ] 自动备份
- [ ] 数据统计
- [ ] 插件系统

## 技术对比

### 与原版的对比

| 功能 | AI对话导出助手 | AI Chat Exporter Pro |
|------|--------------|---------------------|
| 豆包支持 | ❌ | ✅ |
| DeepSeek支持 | ✅ | ✅ |
| ChatGPT支持 | ✅ | 🚧 |
| 批量导出 | ❌ | ✅ |
| ZIP打包 | ❌ | ✅ |
| 免费使用 | ❌ (积分制) | ✅ |
| 开源 | ❌ | ✅ |

## 贡献指南

欢迎提交Issue和Pull Request！

### 添加新平台适配器

1. 在 `src/platforms/` 创建新的适配器文件
2. 继承 `PlatformAdapter` 基类
3. 实现必要的方法
4. 在 `content.js` 中注册适配器

示例：

```javascript
class NewPlatformAdapter extends PlatformAdapter {
  static detect() {
    return window.location.hostname.includes('example.com');
  }
  
  async getConversations() {
    // 实现获取对话列表
  }
  
  async getMessages(conversationId) {
    // 实现获取消息
  }
}
```

## 许可证

MIT License

## 致谢

- [JSZip](https://stuk.github.io/jszip/) - ZIP文件生成
- [html2canvas](https://html2canvas.hertzen.com/) - 网页截图
- [jsPDF](https://parall.ax/products/jspdf) - PDF生成

## 联系方式

- GitHub: [liguo6825-ux](https://github.com/liguo6825-ux)
- 项目地址: https://github.com/liguo6825-ux/ai-chat-exporter-pro
