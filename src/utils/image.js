/**
 * 图片处理工具
 * 用于预加载和转换图片
 */

class ImagePreloader {
  constructor(options = {}) {
    this.options = {
      timeout: 10000,
      concurrent: 5,
      ...options
    };
    this.loadedImages = new Map();
  }
  
  /**
   * 预加载容器中的所有图片
   * @param {HTMLElement} container - 容器元素
   * @returns {Promise<Object>} 加载结果
   */
  async preload(container) {
    const images = container.querySelectorAll('img');
    const results = {
      total: images.length,
      success: 0,
      failed: 0,
      skipped: 0
    };
    
    if (images.length === 0) {
      return results;
    }
    
    console.log(`开始预加载 ${images.length} 张图片...`);
    
    // 分批处理，控制并发
    const batches = this.chunkArray(Array.from(images), this.options.concurrent);
    
    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(img => this.loadImage(img))
      );
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.skipped) {
            results.skipped++;
          } else {
            results.success++;
          }
        } else {
          results.failed++;
        }
      }
    }
    
    console.log(`图片加载完成: 成功 ${results.success}, 失败 ${results.failed}, 跳过 ${results.skipped}`);
    
    return results;
  }
  
  /**
   * 加载单张图片
   * @param {HTMLImageElement} img - 图片元素
   * @returns {Promise<Object>}
   */
  async loadImage(img) {
    // 检查是否已经加载过
    if (img.classList.contains('aiexporter-img-loaded')) {
      return { success: true, skipped: true };
    }
    
    // 检查是否有原始src
    const originalSrc = img.src || img.dataset.src;
    if (!originalSrc) {
      return { success: true, skipped: true };
    }
    
    // 检查缓存
    if (this.loadedImages.has(originalSrc)) {
      img.src = this.loadedImages.get(originalSrc);
      img.classList.add('aiexporter-img-loaded');
      return { success: true, skipped: true };
    }
    
    try {
      // 使用fetch获取图片
      const response = await fetch(originalSrc, {
        cache: 'no-store',
        signal: AbortSignal.timeout(this.options.timeout)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      // 保存到缓存
      this.loadedImages.set(originalSrc, objectUrl);
      
      // 替换图片src
      img.dataset.originalSrc = originalSrc;
      img.src = objectUrl;
      img.classList.add('aiexporter-img-loaded');
      
      return { success: true, originalSrc, objectUrl };
    } catch (error) {
      console.warn(`图片加载失败: ${originalSrc}`, error);
      return { success: false, error: error.message, originalSrc };
    }
  }
  
  /**
   * 释放资源
   */
  dispose() {
    // 释放所有Blob URL
    for (const [originalSrc, objectUrl] of this.loadedImages) {
      URL.revokeObjectURL(objectUrl);
    }
    this.loadedImages.clear();
  }
  
  /**
   * 将数组分块
   * @param {Array} array - 原始数组
   * @param {number} size - 块大小
   * @returns {Array}
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * 图片转换工具
 */
class ImageConverter {
  /**
   * 将图片转换为Base64
   * @param {string} url - 图片URL
   * @returns {Promise<string>}
   */
  static async toBase64(url) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('转换为Base64失败:', error);
      return null;
    }
  }
  
  /**
   * 将图片转换为Blob
   * @param {string} url - 图片URL
   * @returns {Promise<Blob>}
   */
  static async toBlob(url) {
    try {
      const response = await fetch(url);
      return await response.blob();
    } catch (error) {
      console.warn('转换为Blob失败:', error);
      return null;
    }
  }
  
  /**
   * 压缩图片
   * @param {HTMLImageElement} img - 图片元素
   * @param {Object} options - 选项
   * @returns {Promise<string>}
   */
  static async compress(img, options = {}) {
    const {
      maxWidth = 1200,
      maxHeight = 1200,
      quality = 0.8,
      type = 'image/jpeg'
    } = options;
    
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // 计算缩放后的尺寸
      let { width, height } = img;
      
      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }
      
      if (height > maxHeight) {
        width *= maxHeight / height;
        height = maxHeight;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          const url = URL.createObjectURL(blob);
          resolve(url);
        },
        type,
        quality
      );
    });
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ImagePreloader,
    ImageConverter
  };
}
