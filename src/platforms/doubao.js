/**
 * 豆包平台适配器
 */

class DoubaoAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = 'doubao';
    this.displayName = '豆包';
    this.hostname = 'doubao.com';
    this.interceptor = null;
    this.setupInterceptor();
  }
  
  /**
   * 检测当前页面是否匹配豆包平台
   * @returns {boolean}
   */
  static detect() {
    return window.location.hostname.includes('doubao.com');
  }
  
  /**
   * 设置API拦截器
   */
  setupInterceptor() {
    this.interceptor = {
      captures: new Map(),
      
      setup() {
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
                try {
                  const response = JSON.parse(this.responseText);
                  self.captures.set(this._url, {
                    method: this._method,
                    url: this._url,
                    response: response,
                    timestamp: Date.now()
                  });
                } catch (e) {
                  // 非JSON响应，忽略
                }
              }
            });
            return originalSend.apply(xhr, arguments);
          };
          
          return xhr;
        };
      },
      
      getCapture(urlPattern) {
        for (const [url, capture] of this.captures) {
          if (url.includes(urlPattern)) {
            return capture.response;
          }
        }
        return null;
      },
      
      async waitForResponse(urlPattern, timeout = 5000) {
        return new Promise((resolve, reject) => {
          const startTime = Date.now();
          
          const checkInterval = setInterval(() => {
            const capture = this.getCapture(urlPattern);
            if (capture) {
              clearInterval(checkInterval);
              resolve(capture);
              return;
            }
            
            if (Date.now() - startTime > timeout) {
              clearInterval(checkInterval);
              reject(new Error(`等待响应超时: ${urlPattern}`));
            }
          }, 100);
        });
      }
    };
    
    this.interceptor.setup();
  }
  
  /**
   * 获取对话列表
   * @returns {Promise<Array>}
   */
  async getConversations() {
    // 从侧边栏获取对话列表
    const sidebarItems = document.querySelectorAll('[class*="conversation-list"] a, [class*="chat-list"] a');
    const conversations = [];
    
    for (const item of sidebarItems) {
      const href = item.getAttribute('href');
      const title = item.textContent?.trim();
      
      if (href && href.includes('/chat/')) {
        const id = href.split('/chat/')[1];
        if (id && title) {
          conversations.push({
            id: id,
            title: title,
            url: href
          });
        }
      }
    }
    
    return conversations;
  }
  
  /**
   * 获取对话内容
   * @param {string} conversationId - 对话ID
   * @returns {Promise<Array>}
   */
  async getMessages(conversationId) {
    // 点击对话触发API请求
    await this.clickConversation(conversationId);
    
    // 等待API响应
    try {
      const response = await this.interceptor.waitForResponse('/im/chain/single', 5000);
      const messages = response.downlink_body?.pull_singe_chain_downlink_body?.messages || [];
      
      // 检查是否有更多消息
      const hasMore = response.downlink_body?.pull_singe_chain_downlink_body?.has_more;
      if (hasMore) {
        const msgCursor = response.downlink_body?.pull_singe_chain_downlink_body?.msg_cursor;
        const moreMessages = await this.loadMoreMessages(conversationId, msgCursor);
        messages.push(...moreMessages);
      }
      
      return messages;
    } catch (error) {
      console.warn('获取消息失败:', error);
      return [];
    }
  }
  
  /**
   * 点击对话
   * @param {string} conversationId - 对话ID
   */
  async clickConversation(conversationId) {
    // 查找对话链接
    const link = document.querySelector(`a[href*="/chat/${conversationId}"]`);
    if (link) {
      this.click(link);
      await this.sleep(1000);
    }
  }
  
  /**
   * 加载更多消息
   * @param {string} conversationId - 对话ID
   * @param {string} msgCursor - 消息游标
   * @returns {Promise<Array>}
   */
  async loadMoreMessages(conversationId, msgCursor) {
    // 这里需要触发加载更多消息的操作
    // 具体实现取决于豆包的加载机制
    return [];
  }
  
  /**
   * 获取消息角色
   * @param {Object} message - 消息对象
   * @returns {string}
   */
  getRole(message) {
    // user_type: 1 = AI, 2 = 用户
    return message.user_type === 2 ? '用户' : 'AI';
  }
  
  /**
   * 提取消息内容
   * @param {Object} message - 消息对象
   * @returns {string}
   */
  extractContent(message) {
    const blocks = message.content_block || [];
    let content = '';
    
    for (const block of blocks) {
      if (block.block_type === 10000 && block.content?.text_block?.text) {
        content += block.content.text_block.text;
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
    const blocks = message.content_block || [];
    let thinkContent = '';
    
    for (const block of blocks) {
      if (block.block_type === 10001 && block.content?.text_block?.text) {
        thinkContent += block.content.text_block.text;
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
      messageId: message.message_id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      contentType: message.content_type,
      contentStatus: message.content_status,
      indexInConv: message.index_in_conv,
      messageBodyVersion: message.message_body_version,
      secSender: message.sec_sender
    };
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DoubaoAdapter };
}
