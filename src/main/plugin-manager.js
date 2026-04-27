// GalaxyEpoch - 插件系统管理器
// 支持动态加载/卸载插件，提供标准插件 API
// 插件存放目录：{userData}/plugins/
// 每个插件目录结构：{plugin-id}/manifest.json + index.js + (可选) assets/

const fs = require('fs');
const path = require('path');
const JsonStore = require('./json-store');

class PluginManager {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.store = new JsonStore('plugins', {
      installed: {},  // pluginId → { enabled, version, installedAt }
      pluginOrder: [] // 插件排序
    });
    this.loadedPlugins = {};  // pluginId → plugin instance
    this.hooks = {};          // hookName → [callback, ...]
    this.pluginDir = null;
  }

  /**
   * 初始化插件目录
   */
  init(userDataPath) {
    this.pluginDir = path.join(userDataPath, 'plugins');
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true });
    }
    // 自动加载已安装的启用插件
    this._loadEnabledPlugins();
  }

  // ========== 插件生命周期 ==========

  /**
   * 安装插件（从目录安装）
   */
  install(pluginPath) {
    const manifestPath = path.join(pluginPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return { success: false, error: '缺少 manifest.json' };
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      if (!manifest.id || !manifest.name || !manifest.version) {
        return { success: false, error: 'manifest.json 缺少必要字段 (id, name, version)' };
      }

      // 复制到插件目录
      const targetDir = path.join(this.pluginDir, manifest.id);
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true });
      }
      this._copyDir(pluginPath, targetDir);

      // 记录安装
      const installed = this.store.get('installed', {});
      installed[manifest.id] = {
        enabled: true,
        version: manifest.version,
        installedAt: new Date().toISOString()
      };
      this.store.set('installed', installed);

      // 自动加载
      this._loadPlugin(manifest.id);

      return { success: true, plugin: manifest };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * 卸载插件
   */
  uninstall(pluginId) {
    // 先停止
    this._unloadPlugin(pluginId);

    // 删除目录
    const targetDir = path.join(this.pluginDir, pluginId);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true });
    }

    // 移除记录
    const installed = this.store.get('installed', {});
    delete installed[pluginId];
    this.store.set('installed', installed);

    return { success: true };
  }

  /**
   * 启用/禁用插件
   */
  setEnabled(pluginId, enabled) {
    const installed = this.store.get('installed', {});
    if (!installed[pluginId]) return { success: false, error: '插件未安装' };

    installed[pluginId].enabled = enabled;
    this.store.set('installed', installed);

    if (enabled) {
      this._loadPlugin(pluginId);
    } else {
      this._unloadPlugin(pluginId);
    }

    return { success: true };
  }

  /**
   * 获取已安装插件列表
   */
  listInstalled() {
    const installed = this.store.get('installed', {});
    const result = [];

    for (const [id, info] of Object.entries(installed)) {
      const manifest = this._readManifest(id);
      result.push({
        id,
        name: manifest?.name || id,
        version: manifest?.version || info.version,
        description: manifest?.description || '',
        author: manifest?.author || '',
        icon: manifest?.icon || '🧩',
        enabled: info.enabled,
        installedAt: info.installedAt,
        loaded: !!this.loadedPlugins[id]
      });
    }

    return result;
  }

  // ========== Hook 系统 ==========

  /**
   * 注册 hook（供插件调用）
   */
  registerHook(pluginId, hookName, callback) {
    if (!this.hooks[hookName]) this.hooks[hookName] = [];
    this.hooks[hookName].push({ pluginId, callback });
  }

  /**
   * 触发 hook（供主进程/其他模块调用）
   */
  async emitHook(hookName, ...args) {
    const handlers = this.hooks[hookName] || [];
    const results = [];
    for (const handler of handlers) {
      try {
        const result = await handler.callback(...args);
        results.push({ pluginId: handler.pluginId, result });
      } catch (e) {
        console.error(`[Plugin] Hook ${hookName} error in ${handler.pluginId}:`, e.message);
      }
    }
    return results;
  }

  /**
   * 移除插件的所有 hook
   */
  _removePluginHooks(pluginId) {
    for (const hookName in this.hooks) {
      this.hooks[hookName] = this.hooks[hookName].filter(h => h.pluginId !== pluginId);
    }
  }

  // ========== 插件 API（注入给插件的上下文） ==========

  _createPluginContext(pluginId) {
    return {
      // 注册 hook
      onHook: (hookName, callback) => this.registerHook(pluginId, hookName, callback),
      // 读写设置
      getSetting: (key) => this.settingsManager.get(`plugins.${pluginId}.${key}`),
      setSetting: (key, value) => this.settingsManager.set(`plugins.${pluginId}.${key}`, value),
      // 发送通知到渲染进程
      notify: (channel, data) => {
        const { BrowserWindow } = require('electron');
        const win = BrowserWindow.getAllWindows()[0];
        if (win) win.webContents.send(`plugin:${pluginId}:${channel}`, data);
      },
      // 插件信息
      pluginId,
      pluginDir: path.join(this.pluginDir, pluginId)
    };
  }

  // ========== 内部方法 ==========

  _loadEnabledPlugins() {
    const installed = this.store.get('installed', {});
    for (const [id, info] of Object.entries(installed)) {
      if (info.enabled) {
        this._loadPlugin(id);
      }
    }
  }

  _loadPlugin(pluginId) {
    const pluginPath = path.join(this.pluginDir, pluginId, 'index.js');
    if (!fs.existsSync(pluginPath)) {
      console.warn(`[Plugin] ${pluginId}: index.js 不存在`);
      return;
    }

    try {
      // 清理旧的 hook
      this._removePluginHooks(pluginId);

      const PluginClass = require(pluginPath);
      const ctx = this._createPluginContext(pluginId);
      const instance = typeof PluginClass === 'function' ? new PluginClass(ctx) : PluginClass(ctx);
      
      this.loadedPlugins[pluginId] = instance;
      console.log(`[Plugin] ${pluginId} 已加载`);

      // 调用插件的 onActivate
      if (instance.onActivate) instance.onActivate();
    } catch (e) {
      console.error(`[Plugin] ${pluginId} 加载失败:`, e.message);
    }
  }

  _unloadPlugin(pluginId) {
    const instance = this.loadedPlugins[pluginId];
    if (instance) {
      if (instance.onDeactivate) instance.onDeactivate();
      delete this.loadedPlugins[pluginId];
    }
    this._removePluginHooks(pluginId);
    
    // 清除 require 缓存
    const pluginPath = path.join(this.pluginDir, pluginId, 'index.js');
    delete require.cache[require.resolve(pluginPath)];
  }

  _readManifest(pluginId) {
    const manifestPath = path.join(this.pluginDir, pluginId, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (e) {
      return null;
    }
  }

  _copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this._copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // ========== 联网搜索与在线安装 ==========

  /**
   * 搜索在线插件仓库
   * 当前实现：搜索 GitHub 上 GalaxyEpoch 插件仓库
   * 可扩展为自建插件市场 API
   */
  async searchOnline(query) {
    const https = require('https');
    
    // 默认搜索 GalaxyEpoch 官方插件仓库
    // 格式：https://galaxyepoch-plugins.github.io/registry.json
    // 备选：搜索 GitHub topics
    const registryUrl = 'https://galaxyepoch-plugins.github.io/registry.json';
    
    return new Promise((resolve) => {
      https.get(registryUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const registry = JSON.parse(data);
            if (!Array.isArray(registry)) {
              resolve(this._searchFallback(query));
              return;
            }
            // 过滤匹配
            const q = query.toLowerCase();
            const results = registry.filter(p => 
              (p.name || '').toLowerCase().includes(q) ||
              (p.description || '').toLowerCase().includes(q) ||
              (p.tags || []).some(t => t.toLowerCase().includes(q)) ||
              (p.author || '').toLowerCase().includes(q)
            );
            resolve(results.length > 0 ? results : this._searchFallback(query));
          } catch (e) {
            resolve(this._searchFallback(query));
          }
        });
      }).on('error', () => {
        resolve(this._searchFallback(query));
      });
    });
  }

  /**
   * 备选搜索：从 GitHub 搜索 GalaxyEpoch 插件
   */
  _searchFallback(query) {
    const https = require('https');
    // 返回一个静态列表作为示例（实际可对接 GitHub API）
    // 这里返回内置的推荐插件列表
    const builtinPlugins = [
      {
        id: 'plugin-translator',
        name: '智能翻译',
        description: '自动检测语言并翻译对话内容，支持中英日韩等多种语言互译',
        author: 'GalaxyEpoch',
        version: '1.0.0',
        icon: '🌐',
        stars: 128,
        tags: ['翻译', '多语言', 'translate'],
        downloadUrl: ''
      },
      {
        id: 'plugin-summarizer',
        name: '对话摘要',
        description: '一键生成长对话的摘要，快速回顾关键信息',
        author: 'GalaxyEpoch',
        version: '1.0.0',
        icon: '📝',
        stars: 96,
        tags: ['摘要', '总结', 'summarize'],
        downloadUrl: ''
      },
      {
        id: 'plugin-code-review',
        name: '代码审查',
        description: '对对话中的代码片段进行自动审查，给出改进建议',
        author: 'GalaxyEpoch',
        version: '1.0.0',
        icon: '🔍',
        stars: 72,
        tags: ['代码', '审查', 'review', 'code'],
        downloadUrl: ''
      },
      {
        id: 'plugin-prompt-templates',
        name: '提示词模板',
        description: '内置多种高质量提示词模板，一键应用到对话',
        author: 'GalaxyEpoch',
        version: '1.0.0',
        icon: '📋',
        stars: 156,
        tags: ['提示词', '模板', 'prompt', 'template'],
        downloadUrl: ''
      },
      {
        id: 'plugin-web-search',
        name: '联网搜索',
        description: '让 AI 对话具备联网搜索能力，获取实时信息',
        author: 'GalaxyEpoch',
        version: '1.0.0',
        icon: '🔎',
        stars: 203,
        tags: ['搜索', '联网', 'web', 'search', '互联网'],
        downloadUrl: ''
      }
    ];
    
    const q = query.toLowerCase();
    return builtinPlugins.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  /**
   * 在线安装插件（下载并解压到插件目录）
   */
  async installOnline(pluginId, downloadUrl) {
    // 确保插件目录已初始化
    if (!this.pluginDir) {
      return { success: false, error: '插件系统未初始化，请重启应用' };
    }

    // 没有下载链接时，创建内置模板插件
    if (!downloadUrl) {
      return this._createTemplatePlugin(pluginId);
    }
    
    // TODO: 未来实现 zip 下载解压
    return { success: false, error: '在线下载安装暂未开放，请使用本地安装' };
  }

  /**
   * 创建模板插件（用于演示）
   */
  _createTemplatePlugin(pluginId) {
    const templates = {
      'plugin-translator': {
        id: 'plugin-translator',
        name: '智能翻译',
        version: '1.0.0',
        description: '自动检测语言并翻译对话内容',
        author: 'GalaxyEpoch',
        icon: '🌐',
        main: 'index.js'
      },
      'plugin-summarizer': {
        id: 'plugin-summarizer',
        name: '对话摘要',
        version: '1.0.0',
        description: '一键生成长对话的摘要',
        author: 'GalaxyEpoch',
        icon: '📝',
        main: 'index.js'
      },
      'plugin-code-review': {
        id: 'plugin-code-review',
        name: '代码审查',
        version: '1.0.0',
        description: '对代码片段进行自动审查',
        author: 'GalaxyEpoch',
        icon: '🔍',
        main: 'index.js'
      },
      'plugin-prompt-templates': {
        id: 'plugin-prompt-templates',
        name: '提示词模板',
        version: '1.0.0',
        description: '内置多种高质量提示词模板',
        author: 'GalaxyEpoch',
        icon: '📋',
        main: 'index.js'
      },
      'plugin-web-search': {
        id: 'plugin-web-search',
        name: '联网搜索',
        version: '1.0.0',
        description: '让 AI 对话具备联网搜索能力',
        author: 'GalaxyEpoch',
        icon: '🔎',
        main: 'index.js'
      }
    };

    const manifest = templates[pluginId];
    if (!manifest) {
      return { success: false, error: '未知插件' };
    }

    const pluginDir = path.join(this.pluginDir, pluginId);
    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
    }

    // 写入 manifest.json
    fs.writeFileSync(
      path.join(pluginDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    // 写入 index.js 模板
    const indexJs = `// ${manifest.name} - GalaxyEpoch 插件
module.exports = function(ctx) {
  return {
    onActivate() {
      console.log('[Plugin] ${manifest.name} 已激活');
    },
    onDeactivate() {
      console.log('[Plugin] ${manifest.name} 已停用');
    }
  };
};`;
    fs.writeFileSync(path.join(pluginDir, 'index.js'), indexJs, 'utf-8');

    // 记录安装
    const installed = this.store.get('installed', {});
    installed[pluginId] = {
      enabled: true,
      version: manifest.version,
      installedAt: new Date().toISOString()
    };
    this.store.set('installed', installed);

    // 加载
    this._loadPlugin(pluginId);

    return { success: true, plugin: manifest };
  }
}

module.exports = PluginManager;
