/**
 * 自动滚动加载工具
 * 用于加载虚拟滚动的历史消息
 */

class AutoScroller {
  constructor(options = {}) {
    this.options = {
      checkInterval: 500,
      maxUnchanged: 3,
      scrollStep: null, // null表示使用容器高度
      disableUserInteraction: true,
      ...options
    };
    
    this.isRunning = false;
    this.shouldStop = false;
  }
  
  /**
   * 开始自动滚动
   * @param {HTMLElement} element - 滚动容器
   * @param {Object} callbacks - 回调函数
   * @returns {Promise<Object>}
   */
  async scroll(element, callbacks = {}) {
    if (!element) {
      throw new Error('滚动容器不能为空');
    }
    
    const {
      onProgress = () => {},
      onComplete = () => {},
      onError = () => {}
    } = callbacks;
    
    this.isRunning = true;
    this.shouldStop = false;
    
    let lastScrollTop = -1;
    let unchangedCount = 0;
    let totalScrolls = 0;
    let maxScrollTop = 0;
    
    // 保存原始状态
    const originalStyles = this.saveOriginalStyles(element);
    
    // 禁用用户交互
    if (this.options.disableUserInteraction) {
      this.disableInteraction(element);
    }
    
    try {
      onProgress({
        status: 'started',
        totalScrolls: 0,
        scrollTop: element.scrollTop,
        maxScrollTop: element.scrollHeight
      });
      
      while (unchangedCount < this.options.maxUnchanged && !this.shouldStop) {
        // 计算滚动步长
        const scrollStep = this.options.scrollStep || element.clientHeight;
        
        // 执行滚动
        element.scrollTo({
          top: element.scrollTop + scrollStep,
          behavior: 'instant'
        });
        
        // 等待内容加载
        await this.sleep(this.options.checkInterval);
        
        // 检查滚动位置是否变化
        if (element.scrollTop === lastScrollTop) {
          unchangedCount++;
        } else {
          unchangedCount = 0;
          lastScrollTop = element.scrollTop;
          maxScrollTop = Math.max(maxScrollTop, lastScrollTop);
        }
        
        totalScrolls++;
        
        // 报告进度
        onProgress({
          status: 'scrolling',
          totalScrolls,
          scrollTop: lastScrollTop,
          maxScrollTop: element.scrollHeight,
          unchangedCount
        });
      }
      
      const result = {
        status: this.shouldStop ? 'stopped' : 'completed',
        totalScrolls,
        maxScrollTop,
        reachedBottom: unchangedCount >= this.options.maxUnchanged
      };
      
      onComplete(result);
      
      return result;
      
    } catch (error) {
      onError(error);
      throw error;
    } finally {
      // 恢复原始状态
      if (this.options.disableUserInteraction) {
        this.restoreOriginalStyles(element, originalStyles);
      }
      
      this.isRunning = false;
    }
  }
  
  /**
   * 停止滚动
   */
  stop() {
    this.shouldStop = true;
  }
  
  /**
   * 检查是否正在运行
   * @returns {boolean}
   */
  isScrolling() {
    return this.isRunning;
  }
  
  /**
   * 保存原始样式
   * @param {HTMLElement} element
   * @returns {Object}
   */
  saveOriginalStyles(element) {
    return {
      overflow: element.style.overflow,
      pointerEvents: element.style.pointerEvents,
      userSelect: element.style.userSelect
    };
  }
  
  /**
   * 禁用用户交互
   * @param {HTMLElement} element
   */
  disableInteraction(element) {
    element.style.overflow = 'hidden';
    element.style.pointerEvents = 'none';
    element.style.userSelect = 'none';
  }
  
  /**
   * 恢复原始样式
   * @param {HTMLElement} element
   * @param {Object} styles
   */
  restoreOriginalStyles(element, styles) {
    element.style.overflow = styles.overflow;
    element.style.pointerEvents = styles.pointerEvents;
    element.style.userSelect = styles.userSelect;
  }
  
  /**
   * 延迟函数
   * @param {number} ms
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 滚动到顶部
   * @param {HTMLElement} element
   */
  scrollToTop(element) {
    element.scrollTo({ top: 0, behavior: 'instant' });
  }
  
  /**
   * 滚动到底部
   * @param {HTMLElement} element
   */
  scrollToBottom(element) {
    element.scrollTo({ top: element.scrollHeight, behavior: 'instant' });
  }
  
  /**
   * 获取滚动进度
   * @param {HTMLElement} element
   * @returns {number} 0-1之间的进度
   */
  getScrollProgress(element) {
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight - element.clientHeight;
    
    if (scrollHeight <= 0) return 1;
    
    return Math.min(scrollTop / scrollHeight, 1);
  }
}

/**
 * 滚动检测工具
 */
class ScrollDetector {
  constructor(element) {
    this.element = element;
    this.lastScrollTop = 0;
    this.isScrolling = false;
    this.scrollTimeout = null;
    
    this.setupListeners();
  }
  
  setupListeners() {
    this.element.addEventListener('scroll', () => {
      this.isScrolling = true;
      this.lastScrollTop = this.element.scrollTop;
      
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        this.isScrolling = false;
      }, 150);
    });
  }
  
  /**
   * 检查是否正在滚动
   * @returns {boolean}
   */
  isScrollingActive() {
    return this.isScrolling;
  }
  
  /**
   * 检查是否滚动到底部
   * @returns {boolean}
   */
  isAtBottom() {
    const { scrollTop, scrollHeight, clientHeight } = this.element;
    return scrollTop + clientHeight >= scrollHeight - 10;
  }
  
  /**
   * 检查是否滚动到顶部
   * @returns {boolean}
   */
  isAtTop() {
    return this.element.scrollTop <= 10;
  }
  
  /**
   * 获取滚动方向
   * @returns {string} 'up' | 'down' | 'none'
   */
  getScrollDirection() {
    const currentScrollTop = this.element.scrollTop;
    const diff = currentScrollTop - this.lastScrollTop;
    
    if (Math.abs(diff) < 5) return 'none';
    return diff > 0 ? 'down' : 'up';
  }
  
  /**
   * 销毁
   */
  destroy() {
    clearTimeout(this.scrollTimeout);
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AutoScroller,
    ScrollDetector
  };
}
