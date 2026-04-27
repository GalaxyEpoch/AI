// 设置管理器
const JsonStore = require('./json-store');

class SettingsManager {
  constructor() {
    this.store = new JsonStore('settings', {
      theme: 'dark',
      language: 'zh-CN',
      autoScan: true,
      apiKeyMap: {},
      customApiEndpoints: [],
      privacy: {
        saveHistory: true,
        sendUsageData: false
      },
      defaultModel: '',
      chatParams: {
        temperature: 0.7,
        maxTokens: 4096,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0
      },
      billing: {
        commissionRate: 0.1,
        enabled: true
      },
      windowBounds: { width: 1280, height: 800 }
    });
  }

  get(key) {
    return this.store.get(key);
  }

  set(key, value) {
    this.store.set(key, value);
    return { success: true };
  }

  getAll() {
    return this.store.store;
  }

  getApiKey(provider) {
    const map = this.store.get('apiKeyMap', {});
    return map[provider] || '';
  }

  setApiKey(provider, key) {
    const map = this.store.get('apiKeyMap', {});
    map[provider] = key;
    this.store.set('apiKeyMap', map);
    return { success: true };
  }
}

module.exports = SettingsManager;
