// GalaxyEpoch - 云端同步管理器
// 支持 WebDAV / 自建服务器 / 导出导入本地文件
// 对话记录、设置、知识库等数据可选同步

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const JsonStore = require('./json-store');

class SyncManager {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.store = new JsonStore('sync', {
      enabled: false,
      method: 'none',    // 'none' | 'webdav' | 'custom' | 'local'
      lastSync: null,
      syncItems: {
        conversations: true,
        settings: true,
        knowledge: true,
        plugins: false
      },
      // WebDAV 配置
      webdav: {
        url: '',
        username: '',
        password: ''
      },
      // 自建服务器配置
      custom: {
        url: '',
        token: ''
      },
      // 本地导出路径
      localPath: ''
    });
    this.syncing = false;
  }

  /**
   * 获取同步配置
   */
  getConfig() {
    return this.store.getAll();
  }

  /**
   * 更新同步配置
   */
  updateConfig(updates) {
    for (const [key, value] of Object.entries(updates)) {
      this.store.set(key, value);
    }
    return { success: true };
  }

  /**
   * 执行同步（上传）
   */
  async push(data) {
    if (this.syncing) return { success: false, error: '正在同步中' };
    this.syncing = true;

    try {
      const method = this.store.get('method', 'none');
      let result;

      switch (method) {
        case 'webdav':
          result = await this._pushWebDAV(data);
          break;
        case 'custom':
          result = await this._pushCustom(data);
          break;
        case 'local':
          result = await this._pushLocal(data);
          break;
        default:
          result = { success: false, error: '未配置同步方式' };
      }

      if (result.success) {
        this.store.set('lastSync', new Date().toISOString());
      }
      return result;
    } finally {
      this.syncing = false;
    }
  }

  /**
   * 执行同步（下载）
   */
  async pull() {
    if (this.syncing) return { success: false, error: '正在同步中' };
    this.syncing = true;

    try {
      const method = this.store.get('method', 'none');
      let result;

      switch (method) {
        case 'webdav':
          result = await this._pullWebDAV();
          break;
        case 'custom':
          result = await this._pullCustom();
          break;
        case 'local':
          result = await this._pullLocal();
          break;
        default:
          result = { success: false, error: '未配置同步方式' };
      }

      if (result.success) {
        this.store.set('lastSync', new Date().toISOString());
      }
      return result;
    } finally {
      this.syncing = false;
    }
  }

  /**
   * 获取同步状态
   */
  getStatus() {
    return {
      enabled: this.store.get('enabled', false),
      method: this.store.get('method', 'none'),
      lastSync: this.store.get('lastSync', null),
      syncing: this.syncing,
      syncItems: this.store.get('syncItems', {})
    };
  }

  // ========== WebDAV 同步 ==========

  async _pushWebDAV(data) {
    const config = this.store.get('webdav', {});
    if (!config.url) return { success: false, error: '未配置 WebDAV 地址' };

    try {
      const payload = JSON.stringify(data);
      await axios.request({
        method: 'PUT',
        url: `${config.url.replace(/\/$/, '')}/galaxyepoch-sync.json`,
        data: payload,
        headers: { 'Content-Type': 'application/json' },
        auth: config.username ? { username: config.username, password: config.password } : undefined,
        timeout: 30000
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: `WebDAV 上传失败: ${e.message}` };
    }
  }

  async _pullWebDAV() {
    const config = this.store.get('webdav', {});
    if (!config.url) return { success: false, error: '未配置 WebDAV 地址' };

    try {
      const resp = await axios.request({
        method: 'GET',
        url: `${config.url.replace(/\/$/, '')}/galaxyepoch-sync.json`,
        headers: { 'Content-Type': 'application/json' },
        auth: config.username ? { username: config.username, password: config.password } : undefined,
        timeout: 30000
      });
      return { success: true, data: resp.data };
    } catch (e) {
      if (e.response && e.response.status === 404) {
        return { success: false, error: '云端暂无同步数据' };
      }
      return { success: false, error: `WebDAV 下载失败: ${e.message}` };
    }
  }

  // ========== 自建服务器同步 ==========

  async _pushCustom(data) {
    const config = this.store.get('custom', {});
    if (!config.url) return { success: false, error: '未配置服务器地址' };

    try {
      await axios.post(`${config.url.replace(/\/$/, '')}/api/sync/push`, data, {
        headers: { 'Authorization': `Bearer ${config.token}`, 'Content-Type': 'application/json' },
        timeout: 30000
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: `服务器上传失败: ${e.message}` };
    }
  }

  async _pullCustom() {
    const config = this.store.get('custom', {});
    if (!config.url) return { success: false, error: '未配置服务器地址' };

    try {
      const resp = await axios.get(`${config.url.replace(/\/$/, '')}/api/sync/pull`, {
        headers: { 'Authorization': `Bearer ${config.token}` },
        timeout: 30000
      });
      return { success: true, data: resp.data };
    } catch (e) {
      return { success: false, error: `服务器下载失败: ${e.message}` };
    }
  }

  // ========== 本地文件导出/导入 ==========

  async _pushLocal(data) {
    const localPath = this.store.get('localPath', '');
    if (!localPath) return { success: false, error: '未配置本地路径' };

    try {
      const filePath = path.join(localPath, `galaxyepoch-backup-${Date.now()}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: `本地导出失败: ${e.message}` };
    }
  }

  async _pullLocal() {
    const localPath = this.store.get('localPath', '');
    if (!localPath) return { success: false, error: '未配置本地路径' };

    try {
      // 查找最新的备份文件
      const files = fs.readdirSync(localPath)
        .filter(f => f.startsWith('galaxyepoch-backup-') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (files.length === 0) return { success: false, error: '未找到本地备份文件' };

      const data = JSON.parse(fs.readFileSync(path.join(localPath, files[0]), 'utf-8'));
      return { success: true, data, file: files[0] };
    } catch (e) {
      return { success: false, error: `本地导入失败: ${e.message}` };
    }
  }

  /**
   * 导出所有数据为 JSON
   */
  exportAll(conversationManager, settingsManager, knowledgeManager) {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      conversations: conversationManager ? conversationManager.listConversations() : [],
      settings: settingsManager ? settingsManager.getAll() : {},
      knowledge: knowledgeManager ? knowledgeManager.listLibraries() : []
    };
    return data;
  }
}

module.exports = SyncManager;
