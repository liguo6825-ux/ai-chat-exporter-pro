/**
 * AI Chat Exporter Pro - 主内容脚本
 * 负责检测平台、初始化适配器、处理导出请求
 */

class AIChatExporter {
  constructor() {
    this.adapter = null;
    this.isExporting = false;
    this.exportQueue = [];
    this.init();
  }

  /**
   * 初始化
   */
  init() {
    // 检测当前平台
    this.adapter = this.detectPlatform();
    
    if (this.adapter) {
      console.log(`[AI Chat Exporter] 检测到平台: ${this.adapter.getDisplayName()}`);
      this.setupMessageListener();
      this.injectUI();
    } else {
      console.log('[AI Chat Exporter] 未检测到支持的平台');
    }
  }

  /**
   * 检测当前平台
   * @returns {PlatformAdapter|null}
   */
  detectPlatform() {
    const adapters = [
      DoubaoAdapter,
      DeepSeekAdapter
      // 后续添加更多平台
    ];

    for (const AdapterClass of adapters) {
      if (AdapterClass.detect()) {
        return new AdapterClass();
      }
    }

    return null;
  }

  /**
   * 设置消息监听
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 保持消息通道开放
    });
  }

  /**
   * 处理消息
   * @param {Object} request - 请求对象
   * @param {Object} sender - 发送者
   * @param {Function} sendResponse - 响应函数
   */
  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'getPlatform':
          sendResponse({
            success: true,
            platform: this.adapter ? {
              name: this.adapter.getName(),
              displayName: this.adapter.getDisplayName()
            } : null
          });
          break;

        case 'getConversations':
          const conversations = await this.getConversations();
          sendResponse({ success: true, conversations });
          break;

        case 'exportConversation':
          const result = await this.exportConversation(
            request.conversationId,
            request.options
          );
          sendResponse({ success: true, result });
          break;

        case 'exportAll':
          const results = await this.exportAll(request.options);
          sendResponse({ success: true, results });
          break;

        case 'getProgress':
          sendResponse({
            success: true,
            progress: this.getProgress()
          });
          break;

        case 'stopExport':
          this.stopExport();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: '未知操作' });
      }
    } catch (error) {
      console.error('[AI Chat Exporter] 处理消息失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * 获取对话列表
   * @returns {Promise<Array>}
   */
  async getConversations() {
    if (!this.adapter) {
      throw new Error('未初始化平台适配器');
    }

    return await this.adapter.getConversations();
  }

  /**
   * 导出单个对话
   * @param {string} conversationId - 对话ID
   * @param {Object} options - 导出选项
   * @returns {Promise<Object>}
   */
  async exportConversation(conversationId, options = {}) {
    if (this.isExporting) {
      throw new Error('正在导出中，请等待完成');
    }

    this.isExporting = true;

    try {
      // 获取消息
      const messages = await this.adapter.getMessages(conversationId);

      // 创建对话对象
      const conversation = {
        id: conversationId,
        title: await this.getConversationTitle(conversationId),
        messages: messages
      };

      // 导出
      const engine = new ExportEngine(options);
      const result = await engine.export(conversation, options);

      // 下载文件
      this.downloadResult(result);

      return result;
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * 导出所有对话
   * @param {Object} options - 导出选项
   * @returns {Promise<Array>}
   */
  async exportAll(options = {}) {
    if (this.isExporting) {
      throw new Error('正在导出中，请等待完成');
    }

    this.isExporting = true;

    try {
      // 获取所有对话
      const conversations = await this.getConversations();
      const results = [];

      for (let i = 0; i < conversations.length; i++) {
        const conv = conversations[i];

        // 报告进度
        this.reportProgress({
          current: i + 1,
          total: conversations.length,
          status: 'exporting',
          conversation: conv.title
        });

        try {
          // 获取消息
          const messages = await this.adapter.getMessages(conv.id);

          // 创建对话对象
          const conversation = {
            id: conv.id,
            title: conv.title,
            messages: messages
          };

          // 导出
          const engine = new ExportEngine(options);
          const result = await engine.export(conversation, {
            ...options,
            zipOutput: false // 不单独打包
          });

          results.push(result);

          this.reportProgress({
            current: i + 1,
            total: conversations.length,
            status: 'success',
            conversation: conv.title
          });
        } catch (error) {
          console.error(`导出对话失败: ${conv.title}`, error);

          this.reportProgress({
            current: i + 1,
            total: conversations.length,
            status: 'error',
            conversation: conv.title,
            error: error.message
          });
        }
      }

      // 如果有多于一个结果，打包为ZIP
      if (results.length > 1 && options.zipOutput !== false) {
        const zipResult = await this.createZip(results);
        this.downloadResult(zipResult);
        return [zipResult];
      }

      // 下载每个文件
      for (const result of results) {
        this.downloadResult(result);
      }

      return results;
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * 获取对话标题
   * @param {string} conversationId - 对话ID
   * @returns {Promise<string>}
   */
  async getConversationTitle(conversationId) {
    const conversations = await this.getConversations();
    const conv = conversations.find(c => c.id === conversationId);
    return conv?.title || '未命名对话';
  }

  /**
   * 创建ZIP文件
   * @param {Array} files - 文件列表
   * @returns {Promise<Object>}
   */
  async createZip(files) {
    const zip = new JSZip();

    for (const file of files) {
      if (file.content instanceof Blob) {
        zip.file(file.name, file.content);
      } else {
        zip.file(file.name, file.content);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });

    return {
      name: `ai-chat-export-${this.getTimestamp()}.zip`,
      content: blob
    };
  }

  /**
   * 下载结果
   * @param {Object} result - 导出结果
   */
  downloadResult(result) {
    if (!result) return;

    const url = result.content instanceof Blob
      ? URL.createObjectURL(result.content)
      : URL.createObjectURL(new Blob([result.content], { type: 'text/plain' }));

    const a = document.createElement('a');
    a.href = url;
    a.download = result.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 清理
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * 报告进度
   * @param {Object} progress - 进度信息
   */
  reportProgress(progress) {
    // 发送消息到popup
    chrome.runtime.sendMessage({
      action: 'progress',
      progress
    }).catch(() => {
      // popup可能未打开，忽略错误
    });
  }

  /**
   * 获取当前进度
   * @returns {Object|null}
   */
  getProgress() {
    return this.currentProgress;
  }

  /**
   * 停止导出
   */
  stopExport() {
    this.isExporting = false;
  }

  /**
   * 注入UI
   */
  injectUI() {
    // 可以在这里注入浮动按钮或其他UI元素
    console.log('[AI Chat Exporter] UI已注入');
  }

  /**
   * 获取时间戳
   * @returns {string}
   */
  getTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  }
}

// 初始化
const exporter = new AIChatExporter();

// 导出到全局（方便调试）
window.aiChatExporter = exporter;
