# AI Chat Exporter Pro - 架构设计文档

## 1. 核心架构

```
ai-chat-exporter-pro/
├── src/
│   ├── core/           # 核心引擎
│   │   ├── extractor.js    # 数据提取引擎
│   │   ├── formatter.js    # 格式化引擎
│   │   ├── exporter.js     # 导出引擎
│   │   └── pipeline.js     # 处理管道
│   ├── platforms/      # 平台适配器
│   │   ├── base.js         # 基础适配器类
│   │   ├── doubao.js       # 豆包适配器
│   │   ├── deepseek.js     # DeepSeek适配器
│   │   ├── chatgpt.js      # ChatGPT适配器
│   │   ├── kimi.js         # Kimi适配器
│   │   └── yuanbao.js      # 元宝适配器
│   ├── utils/          # 工具函数
│   │   ├── indexeddb.js    # IndexedDB操作
│   │   ├── interceptor.js  # XHR/Fetch拦截
│   │   ├── scraper.js      # DOM抓取
│   │   ├── image.js        # 图片处理
│   │   ├── scroll.js       # 自动滚动
│   │   └── file.js         # 文件操作
│   └── ui/             # 用户界面
│       ├── popup.js        # 弹出窗口
│       ├── progress.js     # 进度显示
│       └── toast.js        # 提示消息
├── assets/
│   └── icons/          # 图标资源
├── docs/               # 文档
└── tests/              # 测试
```

## 2. 设计原则

### 2.1 适配器模式
每个平台独立适配器，统一接口：

```javascript
class PlatformAdapter {
  // 检测当前平台
  static detect() { return false; }
  
  // 获取对话列表
  async getConversations() { return []; }
  
  // 获取对话内容
  async getMessages(conversationId) { return []; }
  
  // 格式化消息
  formatMessage(message) { return {}; }
}
```

### 2.2 策略模式
数据获取策略可切换：

```javascript
const DataStrategy = {
  INDEXED_DB: 'indexeddb',      // 本地数据库
  API_INTERCEPT: 'api',         // API拦截
  DOM_SCRAPE: 'dom',            // DOM抓取
  HYBRID: 'hybrid'              // 混合模式
};
```

### 2.3 管道模式
导出流程管道化：

```javascript
const pipeline = new ExportPipeline()
  .extract()      // 提取数据
  .transform()    // 转换格式
  .enhance()      // 增强处理（图片、思考过程等）
  .format()       // 最终格式化
  .export();      // 导出文件
```

## 3. 核心流程

### 3.1 数据提取流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  平台检测    │────▶│ 策略选择    │────▶│ 数据提取    │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                    ┌─────────────┐          │
                    │ IndexedDB   │◀─────────┤
                    │ API拦截     │◀─────────┤
                    │ DOM抓取     │◀─────────┘
                    └─────────────┘
```

### 3.2 导出流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  提取数据    │────▶│ 格式化消息  │────▶│ 处理媒体    │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
┌─────────────┐     ┌─────────────┐          │
│  生成文件    │◀────│ 选择格式    │◀─────────┤
│  (MD/PDF/   │     │ (MD/PDF/    │          │
│   PNG/JSON) │     │  PNG/JSON)  │          │
└─────────────┘     └─────────────┘          │
                                    ┌─────────────┐
                                    │ 预加载图片  │◀────────┘
                                    └─────────────┘
```

## 4. 关键技术方案

### 4.1 IndexedDB读取（DeepSeek/ChatGPT）

```javascript
class IndexedDBStrategy {
  async read(dbName, storeName, id = null) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const getRequest = id ? store.get(id) : store.getAll();
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }
}
```

### 4.2 API拦截（豆包/元宝）

```javascript
class APIInterceptor {
  constructor() {
    this.captures = new Map();
    this.setupXHRIntercept();
    this.setupFetchIntercept();
  }
  
  setupXHRIntercept() {
    const OriginalXHR = window.XMLHttpRequest;
    const self = this;
    
    window.XMLHttpRequest = function() {
      const xhr = new OriginalXHR();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;
      
      xhr.open = function(method, url) {
        this._url = url;
        this._method = method;
        return originalOpen.apply(xhr, arguments);
      };
      
      xhr.send = function(body) {
        this.addEventListener('load', function() {
          if (this.status === 200) {
            self.captures.set(this._url, {
              method: this._method,
              url: this._url,
              response: this.response,
              timestamp: Date.now()
            });
          }
        });
        return originalSend.apply(xhr, arguments);
      };
      
      return xhr;
    };
  }
}
```

