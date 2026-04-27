// API 客户端 - 统一对话接口
const axios = require('axios');

class ApiClient {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.currentController = null;
  }

  _getApiKey(provider) {
    return this.settingsManager.getApiKey(provider);
  }

  _getChatParams(overrides = {}) {
    const defaults = this.settingsManager.get('chatParams') || {};
    return { ...defaults, ...overrides };
  }

  /**
   * 判断是否为 Ollama 本地模型
   */
  _isOllama(model) {
    return model.provider === 'ollama' || 
           (model.apiBase && model.apiBase.includes('11434')) ||
           (model.type === 'local' && model.provider === 'ollama');
  }

  /**
   * 分类错误信息，给出明确中文提示
   */
  _classifyError(error, model) {
    const msg = error.message || '';
    const status = error.response?.status;
    const errData = error.response?.data;

    // 超时
    if (msg.includes('ETIMEDOUT') || msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
      return `⏱️ 连接超时：无法连接到 ${model.apiBase || '服务器'}，请检查网络或 API 地址是否正确`;
    }
    // DNS 解析失败
    if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      return `🌐 地址错误：无法解析域名 ${model.apiBase || ''}，请检查 API 地址`;
    }
    // 401 密钥无效
    if (status === 401 || status === 403) {
      return `🔑 密钥无效：${model.provider || '该平台'} API Key 不正确或已过期，请在设置中更新`;
    }
    // 404 模型不存在
    if (status === 404) {
      const hint = errData ? (typeof errData === 'string' ? errData : JSON.stringify(errData)).substring(0, 200) : '';
      return `❓ 模型不存在：模型 ID "${model.model || model.name}" 在该平台上不存在${hint ? '\n' + hint : ''}`;
    }
    // 429 限流
    if (status === 429) {
      return `🚫 请求过于频繁：${model.provider || '该平台'} 限流了，请稍后重试`;
    }
    // 500+ 服务端错误
    if (status >= 500) {
      return `🔴 服务器错误：${model.provider || '该平台'} 服务异常 (${status})，请稍后重试`;
    }
    // 400 请求参数错误
    if (status === 400) {
      const detail = errData ? (typeof errData === 'string' ? errData : JSON.stringify(errData)).substring(0, 200) : '';
      return `⚠️ 请求参数错误：${detail || '请检查模型ID和参数'}`;
    }
    // Anthropic 特殊错误
    if (errData?.error?.type === 'authentication_error') {
      return `🔑 密钥无效：Anthropic API Key 不正确或已过期`;
    }
    if (errData?.error?.type === 'not_found_error') {
      return `❓ 模型不存在：模型 ID "${model.model}" 在 Anthropic 平台上不存在`;
    }
    // 默认
    const apiMsg = errData?.error?.message || errData?.message || '';
    return `❌ 请求失败：${apiMsg || msg}`;
  }

  /**
   * 带重试的请求包装
   */
  async _requestWithRetry(fn, maxRetries = 1) {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e;
        // 只对超时/网络错误重试，4xx 错误不重试
        const status = e.response?.status;
        if (status && status >= 400 && status < 500) break;
        const msg = e.message || '';
        if (!msg.includes('ETIMEDOUT') && !msg.includes('timeout') && !msg.includes('ECONNRESET')) break;
        if (i < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (i + 1))); // 递增等待
        }
      }
    }
    throw lastError;
  }

  /**
   * 非流式对话
   */
  async chat(model, messages, params = {}) {
    const chatParams = this._getChatParams(params);

    // Ollama 本地模型走专属路径
    if (this._isOllama(model)) {
      return this._chatOllama(model, messages, chatParams);
    }
    if (model.isAnthropic) {
      return this._chatAnthropic(model, messages, chatParams);
    }
    if (model.isGoogle) {
      return this._chatGoogle(model, messages, chatParams);
    }
    return this._chatOpenAI(model, messages, chatParams);
  }

  /**
   * 流式对话
   */
  chatStream(model, messages, params, onChunk, onDone, onError) {
    const chatParams = this._getChatParams(params);

    // Ollama 本地模型走专属路径
    if (this._isOllama(model)) {
      return this._streamOllama(model, messages, chatParams, onChunk, onDone, onError);
    }
    if (model.isAnthropic) {
      return this._streamAnthropic(model, messages, chatParams, onChunk, onDone, onError);
    }
    if (model.isGoogle) {
      return this._streamGoogle(model, messages, chatParams, onChunk, onDone, onError);
    }
    return this._streamOpenAI(model, messages, chatParams, onChunk, onDone, onError);
  }

  abortCurrentRequest() {
    if (this.currentController) {
      this.currentController.abort();
      this.currentController = null;
    }
  }

  // ===================== Ollama 本地模型 =====================

  async _chatOllama(model, messages, params) {
    try {
      const apiBase = model.apiBase || 'http://127.0.0.1:11434';
      const resp = await axios.post(`${apiBase}/api/chat`, {
        model: model.model || model.name,
        messages,
        stream: false,
        options: {
          temperature: params.temperature,
          num_predict: params.maxTokens
        }
      }, { timeout: 120000 });

      return {
        success: true,
        content: resp.data.message?.content || '',
        usage: {
          prompt_tokens: resp.data.prompt_eval_count || 0,
          completion_tokens: resp.data.eval_count || 0
        },
        model: resp.data.model
      };
    } catch (e) {
      return {
        success: false,
        error: e.response?.data?.error || e.message || 'Ollama 请求失败'
      };
    }
  }

  async _streamOllama(model, messages, params, onChunk, onDone, onError) {
    this.currentController = new AbortController();

    try {
      const apiBase = model.apiBase || 'http://127.0.0.1:11434';
      const resp = await axios.post(`${apiBase}/api/chat`, {
        model: model.model || model.name,
        messages,
        stream: true,
        options: {
          temperature: params.temperature,
          num_predict: params.maxTokens
        }
      }, {
        responseType: 'stream',
        signal: this.currentController.signal,
        timeout: 300000
      });

      let fullContent = '';
      let buffer = '';

      resp.data.on('data', (chunk) => {
        buffer += chunk.toString();
        // Ollama 每行一个 JSON 对象
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留最后一个不完整的行

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.message && parsed.message.content) {
              const delta = parsed.message.content;
              fullContent += delta;
              onChunk({ content: delta, fullContent });
            }
            if (parsed.done) {
              onDone({ content: fullContent });
              return;
            }
          } catch (e) {
            // 解析错误，跳过
          }
        }
      });

      resp.data.on('end', () => {
        // 处理 buffer 中剩余的数据
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer);
            if (parsed.message && parsed.message.content) {
              fullContent += parsed.message.content;
              onChunk({ content: parsed.message.content, fullContent });
            }
          } catch (e) {}
        }
        onDone({ content: fullContent });
      });

      resp.data.on('error', (e) => {
        onError({ error: e.message });
      });
    } catch (e) {
      if (e.name === 'CanceledError' || e.name === 'AbortError') {
        onDone({ content: '', aborted: true });
      } else {
        onError({ error: e.response?.data?.error || e.message || 'Ollama 请求失败' });
      }
    }
  }

  // ===================== OpenAI 兼容格式 =====================

  async _chatOpenAI(model, messages, params) {
    // 自定义模型可能在 model.apiKey 上直接存了 key，或在 apiKeyMap 中
    const apiKey = model.apiKey || this._getApiKey(model.provider);
    if (!apiKey && model.type === 'online') {
      return { success: false, error: `请先设置 ${model.provider} 的 API Key` };
    }

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    try {
      const resp = await this._requestWithRetry(() => axios.post(`${model.apiBase}/chat/completions`, {
        model: model.model || model.name,
        messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        top_p: params.topP,
        frequency_penalty: params.frequencyPenalty,
        presence_penalty: params.presencePenalty,
        stream: false
      }, { headers, timeout: 120000 }));

      const choice = resp.data.choices && resp.data.choices[0];
      return {
        success: true,
        content: choice?.message?.content || '',
        usage: resp.data.usage,
        model: resp.data.model
      };
    } catch (e) {
      return {
        success: false,
        error: this._classifyError(e, model)
      };
    }
  }

  async _streamOpenAI(model, messages, params, onChunk, onDone, onError) {
    // 自定义模型可能在 model.apiKey 上直接存了 key，或在 apiKeyMap 中
    const apiKey = model.apiKey || this._getApiKey(model.provider);
    if (!apiKey && model.type === 'online') {
      onError({ error: `请先设置 ${model.provider} 的 API Key` });
      return;
    }

    this.currentController = new AbortController();
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    try {
      const resp = await axios.post(`${model.apiBase}/chat/completions`, {
        model: model.model || model.name,
        messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        top_p: params.topP,
        frequency_penalty: params.frequencyPenalty,
        presence_penalty: params.presencePenalty,
        stream: true
      }, {
        headers,
        responseType: 'stream',
        signal: this.currentController.signal,
        timeout: 300000
      });

      let fullContent = '';
      let buffer = '';

      resp.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留不完整的行

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6).trim();
            if (data === '[DONE]') {
              onDone({ content: fullContent });
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullContent += delta;
                onChunk({ content: delta, fullContent });
              }
            } catch (e) {
              // 解析错误，跳过
            }
          }
        }
      });

      resp.data.on('end', () => {
        onDone({ content: fullContent });
      });

      resp.data.on('error', (e) => {
        onError({ error: e.message });
      });
    } catch (e) {
      if (e.name === 'CanceledError' || e.name === 'AbortError') {
        onDone({ content: '', aborted: true });
      } else {
        onError({ error: this._classifyError(e, model) });
      }
    }
  }

  // ===================== Anthropic 格式 =====================

  async _chatAnthropic(model, messages, params) {
    const apiKey = model.apiKey || this._getApiKey(model.provider);
    if (!apiKey) {
      return { success: false, error: '请先设置 Anthropic API Key' };
    }

    let systemPrompt = '';
    const chatMessages = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += msg.content + '\n';
      } else {
        chatMessages.push(msg);
      }
    }

    try {
      const resp = await axios.post(`${model.apiBase}/messages`, {
        model: model.model,
        max_tokens: params.maxTokens || 4096,
        system: systemPrompt.trim() || undefined,
        messages: chatMessages,
        temperature: params.temperature,
        stream: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        timeout: 120000
      });

      return {
        success: true,
        content: resp.data.content?.[0]?.text || '',
        usage: resp.data.usage,
        model: resp.data.model
      };
    } catch (e) {
      return {
        success: false,
        error: this._classifyError(e, model)
      };
    }
  }

  async _streamAnthropic(model, messages, params, onChunk, onDone, onError) {
    const apiKey = model.apiKey || this._getApiKey(model.provider);
    if (!apiKey) {
      onError({ error: '请先设置 Anthropic API Key' });
      return;
    }

    this.currentController = new AbortController();
    let systemPrompt = '';
    const chatMessages = [];
    for (const msg of messages) {
      if (msg.role === 'system') systemPrompt += msg.content + '\n';
      else chatMessages.push(msg);
    }

    try {
      const resp = await axios.post(`${model.apiBase}/messages`, {
        model: model.model,
        max_tokens: params.maxTokens || 4096,
        system: systemPrompt.trim() || undefined,
        messages: chatMessages,
        temperature: params.temperature,
        stream: true
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        responseType: 'stream',
        signal: this.currentController.signal,
        timeout: 300000
      });

      let fullContent = '';
      let buffer = '';

      resp.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullContent += parsed.delta.text;
                onChunk({ content: parsed.delta.text, fullContent });
              }
              if (parsed.type === 'message_stop') {
                onDone({ content: fullContent });
                return;
              }
            } catch (e) {}
          }
        }
      });

      resp.data.on('end', () => onDone({ content: fullContent }));
      resp.data.on('error', (e) => onError({ error: e.message }));
    } catch (e) {
      if (e.name === 'AbortError') onDone({ content: '', aborted: true });
      else onError({ error: this._classifyError(e, model) });
    }
  }

  // ===================== Google Gemini 格式 =====================

  async _chatGoogle(model, messages, params) {
    const apiKey = model.apiKey || this._getApiKey(model.provider);
    if (!apiKey) return { success: false, error: '请先设置 Google API Key' };

    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    try {
      const resp = await axios.post(
        `${model.apiBase}/models/${model.model}:generateContent?key=${apiKey}`,
        { contents, generationConfig: { temperature: params.temperature, maxOutputTokens: params.maxTokens } },
        { timeout: 120000 }
      );

      return {
        success: true,
        content: resp.data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        usage: resp.data.usageMetadata,
        model: model.model
      };
    } catch (e) {
      return { success: false, error: this._classifyError(e, model) };
    }
  }

  async _streamGoogle(model, messages, params, onChunk, onDone, onError) {
    const apiKey = model.apiKey || this._getApiKey(model.provider);
    if (!apiKey) { onError({ error: '请先设置 Google API Key' }); return; }

    this.currentController = new AbortController();
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    try {
      const resp = await axios.post(
        `${model.apiBase}/models/${model.model}:streamGenerateContent?alt=sse&key=${apiKey}`,
        { contents, generationConfig: { temperature: params.temperature, maxOutputTokens: params.maxTokens } },
        { responseType: 'stream', signal: this.currentController.signal, timeout: 300000 }
      );

      let fullContent = '';
      let buffer = '';

      resp.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              fullContent += text;
              onChunk({ content: text, fullContent });
            }
          } catch (e) {}
        }
      });

      resp.data.on('end', () => onDone({ content: fullContent }));
      resp.data.on('error', (e) => onError({ error: e.message }));
    } catch (e) {
      if (e.name === 'AbortError') onDone({ content: '', aborted: true });
      else onError({ error: this._classifyError(e, model) });
    }
  }
}

module.exports = ApiClient;
