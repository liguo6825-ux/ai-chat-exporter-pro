/**
 * DeepSeek平台适配器
 * 使用IndexedDB读取本地数据
 */

class DeepSeekAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = 'deepseek';
    this.displayName = 'DeepSeek';
    this.hostname = 'deepseek.com';
    this.dbName = 'deepseek-chat';
    this.storeName = 'history-message';
  }
  
  /**
   * 检测当前页面是否匹配DeepSeek平台
   * @returns {boolean}
   */
  static detect() {
    return window.location.hostname.includes('deepseek.com');
  }
  
  /**
   * 从IndexedDB读取数据
   * @param {string} id - 记录ID
   * @returns {Promise<Object>}
   */
  async readFromIndexedDB(id = null) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        
        try {
          const transaction = db.transaction([this.storeName], 'readonly');
          const store = transaction.objectStore(this.storeName);
          
          const getRequest = id ? store.get(id) : store.getAll();
          
          getRequest.onsuccess = () => resolve(getRequest.result);
          getRequest.onerror = () => reject(getRequest.error);
        } catch (error) {
          reject(error);
        }
      };
    });
  }
  
  /**
   * 获取对话列表
   * @returns {Promise<Array>}
   */
  async getConversations() {
    const data = await this.readFromIndexedDB();
    
    if (!Array.isArray(data)) {
      return [];
    }
    
    return data.map(item => ({
      id: item.chat_session_id || item.id,
      title: item.data?.chat_session?.title || '未命名对话',
      createTime: item.data?.chat_session?.create_time,
      messageCount: item.data?.chat_messages?.length || 0
    }));
  }
  
  /**
   * 获取对话内容
   * @param {string} conversationId - 对话ID
   * @returns {Promise<Array>}
   */
  async getMessages(conversationId) {
    const data = await this.readFromIndexedDB(conversationId);
    
    if (!data || !data.data) {
      return [];
    }
    
    return data.data.chat_messages || [];
  }
  
  /**
   * 获取消息角色
   * @param {Object} message - 消息对象
   * @returns {string}
   */
  getRole(message) {
    const roleMap = {
      'USER': '用户',
      'ASSISTANT': 'DeepSeek',
      'SYSTEM': '系统'
    };
    
    return roleMap[message.role] || message.role || '未知';
  }
  
  /**
   * 提取消息内容
   * @param {Object} message - 消息对象
   * @returns {string}
   */
  extractContent(message) {
    const fragments = message.fragments || [];
    let content = '';
    
    for (const fragment of fragments) {
      if (fragment.type === 'RESPONSE' || fragment.type === 'REQUEST') {
        content += fragment.content || '';
      }
    }
    
    return content;
  }
  
  /**
   * 提取思考过程
   * @param {Object} message - 消息对象
   * @returns {string}
   */
  extractThinkContent(message) {
    const fragments = message.fragments || [];
    let thinkContent = '';
    
    for (const fragment of fragments) {
      if (fragment.type === 'THINK') {
        thinkContent += fragment.content || '';
      }
    }
    
    return thinkContent;
  }
  
  /**
   * 提取元数据
   * @param {Object} message - 消息对象
   * @returns {Object}
   */
  extractMetadata(message) {
    return {
      messageId: message.id,
      role: message.role,
      model: message.model,
      finishReason: message.finish_reason,
      tokenCount: message.token_count,
      thinkingTime: message.thinking_time
    };
  }
  
  /**
   * 自动滚动加载历史消息
   * DeepSeek使用虚拟滚动，需要滚动加载
   * @param {HTMLElement} element - 滚动容器
   * @param {Object} options - 选项
   * @returns {Promise<Object>}
   */
  async autoScroll(element, options = {}) {
    const scrollContainer = element || document.querySelector('.ds-scroll-area');
    
    if (!scrollContainer) {
      console.warn('未找到滚动容器');
      return { totalScrolls: 0, maxScrollTop: 0 };
    }
    
    return super.autoScroll(scrollContainer, {
      checkInterval: 500,
      maxUnchanged: 3,
      ...options
    });
  }
  
  /**
   * 获取当前对话ID
   * @returns {string|null}
   */
  getCurrentConversationId() {
    const match = window.location.pathname.match(/\/s\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }
  
  /**
   * 获取当前对话标题
   * @returns {Promise<string>}
   */
  async getCurrentConversationTitle() {
    const id = this.getCurrentConversationId();
    
    if (id) {
      try {
        const data = await this.readFromIndexedDB(id);
        return data?.data?.chat_session?.title || '未命名对话';
      } catch (e) {
        console.warn('读取标题失败:', e);
      }
    }
    
    // 从DOM获取
    const titleElement = document.querySelector('.d8ed659a, [class*="chat-title"]');
    return titleElement?.textContent?.trim() || '未命名对话';
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DeepSeekAdapter };
}