### 4.3 自动滚动加载

```javascript
class AutoScroller {
  async scroll(element, options = {}) {
    const {
      checkInterval = 500,
      maxUnchanged = 3,
      onProgress = () => {}
    } = options;
    
    let lastScrollTop = -1;
    let unchangedCount = 0;
    let totalScrolls = 0;
    
    // 保存原始状态
    const originalOverflow = element.style.overflow;
    const originalPointerEvents = element.style.pointerEvents;
    
    // 禁用用户交互
    element.style.overflow = 'hidden';
    element.style.pointerEvents = 'none';
    
    try {
      while (unchangedCount < maxUnchanged) {
        element.scrollTo({
          top: element.scrollTop + element.clientHeight,
          behavior: 'instant'
        });
        
        await this.sleep(checkInterval);
        
        if (element.scrollTop === lastScrollTop) {
          unchangedCount++;
        } else {
          unchangedCount = 0;
          lastScrollTop = element.scrollTop;
        }
        
        totalScrolls++;
        onProgress({ totalScrolls, scrollTop: lastScrollTop });
      }
    } finally {
      // 恢复原始状态
      element.style.overflow = originalOverflow;
      element.style.pointerEvents = originalPointerEvents;
    }
    
    return { totalScrolls, maxScrollTop: lastScrollTop };
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 4.4 图片预加载

```javascript
class ImagePreloader {
  async preload(container) {
    const images = container.querySelectorAll('img');
    const results = await Promise.allSettled(
      Array.from(images).map(img => this.loadImage(img))
    );
    
    return {
      success: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length
    };
  }
  
  async loadImage(img) {
    try {
      const response = await fetch(img.src, { cache: 'no-store' });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // 替换为Blob URL
      img.dataset.originalSrc = img.src;
      img.src = url;
      img.classList.add('aiexporter-img-loaded');
      
      return { success: true, originalSrc: img.dataset.originalSrc };
    } catch (error) {
      console.warn('图片加载失败:', img.src, error);
      return { success: false, error };
    }
  }
}
```

### 4.5 消息格式化

```javascript
class MessageFormatter {
  format(message, options = {}) {
    const {
      includeThink = true,
      includeTime = true,
      format = 'markdown'
    } = options;
    
    const role = this.getRole(message);
    const time = includeTime ? this.formatTime(message.create_time) : '';
    const content = this.extractContent(message);
    const thinkContent = includeThink ? this.extractThinkContent(message) : '';
    
    switch (format) {
      case 'markdown':
        return this.toMarkdown({ role, time, content, thinkContent });
      case 'html':
        return this.toHTML({ role, time, content, thinkContent });
      case 'json':
        return this.toJSON({ role, time, content, thinkContent });
      default:
        return this.toText({ role, time, content, thinkContent });
    }
  }
  
