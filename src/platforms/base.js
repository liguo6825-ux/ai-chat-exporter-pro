/**
 * 平台适配器基类
 * 所有平台适配器必须继承此类
 */

class PlatformAdapter {
  constructor() {
    this.name = 'base';
    this.displayName = '基础适配器';
    this.hostname = '';
  }
  
  /**
   * 检测当前页面是否匹配该平台
   * @returns {boolean} 是否匹配
   */
  static detect() {
    return false;
  }
  
  /**
   * 获取平台名称
   * @returns {string} 平台名称
   */
  getName() {
    return this.name;
  }
  
  /**
   * 获取平台显示名称
   * @returns {string} 显示名称
   */
  getDisplayName() {
    return this.displayName;
  }
  
  /**
   * 获取对话列表
   * @returns {Promise<Array>} 对话列表
   */
  async getConversations() {
    throw new Error('子类必须实现 getConversations 方法');
  }
  
  /**
   * 获取对话内容
   * @param {string} conversationId - 对话ID
   * @returns {Promise<Array>} 消息列表
   */
  async getMessages(conversationId) {
    throw new Error('子类必须实现 getMessages 方法');
  }
  
  /**
   * 格式化消息
   * @param {Object} message - 原始消息
   * @returns {Object} 格式化后的消息
   */
  formatMessage(message) {
    return {
      id: message.id || message.message_id,
      role: this.getRole(message),
      content: this.extractContent(message),
      thinkContent: this.extractThinkContent(message),
      createTime: message.create_time,
      metadata: this.extractMetadata(message)
    };
  }
  
  /**
   * 获取消息角色
   * @param {Object} message - 消息对象
   * @returns {string} 角色名称
   */
  getRole(message) {
    return '未知';
  }
  
  /**
   * 提取消息内容
   * @param {Object} message - 消息对象
   * @returns {string} 消息内容
   */
  extractContent(message) {
    return message.content || '';
  }
  
  /**
   * 提取思考过程
   * @param {Object} message - 消息对象
   * @returns {string} 思考内容
   */
  extractThinkContent(message) {
    return '';
  }
  
  /**
   * 提取元数据
   * @param {Object} message - 消息对象
   * @returns {Object} 元数据
   */
  extractMetadata(message) {
    return {
      messageId: message.message_id || message.id,
      conversationId: message.conversation_id,
      contentType: message.content_type
    };
  }
  
  /**
   * 自动滚动加载历史消息
   * @param {HTMLElement} element - 滚动容器
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 滚动结果
   */
  async autoScroll(element, options = {}) {
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
  
  /**
   * 延迟函数
   * @param {number} ms - 毫秒
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 触发点击事件
   * @param {HTMLElement} element - 元素
   */
  click(element) {
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    element.dispatchEvent(event);
  }
  
  /**
   * 等待元素出现
   * @param {string} selector - CSS选择器
   * @param {number} timeout - 超时时间
   * @returns {Promise<HTMLElement>}
   */
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`等待元素超时: ${selector}`));
      }, timeout);
    });
  }
  
  /**
   * 等待条件满足
   * @param {Function} condition - 条件函数
   * @param {number} timeout - 超时时间
   * @returns {Promise<boolean>}
   */
  waitForCondition(condition, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const check = () => {
        if (condition()) {
          resolve(true);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error('等待条件超时'));
          return;
        }
        
        requestAnimationFrame(check);
      };
      
      check();
    });
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PlatformAdapter };
}
