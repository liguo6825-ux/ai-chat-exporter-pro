/**
 * 导出引擎
 * 支持多种导出格式和方式
 */

class ExportEngine {
  constructor(options = {}) {
    this.options = {
      format: 'markdown',
      singleFile: false,
      includeMetadata: true,
      zipOutput: true,
      ...options
    };
    
    this.formatter = new ConversationFormatter(options);
    this.exporters = new Map();
    this.registerDefaultExporters();
  }
  
  /**
   * 注册默认导出器
   */
  registerDefaultExporters() {
    this.registerExporter('markdown', new MarkdownExporter());
    this.registerExporter('md', new MarkdownExporter());
    this.registerExporter('html', new HTMLExporter());
    this.registerExporter('json', new JSONExporter());
    this.registerExporter('text', new TextExporter());
    this.registerExporter('txt', new TextExporter());
    this.registerExporter('pdf', new PDFExporter());
    this.registerExporter('png', new PNGExporter());
  }
  
  /**
   * 注册自定义导出器
   * @param {string} name - 导出器名称
   * @param {BaseExporter} exporter - 导出器实例
   */
  registerExporter(name, exporter) {
    this.exporters.set(name, exporter);
  }
  
  /**
   * 导出对话
   * @param {Array|Object} conversations - 对话列表或单个对话
   * @param {Object} options - 导出选项
   * @returns {Promise<Object>} 导出结果
   */
  async export(conversations, options = {}) {
    const mergedOptions = { ...this.options, ...options };
    const { format, singleFile, zipOutput } = mergedOptions;
    
    // 确保是数组
    const convList = Array.isArray(conversations) 
      ? conversations 
      : [conversations];
    
    // 获取导出器
    const exporter = this.exporters.get(format);
    if (!exporter) {
      throw new Error(`不支持的导出格式: ${format}`);
    }
    
    // 导出结果
    const results = [];
    
    if (singleFile) {
      // 合并为单个文件
      const content = await this.exportSingleFile(convList, exporter, mergedOptions);
      results.push({
        name: `ai-chat-export.${exporter.getExtension()}`,
        content
      });
    } else {
      // 每个对话单独文件
      for (let i = 0; i < convList.length; i++) {
        const conv = convList[i];
        const content = await exporter.export(conv, mergedOptions);
        const filename = this.sanitizeFilename(conv.title || `conversation-${i + 1}`);
        
        results.push({
          name: `${filename}.${exporter.getExtension()}`,
          content
        });
      }
    }
    
    // ZIP打包
    if (zipOutput && results.length > 1) {
      const zipContent = await this.createZip(results);
      return {
        filename: `ai-chat-export-${this.getTimestamp()}.zip`,
        content: zipContent,
        files: results
      };
    }
    
    // 返回单个文件或文件列表
    return results.length === 1 
      ? results[0] 
      : results;
  }
  
  /**
   * 导出为单个文件
   * @param {Array} conversations - 对话列表
   * @param {BaseExporter} exporter - 导出器
   * @param {Object} options - 选项
   * @returns {Promise<string>} 文件内容
   */
  async exportSingleFile(conversations, exporter, options) {
    const parts = [];
    
    // 添加文件头
    parts.push(exporter.getHeader(options));
    
    // 添加每个对话
    for (let i = 0; i < conversations.length; i++) {
      const conv = conversations[i];
      parts.push(await exporter.export(conv, options));
      
      // 添加分隔符（除了最后一个）
      if (i < conversations.length - 1) {
        parts.push(exporter.getSeparator());
      }
    }
    
    // 添加文件尾
    parts.push(exporter.getFooter(options));
    
    return parts.join('\n');
  }
  
  /**
   * 创建ZIP文件
   * @param {Array} files - 文件列表
   * @returns {Promise<Blob>} ZIP文件
   */
  async createZip(files) {
    const zip = new JSZip();
    
    for (const file of files) {
      zip.file(file.name, file.content);
    }
    
    return zip.generateAsync({ type: 'blob' });
  }
  
  /**
   * 清理文件名
   * @param {string} filename - 原始文件名
   * @returns {string} 清理后的文件名
   */
  sanitizeFilename(filename) {
    if (!filename) return 'untitled';
    
    // 移除非法字符
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
  }
  
  /**
   * 获取时间戳
   * @returns {string} 时间戳字符串
   */
  getTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  }
}

