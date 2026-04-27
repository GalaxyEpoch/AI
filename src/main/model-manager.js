// 模型管理器
const JsonStore = require('./json-store');

class ModelManager {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.store = new JsonStore('models', {
      models: [],
      customModels: []
    });
  }

  /**
   * 获取平台预设配置（API地址、模型示例、API类型等）
   * 用于「添加模型」时自动填充，以及关联已有 API Key
   */
  getPlatformPresets() {
    return [
      {
        id: 'deepseek',
        name: 'DeepSeek',
        icon: '🟣',
        apiType: 'openai',
        apiBase: 'https://api.deepseek.com/v1',
        modelExamples: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
        desc: 'DeepSeek 高性价比推理模型'
      },
      {
        id: 'qwen',
        name: '通义千问 (Qwen)',
        icon: '🟠',
        apiType: 'openai',
        apiBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        modelExamples: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen3-32b', 'qwen-long'],
        desc: '阿里通义千问系列'
      },
      {
        id: 'zhipu',
        name: '智谱AI (GLM)',
        icon: '🔵',
        apiType: 'openai',
        apiBase: 'https://open.bigmodel.cn/api/paas/v4',
        modelExamples: ['glm-4', 'glm-4-flash', 'glm-4-plus', 'glm-4v'],
        desc: '智谱 GLM 系列，中文能力强'
      },
      {
        id: 'moonshot',
        name: 'Kimi (月之暗面)',
        icon: '🌙',
        apiType: 'openai',
        apiBase: 'https://api.moonshot.cn/v1',
        modelExamples: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
        desc: 'Kimi 长文本能力突出'
      },
      {
        id: 'yi',
        name: '零一万物 (Yi)',
        icon: '🟢',
        apiType: 'openai',
        apiBase: 'https://api.lingyiwanwu.com/v1',
        modelExamples: ['yi-lightning', 'yi-large', 'yi-medium', 'yi-spark'],
        desc: '零一万物 Yi 系列'
      },
      {
        id: 'doubao',
        name: '豆包 (字节火山)',
        icon: '🔴',
        apiType: 'openai',
        apiBase: 'https://ark.cn-beijing.volces.com/api/v3',
        modelExamples: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-pro-128k'],
        desc: '字节跳动豆包系列'
      },
      {
        id: 'baidu',
        name: '百度文心一言',
        icon: '🔵',
        apiType: 'openai',
        apiBase: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop',
        modelExamples: ['completions_pro', 'completions', 'eb-instant'],
        desc: '百度文心一言系列'
      },
      {
        id: 'hunyuan',
        name: '腾讯混元',
        icon: '🟢',
        apiType: 'openai',
        apiBase: 'https://api.hunyuan.cloud.tencent.com/v1',
        modelExamples: ['hunyuan-lite', 'hunyuan-standard', 'hunyuan-pro'],
        desc: '腾讯混元系列'
      },
      {
        id: 'openai',
        name: 'OpenAI',
        icon: '🟢',
        apiType: 'openai',
        apiBase: 'https://api.openai.com/v1',
        modelExamples: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'o1-preview'],
        desc: 'OpenAI GPT 系列'
      },
      {
        id: 'anthropic',
        name: 'Anthropic (Claude)',
        icon: '🟤',
        apiType: 'anthropic',
        apiBase: 'https://api.anthropic.com/v1',
        modelExamples: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
        desc: 'Claude 编程与推理能力强'
      },
      {
        id: 'google',
        name: 'Google Gemini',
        icon: '🔷',
        apiType: 'google',
        apiBase: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        modelExamples: ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        desc: 'Google Gemini 多模态模型'
      },
      {
        id: 'groq',
        name: 'Groq (Llama)',
        icon: '🦙',
        apiType: 'openai',
        apiBase: 'https://api.groq.com/openai/v1',
        modelExamples: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768'],
        desc: 'Groq 极速推理'
      },
      {
        id: 'mistral',
        name: 'Mistral AI',
        icon: '🌪️',
        apiType: 'openai',
        apiBase: 'https://api.mistral.ai/v1',
        modelExamples: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
        desc: 'Mistral AI 系列'
      }
    ];
  }

  /**
   * 获取所有模型（本地 + 在线）
   */
  getAllModels() {
    const stored = this.store.get('models', []);
    const custom = this.store.get('customModels', []);
    return [...stored, ...custom];
  }

  /**
   * 添加自定义模型
   */
  addModel(model) {
    const custom = this.store.get('customModels', []);
    const existing = custom.find(m => m.id === model.id);
    if (existing) {
      return { success: false, error: '模型已存在' };
    }
    model.createdAt = new Date().toISOString();
    custom.push(model);
    this.store.set('customModels', custom);
    return { success: true };
  }

  /**
   * 删除模型
   */
  removeModel(modelId) {
    // 自定义模型可直接删除
    let custom = this.store.get('customModels', []);
    const before = custom.length;
    custom = custom.filter(m => m.id !== modelId);
    if (custom.length < before) {
      this.store.set('customModels', custom);
      return { success: true };
    }
    // 扫描到的模型标记为隐藏
    let models = this.store.get('models', []);
    models = models.map(m => m.id === modelId ? { ...m, hidden: true } : m);
    this.store.set('models', models);
    return { success: true };
  }

  /**
   * 更新模型信息
   */
  updateModel(modelId, data) {
    let custom = this.store.get('customModels', []);
    const idx = custom.findIndex(m => m.id === modelId);
    if (idx !== -1) {
      custom[idx] = { ...custom[idx], ...data };
      this.store.set('customModels', custom);
      return { success: true };
    }
    let models = this.store.get('models', []);
    const idx2 = models.findIndex(m => m.id === modelId);
    if (idx2 !== -1) {
      models[idx2] = { ...models[idx2], ...data };
      this.store.set('models', models);
      return { success: true };
    }
    return { success: false, error: '模型不存在' };
  }

  /**
   * 更新扫描结果（不覆盖自定义模型）
   */
  updateScannedModels(scannedModels) {
    const custom = this.store.get('customModels', []);
    // 合并：扫描结果 + 自定义模型，去重
    const existingIds = new Set(custom.map(m => m.id));
    const merged = scannedModels.filter(m => !existingIds.has(m.id));
    this.store.set('models', scannedModels);
    return { success: true, count: scannedModels.length + custom.length };
  }

  /**
   * 获取预设模型配置（主流在线API）
   */
  getPresets() {
    return [
      // === 国内主流 ===
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'deepseek',
        type: 'online',
        apiBase: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        needApiKey: true,
        icon: '🟣',
        desc: 'DeepSeek 对话模型，性价比极高'
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek R1',
        provider: 'deepseek',
        type: 'online',
        apiBase: 'https://api.deepseek.com/v1',
        model: 'deepseek-reasoner',
        needApiKey: true,
        icon: '🟣',
        desc: 'DeepSeek 推理模型，深度思考'
      },
      {
        id: 'qwen-turbo',
        name: '通义千问 Turbo',
        provider: 'qwen',
        type: 'online',
        apiBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-turbo',
        needApiKey: true,
        icon: '🟠',
        desc: '阿里通义千问，响应速度快'
      },
      {
        id: 'qwen-plus',
        name: '通义千问 Plus',
        provider: 'qwen',
        type: 'online',
        apiBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-plus',
        needApiKey: true,
        icon: '🟠',
        desc: '阿里通义千问，平衡能力与速度'
      },
      {
        id: 'qwen-max',
        name: '通义千问 Max',
        provider: 'qwen',
        type: 'online',
        apiBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-max',
        needApiKey: true,
        icon: '🟠',
        desc: '阿里通义千问旗舰模型'
      },
      {
        id: 'glm-4',
        name: '智谱 GLM-4',
        provider: 'zhipu',
        type: 'online',
        apiBase: 'https://open.bigmodel.cn/api/paas/v4',
        model: 'glm-4',
        needApiKey: true,
        icon: '🔵',
        desc: '智谱AI GLM-4，中文能力强'
      },
      {
        id: 'glm-4-flash',
        name: '智谱 GLM-4-Flash',
        provider: 'zhipu',
        type: 'online',
        apiBase: 'https://open.bigmodel.cn/api/paas/v4',
        model: 'glm-4-flash',
        needApiKey: true,
        icon: '🔵',
        desc: '智谱AI 免费模型，速度快'
      },
      {
        id: 'moonshot-v1',
        name: 'Kimi Moonshot',
        provider: 'moonshot',
        type: 'online',
        apiBase: 'https://api.moonshot.cn/v1',
        model: 'moonshot-v1-8k',
        needApiKey: true,
        icon: '🌙',
        desc: '月之暗面 Kimi，长文本能力强'
      },
      {
        id: 'yi-lightning',
        name: '零一万物 Yi Lightning',
        provider: 'yi',
        type: 'online',
        apiBase: 'https://api.lingyiwanwu.com/v1',
        model: 'yi-lightning',
        needApiKey: true,
        icon: '🟢',
        desc: '零一万物 Yi，性价比高'
      },
      {
        id: 'doubao-pro',
        name: '豆包 Pro',
        provider: 'doubao',
        type: 'online',
        apiBase: 'https://ark.cn-beijing.volces.com/api/v3',
        model: 'doubao-pro-4k',
        needApiKey: true,
        icon: '🔴',
        desc: '字节跳动豆包，多模态支持'
      },
      {
        id: 'ernie-4',
        name: '文心一言 4.0',
        provider: 'baidu',
        type: 'online',
        apiBase: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop',
        model: 'completions_pro',
        needApiKey: true,
        icon: '🔵',
        desc: '百度文心一言旗舰'
      },
      {
        id: 'hunyuan-lite',
        name: '混元 Lite',
        provider: 'hunyuan',
        type: 'online',
        apiBase: 'https://api.hunyuan.cloud.tencent.com/v1',
        model: 'hunyuan-lite',
        needApiKey: true,
        icon: '🟢',
        desc: '腾讯混元，免费体验'
      },

      // === 国际主流 ===
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        type: 'online',
        apiBase: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        needApiKey: true,
        icon: '🟢',
        desc: 'OpenAI GPT-4o，综合能力顶级'
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        type: 'online',
        apiBase: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        needApiKey: true,
        icon: '🟢',
        desc: 'OpenAI GPT-4o Mini，高性价比'
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        type: 'online',
        apiBase: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
        needApiKey: true,
        icon: '🟢',
        desc: 'OpenAI 经典模型，速度快成本低'
      },
      {
        id: 'claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        type: 'online',
        apiBase: 'https://api.anthropic.com/v1',
        model: 'claude-3-5-sonnet-20241022',
        needApiKey: true,
        icon: '🟤',
        desc: 'Anthropic Claude，编程与推理强',
        isAnthropic: true
      },
      {
        id: 'claude-3-haiku',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        type: 'online',
        apiBase: 'https://api.anthropic.com/v1',
        model: 'claude-3-haiku-20240307',
        needApiKey: true,
        icon: '🟤',
        desc: 'Anthropic Claude 轻量版',
        isAnthropic: true
      },
      {
        id: 'gemini-pro',
        name: 'Gemini Pro',
        provider: 'google',
        type: 'online',
        apiBase: 'https://generativelanguage.googleapis.com/v1beta',
        model: 'gemini-pro',
        needApiKey: true,
        icon: '🔷',
        desc: 'Google Gemini，多模态能力',
        isGoogle: true
      },
      {
        id: 'llama3-70b',
        name: 'Llama 3 70B',
        provider: 'groq',
        type: 'online',
        apiBase: 'https://api.groq.com/openai/v1',
        model: 'llama3-70b-8192',
        needApiKey: true,
        icon: '🦙',
        desc: 'Meta Llama3 via Groq，极速推理'
      },
      {
        id: 'mistral-large',
        name: 'Mistral Large',
        provider: 'mistral',
        type: 'online',
        apiBase: 'https://api.mistral.ai/v1',
        model: 'mistral-large-latest',
        needApiKey: true,
        icon: '🌪️',
        desc: 'Mistral AI 旗舰模型'
      }
    ];
  }
}

module.exports = ModelManager;
