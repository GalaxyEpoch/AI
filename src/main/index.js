// GalaxyEpoch - 开源大模型聚合客户端
// 主进程入口

const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, shell } = require('electron');
const path = require('path');
const ModelManager = require('./model-manager');
const ConversationManager = require('./conversation-manager');
const SettingsManager = require('./settings-manager');
const OllamaScanner = require('./ollama-scanner');
const ApiClient = require('./api-client');
const KnowledgeManager = require('./knowledge-manager');
const PaintingManager = require('./painting-manager');
const PluginManager = require('./plugin-manager');
const I18nManager = require('./i18n-manager');
const SyncManager = require('./sync-manager');
const TokenManager = require('./token-manager');
// 推广模块加载：优先加载闭源商业模块，不存在时使用开源 stub
let PromoCore;
try {
  PromoCore = require('./promo-core');
} catch (e) {
  // 闭源模块不存在（开源 fork），使用 stub 实现
  PromoCore = require('./promo-stub');
}

let mainWindow = null;
let adminWindow = null;
let tray = null;

// 初始化各管理器
const settingsManager = new SettingsManager();
const modelManager = new ModelManager(settingsManager);
const conversationManager = new ConversationManager();
const ollamaScanner = new OllamaScanner();
const apiClient = new ApiClient(settingsManager);
const promoCore = new PromoCore(settingsManager);
const knowledgeManager = new KnowledgeManager(settingsManager);
const paintingManager = new PaintingManager(settingsManager);
const pluginManager = new PluginManager(settingsManager);
const i18nManager = new I18nManager(settingsManager);
const syncManager = new SyncManager(settingsManager);
const tokenManager = new TokenManager(settingsManager);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'GalaxyEpoch - 大模型聚合客户端',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f0f14'
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    tray = new Tray(path.join(__dirname, '../../assets/icon.png'));
    const contextMenu = Menu.buildFromTemplate([
      { label: '显示主窗口', click: () => mainWindow && mainWindow.show() },
      { type: 'separator' },
      { label: '管理员后台', click: () => openAdminPanel() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]);
    tray.setToolTip('GalaxyEpoch');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => mainWindow && mainWindow.show());
  } catch (e) {
    // 托盘图标可选，不影响主功能
  }
}