/**
 * 基础导出器
 */
class BaseExporter {
  /**
   * 导出对话
   * @param {Object} conversation - 对话对象
   * @param {Object} options - 选项
   * @returns {Promise<string>} 文件内容
   */
  async export(conversation, options = {}) {
    throw new Error('子类必须实现 export 方法');
  }
  
  /**
   * 获取文件扩展名
   * @returns {string} 扩展名
   */
  getExtension() {
    return 'txt';
  }
  
  /**
   * 获取文件头
   * @param {Object} options - 选项
   * @returns {string} 文件头
   */
  getHeader(options = {}) {
    return '';
  }
  
  /**
   * 获取文件尾
   * @param {Object} options - 选项
   * @returns {string} 文件尾
   */
  getFooter(options = {}) {
    return '';
  }
  
  /**
   * 获取分隔符
   * @returns {string} 分隔符
   */
  getSeparator() {
    return '\n---\n';
  }
}

/**
 * Markdown导出器
 */
class MarkdownExporter extends BaseExporter {
  async export(conversation, options = {}) {
    const formatter = new ConversationFormatter(options);
    return formatter.toMarkdown(conversation);
  }
  
  getExtension() {
    return 'md';
  }
  
  getHeader(options = {}) {
    return '# AI对话导出\n\n' +
           `> 导出时间: ${new Date().toLocaleString()}\n` +
           '> 工具: AI Chat Exporter Pro\n\n' +
           '---\n\n';
  }
}

/**
 * HTML导出器
 */
class HTMLExporter extends BaseExporter {
  async export(conversation, options = {}) {
    const formatter = new ConversationFormatter(options);
    return formatter.toHTML(conversation);
  }
  
  getExtension() {
    return 'html';
  }
}

/**
 * JSON导出器
 */
class JSONExporter extends BaseExporter {
  async export(conversation, options = {}) {
    const formatter = new ConversationFormatter(options);
    return formatter.toJSON(conversation);
  }
  
  getExtension() {
    return 'json';
  }
}

/**
 * 文本导出器
 */
class TextExporter extends BaseExporter {
  async export(conversation, options = {}) {
    const formatter = new ConversationFormatter(options);
    return formatter.toText(conversation);
  }
  
  getExtension() {
    return 'txt';
  }
}

/**
 * PDF导出器
 */
class PDFExporter extends BaseExporter {
  async export(conversation, options = {}) {
    // 先导出为HTML
    const formatter = new ConversationFormatter(options);
    const html = formatter.toHTML(conversation);
    
    // 创建临时容器
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    
    try {
      // 预加载图片
      await this.preloadImages(container);
      
      // 使用html2canvas截图
      const canvas = await html2canvas(container, {
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
      
      return pdf.output('datauristring');
    } finally {
      document.body.removeChild(container);
    }
  }
  
  getExtension() {
    return 'pdf';
  }
  
  async preloadImages(container) {
    const images = container.querySelectorAll('img');
    
    for (const img of images) {
      try {
        const response = await fetch(img.src, { cache: 'no-store' });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        img.src = url;
      } catch (e) {
        console.warn('图片加载失败:', img.src);
      }
    }
  }
}

/**
 * PNG导出器
 */
class PNGExporter extends BaseExporter {
  async export(conversation, options = {}) {
    // 先导出为HTML
    const formatter = new ConversationFormatter(options);
    const html = formatter.toHTML(conversation);
    
    // 创建临时容器
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    
    try {
      // 预加载图片
      await this.preloadImages(container);
      
      // 使用html2canvas截图
      const canvas = await html2canvas(container, {
        logging: false,
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true
      });
      
      return canvas.toDataURL('image/png');
    } finally {
      document.body.removeChild(container);
    }
  }
  
  getExtension() {
    return 'png';
  }
  
  async preloadImages(container) {
    const images = container.querySelectorAll('img');
    
    for (const img of images) {
      try {
        const response = await fetch(img.src, { cache: 'no-store' });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        img.src = url;
      } catch (e) {
        console.warn('图片加载失败:', img.src);
      }
    }
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ExportEngine,
    BaseExporter,
    MarkdownExporter,
    HTMLExporter,
    JSONExporter,
    TextExporter,
    PDFExporter,
    PNGExporter
  };
}