  toMarkdown({ role, time, content, thinkContent }) {
    let result = `### ${role}`;
    if (time) result += ` (${time})`;
    result += '\n\n';
    
    if (thinkContent) {
      result += `<think>\n${thinkContent}\n</think>\n\n`;
    }
    
    result += `${content}\n\n---\n`;
    return result;
  }
}
```

## 5. 导出格式支持

### 5.1 Markdown导出

```javascript
class MarkdownExporter {
  export(conversations, options = {}) {
    let output = '# AI对话导出\n\n';
    output += `导出时间: ${new Date().toLocaleString()}\n\n`;
    output += `---\n\n`;
    
    for (const conv of conversations) {
      output += `## ${conv.title}\n\n`;
      
      for (const msg of conv.messages) {
        output += this.formatMessage(msg, options);
      }
      
      output += '\n---\n\n';
    }
    
    return output;
  }
}
```

### 5.2 PDF导出

```javascript
class PDFExporter {
  async export(element, title) {
    // 预加载图片
    const preloader = new ImagePreloader();
    await preloader.preload(element);
    
    // 使用html2canvas截图
    const canvas = await html2canvas(element, {
      logging: false,
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true
    });
    
    // 生成PDF
    const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = pageWidth;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 0;
    const imgData = canvas.toDataURL('image/png');
    
    // 分页处理
    while (heightLeft > 0) {
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      position -= pageHeight;
      if (heightLeft > 0) pdf.addPage();
    }
    
    pdf.save(`${title}.pdf`);
  }
}
```

### 5.3 PNG导出

```javascript
class PNGExporter {
  async export(element, title) {
    // 预加载图片
    const preloader = new ImagePreloader();
    await preloader.preload(element);
    
    // 截图
    const canvas = await html2canvas(element, {
      logging: false,
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true
    });
    
    // 下载
    const url = canvas.toDataURL('image/png');
    this.downloadFile(url, `${title}.png`);
  }
  
  downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }
}
```

### 5.4 JSON导出

```javascript
class JSONExporter {
  export(conversations, options = {}) {
    const data = {
      exportTime: new Date().toISOString(),
      version: '2.0',
      platform: options.platform,
      conversations: conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        createTime: conv.createTime,
        messageCount: conv.messages.length,
        messages: conv.messages.map(msg => ({
          id: msg.message_id,
          role: msg.user_type === 2 ? 'user' : 'assistant',
          content: this.extractContent(msg),
          thinkContent: this.extractThinkContent(msg),
          createTime: msg.create_time,
          contentType: msg.content_type
        }))
      }))
    };
    
    return JSON.stringify(data, null, 2);
  }
}
```

## 6. 平台适配器实现

### 6.1 豆包适配器

```javascript
class DoubaoAdapter extends PlatformAdapter {
  static detect() {
    return window.location.hostname.includes('doubao.com');
  }
  
  constructor() {
    super();
    this.interceptor = new APIInterceptor();
    this.scroller = new AutoScroller();
  }
  
  async getConversations() {
    // 通过API拦截获取对话列表
    const response = await this.interceptor.waitForResponse('/im/conversation/list');
    return response.data.conversations;
  }
  
  async getMessages(conversationId) {
    // 点击对话触发API请求
    this.clickConversation(conversationId);
    
    // 等待API响应
    const response = await this.interceptor.waitForResponse('/im/chain/single');
    const messages = response.downlink_body.pull_singe_chain_downlink_body.messages;
    
    // 检查是否有更多消息
    if (response.has_more) {
      // 分页加载
      await this.loadMoreMessages(conversationId, response.msg_cursor);
    }
    
    return messages;
  }
  
  formatMessage(message) {
    const role = message.user_type === 2 ? '用户' : 'AI';
    const blocks = message.content_block || [];
    
    let content = '';
    let thinkContent = '';
    
    for (const block of blocks) {
      if (block.block_type === 10000 && block.content?.text_block?.text) {
        content += block.content.text_block.text;
      }
      if (block.block_type === 10001) {
        thinkContent += block.content?.text_block?.text || '';
      }
    }
    
    return { role, content, thinkContent };
  }
}
```

### 6.2 DeepSeek适配器

```javascript
class DeepSeekAdapter extends PlatformAdapter {
  static detect() {
    return window.location.hostname.includes('deepseek.com');
  }
  
  constructor() {
    super();
    this.indexedDB = new IndexedDBStrategy();
  }
  
  async getConversations() {
    // 从IndexedDB读取所有对话
    const data = await this.indexedDB.read('deepseek-chat', 'history-message');
    return data.map(item => ({
      id: item.chat_session_id,
      title: item.data?.chat_session?.title || '未命名对话'
    }));
  }
  
  async getMessages(conversationId) {
    const data = await this.indexedDB.read('deepseek-chat', 'history-message', conversationId);
    return data?.data?.chat_messages || [];
  }
  
