// GalaxyEpoch - Token 推广收益管理器
// 管理各平台 Token 余额、消费记录、充值追踪、推广收益统计

const JsonStore = require('./json-store');

class TokenManager {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.store = new JsonStore('token', {
      // 各平台 Token 余额（手动更新或从 API 同步）
      balances: {
        deepseek: { balance: 0, currency: 'CNY', lastUpdate: null },
        qwen: { balance: 0, currency: 'CNY', lastUpdate: null },
        zhipu: { balance: 0, currency: 'CNY', lastUpdate: null },
        moonshot: { balance: 0, currency: 'CNY', lastUpdate: null },
        yi: { balance: 0, currency: 'CNY', lastUpdate: null },
        doubao: { balance: 0, currency: 'CNY', lastUpdate: null },
        baidu: { balance: 0, currency: 'CNY', lastUpdate: null },
        hunyuan: { balance: 0, currency: 'CNY', lastUpdate: null },
        openai: { balance: 0, currency: 'USD', lastUpdate: null },
        anthropic: { balance: 0, currency: 'USD', lastUpdate: null },
        google: { balance: 0, currency: 'USD', lastUpdate: null },
        groq: { balance: 0, currency: 'USD', lastUpdate: null },
        mistral: { balance: 0, currency: 'EUR', lastUpdate: null }
      },
      // 推广收益记录
      promoEarnings: [],
      // 充值记录
      topUpRecords: [],
      // 收款配置（用户自己的二维码/银行卡）
      myPayment: {
        method: 'alipay',       // alipay / wechat / bank / usdt
        alipayAccount: '',
        alipayQR: '',           // 收款码 Base64
        wechatAccount: '',
        wechatQR: '',           // 收款码 Base64
        bankName: '',
        bankBranch: '',
        bankAccount: '',
        bankHolder: '',
        usdtAddress: '',
        usdtNetwork: 'TRC20',   // TRC20 / ERC20 / BEP20
        customNote: ''
      },
      // 收益统计汇总
      stats: {
        totalPromoClicks: 0,
        totalPromoEarnings: 0,     // 推广总收益 (CNY)
        totalTopUp: 0,             // 充值总金额 (CNY)
        totalConsumed: 0,          // 消费总金额 (CNY)
        pendingSettlement: 0,      // 待结算
        settledAmount: 0           // 已结算
      }
    });
  }

  // ==================== 余额管理 ====================

  /**
   * 获取所有平台余额
   */
  getAllBalances() {
    return this.store.get('balances', {});
  }

  /**
   * 获取单个平台余额
   */
  getBalance(provider) {
    const balances = this.store.get('balances', {});
    return balances[provider] || { balance: 0, currency: 'CNY', lastUpdate: null };
  }

  /**
   * 更新平台余额
   */
  updateBalance(provider, balance, currency) {
    const balances = this.store.get('balances', {});
    if (!balances[provider]) {
      balances[provider] = { balance: 0, currency: 'CNY', lastUpdate: null };
    }
    balances[provider].balance = balance;
    if (currency) balances[provider].currency = currency;
    balances[provider].lastUpdate = new Date().toISOString();
    this.store.set('balances', balances);
    return { success: true, balance: balances[provider] };
  }

  /**
   * 批量更新余额
   */
  updateBalances(data) {
    const balances = this.store.get('balances', {});
    for (const [provider, info] of Object.entries(data)) {
      if (!balances[provider]) {
        balances[provider] = { balance: 0, currency: 'CNY', lastUpdate: null };
      }
      balances[provider].balance = info.balance !== undefined ? info.balance : balances[provider].balance;
      balances[provider].currency = info.currency || balances[provider].currency;
      balances[provider].lastUpdate = new Date().toISOString();
    }
    this.store.set('balances', balances);
    return { success: true };
  }

  // ==================== 推广收益 ====================

  /**
   * 记录推广收益
   */
  addPromoEarning(record) {
    const earnings = this.store.get('promoEarnings', []);
    earnings.unshift({
      id: 'earn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      provider: record.provider || '',
      type: record.type || 'promo',         // promo=推广注册 / topup=充值返利 / usage=用量分成
      amount: record.amount || 0,           // 金额 (CNY)
      currency: record.currency || 'CNY',
      status: record.status || 'pending',   // pending / settled / cancelled
      note: record.note || '',
      timestamp: new Date().toISOString()
    });
    // 保留最近 5000 条
    if (earnings.length > 5000) earnings.length = 5000;
    this.store.set('promoEarnings', earnings);
    // 更新统计
    this._recalcStats();
    return { success: true };
  }

  /**
   * 获取推广收益记录（分页）
   */
  getPromoEarnings(page = 1, pageSize = 20, filters = {}) {
    let records = this.store.get('promoEarnings', []);
    // 过滤
    if (filters.provider) records = records.filter(r => r.provider === filters.provider);
    if (filters.type) records = records.filter(r => r.type === filters.type);
    if (filters.status) records = records.filter(r => r.status === filters.status);
    const total = records.length;
    const start = (page - 1) * pageSize;
    return {
      records: records.slice(start, start + pageSize),
      total,
      page,
      pageSize
    };
  }

  /**
   * 更新收益记录状态
   */
  updateEarningStatus(earningId, status) {
    const earnings = this.store.get('promoEarnings', []);
    const item = earnings.find(e => e.id === earningId);
    if (item) {
      item.status = status;
      this.store.set('promoEarnings', earnings);
      this._recalcStats();
      return { success: true };
    }
    return { success: false, error: 'Record not found' };
  }

  // ==================== 充值记录 ====================

  /**
   * 记录充值
   */
  addTopUpRecord(record) {
    const records = this.store.get('topUpRecords', []);
    records.unshift({
      id: 'topup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      provider: record.provider || '',
      amount: record.amount || 0,
      currency: record.currency || 'CNY',
      tokens: record.tokens || 0,
      method: record.method || '',     // alipay / wechat / bank / promo
      note: record.note || '',
      timestamp: new Date().toISOString()
    });
    if (records.length > 5000) records.length = 5000;
    this.store.set('topUpRecords', records);
    this._recalcStats();
    return { success: true };
  }

  /**
   * 获取充值记录（分页）
   */
  getTopUpRecords(page = 1, pageSize = 20) {
    const records = this.store.get('topUpRecords', []);
    const total = records.length;
    const start = (page - 1) * pageSize;
    return {
      records: records.slice(start, start + pageSize),
      total,
      page,
      pageSize
    };
  }

  // ==================== 收款配置 ====================

  /**
   * 获取我的收款配置
   */
  getMyPayment() {
    return this.store.get('myPayment', {
      method: 'alipay',
      alipayAccount: '', alipayQR: '',
      wechatAccount: '', wechatQR: '',
      bankName: '', bankBranch: '', bankAccount: '', bankHolder: '',
      usdtAddress: '', usdtNetwork: 'TRC20',
      customNote: ''
    });
  }

  /**
   * 更新我的收款配置
   */
  updateMyPayment(config) {
    this.store.set('myPayment', config);
    return { success: true };
  }

  // ==================== 统计 ====================

  /**
   * 获取收益统计
   */
  getStats() {
    return this.store.get('stats', {
      totalPromoClicks: 0,
      totalPromoEarnings: 0,
      totalTopUp: 0,
      totalConsumed: 0,
      pendingSettlement: 0,
      settledAmount: 0
    });
  }

  /**
   * 更新统计（手动修正）
   */
  updateStats(data) {
    this.store.set('stats', data);
    return { success: true };
  }

  /**
   * 重新计算统计数据
   */
  _recalcStats() {
    const earnings = this.store.get('promoEarnings', []);
    const topUps = this.store.get('topUpRecords', []);

    const totalPromoEarnings = earnings.reduce((sum, e) => sum + (e.amount || 0), 0);
    const pendingSettlement = earnings.filter(e => e.status === 'pending').reduce((sum, e) => sum + (e.amount || 0), 0);
    const settledAmount = earnings.filter(e => e.status === 'settled').reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalTopUp = topUps.reduce((sum, t) => sum + (t.amount || 0), 0);

    const stats = {
      totalPromoClicks: earnings.filter(e => e.type === 'promo').length,
      totalPromoEarnings,
      totalTopUp,
      totalConsumed: 0, // 消费需从 API 获取，暂为手动
      pendingSettlement,
      settledAmount
    };
    this.store.set('stats', stats);
    return stats;
  }

  /**
   * 获取完整的收益概览（前端面板用）
   */
  getOverview() {
    const balances = this.store.get('balances', {});
    const stats = this.getStats();
    const payment = this.getMyPayment();

    // 计算总余额（统一换算为 CNY 估算）
    const rateToCNY = { CNY: 1, USD: 7.25, EUR: 7.85, GBP: 9.15, JPY: 0.048, KRW: 0.0053 };
    let totalBalanceCNY = 0;
    const balanceList = [];
    for (const [provider, info] of Object.entries(balances)) {
      const rate = rateToCNY[info.currency] || 1;
      totalBalanceCNY += (info.balance || 0) * rate;
      balanceList.push({ provider, ...info, estimatedCNY: (info.balance || 0) * rate });
    }

    return {
      stats,
      totalBalanceCNY: totalBalanceCNY.toFixed(2),
      balanceList,
      paymentMethod: payment.method,
      hasPaymentConfig: !!(payment.alipayAccount || payment.wechatAccount || payment.bankAccount || payment.usdtAddress)
    };
  }

  /**
   * 导出数据（备份用）
   */
  exportData() {
    return {
      balances: this.store.get('balances', {}),
      promoEarnings: this.store.get('promoEarnings', []),
      topUpRecords: this.store.get('topUpRecords', []),
      myPayment: this.store.get('myPayment', {}),
      stats: this.store.get('stats', {}),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * 导入数据（恢复用）
   */
  importData(data) {
    if (data.balances) this.store.set('balances', data.balances);
    if (data.promoEarnings) this.store.set('promoEarnings', data.promoEarnings);
    if (data.topUpRecords) this.store.set('topUpRecords', data.topUpRecords);
    if (data.myPayment) this.store.set('myPayment', data.myPayment);
    if (data.stats) this.store.set('stats', data.stats);
    return { success: true };
  }
}

module.exports = TokenManager;
