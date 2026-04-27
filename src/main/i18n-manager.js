// GalaxyEpoch - 国际化管理器（i18n）
// 支持动态语言切换，语言包存放在 src/main/locales/ 目录

const fs = require('fs');
const path = require('path');
const JsonStore = require('./json-store');

class I18nManager {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.store = new JsonStore('i18n', {
      currentLanguage: 'zh-CN',
      customTranslations: {}
    });
    this.translations = {};
    this.supportedLanguages = [
      { code: 'zh-CN', name: '简体中文', nativeName: '简体中文' },
      { code: 'zh-TW', name: '繁體中文', nativeName: '繁體中文' },
      { code: 'en-US', name: 'English', nativeName: 'English' },
      { code: 'ja-JP', name: '日本語', nativeName: '日本語' },
      { code: 'ko-KR', name: '한국어', nativeName: '한국어' },
      { code: 'fr-FR', name: 'Français', nativeName: 'Français' },
      { code: 'de-DE', name: 'Deutsch', nativeName: 'Deutsch' },
      { code: 'es-ES', name: 'Español', nativeName: 'Español' },
      { code: 'ru-RU', name: 'Русский', nativeName: 'Русский' }
    ];
    this._loadAllLanguages();
  }

  /**
   * 加载所有语言包
   */
  _loadAllLanguages() {
    const localesDir = path.join(__dirname, 'locales');
    if (!fs.existsSync(localesDir)) {
      fs.mkdirSync(localesDir, { recursive: true });
      // 写入默认语言包
      this._writeDefaultLocales(localesDir);
    }

    const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const code = file.replace('.json', '');
      try {
        this.translations[code] = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf-8'));
      } catch (e) {
        console.error(`[i18n] 加载 ${code} 失败:`, e.message);
      }
    }
  }

  /**
   * 写入默认语言包
   */
  _writeDefaultLocales(dir) {
    const zhCN = {
      // 通用
      "app.name": "GalaxyEpoch",
      "app.tagline": "大模型聚合客户端",
      // 侧边栏
      "sidebar.chats": "对话",
      "sidebar.models": "模型",
      "sidebar.newChat": "新对话",
      "sidebar.search": "搜索对话...",
      // 模型
      "model.local": "本地模型",
      "model.online": "在线模型",
      "model.scan": "扫描本地模型",
      "model.scanRunning": "正在扫描...",
      "model.noLocal": "未发现本地模型",
      "model.noLocalTip": "请确保 Ollama 已启动并安装了模型",
      "model.localBadge": "本地",
      "model.getKey": "获取密钥",
      "model.addCustom": "添加自定义模型",
      // 对话
      "chat.placeholder": "输入消息... (Enter 发送, Shift+Enter 换行)",
      "chat.send": "发送",
      "chat.stop": "停止",
      "chat.selectModel": "选择模型...",
      "chat.selectModelFirst": "请先选择一个模型",
      "chat.clear": "清空对话",
      "chat.thinking": "思考中...",
      "chat.empty": "选择一个模型开始对话",
      "chat.quickNew": "开始新对话",
      "chat.quickScan": "扫描本地模型",
      "chat.quickOnline": "配置在线模型",
      // 设置
      "settings.title": "设置",
      "settings.apiKeys": "API 密钥",
      "settings.apiKeySet": "已设置",
      "settings.apiKeyUnset": "未设置",
      "settings.chatParams": "对话参数",
      "settings.temperature": "温度",
      "settings.maxTokens": "最大 Token 数",
      "settings.general": "通用",
      "settings.privacy": "隐私",
      "settings.about": "关于",
      "settings.language": "语言",
      "settings.theme": "主题",
      "settings.version": "版本",
      // 主题
      "theme.dark": "暗色",
      "theme.light": "亮色",
      // 购买Token
      "buyToken.title": "获取 API 密钥",
      "buyToken.message": "即将跳转到 {provider} 官方平台注册/购买 API 密钥",
      "buyToken.confirm": "前往",
      "buyToken.cancel": "取消",
      // 知识库
      "kb.title": "知识库",
      "kb.create": "创建知识库",
      "kb.name": "名称",
      "kb.description": "描述",
      "kb.addDoc": "添加文档",
      "kb.empty": "暂无知识库",
      "kb.search": "搜索知识库...",
      "kb.active": "已激活",
      "kb.deactivate": "停用",
      // 绘画
      "paint.title": "AI 绘画",
      "paint.prompt": "描述你想要生成的图片...",
      "paint.generate": "生成",
      "paint.model": "绘画模型",
      "paint.size": "尺寸",
      "paint.history": "历史记录",
      // 插件
      "plugin.title": "插件",
      "plugin.install": "安装插件",
      "plugin.uninstall": "卸载",
      "plugin.enable": "启用",
      "plugin.disable": "停用",
      // 通用
      "common.confirm": "确认",
      "common.cancel": "取消",
      "common.save": "保存",
      "common.delete": "删除",
      "common.close": "关闭",
      "common.loading": "加载中...",
      "common.error": "出错",
      "common.success": "成功"
    };

    const enUS = {
      "app.name": "GalaxyEpoch",
      "app.tagline": "AI Model Aggregator",
      "sidebar.chats": "Chats",
      "sidebar.models": "Models",
      "sidebar.newChat": "New Chat",
      "sidebar.search": "Search chats...",
      "model.local": "Local Models",
      "model.online": "Online Models",
      "model.scan": "Scan Local Models",
      "model.scanRunning": "Scanning...",
      "model.noLocal": "No local models found",
      "model.noLocalTip": "Make sure Ollama is running with models installed",
      "model.localBadge": "Local",
      "model.getKey": "Get Key",
      "model.addCustom": "Add Custom Model",
      "chat.placeholder": "Type a message... (Enter to send, Shift+Enter for new line)",
      "chat.send": "Send",
      "chat.stop": "Stop",
      "chat.selectModel": "Select model...",
      "chat.selectModelFirst": "Please select a model first",
      "chat.clear": "Clear Chat",
      "chat.thinking": "Thinking...",
      "chat.empty": "Select a model to start chatting",
      "chat.quickNew": "New Chat",
      "chat.quickScan": "Scan Local Models",
      "chat.quickOnline": "Configure Online Models",
      "settings.title": "Settings",
      "settings.apiKeys": "API Keys",
      "settings.apiKeySet": "Set",
      "settings.apiKeyUnset": "Not Set",
      "settings.chatParams": "Chat Parameters",
      "settings.temperature": "Temperature",
      "settings.maxTokens": "Max Tokens",
      "settings.general": "General",
      "settings.privacy": "Privacy",
      "settings.about": "About",
      "settings.language": "Language",
      "settings.theme": "Theme",
      "settings.version": "Version",
      "theme.dark": "Dark",
      "theme.light": "Light",
      "buyToken.title": "Get API Key",
      "buyToken.message": "You will be redirected to {provider}'s official platform to register/purchase an API key",
      "buyToken.confirm": "Go",
      "buyToken.cancel": "Cancel",
      "kb.title": "Knowledge Base",
      "kb.create": "Create Knowledge Base",
      "kb.name": "Name",
      "kb.description": "Description",
      "kb.addDoc": "Add Document",
      "kb.empty": "No knowledge bases",
      "kb.search": "Search knowledge base...",
      "kb.active": "Active",
      "kb.deactivate": "Deactivate",
      "paint.title": "AI Painting",
      "paint.prompt": "Describe the image you want to generate...",
      "paint.generate": "Generate",
      "paint.model": "Painting Model",
      "paint.size": "Size",
      "paint.history": "History",
      "plugin.title": "Plugins",
      "plugin.install": "Install Plugin",
      "plugin.uninstall": "Uninstall",
      "plugin.enable": "Enable",
      "plugin.disable": "Disable",
      "common.confirm": "Confirm",
      "common.cancel": "Cancel",
      "common.save": "Save",
      "common.delete": "Delete",
      "common.close": "Close",
      "common.loading": "Loading...",
      "common.error": "Error",
      "common.success": "Success"
    };

    const jaJP = {
      "app.name": "GalaxyEpoch",
      "app.tagline": "AIモデル統合クライアント",
      "sidebar.chats": "チャット",
      "sidebar.models": "モデル",
      "sidebar.newChat": "新規チャット",
      "sidebar.search": "チャットを検索...",
      "model.local": "ローカルモデル",
      "model.online": "オンラインモデル",
      "model.scan": "ローカルモデルをスキャン",
      "model.noLocal": "ローカルモデルが見つかりません",
      "model.getKey": "キーを取得",
      "chat.placeholder": "メッセージを入力... (Enterで送信)",
      "chat.send": "送信",
      "chat.stop": "停止",
      "chat.selectModel": "モデルを選択...",
      "chat.thinking": "考え中...",
      "settings.title": "設定",
      "settings.apiKeys": "APIキー",
      "common.confirm": "確認",
      "common.cancel": "キャンセル",
      "common.save": "保存",
      "common.delete": "削除",
      "common.close": "閉じる"
    };

    fs.writeFileSync(path.join(dir, 'zh-CN.json'), JSON.stringify(zhCN, null, 2), 'utf-8');
    fs.writeFileSync(path.join(dir, 'en-US.json'), JSON.stringify(enUS, null, 2), 'utf-8');
    fs.writeFileSync(path.join(dir, 'ja-JP.json'), JSON.stringify(jaJP, null, 2), 'utf-8');
  }

  /**
   * 获取当前语言
   */
  getCurrentLanguage() {
    return this.store.get('currentLanguage', 'zh-CN');
  }

  /**
   * 设置当前语言
   */
  setLanguage(code) {
    if (!this.supportedLanguages.find(l => l.code === code)) {
      return { success: false, error: '不支持的语言' };
    }
    this.store.set('currentLanguage', code);
    return { success: true };
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages() {
    return this.supportedLanguages;
  }

  /**
   * 翻译 key
   */
  t(key, params = {}) {
    const lang = this.getCurrentLanguage();
    let text = this.translations[lang]?.[key] 
            || this.translations['zh-CN']?.[key] 
            || key;
    
    // 替换参数 {param}
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return text;
  }

  /**
   * 获取当前语言的完整翻译表
   */
  getAllTranslations() {
    const lang = this.getCurrentLanguage();
    return {
      language: lang,
      translations: this.translations[lang] || this.translations['zh-CN'] || {}
    };
  }
}

module.exports = I18nManager;