  formatMessage(message) {
    const role = message.role === 'USER' ? '用户' : 'DeepSeek';
    let content = '';
    let thinkContent = '';
    
    for (const fragment of message.fragments || []) {
      if (fragment.type === 'THINK') {
        thinkContent += fragment.content;
      } else if (fragment.type === 'RESPONSE' || fragment.type === 'REQUEST') {
        content += fragment.content;
      }
    }
    
    return { role, content, thinkContent };
  }
}
```

## 7. 用户界面设计

### 7.1 弹出窗口

```html
<div class="aiexporter-popup">
  <header>
    <h1>AI对话导出助手</h1>
    <span class="version">v2.0</span>
  </header>
  
  <main>
    <!-- 平台信息 -->
    <div class="platform-info">
      <span class="platform-name">当前平台: 豆包</span>
      <span class="conversation-count">共 25 个对话</span>
    </div>
    
    <!-- 导出选项 -->
    <div class="export-options">
      <label>
        <input type="radio" name="format" value="markdown" checked>
        Markdown
      </label>
      <label>
        <input type="radio" name="format" value="pdf">
        PDF
      </label>
      <label>
        <input type="radio" name="format" value="png">
        长图
      </label>
      <label>
        <input type="radio" name="format" value="json">
        JSON
      </label>
    </div>
    
    <!-- 高级选项 -->
    <div class="advanced-options">
      <label>
        <input type="checkbox" id="include-think" checked>
        包含思考过程
      </label>
      <label>
        <input type="checkbox" id="include-time" checked>
        包含时间戳
      </label>
      <label>
        <input type="checkbox" id="single-file">
        合并为单个文件
      </label>
    </div>
    
    <!-- 进度显示 -->
    <div class="progress-container" style="display: none;">
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
      <span class="progress-text">0/25</span>
    </div>
    
    <!-- 操作按钮 -->
    <div class="actions">
      <button id="export-current">导出当前对话</button>
      <button id="export-all">导出全部对话</button>
      <button id="stop-export" style="display: none;">停止</button>
    </div>
  </main>
  
  <footer>
    <a href="https://github.com/liguo6825-ux/ai-chat-exporter-pro" target="_blank">
      GitHub
    </a>
  </footer>
</div>
```

### 7.2 进度显示

```javascript
class ProgressUI {
  constructor(container) {
    this.container = container;
    this.progressBar = container.querySelector('.progress-fill');
    this.progressText = container.querySelector('.progress-text');
  }
  
  show() {
    this.container.style.display = 'block';
  }
  
  hide() {
    this.container.style.display = 'none';
  }
  
  update(current, total, status = '') {
    const percentage = (current / total) * 100;
    this.progressBar.style.width = `${percentage}%`;
    this.progressText.textContent = `${current}/${total} ${status}`;
  }
  
  complete() {
    this.progressBar.style.width = '100%';
    this.progressText.textContent = '完成!';
    setTimeout(() => this.hide(), 2000);
  }
}
```

## 8. 错误处理

### 8.1 重试机制

```javascript
class RetryHelper {
  static async withRetry(fn, options = {}) {
    const {
      maxRetries = 3,
      delay = 1000,
      backoff = 2,
      onRetry = () => {}
    } = options;
    
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (i < maxRetries - 1) {
          onRetry({ attempt: i + 1, error });
          await this.sleep(delay * Math.pow(backoff, i));
        }
      }
    }
    
    throw lastError;
  }
  
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 8.2 错误分类

```javascript
class ExportError extends Error {
  constructor(type, message, details = {}) {
    super(message);
    this.type = type;
    this.details = details;
  }
}

const ErrorType = {
  NETWORK: 'network',           // 网络错误
  AUTH: 'auth',                 // 认证错误
  NOT_FOUND: 'not_found',       // 资源不存在
  TIMEOUT: 'timeout',           // 超时
  RATE_LIMIT: 'rate_limit',     // 限流
  UNKNOWN: 'unknown'            // 未知错误
};
```

## 9. 性能优化

### 9.1 并发控制

```javascript
class ConcurrencyLimiter {
  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency;
    this.running = 0;
    this.queue = [];
  }
  
  async run(fn) {
    if (this.running >= this.maxConcurrency) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    
    this.running++;
    
    try {
      return await fn();
    } finally {
      this.running--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }
}
```

