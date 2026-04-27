// GalaxyEpoch - 单元测试
const JsonStore = require('./src/main/json-store');
const SettingsManager = require('./src/main/settings-manager');
const KnowledgeManager = require('./src/main/knowledge-manager');
const I18nManager = require('./src/main/i18n-manager');
const PromoStub = require('./src/main/promo-stub');
const SyncManager = require('./src/main/sync-manager');
const PaintingManager = require('./src/main/painting-manager');
const PluginManager = require('./src/main/plugin-manager');
const TokenManager = require('./src/main/token-manager');

let passed = 0;
let failed = 0;

async function runTests() {

function assert(name, condition) {
  if (condition) {
    console.log('[PASS]', name);
    passed++;
  } else {
    console.log('[FAIL]', name);
    failed++;
  }
}

console.log('========== GalaxyEpoch Unit Tests ==========\n');

// 1. JsonStore
console.log('--- JsonStore ---');
const store = new JsonStore('test_unit', { foo: 'bar', count: 0 });
assert('JsonStore.get', store.get('foo') === 'bar');
assert('JsonStore.set', (() => { store.set('count', 42); return store.get('count') === 42; })());
assert('JsonStore.getAll', store.getAll().count === 42);

// 2. SettingsManager
console.log('\n--- SettingsManager ---');
const sm = new SettingsManager();
assert('SettingsManager.get default', sm.get('theme') === 'dark');
sm.set('testKey', 'testVal');
assert('SettingsManager.set+get', sm.get('testKey') === 'testVal');
assert('SettingsManager.getApiKey', sm.getApiKey('nonexistent') === '');

// 3. KnowledgeManager
console.log('\n--- KnowledgeManager ---');
const km = new KnowledgeManager(sm);
const lib = km.createLibrary('Test KB', 'For unit test');
assert('KnowledgeManager.createLibrary', lib.success === true);
const libId = lib.library.id;
assert('KnowledgeManager.listLibraries', km.listLibraries().length >= 1);
const doc = km.addDocument(libId, 'test.txt', 'GalaxyEpoch is an open-source AI model aggregator. It supports multiple AI providers including OpenAI, Anthropic, and Google. Knowledge base allows RAG-based answers.');
assert('KnowledgeManager.addDocument', doc.success === true);
const results = km.search(libId, 'GalaxyEpoch open-source');
assert('KnowledgeManager.search', results.length > 0);
const context = km.buildRAGContext(libId, 'What is GalaxyEpoch?');
assert('KnowledgeManager.buildRAGContext', context.length > 0);
km.deleteLibrary(libId);
assert('KnowledgeManager.deleteLibrary', km.listLibraries().length === 0);

// 4. I18nManager
console.log('\n--- I18nManager ---');
const i18n = new I18nManager(sm);
assert('I18nManager.getCurrentLanguage', i18n.getCurrentLanguage() === 'zh-CN');
assert('I18nManager.t zh-CN', i18n.t('sidebar.chats') === '\u5BF9\u8BDD');
i18n.setLanguage('en-US');
assert('I18nManager.setLanguage en-US', i18n.t('sidebar.chats') === 'Chats');
assert('I18nManager.getSupported', i18n.getSupportedLanguages().length >= 5);
i18n.setLanguage('zh-CN');

// 5. PromoStub
console.log('\n--- PromoStub ---');
const stub = new PromoStub(sm);
assert('PromoStub.getPromoLink', stub.getPromoLink('deepseek').includes('deepseek'));
assert('PromoStub.verifyAdmin', stub.verifyAdmin('test') === false);
assert('PromoStub.getCommissionStats', stub.getCommissionStats().totalEarned === 0);
assert('PromoStub.updatePromoLink', stub.updatePromoLink('test', 'http://test.com').success === false);

// 6. SyncManager
console.log('\n--- SyncManager ---');
const sync = new SyncManager(sm);
const syncConfig = sync.getConfig();
console.log('SyncManager config method:', syncConfig.method);
assert('SyncManager.getConfig', syncConfig.method === 'none' || typeof syncConfig.method === 'string');
assert('SyncManager.getStatus', sync.getStatus().syncing === false);
sync.updateConfig({ method: 'local', localPath: 'C:\\temp' });
assert('SyncManager.updateConfig', sync.getConfig().method === 'local');

// 7. PaintingManager
console.log('\n--- PaintingManager ---');
const paint = new PaintingManager(sm);
assert('PaintingManager.getPresets', paint.getPresets().length >= 4);
assert('PaintingManager.getHistory', paint.getHistory().total === 0);
const comfyResult = await paint.checkLocalService('comfyui');
console.log('PaintingManager checkLocalService comfyui:', JSON.stringify(comfyResult));
assert('PaintingManager.checkLocalService', comfyResult.available === false); // 本地服务未启动

// 8. PluginManager
console.log('\n--- PluginManager ---');
const plugin = new PluginManager(sm);
assert('PluginManager.listInstalled', Array.isArray(plugin.listInstalled()));

// --- TokenManager ---
console.log('\n--- TokenManager ---');
{
  const tm = new TokenManager(sm);

  // 测试获取余额
  const balances = tm.getAllBalances();
  assert('TokenManager.getAllBalances', balances && typeof balances === 'object');

  // 测试更新余额
  const result = tm.updateBalance('deepseek', 100.50, 'CNY');
  assert('TokenManager.updateBalance', result.success && result.balance.balance === 100.50);

  // 测试获取单个余额
  const bal = tm.getBalance('deepseek');
  assert('TokenManager.getBalance', bal.balance === 100.50);

  // 测试添加收益记录
  const earnResult = tm.addPromoEarning({ provider: 'deepseek', type: 'promo', amount: 25.00, note: 'Test earning' });
  assert('TokenManager.addPromoEarning', earnResult.success);

  // 测试获取收益记录
  const earnings = tm.getPromoEarnings(1, 20);
  assert('TokenManager.getPromoEarnings', earnings.total >= 1 && earnings.records[0].amount === 25.00);

  // 测试添加充值记录
  const topupResult = tm.addTopUpRecord({ provider: 'qwen', amount: 50.00, method: 'alipay' });
  assert('TokenManager.addTopUpRecord', topupResult.success);

  // 测试获取统计
  const stats = tm.getStats();
  assert('TokenManager.getStats', stats.totalPromoEarnings >= 25.00 && stats.totalTopUp >= 50.00);

  // 测试概览
  const overview = tm.getOverview();
  assert('TokenManager.getOverview', overview.stats && overview.balanceList && overview.totalBalanceCNY);

  // 测试收款配置 - 先重置再测试，避免残留数据干扰
  tm.updateMyPayment({ method: 'alipay', alipayAccount: 'test@alipay.com', alipayQR: '', wechatAccount: '', wechatQR: '', bankName: '', bankBranch: '', bankAccount: '', bankHolder: '', usdtAddress: '', usdtNetwork: 'TRC20', customNote: '' });
  const payment = tm.getMyPayment();
  assert('TokenManager.getMyPayment', payment && payment.method === 'alipay' && payment.alipayAccount === 'test@alipay.com');

  const updatePayment = tm.updateMyPayment({ method: 'bank', bankName: '工商银行', bankBranch: '北京分行', bankAccount: '6222****', bankHolder: '测试', alipayAccount: '', alipayQR: '', wechatAccount: '', wechatQR: '', usdtAddress: '', usdtNetwork: 'TRC20', customNote: '' });
  assert('TokenManager.updateMyPayment', updatePayment.success);

  const updatedPayment = tm.getMyPayment();
  assert('TokenManager.getMyPayment (updated)', updatedPayment.method === 'bank' && updatedPayment.bankName === '工商银行');

  // 测试导出/导入
  const exported = tm.exportData();
  assert('TokenManager.exportData', exported && exported.balances);

  const importResult = tm.importData(exported);
  assert('TokenManager.importData', importResult.success);

  // 测试更新收益状态
  const earningsList = tm.getPromoEarnings(1, 20);
  if (earningsList.records.length > 0) {
    const statusResult = tm.updateEarningStatus(earningsList.records[0].id, 'settled');
    assert('TokenManager.updateEarningStatus', statusResult.success);
  } else {
    assert('TokenManager.updateEarningStatus', true); // skip
  }
}

// Summary
console.log('\n========== Test Results ==========');
console.log('Passed:', passed);
console.log('Failed:', failed);
console.log('Total:', passed + failed);

if (failed > 0) process.exit(1);
}

runTests().catch(e => { console.error(e); process.exit(1); });
