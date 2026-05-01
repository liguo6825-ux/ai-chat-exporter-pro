/**
 * 消息格式化引擎
 * 支持多种输出格式
 */

class MessageFormatter {
  constructor(options = {}) {
    this.options = {
      includeThink: true,
      includeTime: true,
      includeMetadata: true,
      dateFormat: 'YYYY-MM-DD HH:mm:ss',
      ...options
    };
  }
  
  /**
   * 格式化单条消息
   * @param {Object} message - 原始消息对象
   * @param {string} format - 输出格式
   * @returns {string} 格式化后的消息
   */
  format(message, format = 'markdown') {
    const parsed = this.parseMessage(message);
    
    switch (format.toLowerCase()) {
      case 'markdown':
      case 'md':
        return this.toMarkdown(parsed);
      case 'html':
        return this.toHTML(parsed);
      case 'json':
        return this.toJSON(parsed);
      case 'text':
      case 'txt':
        return this.toText(parsed);
      default:
        return this.toMarkdown(parsed);
    }
  }
  
  /**
   * 解析消息对象
   * @param {Object} message - 原始消息
   * @returns {Object} 解析后的消息
   */
  parseMessage(message) {
    return {
      id: message.id || message.message_id,
      role: this.getRole(message),
      content: this.extractContent(message),
      thinkContent: this.extractThinkContent(message),
      createTime: message.create_time || message.timestamp,
      updateTime: message.update_time,
      contentType: message.content_type,
      metadata: this.extractMetadata(message)
    };
  }
  
  /**
   * 获取消息角色
   * @param {Object} message - 消息对象
   * @returns {string} 角色名称
   */
  getRole(message) {
    // 豆包平台
    if (message.user_type !== undefined) {
      return message.user_type === 2 ? '用户' : 'AI';
    }
    
    // DeepSeek平台
    if (message.role) {
      const roleMap = {
        'USER': '用户',
        'ASSISTANT': 'DeepSeek',
        'SYSTEM': '系统'
      };
      return roleMap[message.role] || message.role;
    }
    
    // ChatGPT平台
    if (message.author?.role) {
      const roleMap = {
        'user': '用户',
        'assistant': 'ChatGPT',
        'system': '系统'
      };
      return roleMap[message.author.role] || message.author.role;
    }
    
    return '未知';
  }
  
  /**
   * 提取消息内容
   * @param {Object} message - 消息对象
   * @returns {string} 消息内容
   */
  extractContent(message) {
    // 直接内容
    if (message.content && typeof message.content === 'string') {
      return message.content;
    }
    
    // 豆包 content_block
    if (message.content_block) {
      return message.content_block
        .filter(block => block.block_type === 10000)
        .map(block => block.content?.text_block?.text || '')
        .join('');
    }
    
    // DeepSeek fragments
    if (message.fragments) {
      return message.fragments
        .filter(f => f.type === 'RESPONSE' || f.type === 'REQUEST')
        .map(f => f.content)
        .join('');
    }
    
    // ChatGPT text
    if (message.text) {
      return message.text;
    }
    
    return '';
  }
  
