/**
 * 数据提取引擎
 * 负责从各种来源提取对话数据
 */

class DataExtractor {
  constructor() {
    this.strategies = new Map();
    this.registerDefaultStrategies();
  }
  
  /**
   * 注册默认的数据提取策略
   */
  registerDefaultStrategies() {
    this.registerStrategy('indexeddb', new IndexedDBStrategy());
    this.registerStrategy('api', new APIInterceptorStrategy());
    this.registerStrategy('dom', new DOMScrapeStrategy());
  }
  
  /**
   * 注册自定义策略
   * @param {string} name - 策略名称
   * @param {DataStrategy} strategy - 策略实例
   */
  registerStrategy(name, strategy) {
    this.strategies.set(name, strategy);
  }
  
  /**
   * 获取数据提取策略
   * @param {string} name - 策略名称
   * @returns {DataStrategy} 策略实例
   */
  getStrategy(name) {
    return this.strategies.get(name);
  }
  
  /**
   * 提取对话数据
   * @param {Object} options - 提取选项
   * @param {string} options.strategy - 使用的策略
   * @param {string} options.conversationId - 对话ID
   * @returns {Promise<Array>} 消息列表
   */
  async extract(options = {}) {
    const { strategy = 'auto', conversationId } = options;
    
    // 自动选择策略
    if (strategy === 'auto') {
      return this.autoExtract(conversationId);
    }
    
    // 使用指定策略
    const selectedStrategy = this.strategies.get(strategy);
    if (!selectedStrategy) {
      throw new ExportError(
        ErrorType.UNKNOWN,
        `未知的提取策略: ${strategy}`
      );
    }
    
    return selectedStrategy.extract(conversationId);
  }
  
  /**
   * 自动选择最佳策略提取数据
   * @param {string} conversationId - 对话ID
   * @returns {Promise<Array>} 消息列表
   */
  async autoExtract(conversationId) {
    // 按优先级尝试不同策略
    const strategies = ['indexeddb', 'api', 'dom'];
    
    for (const strategyName of strategies) {
      const strategy = this.strategies.get(strategyName);
      if (!strategy || !strategy.isAvailable()) {
        continue;
      }
      
      try {
        const result = await strategy.extract(conversationId);
        if (result && result.length > 0) {
          console.log(`使用 ${strategyName} 策略成功提取数据`);
          return result;
        }
      } catch (error) {
        console.warn(`${strategyName} 策略失败:`, error);
      }
    }
    
    throw new ExportError(
      ErrorType.UNKNOWN,
      '所有提取策略均失败'
    );
  }
}

/**
 * 数据提取策略基类
 */
class DataStrategy {
  /**
   * 检查策略是否可用
   * @returns {boolean} 是否可用
   */
  isAvailable() {
    return true;
  }
  
  /**
   * 提取数据
   * @param {string} conversationId - 对话ID
   * @returns {Promise<Array>} 消息列表
   */
  async extract(conversationId) {
    throw new Error('子类必须实现 extract 方法');
  }
}

/**
 * IndexedDB提取策略
 */
class IndexedDBStrategy extends DataStrategy {
  constructor(dbName, storeName) {
    super();
    this.dbName = dbName;
    this.storeName = storeName;
  }
  
  isAvailable() {
    return typeof indexedDB !== 'undefined';
  }
  
  async extract(conversationId) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        
        try {
          const transaction = db.transaction([this.storeName], 'readonly');
          const store = transaction.objectStore(this.storeName);
          
          const getRequest = conversationId 
            ? store.get(conversationId)
            : store.getAll();
          
          getRequest.onsuccess = () => resolve(getRequest.result);
          getRequest.onerror = () => reject(getRequest.error);
        } catch (error) {
          reject(error);
        }
      };
    });
  }
}

/**
 * API拦截策略
 */
class APIInterceptorStrategy extends DataStrategy {
  constructor() {
    super();
    this.captures = new Map();
    this.setupInterception();
  }
  
  setupInterception() {
    this.interceptXHR();
    this.interceptFetch();
  }
  
  interceptXHR() {
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
  
  interceptFetch() {
    const originalFetch = window.fetch;
    const self = this;
    
    window.fetch = async function(url, options = {}) {
      const response = await originalFetch.apply(this, arguments);
      
      // 克隆响应以便读取
      const clonedResponse = response.clone();
      
      try {
        const data = await clonedResponse.json();
        self.captures.set(url, {
          method: options.method || 'GET',
          url: url,
          response: data,
          timestamp: Date.now()
        });
      } catch (e) {
        // 非JSON响应，忽略
      }
      
      return response;
    };
  }
  
  async extract(conversationId) {
    // 查找匹配的API响应
    for (const [url, capture] of this.captures) {
      if (url.includes(conversationId) || url.includes('chain/single')) {
        return this.parseResponse(capture.response);
      }
    }
    
    return [];
  }
  
  parseResponse(response) {
    // 子类重写此方法解析特定格式
    return response;
  }
  
  waitForResponse(urlPattern, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        // 检查是否已有匹配的响应
        for (const [url, capture] of this.captures) {
          if (url.includes(urlPattern)) {
            clearInterval(checkInterval);
            resolve(capture.response);
            return;
          }
        }
        
        // 超时检查
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error(`等待响应超时: ${urlPattern}`));
        }
      }, 100);
    });
  }
}

/**
 * DOM抓取策略
 */
class DOMScrapeStrategy extends DataStrategy {
  constructor(selectors) {
    super();
    this.selectors = selectors;
  }
  
  async extract(conversationId) {
    const messages = [];
    const messageElements = document.querySelectorAll(this.selectors.message);
    
    for (const element of messageElements) {
      const message = this.parseMessageElement(element);
      if (message) {
        messages.push(message);
      }
    }
    
    return messages;
  }
  
  parseMessageElement(element) {
    // 子类重写此方法解析特定DOM结构
    return {
      role: element.querySelector(this.selectors.role)?.textContent,
      content: element.querySelector(this.selectors.content)?.textContent,
      time: element.querySelector(this.selectors.time)?.textContent
    };
  }
}

/**
 * 导出错误类
 */
class ExportError extends Error {
  constructor(type, message, details = {}) {
    super(message);
    this.type = type;
    this.details = details;
  }
}

/**
 * 错误类型枚举
 */
const ErrorType = {
  NETWORK: 'network',
  AUTH: 'auth',
  NOT_FOUND: 'not_found',
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  UNKNOWN: 'unknown'
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DataExtractor,
    DataStrategy,
    IndexedDBStrategy,
    APIInterceptorStrategy,
    DOMScrapeStrategy,
    ExportError,
    ErrorType
  };
}