### 9.2 缓存机制

```javascript
class CacheManager {
  constructor(maxSize = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (item && Date.now() - item.timestamp < 300000) { // 5分钟过期
      return item.data;
    }
    return null;
  }
  
  set(key, data) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}
```

## 10. 测试策略

### 10.1 单元测试

```javascript
// 测试适配器
describe('DoubaoAdapter', () => {
  test('detect platform', () => {
    // 模拟豆包环境
    Object.defineProperty(window, 'location', {
      value: { hostname: 'www.doubao.com' }
    });
    
    expect(DoubaoAdapter.detect()).toBe(true);
  });
  
  test('format message', () => {
    const adapter = new DoubaoAdapter();
    const message = {
      user_type: 2,
      content_block: [{
        block_type: 10000,
        content: { text_block: { text: 'Hello' } }
      }]
    };
    
    const result = adapter.formatMessage(message);
    expect(result.role).toBe('用户');
    expect(result.content).toBe('Hello');
  });
});
```

### 10.2 集成测试

```javascript
// 测试完整导出流程
describe('Export Pipeline', () => {
  test('export conversation', async () => {
    const pipeline = new ExportPipeline();
    const result = await pipeline
      .extract()
      .transform()
      .format('markdown')
      .export();
    
    expect(result).toContain('# AI对话导出');
    expect(result).toContain('用户:');
    expect(result).toContain('AI:');
  });
});
```

## 11. 扩展开发规范

### 11.1 目录结构规范

```
src/
  core/         # 核心引擎，不依赖具体平台
  platforms/    # 平台适配器，每个平台独立文件
  utils/        # 工具函数，按功能分类
  ui/           # 用户界面组件
```

### 11.2 命名规范

- 类名: PascalCase (e.g., `DoubaoAdapter`)
- 方法名: camelCase (e.g., `getConversations`)
- 常量: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_COUNT`)
- 文件: kebab-case (e.g., `doubao-adapter.js`)

### 11.3 注释规范

```javascript
/**
 * 获取对话列表
 * @param {Object} options - 选项
 * @param {number} options.limit - 最大数量
 * @returns {Promise<Array>} 对话列表
 * @throws {ExportError} 当获取失败时抛出
 */
async getConversations(options = {}) {
  // 实现
}
```

## 12. 发布流程

### 12.1 版本管理

```bash
# 更新版本号
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

### 12.2 打包发布

```bash
# 打包扩展
zip -r ai-chat-exporter-pro-v2.0.zip \
  manifest.json \
  src/ \
  assets/ \
  _locales/

# 发布到Chrome Web Store
# 1. 访问 https://chrome.google.com/webstore/devconsole
# 2. 上传zip文件
# 3. 填写商店信息
# 4. 提交审核
```

## 13. 国际化支持

### 13.1 目录结构

```
_locales/
  zh_CN/
    messages.json
  en/
    messages.json
  ja/
    messages.json
```

### 13.2 消息格式

```json
{
  "appName": {
    "message": "AI对话导出助手",
    "description": "扩展名称"
  },
  "exportButton": {
    "message": "导出对话",
    "description": "导出按钮文本"
  },
  "processing": {
    "message": "处理中...",
    "description": "处理状态文本"
  }
}
```

## 14. 安全考虑

### 14.1 数据安全

- 所有数据处理在本地完成
- 不上传用户数据到服务器
- 敏感信息（Token等）不存储

### 14.2 权限最小化

```json
{
  "permissions": [
    "activeTab",
    "storage"
  ],
  "host_permissions": [
    "*://*.doubao.com/*",
    "*://*.deepseek.com/*",
    "*://*.chatgpt.com/*"
  ]
}
```

## 15. 未来扩展

### 15.1 计划支持的平台

- [ ] Claude (Anthropic)
- [ ] Gemini (Google)
- [ ] 通义千问 (阿里)
- [ ] 文心一言 (百度)
- [ ] 智谱清言

### 15.2 计划功能

- [ ] 云端同步
- [ ] 对话搜索
- [ ] 自动备份
- [ ] 数据统计
- [ ] 插件系统