function openAdminPanel() {
  if (adminWindow) {
    adminWindow.focus();
    return;
  }
  adminWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'GalaxyEpoch 管理员后台',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/admin-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    backgroundColor: '#0f0f14'
  });
  adminWindow.loadFile(path.join(__dirname, '../renderer/admin.html'));
  adminWindow.on('closed', () => { adminWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  pluginManager.init(app.getPath('userData'));
  registerIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===================== IPC 通信注册 =====================

function registerIpcHandlers() {
  // --- 窗口控制 ---
  ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    }
  });
  ipcMain.on('window-close', () => mainWindow && mainWindow.close());
  ipcMain.handle('window-is-maximized', () => mainWindow && mainWindow.isMaximized());

  // --- 本地模型扫描 ---
  ipcMain.handle('ollama:scan', async () => {
    return ollamaScanner.scanLocalModels();
  });
  ipcMain.handle('ollama:check-status', async () => {
    return ollamaScanner.checkStatus();
  });

  // --- 模型管理 ---
  ipcMain.handle('models:get-all', async () => {
    return modelManager.getAllModels();
  });
  ipcMain.handle('models:add', async (_, model) => {
    return modelManager.addModel(model);
  });
  ipcMain.handle('models:remove', async (_, modelId) => {
    return modelManager.removeModel(modelId);
  });
  ipcMain.handle('models:update', async (_, modelId, data) => {
    return modelManager.updateModel(modelId, data);
  });
  ipcMain.handle('models:get-presets', async () => {
    return modelManager.getPresets();
  });
  ipcMain.handle('models:get-platform-presets', async () => {
    return modelManager.getPlatformPresets();
  });

  // --- 对话管理 ---
  ipcMain.handle('conversations:list', async () => {
    return conversationManager.listConversations();
  });
  ipcMain.handle('conversations:create', async (_, title) => {
    return conversationManager.createConversation(title);
  });
  ipcMain.handle('conversations:delete', async (_, id) => {
    return conversationManager.deleteConversation(id);
  });
  ipcMain.handle('conversations:rename', async (_, id, title) => {
    return conversationManager.renameConversation(id, title);
  });
  ipcMain.handle('conversations:get-messages', async (_, id) => {
    return conversationManager.getMessages(id);
  });
  ipcMain.handle('conversations:save-message', async (_, convId, message) => {
    return conversationManager.saveMessage(convId, message);
  });
  ipcMain.handle('conversations:clear-messages', async (_, id) => {
    return conversationManager.clearMessages(id);
  });

  // --- AI 对话 ---
  ipcMain.handle('chat:send', async (_, model, messages, params) => {
    return apiClient.chat(model, messages, params);
  });
  // 流式对话使用 event-based 方式（支持 RAG 知识库注入）
  ipcMain.on('chat:stream', async (event, model, messages, params) => {
    // RAG: 如果有激活的知识库，注入上下文
    const activeKB = settingsManager.get('activeKnowledgeBase', null);
    if (activeKB && messages.length > 0) {
      const lastUserMsg = messages.filter(m => m.role === 'user').pop();
      if (lastUserMsg) {
        const ragContext = knowledgeManager.buildRAGContext(activeKB, lastUserMsg.content);
        if (ragContext) {
          // 在用户消息前插入知识库上下文作为系统提示
          messages = [
            { role: 'system', content: ragContext },
            ...messages
          ];
        }
      }
    }
    
    apiClient.chatStream(model, messages, params, (chunk) => {
      mainWindow && mainWindow.webContents.send('chat:stream-chunk', chunk);
    }, (done) => {
      mainWindow && mainWindow.webContents.send('chat:stream-done', done);
    }, (error) => {
      mainWindow && mainWindow.webContents.send('chat:stream-error', error);
    });
  });
  ipcMain.on('chat:abort', () => {
    apiClient.abortCurrentRequest();
  });

  // --- 设置 ---
  ipcMain.handle('settings:get', async (_, key) => {
    return settingsManager.get(key);
  });
  ipcMain.handle('settings:set', async (_, key, value) => {
    return settingsManager.set(key, value);
  });
  ipcMain.handle('settings:get-all', async () => {
    return settingsManager.getAll();
  });

  // --- 推广跳转（前台：用户点击购买Token时触发） ---
  ipcMain.handle('promo:open-link', async (_, provider) => {
    return promoCore.openPromoLink(provider);
  });
  ipcMain.handle('promo:get-link', async (_, provider) => {
    return promoCore.getPromoLink(provider);
  });

  // --- 管理员后台 IPC ---
  ipcMain.handle('admin:login', async (_, password) => {
    return promoCore.verifyAdmin(password);
  });
  ipcMain.handle('admin:set-password', async (_, password) => {
    return promoCore.setAdminPassword(password);
  });
  ipcMain.handle('admin:get-commission', async () => {
    return promoCore.getCommissionStats();
  });
  ipcMain.handle('admin:update-commission', async (_, data) => {
    return promoCore.updateCommission(data);
  });
  ipcMain.handle('admin:get-promo-links', async () => {
    return promoCore.getAllPromoLinks();
  });
  ipcMain.handle('admin:update-promo-link', async (_, provider, link) => {
    return promoCore.updatePromoLink(provider, link);
  });
  ipcMain.handle('admin:get-click-records', async (_, page, pageSize) => {
    return promoCore.getClickRecords(page, pageSize);
  });
  ipcMain.handle('admin:get-payment-config', async () => {
    return promoCore.getPaymentConfig();
  });
  ipcMain.handle('admin:update-payment-config', async (_, config) => {
    return promoCore.updatePaymentConfig(config);
  });
  ipcMain.handle('admin:open-panel', async () => {
    openAdminPanel();
    return { success: true };
  });

  // --- 应用信息 ---
  ipcMain.handle('app:get-version', async () => {
    return app.getVersion();
  });

  // --- 知识库管理 ---
  ipcMain.handle('kb:create', async (_, name, desc) => {
    return knowledgeManager.createLibrary(name, desc);
  });
  ipcMain.handle('kb:list', async () => {
    return knowledgeManager.listLibraries();
  });
  ipcMain.handle('kb:get', async (_, id) => {
    return knowledgeManager.getLibrary(id);
  });
  ipcMain.handle('kb:update', async (_, id, updates) => {
    return knowledgeManager.updateLibrary(id, updates);
  });
  ipcMain.handle('kb:delete', async (_, id) => {
    return knowledgeManager.deleteLibrary(id);
  });
  ipcMain.handle('kb:add-doc', async (_, libId, fileName, content, options) => {
    return knowledgeManager.addDocument(libId, fileName, content, options);
  });
  ipcMain.handle('kb:add-doc-file', async (_, libId, filePath, options) => {
    return knowledgeManager.addDocumentFromFile(libId, filePath, options);
  });
  ipcMain.handle('kb:remove-doc', async (_, libId, docId) => {
    return knowledgeManager.removeDocument(libId, docId);
  });
  ipcMain.handle('kb:search', async (_, libId, query, options) => {
    return knowledgeManager.search(libId, query, options);
  });
  ipcMain.handle('kb:build-context', async (_, libId, query, options) => {
    return knowledgeManager.buildRAGContext(libId, query, options);
  });

  // --- 对话中开启知识库RAG（在发送消息前注入上下文） ---
  ipcMain.handle('kb:get-active', async () => {
    return settingsManager.get('activeKnowledgeBase', null);
  });
  ipcMain.handle('kb:set-active', async (_, libId) => {
    return settingsManager.set('activeKnowledgeBase', libId);
  });

  // --- 知识库文件选择对话框 ---
  ipcMain.handle('kb:browse-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择文档文件',
      filters: [
        { name: '文本文件', extensions: ['txt', 'md', 'json', 'csv', 'html', 'xml', 'log'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // --- 插件目录选择对话框 ---
  ipcMain.handle('plugin:browse-dir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择插件目录',
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // --- 插件联网搜索 ---
  ipcMain.handle('plugin:search-online', async (_, query) => {
    return pluginManager.searchOnline(query);
  });

  // --- 插件在线安装 ---
  ipcMain.handle('plugin:install-online', async (_, pluginId, downloadUrl) => {
    return pluginManager.installOnline(pluginId, downloadUrl);
  });

  // --- AI 绘画 ---
  ipcMain.handle('paint:get-presets', async () => {
    return paintingManager.getPresets();
  });
  ipcMain.handle('paint:generate', async (_, presetId, prompt, options) => {
    return paintingManager.generate(presetId, prompt, options);
  });
  ipcMain.handle('paint:get-history', async (_, page, pageSize) => {
    return paintingManager.getHistory(page, pageSize);
  });
  ipcMain.handle('paint:check-local', async (_, provider) => {
    return paintingManager.checkLocalService(provider);
  });

  // --- 插件管理 ---
  ipcMain.handle('plugin:list', async () => {
    return pluginManager.listInstalled();
  });
  ipcMain.handle('plugin:install', async (_, pluginPath) => {
    return pluginManager.install(pluginPath);
  });
  ipcMain.handle('plugin:uninstall', async (_, pluginId) => {
    return pluginManager.uninstall(pluginId);
  });
  ipcMain.handle('plugin:set-enabled', async (_, pluginId, enabled) => {
    return pluginManager.setEnabled(pluginId, enabled);
  });

  // --- 国际化 (i18n) ---
  ipcMain.handle('i18n:get-language', async () => {
    return i18nManager.getCurrentLanguage();
  });
  ipcMain.handle('i18n:set-language', async (_, code) => {
    return i18nManager.setLanguage(code);
  });
  ipcMain.handle('i18n:get-supported', async () => {
    return i18nManager.getSupportedLanguages();
  });
  ipcMain.handle('i18n:get-translations', async () => {
    return i18nManager.getAllTranslations();
  });
  ipcMain.handle('i18n:t', async (_, key, params) => {
    return i18nManager.t(key, params);
  });

  // --- 云端同步 ---
  ipcMain.handle('sync:get-config', async () => {
    return syncManager.getConfig();
  });
  ipcMain.handle('sync:update-config', async (_, updates) => {
    return syncManager.updateConfig(updates);
  });
  ipcMain.handle('sync:push', async () => {
    const data = syncManager.exportAll(conversationManager, settingsManager, knowledgeManager);
    return syncManager.push(data);
  });
  ipcMain.handle('sync:pull', async () => {
    return syncManager.pull();
  });
  ipcMain.handle('sync:get-status', async () => {
    return syncManager.getStatus();
  });

  // --- Token 推广收益 ---
  ipcMain.handle('token:get-overview', async () => {
    return tokenManager.getOverview();
  });
  ipcMain.handle('token:get-balances', async () => {
    return tokenManager.getAllBalances();
  });
  ipcMain.handle('token:update-balance', async (_, provider, balance, currency) => {
    return tokenManager.updateBalance(provider, balance, currency);
  });
  ipcMain.handle('token:update-balances', async (_, data) => {
    return tokenManager.updateBalances(data);
  });
  ipcMain.handle('token:get-earnings', async (_, page, pageSize, filters) => {
    return tokenManager.getPromoEarnings(page, pageSize, filters || {});
  });
  ipcMain.handle('token:add-earning', async (_, record) => {
    return tokenManager.addPromoEarning(record);
  });
  ipcMain.handle('token:update-earning-status', async (_, earningId, status) => {
    return tokenManager.updateEarningStatus(earningId, status);
  });
  ipcMain.handle('token:get-topup-records', async (_, page, pageSize) => {
    return tokenManager.getTopUpRecords(page, pageSize);
  });
  ipcMain.handle('token:add-topup', async (_, record) => {
    return tokenManager.addTopUpRecord(record);
  });
  ipcMain.handle('token:get-my-payment', async () => {
    return tokenManager.getMyPayment();
  });
  ipcMain.handle('token:update-my-payment', async (_, config) => {
    return tokenManager.updateMyPayment(config);
  });
  ipcMain.handle('token:get-stats', async () => {
    return tokenManager.getStats();
  });
  ipcMain.handle('token:update-stats', async (_, data) => {
    return tokenManager.updateStats(data);
  });
  ipcMain.handle('token:export', async () => {
    return tokenManager.exportData();
  });
  ipcMain.handle('token:import', async (_, data) => {
    return tokenManager.importData(data);
  });

}
