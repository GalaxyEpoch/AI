// GalaxyEpoch - AI 绘画管理器
// 支持 DALL-E 3 / Stable Diffusion (Stability AI) / 本地 ComfyUI / Ollama 绘图模型

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const JsonStore = require('./json-store');

class PaintingManager {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.store = new JsonStore('painting', {
      history: [],  // { id, prompt, model, url, localPath, createdAt }
      presets: this._getDefaultPresets()
    });
  }

  _getDefaultPresets() {
    return [
      {
        id: 'dalle3',
        name: 'DALL-E 3',
        provider: 'openai',
        type: 'online',
        icon: '🎨',
        desc: 'OpenAI 最新图像生成模型',
        sizes: ['1024x1024', '1024x1792', '1792x1024'],
        quality: ['standard', 'hd'],
        apiBase: 'https://api.openai.com/v1'
      },
      {
        id: 'stable-diffusion-3',
        name: 'Stable Diffusion 3',
        provider: 'stability',
        type: 'online',
        icon: '🖼️',
        desc: 'Stability AI 图像生成',
        sizes: ['1024x1024', '1024x1536', '1536x1024'],
        quality: ['standard'],
        apiBase: 'https://api.stability.ai/v2beta'
      },
      {
        id: 'comfyui',
        name: 'ComfyUI (本地)',
        provider: 'comfyui',
        type: 'local',
        icon: '🖥️',
        desc: '本地 Stable Diffusion 工作流',
        sizes: ['512x512', '768x768', '1024x1024'],
        quality: ['standard'],
        apiBase: 'http://127.0.0.1:8188'
      },
      {
        id: 'flux-local',
        name: 'Flux (Ollama本地)',
        provider: 'ollama',
        type: 'local',
        icon: '🖥️',
        desc: '通过 Ollama 运行的本地绘图模型',
        sizes: ['512x512', '1024x1024'],
        quality: ['standard'],
        apiBase: 'http://127.0.0.1:11434'
      }
    ];
  }

  /**
   * 获取绘画模型列表
   */
  getPresets() {
    return this.store.get('presets', []);
  }

  /**
   * 生成图像
   */
  async generate(presetId, prompt, options = {}) {
    const presets = this.getPresets();
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return { success: false, error: '绘画模型不存在' };

    try {
      let result;
      switch (preset.provider) {
        case 'openai':
          result = await this._generateDalle(preset, prompt, options);
          break;
        case 'stability':
          result = await this._generateStability(preset, prompt, options);
          break;
        case 'comfyui':
          result = await this._generateComfyUI(preset, prompt, options);
          break;
        case 'ollama':
          result = await this._generateOllama(preset, prompt, options);
          break;
        default:
          result = { success: false, error: '不支持的绘画模型' };
      }

      if (result.success) {
        this._addToHistory(prompt, preset, result);
      }
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ========== DALL-E 3 ==========

  async _generateDalle(preset, prompt, options) {
    const apiKey = this.settingsManager.getApiKey('openai');
    if (!apiKey) return { success: false, error: '未配置 OpenAI API Key' };

    const resp = await axios.post(`${preset.apiBase}/images/generations`, {
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: options.size || '1024x1024',
      quality: options.quality || 'standard'
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 120000
    });

    const imageData = resp.data.data[0];
    // 下载图片到本地
    const localPath = await this._downloadImage(imageData.url, `dalle3_${Date.now()}.png`);
    return {
      success: true,
      url: imageData.url,
      localPath,
      revisedPrompt: imageData.revised_prompt
    };
  }

  // ========== Stability AI ==========

  async _generateStability(preset, prompt, options) {
    const apiKey = this.settingsManager.getApiKey('stability');
    if (!apiKey) return { success: false, error: '未配置 Stability AI API Key' };

    const [w, h] = (options.size || '1024x1024').split('x').map(Number);

    const resp = await axios.post(`${preset.apiBase}/stable-image/generate/sd3`, {
      prompt,
      output_format: 'png',
      width: w,
      height: h
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'image/*',
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer',
      timeout: 120000
    });

    const localPath = await this._saveImageBuffer(resp.data, `sd3_${Date.now()}.png`);
    return {
      success: true,
      localPath,
      url: null
    };
  }

  // ========== ComfyUI (本地) ==========

  async _generateComfyUI(preset, prompt, options) {
    const apiBase = options.apiBase || preset.apiBase;

    // 简化的 ComfyUI 工作流
    const workflow = {
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed: Math.floor(Math.random() * 1000000000),
          steps: 20,
          cfg: 7,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0]
        }
      },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: options.checkpoint || 'model.safetensors' } },
      '5': { class_type: 'EmptyLatentImage', inputs: { width: parseInt((options.size || '512x512').split('x')[0]), height: parseInt((options.size || '512x512').split('x')[1]), batch_size: 1 } },
      '6': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
      '7': { class_type: 'CLIPTextEncode', inputs: { text: options.negativePrompt || '', clip: ['4', 1] } },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
      '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'GalaxyEpoch', images: ['8', 0] } }
    };

    const resp = await axios.post(`${apiBase}/prompt`, { prompt: workflow }, { timeout: 30000 });

    if (resp.data.prompt_id) {
      // 轮询等待完成
      const result = await this._pollComfyUI(apiBase, resp.data.prompt_id);
      return result;
    }

    return { success: false, error: 'ComfyUI 提交失败' };
  }

  async _pollComfyUI(apiBase, promptId) {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const hist = await axios.get(`${apiBase}/history/${promptId}`);
        const data = hist.data[promptId];
        if (data && data.status && data.status.completed) {
          const outputs = data.outputs;
          for (const nodeId in outputs) {
            if (outputs[nodeId].images) {
              const img = outputs[nodeId].images[0];
              const imgUrl = `${apiBase}/view?filename=${img.filename}&subfolder=${img.subfolder || ''}`;
              const localPath = await this._downloadImage(imgUrl, `comfyui_${Date.now()}.png`);
              return { success: true, localPath, url: imgUrl };
            }
          }
        }
        if (data && data.status && data.status.status_str === 'error') {
          return { success: false, error: 'ComfyUI 执行出错' };
        }
      } catch (e) { /* continue polling */ }
    }
    return { success: false, error: 'ComfyUI 生成超时' };
  }

  // ========== Ollama 本地绘图 ==========

  async _generateOllama(preset, prompt, options) {
    const apiBase = options.apiBase || preset.apiBase;
    const model = options.model || 'llava';  // Ollama 视觉模型

    const resp = await axios.post(`${apiBase}/api/generate`, {
      model,
      prompt,
      stream: false
    }, { timeout: 120000 });

    if (resp.data && resp.data.response) {
      return {
        success: true,
        text: resp.data.response,
        localPath: null,
        url: null
      };
    }
    return { success: false, error: 'Ollama 绘图模型返回异常' };
  }

  // ========== 辅助方法 ==========

  async _downloadImage(url, filename) {
    try {
      const userDataPath = this._getImagesDir();
      const filePath = path.join(userDataPath, filename);
      const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
      fs.writeFileSync(filePath, resp.data);
      return filePath;
    } catch (e) {
      return null;
    }
  }

  async _saveImageBuffer(buffer, filename) {
    try {
      const userDataPath = this._getImagesDir();
      const filePath = path.join(userDataPath, filename);
      fs.writeFileSync(filePath, buffer);
      return filePath;
    } catch (e) {
      return null;
    }
  }

  _getImagesDir() {
    let userDataPath;
    try { userDataPath = require('electron').app.getPath('userData'); } catch(e) { userDataPath = require('os').tmpdir(); }
    const dir = path.join(userDataPath, 'painting');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  _addToHistory(prompt, preset, result) {
    const history = this.store.get('history', []);
    history.unshift({
      id: `img_${Date.now()}`,
      prompt,
      model: preset.name,
      url: result.url,
      localPath: result.localPath,
      createdAt: new Date().toISOString()
    });
    // 保留最近 500 条
    if (history.length > 500) history.length = 500;
    this.store.set('history', history);
  }

  /**
   * 获取绘画历史
   */
  getHistory(page = 1, pageSize = 20) {
    const history = this.store.get('history', []);
    const start = (page - 1) * pageSize;
    return {
      records: history.slice(start, start + pageSize),
      total: history.length,
      page,
      pageSize
    };
  }

  /**
   * 检查本地绘画服务是否可用
   */
  async checkLocalService(provider) {
    const presets = this.getPresets();
    const preset = presets.find(p => p.id === provider);
    if (!preset || preset.type !== 'local') return { available: false };

    try {
      const resp = await axios.get(preset.apiBase, { timeout: 5000 });
      return { available: true, provider };
    } catch (e) {
      return { available: false, provider, error: e.message };
    }
  }
}

module.exports = PaintingManager;
