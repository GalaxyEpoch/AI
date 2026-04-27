// GalaxyEpoch 推广模块 - 开源 Stub 实现
// 当闭源 promo-core.js 不存在时（开源 fork 场景），使用此 stub
// 功能：所有推广跳转直接打开官方首页（无推广参数），管理员功能禁用
// 开发者可替换为自己的 promo-core.js 实现 PromoInterface 接口

let shell;
try {
  shell = require('electron').shell;
} catch (e) {
  shell = { openExternal: (url) => console.log('[PromoStub] openExternal:', url) };
}

/**
 * 官方首页映射（无推广参数）
 */
const OFFICIAL_LINKS = {
  deepseek: 'https://platform.deepseek.com',
  qwen: 'https://dashscope.console.aliyun.com',
  zhipu: 'https://open.bigmodel.cn',
  moonshot: 'https://platform.moonshot.cn',
  yi: 'https://platform.lingyiwanwu.com',
  doubao: 'https://console.volcengine.com/ark',
  baidu: 'https://cloud.baidu.com',
  hunyuan: 'https://cloud.tencent.com',
  openai: 'https://platform.openai.com',
  anthropic: 'https://console.anthropic.com',
  google: 'https://ai.google.dev',
  groq: 'https://console.groq.com',
  mistral: 'https://console.mistral.ai'
};

class PromoStub {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    console.log('[GalaxyEpoch] 使用开源推广 stub（无推广参数）');
  }

  getPromoLink(provider) {
    return OFFICIAL_LINKS[provider] || 'https://www.google.com';
  }

  openPromoLink(provider) {
    const link = this.getPromoLink(provider);
    shell.openExternal(link);
    return { success: true, link };
  }

  getAllPromoLinks() {
    return { ...OFFICIAL_LINKS };
  }

  updatePromoLink(provider, link) {
    console.log('[PromoStub] updatePromoLink: 闭源模块未安装，无法更新');
    return { success: false, error: 'Promo module not installed' };
  }

  getCommissionStats() {
    return { totalEarned: 0, pendingPayout: 0, paidOut: 0 };
  }

  updateCommission(data) {
    return { success: false, error: 'Promo module not installed' };
  }

  getClickRecords(page = 1, pageSize = 20) {
    return { records: [], total: 0, page, pageSize };
  }

  getPaymentConfig() {
    return { method: '', qrCodeBase64: '', alipayAccount: '', wechatAccount: '', bankName: '', bankAccount: '', bankHolder: '', customConfig: '' };
  }

  updatePaymentConfig(config) {
    return { success: false, error: 'Promo module not installed' };
  }

  verifyAdmin(password) {
    // 开源版无管理员功能
    return false;
  }

  setAdminPassword(password) {
    return { success: false, error: 'Promo module not installed' };
  }
}

module.exports = PromoStub;
