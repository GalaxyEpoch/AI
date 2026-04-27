// GalaxyEpoch 推广模块公共接口契约
// 此文件定义了推广模块的接口规范，供开发者参考
// 实际实现为 promo-core.js（闭源，不包含在开源仓库中）

/**
 * PromoInterface - 推广模块必须实现以下所有方法
 * 
 * 如果你需要自定义推广逻辑（例如使用你自己的推广链接），
 * 可以创建自己的 promo-core.js 实现此接口，放在 src/main/ 目录下。
 * 主进程会自动加载 promo-core.js，只要它导出了符合此接口的类即可。
 */
class PromoInterface {
  /**
   * 构造函数
   * @param {object} settingsManager - 设置管理器实例
   */
  constructor(settingsManager) {}

  /**
   * 获取推广链接
   * @param {string} provider - 模型提供商标识（如 'deepseek', 'openai'）
   * @returns {string} 推广链接URL
   */
  getPromoLink(provider) {}

  /**
   * 在系统浏览器中打开推广链接
   * @param {string} provider - 模型提供商标识
   * @returns {{ success: boolean, link?: string }} 操作结果
   */
  openPromoLink(provider) {}

  /**
   * 获取所有推广链接配置
   * @returns {Object<string, string>} provider → 链接映射
   */
  getAllPromoLinks() {}

  /**
   * 更新推广链接
   * @param {string} provider - 提供商标识
   * @param {string} link - 新链接
   * @returns {{ success: boolean }}
   */
  updatePromoLink(provider, link) {}

  /**
   * 获取佣金统计
   * @returns {{ totalEarned: number, pendingPayout: number, paidOut: number }}
   */
  getCommissionStats() {}

  /**
   * 更新佣金数据
   * @param {object} data - 佣金数据
   * @returns {{ success: boolean }}
   */
  updateCommission(data) {}

  /**
   * 获取点击记录（分页）
   * @param {number} page - 页码
   * @param {number} pageSize - 每页条数
   * @returns {{ records: Array, total: number, page: number, pageSize: number }}
   */
  getClickRecords(page, pageSize) {}

  /**
   * 获取收款配置
   * @returns {object} 收款配置
   */
  getPaymentConfig() {}

  /**
   * 更新收款配置
   * @param {object} config - 收款配置
   * @returns {{ success: boolean }}
   */
  updatePaymentConfig(config) {}

  /**
   * 验证管理员密码
   * @param {string} password - 密码
   * @returns {boolean} 是否验证通过
   */
  verifyAdmin(password) {}

  /**
   * 设置管理员密码
   * @param {string} password - 新密码
   * @returns {{ success: boolean }}
   */
  setAdminPassword(password) {}
}

module.exports = PromoInterface;