  /**
   * 提取思考过程
   * @param {Object} message - 消息对象
   * @returns {string} 思考内容
   */
  extractThinkContent(message) {
    // 豆包思考过程
    if (message.content_block) {
      return message.content_block
        .filter(block => block.block_type === 10001)
        .map(block => block.content?.text_block?.text || '')
        .join('');
    }
    
    // DeepSeek思考过程
    if (message.fragments) {
      return message.fragments
        .filter(f => f.type === 'THINK')
        .map(f => f.content)
        .join('');
    }
    
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
      senderId: message.sender_id,
      contentType: message.content_type,
      contentStatus: message.content_status,
      indexInConv: message.index_in_conv,
      messageBodyVersion: message.message_body_version
    };
  }
  
  /**
   * 转换为Markdown格式
   * @param {Object} parsed - 解析后的消息
   * @returns {string} Markdown文本
   */
  toMarkdown(parsed) {
    let result = `### ${parsed.role}`;
    
    if (this.options.includeTime && parsed.createTime) {
      const time = this.formatTime(parsed.createTime);
      result += ` (${time})`;
    }
    
    result += '\n\n';
    
    // 思考过程
    if (this.options.includeThink && parsed.thinkContent) {
      result += `<think>\n${parsed.thinkContent}\n</think>\n\n`;
    }
    
    // 主要内容
    result += `${parsed.content}\n\n---\n`;
    
    return result;
  }
  
  /**
   * 转换为HTML格式
   * @param {Object} parsed - 解析后的消息
   * @returns {string} HTML文本
   */
  toHTML(parsed) {
    const roleClass = parsed.role === '用户' ? 'user' : 'assistant';
    
    let html = `<div class="message ${roleClass}" data-message-id="${parsed.id}">`;
    
    // 头部
    html += `<div class="message-header">`;
    html += `<span class="role">${parsed.role}</span>`;
    if (this.options.includeTime && parsed.createTime) {
      html += `<span class="time">${this.formatTime(parsed.createTime)}</span>`;
    }
    html += `</div>`;
    
    // 思考过程
    if (this.options.includeThink && parsed.thinkContent) {
      html += `<div class="think-content">`;
      html += `<details>`;
      html += `<summary>思考过程</summary>`;
      html += `<pre>${this.escapeHTML(parsed.thinkContent)}</pre>`;
      html += `</details>`;
      html += `</div>`;
    }
    
    // 主要内容
    html += `<div class="message-content">`;
    html += this.markdownToHTML(parsed.content);
    html += `</div>`;
    
    html += `</div>`;
    
    return html;
  }
  
  /**
   * 转换为JSON格式
   * @param {Object} parsed - 解析后的消息
   * @returns {string} JSON文本
   */
  toJSON(parsed) {
    return JSON.stringify(parsed, null, 2);
  }
  
  /**
   * 转换为纯文本格式
   * @param {Object} parsed - 解析后的消息
   * @returns {string} 纯文本
   */
  toText(parsed) {
    let result = `${parsed.role}:`;
    
    if (this.options.includeTime && parsed.createTime) {
      result += ` [${this.formatTime(parsed.createTime)}]`;
    }
    
    result += '\n';
    
    if (this.options.includeThink && parsed.thinkContent) {
      result += `\n[思考过程]\n${parsed.thinkContent}\n`;
    }
    
    result += `\n${parsed.content}\n\n`;
    
    return result;
  }
  
  /**
   * 格式化时间戳
   * @param {number|string} timestamp - 时间戳
   * @returns {string} 格式化后的时间
   */
  formatTime(timestamp) {
    if (!timestamp) return '';
    
    // 处理秒级时间戳
    const ms = timestamp.toString().length === 10 
      ? timestamp * 1000 
      : timestamp;
    
    const date = new Date(parseInt(ms));
    
    // 使用简单格式化
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }
  
  /**
   * 简单的Markdown转HTML
   * @param {string} markdown - Markdown文本
   * @returns {string} HTML文本
   */
  markdownToHTML(markdown) {
    if (!markdown) return '';
    
    return markdown
      // 代码块
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      // 行内代码
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // 粗体
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // 斜体
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // 链接
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // 换行
      .replace(/\n/g, '<br>');
  }
  
  /**
   * HTML转义
   * @param {string} text - 原始文本
   * @returns {string} 转义后的文本
   */
  escapeHTML(text) {
    if (!text) return '';
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

/**
 * 对话格式化器
 * 格式化整个对话
 */
class ConversationFormatter {
  constructor(options = {}) {
    this.messageFormatter = new MessageFormatter(options);
    this.options = options;
  }
  
  /**
   * 格式化对话
   * @param {Object} conversation - 对话对象
   * @param {string} format - 输出格式
   * @returns {string} 格式化后的对话
   */
  format(conversation, format = 'markdown') {
    switch (format.toLowerCase()) {
      case 'markdown':
      case 'md':
        return this.toMarkdown(conversation);
      case 'html':
        return this.toHTML(conversation);
      case 'json':
        return this.toJSON(conversation);
      case 'text':
      case 'txt':
        return this.toText(conversation);
      default:
        return this.toMarkdown(conversation);
    }
  }
  
  /**
   * 转换为Markdown
   * @param {Object} conversation - 对话对象
   * @returns {string} Markdown文本
   */
  toMarkdown(conversation) {
    let output = `# ${conversation.title || '未命名对话'}\n\n`;
    
    if (this.options.includeMetadata) {
      output += `> 对话ID: ${conversation.id}\n`;
      output += `> 消息数: ${conversation.messages?.length || 0}\n`;
      output += `> 导出时间: ${new Date().toLocaleString()}\n\n`;
    }
    
    output += `---\n\n`;
    
    for (const message of conversation.messages || []) {
      output += this.messageFormatter.format(message, 'markdown');
      output += '\n';
    }
    
    return output;
  }
  
  /**
   * 转换为HTML
   * @param {Object} conversation - 对话对象
   * @returns {string} HTML文本
   */
  toHTML(conversation) {
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${conversation.title || '对话导出'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .message { margin-bottom: 20px; padding: 15px; border-radius: 8px; }
    .message.user { background: #f0f0f0; }
    .message.assistant { background: #f5f5f5; }
    .message-header { font-weight: bold; margin-bottom: 10px; }
    .think-content { background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 10px; }
    .message-content { line-height: 1.6; }
    code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>${conversation.title || '对话导出'}</h1>
  <p>导出时间: ${new Date().toLocaleString()}</p>
  <hr>`;
    
    for (const message of conversation.messages || []) {
      html += this.messageFormatter.format(message, 'html');
    }
    
    html += `</body></html>`;
    
    return html;
  }
  
  /**
   * 转换为JSON
   * @param {Object} conversation - 对话对象
   * @returns {string} JSON文本
   */
  toJSON(conversation) {
    const data = {
      version: '2.0',
      exportTime: new Date().toISOString(),
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createTime: conversation.createTime,
        messageCount: conversation.messages?.length || 0,
        messages: (conversation.messages || []).map(msg => {
          const parsed = this.messageFormatter.parseMessage(msg);
          return {
            id: parsed.id,
            role: parsed.role,
            content: parsed.content,
            thinkContent: parsed.thinkContent,
            createTime: parsed.createTime,
            metadata: parsed.metadata
          };
        })
      }
    };
    
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * 转换为纯文本
   * @param {Object} conversation - 对话对象
   * @returns {string} 纯文本
   */
  toText(conversation) {
    let output = `${conversation.title || '未命名对话'}\n`;
    output += `${'='.repeat(50)}\n\n`;
    
    for (const message of conversation.messages || []) {
      output += this.messageFormatter.format(message, 'text');
      output += '\n';
    }
    
    return output;
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MessageFormatter,
    ConversationFormatter
  };
}
