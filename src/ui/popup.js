/**
 * AI Chat Exporter Pro - Popup脚本
 * 处理用户交互和导出控制
 */

class PopupController {
  constructor() {
    this.platform = null;
    this.conversations = [];
    this.isExporting = false;
    this.init();
  }

  /**
   * 初始化
   */
  async init() {
    this.bindEvents();
    await this.detectPlatform();
    await this.loadConversations();
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 导出当前对话
    document.getElementById('btn-current').addEventListener('click', () => {
      this.exportCurrent();
    });

    // 导出全部对话
    document.getElementById('btn-all').addEventListener('click', () => {
      this.exportAll();
    });

    // 停止导出
    document.getElementById('btn-stop').addEventListener('click', () => {
      this.stopExport();
    });

    // 格式选择
    document.querySelectorAll('input[name="format"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.onFormatChange(e.target.value);
      });
    });
  }

  /**
   * 检测平台
   */
  async detectPlatform() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];

      if (!tab) {
        this.showPlatformError('无法获取当前标签页');
        return;
      }

      // 检查是否是支持的页面
      const supportedHosts = [
        'doubao.com',
        'deepseek.com',
        'chatgpt.com',
        'openai.com',
        'kimi.moonshot.cn',
        'yuanbao.tencent.com'
      ];

      const isSupported = supportedHosts.some(host => tab.url.includes(host));

      if (!isSupported) {
        this.showPlatformError('请在AI对话页面使用');
        return;
      }

      // 向content script发送消息检测平台
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPlatform' });

      if (response && response.success && response.platform) {
        this.platform = response.platform;
        this.updatePlatformInfo(response.platform);
      } else {
        this.showPlatformError('未检测到支持的平台');
      }
    } catch (error) {
      console.error('检测平台失败:', error);
      this.showPlatformError('请刷新页面后重试');
    }
  }

  /**
   * 加载对话列表
   */
  async loadConversations() {
    if (!this.platform) return;

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'getConversations'
      });

      if (response && response.success) {
        this.conversations = response.conversations || [];
        this.updateConversationCount();
      }
    } catch (error) {
      console.error('加载对话列表失败:', error);
    }
  }

  /**
   * 更新平台信息
   * @param {Object} platform - 平台信息
   */
  updatePlatformInfo(platform) {
    const nameEl = document.getElementById('platform-name');
    nameEl.textContent = platform.displayName || platform.name;
    nameEl.style.color = '#1a1a1a';
  }

  /**
   * 更新对话数量
   */
  updateConversationCount() {
    const countEl = document.getElementById('conversation-count');
    if (this.conversations.length > 0) {
      countEl.textContent = `共 ${this.conversations.length} 个对话`;
    } else {
      countEl.textContent = '未检测到对话';
    }
  }

  /**
   * 显示平台错误
   * @param {string} message - 错误信息
   */
  showPlatformError(message) {
    const nameEl = document.getElementById('platform-name');
    nameEl.textContent = message;
    nameEl.style.color = '#f44336';

    // 禁用按钮
    document.getElementById('btn-current').disabled = true;
    document.getElementById('btn-all').disabled = true;
  }

  /**
   * 获取导出选项
   * @returns {Object}
   */
  getExportOptions() {
    const format = document.querySelector('input[name="format"]:checked').value;
    const includeThink = document.getElementById('include-think').checked;
    const includeTime = document.getElementById('include-time').checked;
    const singleFile = document.getElementById('single-file').checked;

    return {
      format,
      includeThink,
      includeTime,
      singleFile,
      zipOutput: !singleFile
    };
  }

  /**
   * 导出当前对话
   */
  async exportCurrent() {
    if (this.isExporting) return;

    try {
      this.startExport();

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const options = this.getExportOptions();

      // 获取当前对话ID（从URL或页面）
      const currentId = await this.getCurrentConversationId(tabs[0].id);

      if (!currentId) {
        throw new Error('无法获取当前对话ID');
      }

      this.showProgress('正在导出当前对话...', 0, 1);

      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'exportConversation',
        conversationId: currentId,
        options
      });

      if (response && response.success) {
        this.showToast('导出成功！', 'success');
      } else {
        throw new Error(response?.error || '导出失败');
      }
    } catch (error) {
      console.error('导出当前对话失败:', error);
      this.showToast(error.message, 'error');
    } finally {
      this.endExport();
    }
  }

  /**
   * 导出全部对话
   */
  async exportAll() {
    if (this.isExporting) return;

    try {
      this.startExport();

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const options = this.getExportOptions();

      this.showProgress('准备导出...', 0, this.conversations.length);

      // 监听进度
      this.setupProgressListener();

      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'exportAll',
        options
      });

      if (response && response.success) {
        this.showToast(`成功导出 ${response.results?.length || 0} 个对话`, 'success');
      } else {
        throw new Error(response?.error || '导出失败');
      }
    } catch (error) {
      console.error('导出全部对话失败:', error);
      this.showToast(error.message, 'error');
    } finally {
      this.endExport();
    }
  }

  /**
   * 获取当前对话ID
   * @param {number} tabId - 标签页ID
   * @returns {Promise<string|null>}
   */
  async getCurrentConversationId(tabId) {
    try {
      // 尝试从content script获取
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'getCurrentConversationId'
      });

      if (response && response.conversationId) {
        return response.conversationId;
      }
    } catch (e) {
      // 忽略错误
    }

    // 从URL获取
    try {
      const tab = await chrome.tabs.get(tabId);
      const url = new URL(tab.url);

      // 豆包
      if (url.hostname.includes('doubao.com')) {
        const match = url.pathname.match(/\/chat\/(\d+)/);
        if (match) return match[1];
      }

      // DeepSeek
      if (url.hostname.includes('deepseek.com')) {
        const match = url.pathname.match(/\/s\/([a-f0-9-]+)/);
        if (match) return match[1];
      }
    } catch (e) {
      // 忽略错误
    }

    return null;
  }

  /**
   * 设置进度监听
   */
  setupProgressListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'progress' && request.progress) {
        this.updateProgress(request.progress);
      }
      return true;
    });
  }

  /**
   * 停止导出
   */
  async stopExport() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'stopExport'
      });

      this.showToast('已停止导出', 'success');
    } catch (error) {
      console.error('停止导出失败:', error);
    } finally {
      this.endExport();
    }
  }

  /**
   * 开始导出
   */
  startExport() {
    this.isExporting = true;
    document.getElementById('btn-current').disabled = true;
    document.getElementById('btn-all').disabled = true;
    document.getElementById('btn-stop').classList.remove('hidden');
  }

  /**
   * 结束导出
   */
  endExport() {
    this.isExporting = false;
    document.getElementById('btn-current').disabled = false;
    document.getElementById('btn-all').disabled = false;
    document.getElementById('btn-stop').classList.add('hidden');
    this.hideProgress();
  }

  /**
   * 显示进度
   * @param {string} status - 状态文本
   * @param {number} current - 当前进度
   * @param {number} total - 总进度
   */
  showProgress(status, current, total) {
    const container = document.getElementById('progress-container');
    const statusEl = document.getElementById('progress-status');
    const countEl = document.getElementById('progress-count');
    const fillEl = document.getElementById('progress-fill');

    container.classList.remove('hidden');
    statusEl.textContent = status;
    countEl.textContent = `${current}/${total}`;

    const percentage = total > 0 ? (current / total) * 100 : 0;
    fillEl.style.width = `${percentage}%`;
  }

  /**
   * 更新进度
   * @param {Object} progress - 进度信息
   */
  updateProgress(progress) {
    const { current, total, status, conversation } = progress;

    const statusMap = {
      'exporting': '正在导出...',
      'success': '导出成功',
      'error': '导出失败',
      'completed': '导出完成'
    };

    this.showProgress(
      statusMap[status] || status,
      current,
      total
    );

    if (conversation) {
      document.getElementById('progress-detail').textContent = conversation;
    }
  }

  /**
   * 隐藏进度
   */
  hideProgress() {
    document.getElementById('progress-container').classList.add('hidden');
  }

  /**
   * 显示提示
   * @param {string} message - 消息
   * @param {string} type - 类型
   */
  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  /**
   * 格式变更处理
   * @param {string} format - 格式
   */
  onFormatChange(format) {
    console.log('选择格式:', format);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
