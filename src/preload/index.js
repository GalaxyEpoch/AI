// Preload 脚本 - 安全桥接主进程与渲染进程（前台用户版）
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Ollama 扫描
  ollamaScan: () => ipcRenderer.invoke('ollama:scan'),
  ollamaCheckStatus: () => ipcRenderer.invoke('ollama:check-status'),

  // 模型管理
  modelsGetAll: () => ipcRenderer.invoke('models:get-all'),
  modelsAdd: (model) => ipcRenderer.invoke('models:add', model),
  modelsRemove: (id) => ipcRenderer.invoke('models:remove', id),
  modelsUpdate: (id, data) => ipcRenderer.invoke('models:update', id, data),
  modelsGetPresets: () => ipcRenderer.invoke('models:get-presets'),
  modelsGetPlatformPresets: () => ipcRenderer.invoke('models:get-platform-presets'),

  // 对话管理
  conversationsList: () => ipcRenderer.invoke('conversations:list'),
  conversationsCreate: (title) => ipcRenderer.invoke('conversations:create', title),
  conversationsDelete: (id) => ipcRenderer.invoke('conversations:delete', id),
  conversationsRename: (id, title) => ipcRenderer.invoke('conversations:rename', id, title),
  conversationsGetMessages: (id) => ipcRenderer.invoke('conversations:get-messages', id),
  conversationsSaveMessage: (convId, msg) => ipcRenderer.invoke('conversations:save-message', convId, msg),
  conversationsClearMessages: (id) => ipcRenderer.invoke('conversations:clear-messages', id),

  // AI 对话
  chatSend: (model, messages, params) => ipcRenderer.invoke('chat:send', model, messages, params),
  chatStream: (model, messages, params) => ipcRenderer.send('chat:stream', model, messages, params),
  chatAbort: () => ipcRenderer.send('chat:abort'),
  onStreamChunk: (callback) => ipcRenderer.on('chat:stream-chunk', (_, data) => callback(data)),
  onStreamDone: (callback) => ipcRenderer.on('chat:stream-done', (_, data) => callback(data)),
  onStreamError: (callback) => ipcRenderer.on('chat:stream-error', (_, data) => callback(data)),

  // 设置
  settingsGet: (key) => ipcRenderer.invoke('settings:get', key),
  settingsSet: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  settingsGetAll: () => ipcRenderer.invoke('settings:get-all'),

  // 推广跳转（用户点击"购买Token"时调用）
  promoOpenLink: (provider) => ipcRenderer.invoke('promo:open-link', provider),

  // 应用信息
  appGetVersion: () => ipcRenderer.invoke('app:get-version'),

  // 知识库管理
  kbCreate: (name, desc) => ipcRenderer.invoke('kb:create', name, desc),
  kbList: () => ipcRenderer.invoke('kb:list'),
  kbGet: (id) => ipcRenderer.invoke('kb:get', id),
  kbUpdate: (id, updates) => ipcRenderer.invoke('kb:update', id, updates),
  kbDelete: (id) => ipcRenderer.invoke('kb:delete', id),
  kbAddDoc: (libId, fileName, content, options) => ipcRenderer.invoke('kb:add-doc', libId, fileName, content, options),
  kbAddDocFile: (libId, filePath, options) => ipcRenderer.invoke('kb:add-doc-file', libId, filePath, options),
  kbRemoveDoc: (libId, docId) => ipcRenderer.invoke('kb:remove-doc', libId, docId),
  kbSearch: (libId, query, options) => ipcRenderer.invoke('kb:search', libId, query, options),
  kbBuildContext: (libId, query, options) => ipcRenderer.invoke('kb:build-context', libId, query, options),
  kbGetActive: () => ipcRenderer.invoke('kb:get-active'),
  kbSetActive: (libId) => ipcRenderer.invoke('kb:set-active', libId),
  kbBrowseFile: () => ipcRenderer.invoke('kb:browse-file'),

  // AI 绘画
  paintGetPresets: () => ipcRenderer.invoke('paint:get-presets'),
  paintGenerate: (presetId, prompt, options) => ipcRenderer.invoke('paint:generate', presetId, prompt, options),
  paintGetHistory: (page, pageSize) => ipcRenderer.invoke('paint:get-history', page, pageSize),
  paintCheckLocal: (provider) => ipcRenderer.invoke('paint:check-local', provider),

  // 插件管理
  pluginList: () => ipcRenderer.invoke('plugin:list'),
  pluginInstall: (pluginPath) => ipcRenderer.invoke('plugin:install', pluginPath),
  pluginUninstall: (pluginId) => ipcRenderer.invoke('plugin:uninstall', pluginId),
  pluginSetEnabled: (pluginId, enabled) => ipcRenderer.invoke('plugin:set-enabled', pluginId, enabled),
  pluginBrowseDir: () => ipcRenderer.invoke('plugin:browse-dir'),
  pluginSearchOnline: (query) => ipcRenderer.invoke('plugin:search-online', query),
  pluginInstallOnline: (pluginId, downloadUrl) => ipcRenderer.invoke('plugin:install-online', pluginId, downloadUrl),

  // 国际化 (i18n)
  i18nGetLanguage: () => ipcRenderer.invoke('i18n:get-language'),
  i18nSetLanguage: (code) => ipcRenderer.invoke('i18n:set-language', code),
  i18nGetSupported: () => ipcRenderer.invoke('i18n:get-supported'),
  i18nGetTranslations: () => ipcRenderer.invoke('i18n:get-translations'),
  i18nT: (key, params) => ipcRenderer.invoke('i18n:t', key, params),

  // 云端同步
  syncGetConfig: () => ipcRenderer.invoke('sync:get-config'),
  syncUpdateConfig: (updates) => ipcRenderer.invoke('sync:update-config', updates),
  syncPush: () => ipcRenderer.invoke('sync:push'),
  syncPull: () => ipcRenderer.invoke('sync:pull'),
  syncGetStatus: () => ipcRenderer.invoke('sync:get-status'),

  // Token 推广收益
  tokenGetOverview: () => ipcRenderer.invoke('token:get-overview'),
  tokenGetBalances: () => ipcRenderer.invoke('token:get-balances'),
  tokenUpdateBalance: (provider, balance, currency) => ipcRenderer.invoke('token:update-balance', provider, balance, currency),
  tokenUpdateBalances: (data) => ipcRenderer.invoke('token:update-balances', data),
  tokenGetEarnings: (page, pageSize, filters) => ipcRenderer.invoke('token:get-earnings', page, pageSize, filters),
  tokenAddEarning: (record) => ipcRenderer.invoke('token:add-earning', record),
  tokenUpdateEarningStatus: (earningId, status) => ipcRenderer.invoke('token:update-earning-status', earningId, status),
  tokenGetTopupRecords: (page, pageSize) => ipcRenderer.invoke('token:get-topup-records', page, pageSize),
  tokenAddTopup: (record) => ipcRenderer.invoke('token:add-topup', record),
  tokenGetMyPayment: () => ipcRenderer.invoke('token:get-my-payment'),
  tokenUpdateMyPayment: (config) => ipcRenderer.invoke('token:update-my-payment', config),
  tokenGetStats: () => ipcRenderer.invoke('token:get-stats'),
  tokenUpdateStats: (data) => ipcRenderer.invoke('token:update-stats', data),
  tokenExport: () => ipcRenderer.invoke('token:export'),
  tokenImport: (data) => ipcRenderer.invoke('token:import', data),

  // 管理员后台
  adminOpenPanel: () => ipcRenderer.invoke('admin:open-panel')
});
