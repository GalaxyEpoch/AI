// GalaxyEpoch - 前端应用逻辑（用户版 - 无账单/付费界面）
// 全局状态
const state = {
  conversations: [],
  currentConvId: null,
  models: [],
  localModels: [],
  presets: [],
  selectedModel: null,
  isStreaming: false,
  streamContent: '',
  settings: {},
  pendingBuyProvider: null,
  // 知识库
  knowledgeBases: [],
  activeKBId: null,
  currentKBId: null,
  pendingDocFilePath: '',
  // 绘画
  paintPresets: [],
  paintPanelOpen: false,
  // 插件
  plugins: [],
  // 语言
  supportedLanguages: [],
  currentLanguage: 'zh-CN'
};

// ===================== 初始化 =====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadConversations();
  await loadModels();
  await loadPaintPresets();
  await loadLanguages();
  await loadPlatformPresets();
  setupEventListeners();
  applyTheme(state.settings.theme || 'dark');
});

// ===================== 数据加载 =====================

async function loadSettings() {
  try {
    state.settings = await window.electronAPI.settingsGetAll();
  } catch (e) {
    console.error('加载设置失败:', e);
  }
}

async function loadConversations() {
  try {
    state.conversations = await window.electronAPI.conversationsList();
    renderConversationList();
  } catch (e) {
    console.error('加载对话列表失败:', e);
  }
}

async function loadModels() {
  try {
    state.models = await window.electronAPI.modelsGetAll();
    state.presets = await window.electronAPI.modelsGetPresets();
    renderModelList();
    updateModelSelector();
  } catch (e) {
    console.error('加载模型列表失败:', e);
  }
}

// ===================== 事件绑定 =====================

function setupEventListeners() {
  // 窗口控制
  document.getElementById('btn-minimize').addEventListener('click', () => window.electronAPI.windowMinimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.electronAPI.windowMaximize());
  document.getElementById('btn-close').addEventListener('click', () => window.electronAPI.windowClose());

  // 新建对话
  document.getElementById('btn-new-chat').addEventListener('click', createNewConversation);
  document.getElementById('btn-quick-new').addEventListener('click', createNewConversation);

  // 快捷操作
  document.getElementById('btn-quick-scan').addEventListener('click', () => {
    switchToTab('models');
    scanLocalModels();
  });
  document.getElementById('btn-quick-online').addEventListener('click', () => {
    openSettings();
  });

  // 侧边栏标签切换
  document.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', () => switchToTab(tab.dataset.tab));
  });

  // 搜索对话
  document.getElementById('search-conversations').addEventListener('input', (e) => {
    filterConversations(e.target.value);
  });

  // 模型扫描
  document.getElementById('btn-scan-local').addEventListener('click', scanLocalModels);

  // 添加模型弹窗事件
  document.getElementById('close-add-model').addEventListener('click', closeAddModelModal);
  document.getElementById('cancel-add-model').addEventListener('click', closeAddModelModal);
  document.getElementById('confirm-add-model').addEventListener('click', confirmAddModel);
  document.getElementById('add-model-platform').addEventListener('change', onPlatformSelect);

  // 设置
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('close-settings').addEventListener('click', closeSettings);

  // 设置标签
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('stab-' + tab.dataset.stab).classList.add('active');
    });
  });

  // 本地模型设置保存
  document.getElementById('btn-save-local').addEventListener('click', saveLocalSettings);

  // 扫描 Ollama（设置面板中）
  document.getElementById('btn-scan-ollama').addEventListener('click', async () => {
    const resultEl = document.getElementById('ollama-scan-result');
    if (resultEl) resultEl.textContent = '🔍 扫描中...';
    const models = await window.electronAPI.ollamaScan();
    state.localModels = models;
    updateModelSelector();
    if (resultEl) {
      resultEl.textContent = models.length > 0
        ? `✅ 发现 ${models.length} 个本地模型`
        : '⚠️ 未发现本地模型，请确保 Ollama 已启动';
      setTimeout(() => { resultEl.textContent = ''; }, 4000);
    }
  });

  // 对话默认保存
  document.getElementById('btn-save-chat-defaults').addEventListener('click', saveChatDefaults);

  // 隐私设置保存
  document.getElementById('btn-save-privacy').addEventListener('click', savePrivacySettings);

  // Token 收益面板事件
  document.getElementById('btn-token-add-topup')?.addEventListener('click', addTopupRecord);
  document.getElementById('btn-token-earnings-more')?.addEventListener('click', () => loadTokenEarnings(tokenEarningsPage + 1));
  document.getElementById('token-earnings-filter-type')?.addEventListener('change', () => loadTokenEarnings(1));
  document.getElementById('token-earnings-filter-status')?.addEventListener('change', () => loadTokenEarnings(1));
  document.getElementById('my-payment-method')?.addEventListener('change', (e) => switchMyPaymentSection(e.target.value));
  document.getElementById('btn-save-my-payment')?.addEventListener('click', saveMyPayment);
  document.getElementById('my-alipay-qr-file')?.addEventListener('change', function() { handleQRUpload(this, 'my-alipay-qr-preview'); });
  document.getElementById('my-wechat-qr-file')?.addEventListener('change', function() { handleQRUpload(this, 'my-wechat-qr-preview'); });

  // 主题切换
  document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);

  // 对话输入
  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  chatInput.addEventListener('input', autoResizeInput);

  document.getElementById('btn-send').addEventListener('click', sendMessage);
  document.getElementById('btn-stop').addEventListener('click', () => window.electronAPI.chatAbort());

  // 模型选择器
  document.getElementById('model-selector').addEventListener('change', (e) => {
    const modelId = e.target.value;
    state.selectedModel = findModel(modelId);
  });

  // 清空对话
  document.getElementById('btn-clear-chat').addEventListener('click', clearCurrentChat);

  // 参数控制
  document.getElementById('opt-temperature').addEventListener('input', (e) => {
    document.getElementById('val-temperature').textContent = e.target.value;
  });
  document.getElementById('setting-temperature').addEventListener('input', (e) => {
    document.getElementById('setting-temperature-val').textContent = e.target.value;
  });

  // 流式响应监听
  window.electronAPI.onStreamChunk((data) => handleStreamChunk(data));
  window.electronAPI.onStreamDone((data) => handleStreamDone(data));
  window.electronAPI.onStreamError((data) => handleStreamError(data));

  // 侧边栏切换（移动端）
  document.getElementById('btn-sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // 购买Token弹窗
  document.getElementById('close-buy-token').addEventListener('click', closeBuyTokenModal);
  document.getElementById('cancel-buy-token').addEventListener('click', closeBuyTokenModal);
  document.getElementById('confirm-buy-token').addEventListener('click', confirmBuyToken);

  // === 绘画面板 ===
  document.getElementById('btn-toggle-paint').addEventListener('click', togglePaintPanel);
  document.getElementById('btn-close-paint').addEventListener('click', () => togglePaintPanel(false));
  document.getElementById('btn-paint-generate').addEventListener('click', generatePainting);

  // === 设置 - 知识库 ===
  document.getElementById('btn-create-kb').addEventListener('click', openCreateKBModal);
  document.getElementById('close-create-kb').addEventListener('click', closeCreateKBModal);
  document.getElementById('cancel-create-kb').addEventListener('click', closeCreateKBModal);
  document.getElementById('confirm-create-kb').addEventListener('click', confirmCreateKB);
  document.getElementById('btn-settings-kb-deactivate').addEventListener('click', deactivateKnowledgeBase);
  // 知识库详情
  document.getElementById('close-kb-detail').addEventListener('click', closeKBDetailModal);
  document.getElementById('btn-kb-activate').addEventListener('click', activateCurrentKB);
  document.getElementById('btn-kb-delete').addEventListener('click', deleteCurrentKB);
  document.getElementById('btn-add-doc-text').addEventListener('click', openAddDocTextModal);
  document.getElementById('btn-add-doc-file').addEventListener('click', openAddDocFileModal);
  // 添加文档（文本）
  document.getElementById('close-add-doc-text').addEventListener('click', closeAddDocTextModal);
  document.getElementById('cancel-add-doc-text').addEventListener('click', closeAddDocTextModal);
  document.getElementById('confirm-add-doc-text').addEventListener('click', confirmAddDocText);
  document.getElementById('doc-chunk-size').addEventListener('input', (e) => {
    document.getElementById('doc-chunk-size-val').textContent = e.target.value;
  });
  // 添加文档（文件）
  document.getElementById('close-add-doc-file').addEventListener('click', closeAddDocFileModal);
  document.getElementById('cancel-add-doc-file').addEventListener('click', closeAddDocFileModal);
  document.getElementById('btn-browse-file').addEventListener('click', browseDocFile);
  document.getElementById('confirm-add-doc-file').addEventListener('click', confirmAddDocFile);
  document.getElementById('doc-file-chunk-size').addEventListener('input', (e) => {
    document.getElementById('doc-file-chunk-size-val').textContent = e.target.value;
  });

  // === 设置 - 插件 ===
  document.getElementById('btn-install-plugin').addEventListener('click', openInstallPluginModal);
  document.getElementById('close-install-plugin').addEventListener('click', closeInstallPluginModal);
  document.getElementById('cancel-install-plugin').addEventListener('click', closeInstallPluginModal);
  document.getElementById('btn-browse-plugin').addEventListener('click', browsePluginDir);
  document.getElementById('confirm-install-plugin').addEventListener('click', confirmInstallPlugin);
  // 联网搜索插件
  document.getElementById('btn-search-plugins').addEventListener('click', openSearchPluginsModal);
  document.getElementById('close-search-plugins').addEventListener('click', closeSearchPluginsModal);
  document.getElementById('btn-do-plugin-search').addEventListener('click', doPluginSearch);
  document.getElementById('plugin-search-query').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doPluginSearch();
  });
}

// ===================== 对话管理 =====================

async function createNewConversation() {
  try {
    // 根据当前语言选择默认标题
    const defaultTitle = state.currentLanguage === 'en-US' ? 'New Chat'
      : state.currentLanguage === 'ja-JP' ? '新規チャット'
      : '新对话';
    const conv = await window.electronAPI.conversationsCreate(defaultTitle);
    state.conversations.unshift(conv);
    state.currentConvId = conv.id;
    renderConversationList();
    showChatArea(conv);
  } catch (e) {
    console.error('创建对话失败:', e);
  }
}

async function selectConversation(convId) {
  state.currentConvId = convId;
  const conv = state.conversations.find(c => c.id === convId);
  if (conv) {
    showChatArea(conv);
    renderConversationList();
    const messages = await window.electronAPI.conversationsGetMessages(convId);
    renderMessages(messages);
  }
}

async function deleteConversation(convId, e) {
  if (e) e.stopPropagation();
  try {
    await window.electronAPI.conversationsDelete(convId);
    state.conversations = state.conversations.filter(c => c.id !== convId);
    if (state.currentConvId === convId) {
      state.currentConvId = null;
      showEmptyState();
    }
    renderConversationList();
  } catch (e) {
    console.error('删除对话失败:', e);
  }
}

function renderConversationList() {
  const list = document.getElementById('conversation-list');
  if (state.conversations.length === 0) {
    list.innerHTML = '<div class="model-empty">暂无对话，点击上方按钮开始</div>';
    return;
  }
  list.innerHTML = state.conversations.map(conv => `
    <div class="conv-item ${conv.id === state.currentConvId ? 'active' : ''}" 
         onclick="selectConversation('${conv.id}')">
      <span class="conv-item-icon">💬</span>
      <div class="conv-item-info">
        <div class="conv-item-title">${escapeHtml(conv.title)}</div>
        <div class="conv-item-meta">${conv.messageCount || 0} 条消息</div>
      </div>
      <div class="conv-item-actions">
        <button onclick="deleteConversation('${conv.id}', event)" title="删除">🗑️</button>
      </div>
    </div>
  `).join('');
}

function filterConversations(query) {
  const items = document.querySelectorAll('.conv-item');
  items.forEach(item => {
    const title = item.querySelector('.conv-item-title').textContent.toLowerCase();
    item.style.display = title.includes(query.toLowerCase()) ? '' : 'none';
  });
}

// ===================== 模型管理 =====================

async function scanLocalModels() {
  const localList = document.getElementById('local-model-list');
  localList.innerHTML = '<div class="model-empty" style="animation: pulse 1.5s infinite;">正在扫描本地模型...</div>';
  
  try {
    const models = await window.electronAPI.ollamaScan();
    state.localModels = models;
    if (models.length === 0) {
      localList.innerHTML = '<div class="model-empty">未发现本地模型<br><small>请确保 Ollama 已启动并安装了模型</small></div>';
    } else {
      localList.innerHTML = models.map(m => `
        <div class="model-item" onclick="selectModel('${m.id}')">
          <span class="model-item-icon">🖥️</span>
          <div class="model-item-info">
            <div class="model-item-name">${escapeHtml(m.name)}</div>
            <div class="model-item-desc">${m.provider} · ${formatSize(m.size)}</div>
          </div>
          <span class="model-item-badge local">本地</span>
        </div>
      `).join('');
    }
    updateModelSelector();
  } catch (e) {
    localList.innerHTML = '<div class="model-empty">扫描失败: ' + escapeHtml(e.message) + '</div>';
  }
}

function renderModelList() {
  const onlineList = document.getElementById('online-model-list');
  const providers = {};
  
  // 在线预设模型
  state.presets.forEach(p => {
    if (!providers[p.provider]) providers[p.provider] = [];
    providers[p.provider].push(p);
  });

  // 自定义模型也按 provider 归入对应平台（去重：同平台同model字段只保留一个）
  const customModels = state.models || [];
  customModels.forEach(m => {
    const pid = m.provider || 'custom';
    if (!providers[pid]) providers[pid] = [];
    // 去重：如果该平台已有相同 model 字段的模型，跳过
    const existingModel = providers[pid].find(p => p.model === (m.model || m.id));
    if (!existingModel) {
      providers[pid].push(m);
    }
  });

  let onlineHtml = '';
  for (const [provider, models] of Object.entries(providers)) {
    const preset = platformPresets.find(p => p.id === provider);
    const displayName = preset ? `${preset.icon} ${preset.name}` : provider.toUpperCase();
    onlineHtml += `<div style="font-size:11px;color:var(--text-muted);padding:8px 12px 4px;font-weight:600;">${displayName}</div>`;
    models.forEach(m => {
      const isCustom = m.id.startsWith('custom_');
      const hasKey = getApiKeyStatus(m.provider);
      if (isCustom) {
        onlineHtml += `
          <div class="model-item" onclick="selectModel('${m.id}')">
            <span class="model-item-icon">${m.icon || '🔧'}</span>
            <div class="model-item-info">
              <div class="model-item-name">${escapeHtml(m.name)}</div>
              <div class="model-item-desc">${escapeHtml(m.model || '')} · ${escapeHtml(m.apiBase || '').replace(/^https?:\/\//, '').split('/')[0]}</div>
            </div>
            <span class="model-item-badge custom">自定义</span>
          </div>
        `;
      } else {
        onlineHtml += `
          <div class="model-item" onclick="selectModel('${m.id}')">
            <span class="model-item-icon">${m.icon}</span>
            <div class="model-item-info">
              <div class="model-item-name">${escapeHtml(m.name)}</div>
              <div class="model-item-desc">${escapeHtml(m.desc)}</div>
            </div>
            ${hasKey
              ? '<span class="model-item-badge">✓</span>'
              : '<button class="btn-buy-token" onclick="event.stopPropagation();openBuyTokenModal(\'' + m.provider + '\')" title="前往官方获取密钥">🔑 获取密钥</button>'
            }
          </div>
        `;
      }
    });
  }
  onlineList.innerHTML = onlineHtml || '<div class="model-empty">暂无在线模型</div>';
}

async function deleteCustomModel(modelId) {
  if (!confirm('确定删除此模型？')) return;
  try {
    const result = await window.electronAPI.modelsRemove(modelId);
    if (result.success) {
      await loadModels();
      renderModelList();
      loadApiKeys(); // 刷新 API 密钥面板中的模型列表
    } else {
      alert('删除失败: ' + (result.error || '未知错误'));
    }
  } catch (e) {
    console.error('删除模型失败:', e);
  }
}

function selectModel(modelId) {
  state.selectedModel = findModel(modelId);
  const selector = document.getElementById('model-selector');
  if (selector) selector.value = modelId;
  if (state.currentConvId) {
    switchToTab('chats');
  } else {
    createNewConversation();
  }
}

function findModel(modelId) {
  let model = state.presets.find(m => m.id === modelId);
  if (model) return model;
  model = state.localModels.find(m => m.id === modelId);
  if (model) return model;
  model = state.models.find(m => m.id === modelId);
  return model;
}

function getApiKeyStatus(provider) {
  const keys = state.settings.apiKeyMap || {};
  return !!keys[provider];
}

function updateModelSelector() {
  const selector = document.getElementById('model-selector');
  if (!selector) return;
  
  let html = '<option value="">选择模型...</option>';
  
  if (state.localModels.length > 0) {
    html += '<optgroup label="🖥️ 本地模型">';
    state.localModels.forEach(m => {
      html += `<option value="${m.id}">${m.name} (本地)</option>`;
    });
    html += '</optgroup>';
  }
  
  // 按平台分组，预设模型 + 自定义模型归入同一平台（去重：同平台同model字段只保留一个）
  const providers = {};
  state.presets.forEach(p => {
    if (!providers[p.provider]) providers[p.provider] = [];
    providers[p.provider].push(p);
  });
  const customModels = state.models || [];
  customModels.forEach(m => {
    const pid = m.provider || 'custom';
    if (!providers[pid]) providers[pid] = [];
    // 去重：如果该平台已有相同 model 字段的预设模型，跳过
    const existingModel = providers[pid].find(p => p.model === (m.model || m.id));
    if (!existingModel) {
      providers[pid].push(m);
    }
  });
  
  for (const [provider, models] of Object.entries(providers)) {
    const preset = platformPresets.find(p => p.id === provider);
    const label = preset ? `${preset.icon} ${preset.name}` : `🔧 ${provider}`;
    html += `<optgroup label="${label}">`;
    models.forEach(m => {
      const suffix = m.id.startsWith('custom_') ? ' (自定义)' : '';
      html += `<option value="${m.id}">${escapeHtml(m.name)}${suffix}</option>`;
    });
    html += '</optgroup>';
  }
  
  selector.innerHTML = html;
  if (state.selectedModel) selector.value = state.selectedModel.id;
}

// ===================== 购买Token（跳转官方） =====================

function openBuyTokenModal(provider) {
  state.pendingBuyProvider = provider;
  const providerNames = {
    deepseek: 'DeepSeek', qwen: '通义千问', zhipu: '智谱AI',
    moonshot: 'Kimi (月之暗面)', yi: '零一万物', doubao: '豆包 (字节跳动)',
    baidu: '百度智能云', hunyuan: '腾讯混元', openai: 'OpenAI',
    anthropic: 'Anthropic', google: 'Google AI', groq: 'Groq', mistral: 'Mistral AI'
  };
  document.getElementById('buy-token-provider-name').textContent = providerNames[provider] || provider;
  document.getElementById('modal-buy-token').style.display = 'flex';
}

function closeBuyTokenModal() {
  document.getElementById('modal-buy-token').style.display = 'none';
  state.pendingBuyProvider = null;
}

async function confirmBuyToken() {
  if (!state.pendingBuyProvider) return;
  const provider = state.pendingBuyProvider;
  closeBuyTokenModal();
  try {
    await window.electronAPI.promoOpenLink(provider);
  } catch (e) {
    console.error('跳转失败:', e);
  }
}

// ===================== 对话逻辑 =====================

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || state.isStreaming) return;

  if (!state.selectedModel) {
    alert('请先选择一个模型');
    return;
  }

  if (!state.currentConvId) {
    await createNewConversation();
  }

  const userMsg = { role: 'user', content: text };
  await window.electronAPI.conversationsSaveMessage(state.currentConvId, userMsg);
  appendMessage('user', text);
  
  input.value = '';
  autoResizeInput.call(input);

  const messages = await window.electronAPI.conversationsGetMessages(state.currentConvId);
  const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

  const params = {
    temperature: parseFloat(document.getElementById('opt-temperature').value),
    maxTokens: parseInt(document.getElementById('opt-max-tokens').value)
  };

  state.isStreaming = true;
  state.streamContent = '';
  showStreamingUI(true);
  appendMessage('assistant', '', true, state.selectedModel?.name || '');

  window.electronAPI.chatStream(state.selectedModel, apiMessages, params);
}

function handleStreamChunk(data) {
  state.streamContent = data.fullContent || '';
  updateStreamingMessage(state.streamContent);
}

function handleStreamDone(data) {
  state.isStreaming = false;
  showStreamingUI(false);

  const content = data.content || state.streamContent;
  if (content && !data.aborted) {
    const modelName = state.selectedModel?.name || '';
    const aiMsg = { role: 'assistant', content, model: modelName };
    window.electronAPI.conversationsSaveMessage(state.currentConvId, aiMsg);
    finalizeStreamingMessage(content);

    // 自动生成对话标题（仅首次回复时）
    autoGenerateTitle(content);
  } else if (data.aborted) {
    removeStreamingMessage();
  }
}

// 自动生成对话标题
async function autoGenerateTitle(aiContent) {
  if (!state.currentConvId) return;
  const conv = state.conversations.find(c => c.id === state.currentConvId);
  if (!conv) return;

  // 只有标题还是"新对话"时才自动生成
  const defaultTitles = ['新对话', 'New Chat', '新規チャット'];
  if (!defaultTitles.includes(conv.title)) return;

  // 从 AI 回复的前 50 字提取标题
  let title = aiContent.replace(/\n/g, ' ').trim();
  if (title.length > 50) {
    title = title.substring(0, 50) + '...';
  }
  // 去掉 markdown 符号
  title = title.replace(/[#*`_~]/g, '').trim();
  if (!title) return;

  try {
    await window.electronAPI.conversationsRename(state.currentConvId, title);
    conv.title = title;
    renderConversationList();
    document.getElementById('chat-title').textContent = title;
  } catch (e) {
    console.error('自动标题生成失败:', e);
  }
}

function handleStreamError(data) {
  state.isStreaming = false;
  showStreamingUI(false);
  updateStreamingMessage('❌ ' + (data.error || '请求失败'), true);
}

// ===================== 消息渲染 =====================

function renderMessages(messages) {
  const container = document.getElementById('chat-messages');
  container.innerHTML = '';
  messages.forEach(msg => {
    appendMessage(msg.role, msg.content, false, msg.model || '');
  });
  scrollToBottom();
}

function appendMessage(role, content, isStreaming = false, modelName = '') {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `message ${role}`;
  if (isStreaming) div.id = 'streaming-message';

  const avatar = role === 'user' ? '👤' : '🤖';
  const modelLabel = (role === 'assistant' && modelName) ? `<div class="message-model">${escapeHtml(modelName)}</div>` : '';
  div.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-body">
      ${modelLabel}
      <div class="message-content">${isStreaming ? '<span class="thinking-dots">思考中...</span>' : renderMarkdown(content)}</div>
    </div>
  `;
  container.appendChild(div);
  scrollToBottom();
}

function updateStreamingMessage(content, isError = false) {
  const msg = document.getElementById('streaming-message');
  if (!msg) return;
  const contentEl = msg.querySelector('.message-content');
  if (isError) {
    contentEl.innerHTML = content;
  } else {
    contentEl.innerHTML = renderMarkdown(content) + '<span class="thinking-dots"> ▌</span>';
  }
  scrollToBottom();
}

function finalizeStreamingMessage(content) {
  const msg = document.getElementById('streaming-message');
  if (!msg) return;
  msg.removeAttribute('id');
  const contentEl = msg.querySelector('.message-content');
  contentEl.innerHTML = renderMarkdown(content);
  scrollToBottom();
}

function removeStreamingMessage() {
  const msg = document.getElementById('streaming-message');
  if (msg) msg.remove();
}

function renderMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="$1">$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/\n/g, '<br>');
  return html;
}

// ===================== UI 控制 =====================

function showChatArea(conv) {
  document.getElementById('chat-empty').style.display = 'none';
  document.getElementById('chat-area').style.display = 'flex';
  document.getElementById('chat-title').textContent = conv.title;
  if (conv.model) {
    state.selectedModel = findModel(conv.model);
    if (state.selectedModel) {
      document.getElementById('model-selector').value = state.selectedModel.id;
    }
  }
}

function showEmptyState() {
  document.getElementById('chat-empty').style.display = 'flex';
  document.getElementById('chat-area').style.display = 'none';
}

function showStreamingUI(streaming) {
  document.getElementById('btn-send').style.display = streaming ? 'none' : 'flex';
  document.getElementById('btn-stop').style.display = streaming ? 'flex' : 'none';
}

function switchToTab(tabName) {
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.sidebar-tab[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById('panel-' + tabName).classList.add('active');
}

function autoResizeInput() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 200) + 'px';
}

function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) container.scrollTop = container.scrollHeight;
}

async function clearCurrentChat() {
  if (!state.currentConvId) return;
  if (!confirm('确定清空当前对话？')) return;
  await window.electronAPI.conversationsClearMessages(state.currentConvId);
  document.getElementById('chat-messages').innerHTML = '';
}

// ===================== 绘画面板（对话区右侧） =====================

function togglePaintPanel(forceState) {
  const panel = document.getElementById('paint-panel');
  const show = forceState !== undefined ? forceState : !state.paintPanelOpen;
  state.paintPanelOpen = show;
  panel.style.display = show ? 'flex' : 'none';
}

async function loadPaintPresets() {
  try {
    state.paintPresets = await window.electronAPI.paintGetPresets();
    renderPaintModelSelector();
    loadPaintHistory();
  } catch (e) {
    console.error('加载绘画预设失败:', e);
  }
}

function renderPaintModelSelector() {
  const sel = document.getElementById('paint-model-select');
  if (!sel) return;
  sel.innerHTML = state.paintPresets.map(p => 
    `<option value="${p.id}">${p.icon} ${p.name} (${p.type === 'local' ? '本地' : '在线'})</option>`
  ).join('');
  
  if (state.paintPresets.length > 0) {
    updatePaintSizes(state.paintPresets[0].sizes);
    sel.addEventListener('change', () => {
      const preset = state.paintPresets.find(p => p.id === sel.value);
      if (preset) updatePaintSizes(preset.sizes);
    });
  }
}

function updatePaintSizes(sizes) {
  const sel = document.getElementById('paint-size-select');
  if (!sel || !sizes) return;
  sel.innerHTML = sizes.map(s => `<option value="${s}">${s.replace('x', ' × ')}</option>`).join('');
}

async function generatePainting() {
  const modelId = document.getElementById('paint-model-select').value;
  const prompt = document.getElementById('paint-prompt').value.trim();
  const size = document.getElementById('paint-size-select').value;
  
  if (!prompt) { alert('请输入图片描述'); return; }
  
  const btn = document.getElementById('btn-paint-generate');
  btn.textContent = '⏳ 生成中...';
  btn.disabled = true;
  
  try {
    const result = await window.electronAPI.paintGenerate(modelId, prompt, { size });
    if (result.success && result.url) {
      document.getElementById('paint-result-img').src = result.url;
      document.getElementById('paint-result').style.display = 'block';
    } else if (result.success && result.localPath) {
      document.getElementById('paint-result-img').src = 'file://' + result.localPath;
      document.getElementById('paint-result').style.display = 'block';
    } else {
      alert('生成失败: ' + (result.error || '未知错误'));
    }
  } catch (e) {
    console.error('绘画生成失败:', e);
    alert('生成失败: ' + e.message);
  } finally {
    btn.textContent = '🎨 生成图片';
    btn.disabled = false;
    loadPaintHistory();
  }
}

async function loadPaintHistory() {
  try {
    const result = await window.electronAPI.paintGetHistory(1, 20);
    const list = document.getElementById('paint-history');
    if (!list) return;
    const history = result.history || result || [];
    if (history.length === 0) {
      list.innerHTML = '<div class="model-empty">暂无绘画记录</div>';
      return;
    }
    list.innerHTML = history.map(h => `
      <div class="paint-history-item">
        <div class="paint-history-thumb">🖼️</div>
        <div class="paint-history-info">
          <div class="paint-history-prompt">${escapeHtml(h.prompt || '').substring(0, 40)}</div>
          <div class="paint-history-meta">${h.model || ''} · ${formatDate(h.createdAt)}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('加载绘画历史失败:', e);
  }
}

// ===================== 设置 =====================

function openSettings() {
  document.getElementById('modal-settings').style.display = 'flex';
  loadApiKeys();
  loadVersion();
  loadKnowledgeBases();
  loadPlugins();
  loadLanguages();
  loadTokenPanel();
  loadSettingsPanelValues();
}

function closeSettings() {
  document.getElementById('modal-settings').style.display = 'none';
}

async function openAdminPanel() {
  try {
    await window.electronAPI.adminOpenPanel();
    closeSettings();
  } catch (e) {
    console.error('打开管理员后台失败:', e);
  }
}

function openSponsorQR(type) {
  const names = { wechat: '微信赞赏', alipay: '支付宝赞赏' };
  alert(`📱 ${names[type] || '赞赏'}\n\n请将收款二维码图片放置到项目 assets/${type}-qrcode.png\n功能启用后，此处将展示二维码供用户扫码打赏。`);
}

function loadApiKeys() {
  const keys = state.settings.apiKeyMap || {};
  const providers = [...new Set(state.presets.map(p => p.provider))];
  const customModels = state.models || [];

  // 按 provider 分组自定义模型
  const modelsByProvider = {};
  customModels.forEach(m => {
    const pid = m.provider || 'custom';
    if (!modelsByProvider[pid]) modelsByProvider[pid] = [];
    modelsByProvider[pid].push(m);
  });

  document.getElementById('apikey-list').innerHTML = providers.map(p => {
    const hasKey = !!keys[p];
    const preset = platformPresets.find(pp => pp.id === p);
    const displayName = preset ? `${preset.icon} ${preset.name}` : p.toUpperCase();
    const pModels = modelsByProvider[p] || [];

    // 预设模型 ID 列表
    const presetModelIds = state.presets.filter(pr => pr.provider === p).map(pr => pr.model || pr.id);

    // 自定义模型行
    const modelRows = pModels.map(m => `
      <div class="apikey-model-row">
        <span class="model-id-tag">${escapeHtml(m.model || m.name)}</span>
        <span class="model-meta">${escapeHtml(m.apiBase || '').replace(/^https?:\/\//, '').split('/')[0]}</span>
        <button class="btn-icon-sm" onclick="openAddModelModal('${m.id}')" title="编辑">✏️</button>
        <button class="btn-icon-sm" onclick="deleteCustomModel('${m.id}')" title="删除">🗑️</button>
      </div>
    `).join('');

    return `
      <div class="apikey-provider-block">
        <div class="apikey-item">
          <span class="provider-name">${displayName}</span>
          <div class="apikey-input-wrap">
            <input type="password"
                   id="apikey-${p}"
                   value="${keys[p] || ''}"
                   placeholder="输入 ${p} API Key"
                   onchange="saveApiKey('${p}', this.value)" />
            <button class="btn-toggle-key-visibility" onclick="toggleKeyVisibility('apikey-${p}', this)" title="显示/隐藏">👁</button>
          </div>
          <span class="apikey-status ${hasKey ? 'set' : 'unset'}">${hasKey ? '已设置' : '未设置'}</span>
          ${!hasKey ? '<button class="btn-buy-token-inline" onclick="openBuyTokenModal(\'' + p + '\');closeSettings();">获取密钥</button>' : ''}
        </div>
        <div class="apikey-models">
          <div class="apikey-models-header">
            <span>已添加模型</span>
            <button class="btn-icon-sm" onclick="openAddModelModal(null, '${p}')" title="添加模型">✚ 添加模型</button>
          </div>
          ${presetModelIds.length > 0 ? '<div class="apikey-preset-models">预设: ' + presetModelIds.map(id => '<span class="model-id-tag preset">' + escapeHtml(id) + '</span>').join(' ') + '</div>' : ''}
          ${modelRows || '<div class="apikey-model-empty">暂无自定义模型</div>'}
        </div>
      </div>
    `;
  }).join('');
}

function toggleKeyVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

async function saveApiKey(provider, key) {
  await window.electronAPI.settingsSet(`apiKeyMap.${provider}`, key);
  state.settings.apiKeyMap = state.settings.apiKeyMap || {};
  state.settings.apiKeyMap[provider] = key;
  loadApiKeys();
  renderModelList();
}

async function loadVersion() {
  try {
    const ver = await window.electronAPI.appGetVersion();
    document.getElementById('app-version').textContent = ver;
  } catch (e) {}
}

// ===================== 主题 =====================

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  window.electronAPI.settingsSet('theme', next);
  state.settings.theme = next;
  document.getElementById('btn-theme-toggle').textContent = next === 'dark' ? '🌙' : '☀️';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('btn-theme-toggle').textContent = theme === 'dark' ? '🌙' : '☀️';
}

// ===================== 添加模型 =====================

let editingModelId = null; // 编辑模式时的模型 ID
let platformPresets = [];  // 平台预设列表缓存

async function loadPlatformPresets() {
  try {
    platformPresets = await window.electronAPI.modelsGetPlatformPresets();
  } catch (e) {
    console.error('加载平台预设失败:', e);
    platformPresets = [];
  }
}

function openAddModelModal(editId, preselectPlatform) {
  editingModelId = editId || null;
  const titleEl = document.getElementById('add-model-modal-title');
  const confirmBtn = document.getElementById('confirm-add-model');

  // 填充平台选择下拉（先填充，再设值）
  const platformSel = document.getElementById('add-model-platform');
  platformSel.innerHTML = '<option value="">-- 选择平台自动填入地址 --</option>' +
    platformPresets.map(p => `<option value="${p.id}">${p.icon} ${p.name}</option>`).join('');

  if (editingModelId) {
    titleEl.textContent = '✏️ 编辑模型';
    confirmBtn.textContent = '保存';
    // 填充已有模型数据
    const model = findModel(editingModelId);
    if (model) {
      document.getElementById('add-model-name').value = model.name || '';
      document.getElementById('add-model-api-base').value = model.apiBase || '';
      document.getElementById('add-model-model-id').value = model.model || '';
      document.getElementById('add-model-api-key').value = model.apiKey || '';
      document.getElementById('add-model-type').value =
        model.isAnthropic ? 'anthropic' : (model.isGoogle ? 'google' : 'openai');
      // 匹配平台
      const matchedPreset = platformPresets.find(p => model.apiBase && p.apiBase === model.apiBase);
      if (matchedPreset) {
        platformSel.value = matchedPreset.id;
      } else if (model.provider && model.provider !== 'custom') {
        platformSel.value = model.provider;
      }
      updateModelIdHint(platformPresets.find(p => p.id === platformSel.value));
      updateKeyStatus(platformSel.value);
    }
  } else {
    titleEl.textContent = '✚ 添加模型';
    confirmBtn.textContent = '添加';
    document.getElementById('add-model-name').value = '';
    document.getElementById('add-model-model-id').value = '';
    document.getElementById('add-model-id-hint').textContent = '';
    document.getElementById('add-model-key-status').textContent = '';

    // 预选平台（从 API 密钥面板点击时传入）
    if (preselectPlatform) {
      platformSel.value = preselectPlatform;
      onPlatformSelect();
      // 加载记住的设置
      loadRememberedSettings(preselectPlatform);
    } else {
      platformSel.value = '';
      document.getElementById('add-model-api-base').value = '';
      document.getElementById('add-model-api-key').value = '';
      document.getElementById('add-model-type').value = 'openai';
    }
  }

  document.getElementById('modal-add-model').style.display = 'flex';
}

function closeAddModelModal() {
  document.getElementById('modal-add-model').style.display = 'none';
  editingModelId = null;
}

// 记住/读取上次添加模型时的设置（按平台存储）
function getRememberedSettings(platformId) {
  try {
    const data = localStorage.getItem('galaxyepoch_remembered_settings');
    return data ? JSON.parse(data)[platformId] : null;
  } catch { return null; }
}

function saveRememberedSettings(platformId, settings) {
  try {
    const data = JSON.parse(localStorage.getItem('galaxyepoch_remembered_settings') || '{}');
    data[platformId] = settings;
    localStorage.setItem('galaxyepoch_remembered_settings', JSON.stringify(data));
  } catch {}
}

function loadRememberedSettings(platformId) {
  const remembered = getRememberedSettings(platformId);
  if (remembered) {
    if (remembered.apiBase) document.getElementById('add-model-api-base').value = remembered.apiBase;
    if (remembered.apiType) document.getElementById('add-model-type').value = remembered.apiType;
    if (remembered.apiKey) document.getElementById('add-model-api-key').value = remembered.apiKey;
  }
}

// 选择平台后自动填入 API 地址、类型、模型 ID 提示、已有 Key
function onPlatformSelect() {
  const platformId = document.getElementById('add-model-platform').value;
  if (!platformId) {
    document.getElementById('add-model-id-hint').textContent = '';
    document.getElementById('add-model-key-status').textContent = '';
    return;
  }
  const preset = platformPresets.find(p => p.id === platformId);
  if (!preset) return;

  // 自动填入 API 地址
  document.getElementById('add-model-api-base').value = preset.apiBase;
  // 自动设置 API 类型
  document.getElementById('add-model-type').value = preset.apiType;
  // 显示模型 ID 示例
  updateModelIdHint(preset);
  // 显示 Key 状态
  updateKeyStatus(platformId);

  // 如果名称为空，自动用平台名填充
  const nameEl = document.getElementById('add-model-name');
  if (!nameEl.value.trim()) {
    nameEl.value = preset.name;
  }
}

function updateModelIdHint(preset) {
  const hintEl = document.getElementById('add-model-id-hint');
  if (preset.modelExamples && preset.modelExamples.length > 0) {
    hintEl.textContent = '（示例: ' + preset.modelExamples.slice(0, 3).join(', ') + '）';
  } else {
    hintEl.textContent = '';
  }
}

function updateKeyStatus(platformId) {
  const statusEl = document.getElementById('add-model-key-status');
  const apiKey = getApiKeyStatus(platformId) ? '✅ 已在设置中配置' : '⚠️ 未配置，请输入或前往设置';
  statusEl.textContent = apiKey;
}

// 模型 ID 校验：检查是否明显用了错误平台的 ID
function validateModelId(modelId, platformId) {
  if (!platformId) return null; // 自定义平台不校验

  const wrongPlatformIds = {
    deepseek: ['gpt-', 'claude-', 'gemini-'],
    qwen: ['gpt-', 'claude-', 'gemini-', 'deepseek-'],
    zhipu: ['gpt-', 'claude-', 'gemini-', 'deepseek-', 'qwen-'],
    moonshot: ['gpt-', 'claude-', 'gemini-', 'deepseek-'],
    yi: ['gpt-', 'claude-', 'gemini-', 'deepseek-'],
    doubao: ['gpt-', 'claude-', 'gemini-', 'deepseek-'],
    baidu: ['gpt-', 'claude-', 'gemini-', 'deepseek-'],
    hunyuan: ['gpt-', 'claude-', 'gemini-', 'deepseek-'],
    openai: ['deepseek-', 'qwen-', 'glm-', 'moonshot-'],
    anthropic: ['gpt-', 'gemini-', 'deepseek-'],
    google: ['gpt-', 'claude-', 'deepseek-'],
    groq: ['gpt-', 'claude-', 'gemini-', 'deepseek-'],
    mistral: ['gpt-', 'claude-', 'gemini-', 'deepseek-']
  };

  const wrongIds = wrongPlatformIds[platformId] || [];
  for (const prefix of wrongIds) {
    if (modelId.startsWith(prefix)) {
      const platformName = platformPresets.find(p => p.id === platformId)?.name || platformId;
      return `⚠️ 模型 ID "${modelId}" 不属于 ${platformName}，请确认是否正确`;
    }
  }
  return null;
}

async function confirmAddModel() {
  const platformId = document.getElementById('add-model-platform').value;
  const name = document.getElementById('add-model-name').value.trim();
  const type = document.getElementById('add-model-type').value;
  const apiBase = document.getElementById('add-model-api-base').value.trim();
  const modelId = document.getElementById('add-model-model-id').value.trim();
  const apiKey = document.getElementById('add-model-api-key').value.trim();

  if (!name || !apiBase || !modelId) {
    alert('请填写必填项（名称、API地址、模型ID）');
    return;
  }

  // 模型 ID 校验
  const validationError = validateModelId(modelId, platformId);
  if (validationError) {
    if (!confirm(validationError + '\n\n是否继续？')) return;
  }

  // 优先使用设置中已有的 Key（如果选了平台且设置中有 Key，无需手动输入）
  let effectiveApiKey = apiKey;
  if (!effectiveApiKey && platformId) {
    const keys = state.settings.apiKeyMap || {};
    effectiveApiKey = keys[platformId] || '';
  }

  const model = {
    id: editingModelId || `custom_${Date.now()}`,
    name,
    provider: platformId || 'custom',
    type: 'online',
    apiBase,
    model: modelId,
    apiKey: effectiveApiKey,
    needApiKey: !!effectiveApiKey,
    icon: platformPresets.find(p => p.id === platformId)?.icon || '🔧',
    desc: platformId ? `${platformPresets.find(p => p.id === platformId)?.name || '自定义'} - ${modelId}` : '自定义模型',
    isAnthropic: type === 'anthropic',
    isGoogle: type === 'google'
  };

  let result;
  if (editingModelId) {
    result = await window.electronAPI.modelsUpdate(editingModelId, model);
  } else {
    result = await window.electronAPI.modelsAdd(model);
  }

  if (result.success) {
    // 同步 API Key 到 apiKeyMap（如果弹窗中输入了新 Key）
    if (effectiveApiKey && platformId) {
      await window.electronAPI.settingsSet(`apiKeyMap.${platformId}`, effectiveApiKey);
      state.settings.apiKeyMap = state.settings.apiKeyMap || {};
      state.settings.apiKeyMap[platformId] = effectiveApiKey;
    }
    // 记住本次设置（如果勾选了复选框）
    const remember = document.getElementById('add-model-remember')?.checked;
    if (remember && platformId) {
      saveRememberedSettings(platformId, { apiBase, apiType: type, apiKey: effectiveApiKey });
    }
    await loadModels();
    closeAddModelModal();
    renderModelList();
    updateModelSelector();
    loadApiKeys(); // 刷新 API 密钥面板中的模型列表和Key状态
  } else {
    alert(result.error || '操作失败');
  }
}

// ===================== 知识库管理（设置面板中） =====================

async function loadKnowledgeBases() {
  try {
    state.knowledgeBases = await window.electronAPI.kbList();
    const activeKB = await window.electronAPI.kbGetActive();
    state.activeKBId = activeKB || null;
    renderSettingsKBList();
    updateSettingsKBActive();
    updateRAGBadge();
  } catch (e) {
    console.error('加载知识库列表失败:', e);
  }
}

function renderSettingsKBList() {
  const list = document.getElementById('settings-kb-list');
  if (!list) return;
  if (state.knowledgeBases.length === 0) {
    list.innerHTML = '<div class="model-empty">暂无知识库，点击上方按钮创建</div>';
    return;
  }
  list.innerHTML = state.knowledgeBases.map(kb => `
    <div class="kb-item" onclick="openKBDetail('${kb.id}')">
      <span class="kb-item-icon">📚</span>
      <div class="kb-item-info">
        <div class="kb-item-name">${escapeHtml(kb.name)}</div>
        <div class="kb-item-meta">${kb.docCount} 个文档 · ${kb.totalChunks} 个分块</div>
      </div>
      ${kb.id === state.activeKBId ? '<span class="model-item-badge local">RAG</span>' : ''}
    </div>
  `).join('');
}

function updateSettingsKBActive() {
  const nameEl = document.getElementById('settings-kb-active-name');
  const deactivateBtn = document.getElementById('btn-settings-kb-deactivate');
  if (state.activeKBId) {
    const kb = state.knowledgeBases.find(k => k.id === state.activeKBId);
    nameEl.textContent = kb ? kb.name : '未知';
    deactivateBtn.style.display = '';
  } else {
    nameEl.textContent = '无';
    deactivateBtn.style.display = 'none';
  }
}

function updateRAGBadge() {
  const badge = document.getElementById('rag-badge');
  if (state.activeKBId) {
    const kb = state.knowledgeBases.find(k => k.id === state.activeKBId);
    badge.textContent = '📚 RAG: ' + (kb ? kb.name : '');
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// 新建知识库模态框
function openCreateKBModal() {
  document.getElementById('kb-create-name').value = '';
  document.getElementById('kb-create-desc').value = '';
  document.getElementById('modal-create-kb').style.display = 'flex';
  setTimeout(() => document.getElementById('kb-create-name').focus(), 100);
}

function closeCreateKBModal() {
  document.getElementById('modal-create-kb').style.display = 'none';
}

async function confirmCreateKB() {
  const name = document.getElementById('kb-create-name').value.trim();
  const desc = document.getElementById('kb-create-desc').value.trim();
  if (!name) { alert('请输入知识库名称'); return; }
  
  try {
    const result = await window.electronAPI.kbCreate(name, desc);
    if (result.success) {
      closeCreateKBModal();
      await loadKnowledgeBases();
      openKBDetail(result.library.id);
    } else {
      alert('创建失败: ' + (result.error || '未知错误'));
    }
  } catch (e) {
    console.error('创建知识库失败:', e);
    alert('创建失败: ' + e.message);
  }
}

async function openKBDetail(kbId) {
  state.currentKBId = kbId;
  try {
    const kb = await window.electronAPI.kbGet(kbId);
    if (!kb) { alert('知识库不存在'); return; }
    
    document.getElementById('kb-detail-title').textContent = '📚 ' + kb.name;
    document.getElementById('kb-detail-desc').textContent = kb.description || '无描述';
    document.getElementById('kb-detail-doc-count').textContent = kb.docs.length;
    const totalChunks = kb.docs.reduce((sum, d) => sum + (d.chunks ? d.chunks.length : 0), 0);
    document.getElementById('kb-detail-chunk-count').textContent = totalChunks;
    document.getElementById('kb-detail-created').textContent = formatDate(kb.createdAt);
    
    const docList = document.getElementById('kb-doc-list');
    if (kb.docs.length === 0) {
      docList.innerHTML = '<div class="model-empty">暂无文档，点击上方按钮添加</div>';
    } else {
      docList.innerHTML = kb.docs.map(doc => `
        <div class="kb-doc-item">
          <span class="kb-doc-icon">📄</span>
          <div class="kb-doc-info">
            <div class="kb-doc-name">${escapeHtml(doc.name)}</div>
            <div class="kb-doc-meta">${doc.chunks ? doc.chunks.length : 0} 个分块 · ${formatDate(doc.addedAt)}</div>
          </div>
          <div class="kb-doc-actions-inline">
            <button onclick="removeKBDoc('${kbId}', '${doc.id}')" title="删除文档">🗑️</button>
          </div>
        </div>
      `).join('');
    }
    
    const activateBtn = document.getElementById('btn-kb-activate');
    if (kbId === state.activeKBId) {
      activateBtn.textContent = '✅ RAG 已激活';
      activateBtn.classList.add('active');
    } else {
      activateBtn.textContent = '🚀 激活 RAG';
      activateBtn.classList.remove('active');
    }
    
    document.getElementById('modal-kb-detail').style.display = 'flex';
  } catch (e) {
    console.error('获取知识库详情失败:', e);
  }
}

function closeKBDetailModal() {
  document.getElementById('modal-kb-detail').style.display = 'none';
  state.currentKBId = null;
}

async function activateCurrentKB() {
  if (!state.currentKBId) return;
  try {
    if (state.currentKBId === state.activeKBId) {
      await window.electronAPI.kbSetActive(null);
      state.activeKBId = null;
    } else {
      await window.electronAPI.kbSetActive(state.currentKBId);
      state.activeKBId = state.currentKBId;
    }
    
    const activateBtn = document.getElementById('btn-kb-activate');
    if (state.currentKBId === state.activeKBId) {
      activateBtn.textContent = '✅ RAG 已激活';
      activateBtn.classList.add('active');
    } else {
      activateBtn.textContent = '🚀 激活 RAG';
      activateBtn.classList.remove('active');
    }
    
    renderSettingsKBList();
    updateSettingsKBActive();
    updateRAGBadge();
  } catch (e) {
    console.error('激活知识库失败:', e);
  }
}

async function deactivateKnowledgeBase() {
  try {
    await window.electronAPI.kbSetActive(null);
    state.activeKBId = null;
    renderSettingsKBList();
    updateSettingsKBActive();
    updateRAGBadge();
  } catch (e) {
    console.error('取消激活失败:', e);
  }
}

async function deleteCurrentKB() {
  if (!state.currentKBId) return;
  if (!confirm('确定删除此知识库？所有文档将被永久删除！')) return;
  try {
    await window.electronAPI.kbDelete(state.currentKBId);
    if (state.currentKBId === state.activeKBId) {
      state.activeKBId = null;
      updateRAGBadge();
    }
    closeKBDetailModal();
    await loadKnowledgeBases();
  } catch (e) {
    console.error('删除知识库失败:', e);
  }
}

async function removeKBDoc(kbId, docId) {
  if (!confirm('确定删除此文档？')) return;
  try {
    await window.electronAPI.kbRemoveDoc(kbId, docId);
    openKBDetail(kbId);
    await loadKnowledgeBases();
  } catch (e) {
    console.error('删除文档失败:', e);
  }
}

// 添加文本文档
function openAddDocTextModal() {
  document.getElementById('modal-add-doc-text').style.display = 'flex';
  document.getElementById('doc-text-name').value = '';
  document.getElementById('doc-text-content').value = '';
}

function closeAddDocTextModal() {
  document.getElementById('modal-add-doc-text').style.display = 'none';
}

async function confirmAddDocText() {
  const name = document.getElementById('doc-text-name').value.trim();
  const content = document.getElementById('doc-text-content').value.trim();
  const chunkSize = parseInt(document.getElementById('doc-chunk-size').value);
  
  if (!name) { alert('请输入文档名称'); return; }
  if (!content) { alert('请输入文档内容'); return; }
  if (!state.currentKBId) return;
  
  try {
    const result = await window.electronAPI.kbAddDoc(state.currentKBId, name, content, { chunkSize });
    if (result.success) {
      closeAddDocTextModal();
      openKBDetail(state.currentKBId);
      await loadKnowledgeBases();
    } else {
      alert('添加失败: ' + (result.error || '未知错误'));
    }
  } catch (e) {
    console.error('添加文档失败:', e);
    alert('添加失败: ' + e.message);
  }
}

// 添加文件文档
function openAddDocFileModal() {
  document.getElementById('modal-add-doc-file').style.display = 'flex';
  document.getElementById('doc-file-path').value = '';
  state.pendingDocFilePath = '';
}

function closeAddDocFileModal() {
  document.getElementById('modal-add-doc-file').style.display = 'none';
}

async function browseDocFile() {
  try {
    const filePath = await window.electronAPI.kbBrowseFile();
    if (filePath) {
      document.getElementById('doc-file-path').value = filePath;
      state.pendingDocFilePath = filePath;
    }
  } catch (e) {
    console.error('浏览文件失败:', e);
  }
}

async function confirmAddDocFile() {
  const filePath = state.pendingDocFilePath || document.getElementById('doc-file-path').value.trim();
  const chunkSize = parseInt(document.getElementById('doc-file-chunk-size').value);
  
  if (!filePath) { alert('请选择或输入文件路径'); return; }
  if (!state.currentKBId) return;
  
  try {
    const result = await window.electronAPI.kbAddDocFile(state.currentKBId, filePath, { chunkSize });
    if (result.success) {
      closeAddDocFileModal();
      openKBDetail(state.currentKBId);
      await loadKnowledgeBases();
    } else {
      alert('导入失败: ' + (result.error || '未知错误'));
    }
  } catch (e) {
    console.error('导入文件失败:', e);
    alert('导入失败: ' + e.message);
  }
}

// ===================== 插件管理（设置面板中） =====================

async function loadPlugins() {
  try {
    state.plugins = await window.electronAPI.pluginList();
    renderSettingsPluginList();
  } catch (e) {
    console.error('加载插件列表失败:', e);
  }
}

function renderSettingsPluginList() {
  const list = document.getElementById('settings-plugin-list');
  if (!list) return;
  if (state.plugins.length === 0) {
    list.innerHTML = '<div class="model-empty">暂无已安装插件</div>';
    return;
  }
  list.innerHTML = state.plugins.map(p => `
    <div class="plugin-item">
      <span class="plugin-item-icon">${p.icon || '🧩'}</span>
      <div class="plugin-item-info">
        <div class="plugin-item-name">${escapeHtml(p.name)}</div>
        <div class="plugin-item-meta">${p.version} · ${p.loaded ? '✅ 已加载' : '⏸ 未加载'}</div>
      </div>
      <div class="plugin-item-toggle">
        <input type="checkbox" ${p.enabled ? 'checked' : ''} 
               onchange="togglePlugin('${p.id}', this.checked)" />
      </div>
      <div class="plugin-item-actions">
        <button onclick="uninstallPlugin('${p.id}')">卸载</button>
      </div>
    </div>
  `).join('');
}

async function togglePlugin(pluginId, enabled) {
  try {
    await window.electronAPI.pluginSetEnabled(pluginId, enabled);
    await loadPlugins();
  } catch (e) {
    console.error('切换插件状态失败:', e);
  }
}

async function uninstallPlugin(pluginId) {
  if (!confirm('确定卸载此插件？')) return;
  try {
    await window.electronAPI.pluginUninstall(pluginId);
    await loadPlugins();
  } catch (e) {
    console.error('卸载插件失败:', e);
  }
}

// 本地安装
function openInstallPluginModal() {
  document.getElementById('plugin-install-path').value = '';
  document.getElementById('modal-install-plugin').style.display = 'flex';
}

function closeInstallPluginModal() {
  document.getElementById('modal-install-plugin').style.display = 'none';
}

async function browsePluginDir() {
  try {
    const dirPath = await window.electronAPI.pluginBrowseDir();
    if (dirPath) {
      document.getElementById('plugin-install-path').value = dirPath;
    }
  } catch (e) {
    console.error('浏览插件目录失败:', e);
  }
}

async function confirmInstallPlugin() {
  const pluginPath = document.getElementById('plugin-install-path').value.trim();
  if (!pluginPath) { alert('请选择插件目录'); return; }
  try {
    const result = await window.electronAPI.pluginInstall(pluginPath);
    if (result.success) {
      closeInstallPluginModal();
      await loadPlugins();
    } else {
      alert('安装失败: ' + (result.error || '未知错误'));
    }
  } catch (e) {
    console.error('安装插件失败:', e);
    alert('安装失败: ' + e.message);
  }
}

// 联网搜索插件
function openSearchPluginsModal() {
  document.getElementById('plugin-search-query').value = '';
  document.getElementById('plugin-search-results').innerHTML = '<div class="model-empty">输入关键词搜索在线技能</div>';
  document.getElementById('modal-search-plugins').style.display = 'flex';
  setTimeout(() => document.getElementById('plugin-search-query').focus(), 100);
}

function closeSearchPluginsModal() {
  document.getElementById('modal-search-plugins').style.display = 'none';
}

async function doPluginSearch() {
  const query = document.getElementById('plugin-search-query').value.trim();
  if (!query) return;
  
  const resultsEl = document.getElementById('plugin-search-results');
  resultsEl.innerHTML = '<div class="model-empty">搜索中...</div>';
  
  try {
    const results = await window.electronAPI.pluginSearchOnline(query);
    if (!results || results.length === 0) {
      resultsEl.innerHTML = '<div class="model-empty">未找到相关技能</div>';
      return;
    }
    resultsEl.innerHTML = results.map(p => {
      const installed = state.plugins.some(ip => ip.name === p.name || ip.id === p.id);
      return `
        <div class="plugin-search-item">
          <span class="plugin-search-item-icon">${p.icon || '🧩'}</span>
          <div class="plugin-search-item-info">
            <div class="plugin-search-item-name">${escapeHtml(p.name)}</div>
            <div class="plugin-search-item-desc">${escapeHtml(p.description || '')}</div>
            <div class="plugin-search-item-meta">${p.author || ''} · ⭐ ${p.stars || 0} · ${p.version || ''}</div>
          </div>
          <div class="plugin-search-item-actions">
            <button onclick="installOnlinePlugin('${p.id}', '${p.downloadUrl || ''}')"
                    class="${installed ? 'installed' : ''}"
                    ${installed ? 'disabled' : ''}>
              ${installed ? '✅ 已安装' : '📥 安装'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('搜索插件失败:', e);
    resultsEl.innerHTML = '<div class="model-empty">搜索失败: ' + escapeHtml(e.message) + '</div>';
  }
}

async function installOnlinePlugin(pluginId, downloadUrl) {
  try {
    const result = await window.electronAPI.pluginInstallOnline(pluginId, downloadUrl || '');
    if (result.success) {
      await loadPlugins();
      // 刷新搜索结果
      doPluginSearch();
    } else {
      alert('安装失败: ' + (result.error || '未知错误'));
    }
  } catch (e) {
    console.error('在线安装插件失败:', e);
    alert('安装失败: ' + e.message);
  }
}

// ===================== 语言管理（设置面板中） =====================

async function loadLanguages() {
  try {
    state.supportedLanguages = await window.electronAPI.i18nGetSupported();
    state.currentLanguage = await window.electronAPI.i18nGetLanguage();
    renderSettingsLanguageList();
  } catch (e) {
    console.error('加载语言列表失败:', e);
  }
}

const LANG_FLAGS = {
  'zh-CN': '🇨🇳', 'zh-TW': '🇹🇼', 'en-US': '🇺🇸', 'ja-JP': '🇯🇵',
  'ko-KR': '🇰🇷', 'fr-FR': '🇫🇷', 'de-DE': '🇩🇪', 'es-ES': '🇪🇸', 'ru-RU': '🇷🇺'
};

function renderSettingsLanguageList() {
  const list = document.getElementById('settings-lang-list');
  const nameEl = document.getElementById('settings-lang-current-name');
  if (!list) return;
  
  const current = state.supportedLanguages.find(l => l.code === state.currentLanguage);
  if (nameEl && current) nameEl.textContent = current.nativeName;
  
  list.innerHTML = state.supportedLanguages.map(lang => `
    <div class="lang-item ${lang.code === state.currentLanguage ? 'active' : ''}" 
         onclick="switchLanguage('${lang.code}')">
      <span class="lang-item-flag">${LANG_FLAGS[lang.code] || '🌐'}</span>
      <div class="lang-item-info">
        <div class="lang-item-name">${escapeHtml(lang.name)}</div>
        <div class="lang-item-native">${escapeHtml(lang.nativeName)}</div>
      </div>
      ${lang.code === state.currentLanguage ? '<span class="lang-item-check">✓</span>' : ''}
    </div>
  `).join('');
}

async function switchLanguage(code) {
  if (code === state.currentLanguage) return;
  try {
    const result = await window.electronAPI.i18nSetLanguage(code);
    if (result && result.success === false) {
      alert('切换语言失败: ' + (result.error || '未知错误'));
      return;
    }
    state.currentLanguage = code;
    renderSettingsLanguageList();
    // 显示重启提示
    const hint = document.getElementById('lang-restart-hint');
    if (hint) hint.style.display = '';
    // 尝试立即应用翻译到当前可见的 UI 元素
    applyLanguageToUI(code);
  } catch (e) {
    console.error('切换语言失败:', e);
  }
}

// 立即将语言应用到界面上可以立即生效的部分
async function applyLanguageToUI(code) {
  try {
    const result = await window.electronAPI.i18nGetTranslations();
    if (!result || !result.translations) return;
    const t = result.translations;
    // 应用到侧边栏标签
    const tabChats = document.querySelector('.sidebar-tab[data-tab="chats"]');
    const tabModels = document.querySelector('.sidebar-tab[data-tab="models"]');
    if (tabChats && t['sidebar.chats']) tabChats.textContent = t['sidebar.chats'];
    if (tabModels && t['sidebar.models']) tabModels.textContent = t['sidebar.models'];
    // 新建对话按钮
    const btnNewChat = document.getElementById('btn-new-chat');
    if (btnNewChat && t['sidebar.newChat']) btnNewChat.innerHTML = `<span class="icon">✚</span> ${t['sidebar.newChat']}`;
    // 输入框 placeholder
    const chatInput = document.getElementById('chat-input');
    if (chatInput && t['chat.placeholder']) chatInput.placeholder = t['chat.placeholder'];
    // 模型选择器默认选项
    const modelSelector = document.getElementById('model-selector');
    if (modelSelector && modelSelector.options[0] && t['chat.selectModel']) {
      modelSelector.options[0].textContent = t['chat.selectModel'];
    }
    // 空状态文字
    const emptyTitle = document.querySelector('.chat-empty h2');
    if (emptyTitle && t['app.tagline']) emptyTitle.nextElementSibling && (emptyTitle.nextElementSibling.textContent = t['app.tagline']);
    // 搜索框 placeholder
    const searchInput = document.getElementById('search-conversations');
    if (searchInput && t['sidebar.search']) searchInput.placeholder = t['sidebar.search'];
  } catch (e) {
    console.error('应用语言到 UI 失败:', e);
  }
}

// ===================== 设置面板值加载与保存 =====================

function loadSettingsPanelValues() {
  const s = state.settings;
  // 本地模型设置
  if (s.ollamaHost !== undefined) {
    const el = document.getElementById('setting-ollama-host');
    if (el) el.value = s.ollamaHost;
  }
  if (s.ollamaPort !== undefined) {
    const el = document.getElementById('setting-ollama-port');
    if (el) el.value = s.ollamaPort;
  }
  const autoScan = document.getElementById('setting-auto-scan');
  if (autoScan) autoScan.checked = s.autoScan !== false;
  // 对话默认
  const cp = s.chatParams || {};
  const tempEl = document.getElementById('setting-temperature');
  const tempVal = document.getElementById('setting-temperature-val');
  if (tempEl) { tempEl.value = cp.temperature ?? 0.7; }
  if (tempVal) { tempVal.textContent = cp.temperature ?? 0.7; }
  const maxTokensEl = document.getElementById('setting-max-tokens');
  if (maxTokensEl) maxTokensEl.value = cp.maxTokens ?? 4096;
  const topPEl = document.getElementById('setting-top-p');
  if (topPEl) topPEl.value = cp.topP ?? 1;
  // 隐私设置
  const saveHistory = document.getElementById('setting-save-history');
  if (saveHistory) saveHistory.checked = s.privacy?.saveHistory !== false;
  const sendUsage = document.getElementById('setting-send-usage');
  if (sendUsage) sendUsage.checked = !!s.privacy?.sendUsageData;
}

async function saveLocalSettings() {
  const host = document.getElementById('setting-ollama-host').value.trim();
  const port = parseInt(document.getElementById('setting-ollama-port').value) || 11434;
  const autoScan = document.getElementById('setting-auto-scan').checked;
  try {
    await window.electronAPI.settingsSet('ollamaHost', host);
    await window.electronAPI.settingsSet('ollamaPort', port);
    await window.electronAPI.settingsSet('autoScan', autoScan);
    state.settings.ollamaHost = host;
    state.settings.ollamaPort = port;
    state.settings.autoScan = autoScan;
    showSaveSuccess('btn-save-local', '✅ 已保存');
  } catch (e) {
    alert('保存失败: ' + e.message);
  }
}

async function saveChatDefaults() {
  const temperature = parseFloat(document.getElementById('setting-temperature').value);
  const maxTokens = parseInt(document.getElementById('setting-max-tokens').value);
  const topP = parseFloat(document.getElementById('setting-top-p').value);
  try {
    await window.electronAPI.settingsSet('chatParams', { temperature, maxTokens, topP });
    state.settings.chatParams = { ...state.settings.chatParams, temperature, maxTokens, topP };
    // 同步更新对话区参数滑块
    const optTemp = document.getElementById('opt-temperature');
    const valTemp = document.getElementById('val-temperature');
    const optMaxTokens = document.getElementById('opt-max-tokens');
    if (optTemp) { optTemp.value = temperature; }
    if (valTemp) { valTemp.textContent = temperature; }
    if (optMaxTokens) { optMaxTokens.value = maxTokens; }
    const statusEl = document.getElementById('chat-defaults-save-status');
    if (statusEl) { statusEl.textContent = '✅ 已保存'; setTimeout(() => { statusEl.textContent = ''; }, 2000); }
    showSaveSuccess('btn-save-chat-defaults', '✅ 已保存');
  } catch (e) {
    alert('保存失败: ' + e.message);
  }
}

async function savePrivacySettings() {
  const saveHistory = document.getElementById('setting-save-history').checked;
  const sendUsage = document.getElementById('setting-send-usage').checked;
  try {
    await window.electronAPI.settingsSet('privacy', { saveHistory, sendUsageData: sendUsage });
    state.settings.privacy = { saveHistory, sendUsageData: sendUsage };
    const statusEl = document.getElementById('privacy-save-status');
    if (statusEl) { statusEl.textContent = '✅ 已保存'; setTimeout(() => { statusEl.textContent = ''; }, 2000); }
    showSaveSuccess('btn-save-privacy', '✅ 已保存');
  } catch (e) {
    alert('保存失败: ' + e.message);
  }
}

function showSaveSuccess(btnId, text) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = text;
  btn.disabled = true;
  setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
}

// ===================== Token 推广收益管理 =====================

let tokenEarningsPage = 1;
let tokenTopupPage = 1;

async function loadTokenPanel() {
  try {
    const overview = await window.electronAPI.tokenGetOverview();
    renderTokenOverview(overview);
    await loadTokenBalances();
    await loadTokenEarnings();
    await loadTokenTopupRecords();
    await loadMyPayment();
  } catch (e) {
    console.error('加载 Token 面板失败:', e);
  }
}

function renderTokenOverview(overview) {
  const stats = overview.stats || {};
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('token-total-earnings', '¥' + (stats.totalPromoEarnings || 0).toFixed(2));
  el('token-pending-settlement', '¥' + (stats.pendingSettlement || 0).toFixed(2));
  el('token-settled-amount', '¥' + (stats.settledAmount || 0).toFixed(2));
  el('token-total-balance', '¥' + (overview.totalBalanceCNY || '0.00'));
}

async function loadTokenBalances() {
  try {
    const balances = await window.electronAPI.tokenGetBalances();
    const container = document.getElementById('token-balance-table');
    if (!container) return;

    const entries = Object.entries(balances);
    if (entries.length === 0) {
      container.innerHTML = '<div class="model-empty">暂无余额数据</div>';
      return;
    }

    container.innerHTML = entries.map(([provider, info]) => {
      const balance = info.balance || 0;
      const currency = info.currency || 'CNY';
      const lastUpdate = info.lastUpdate ? formatDate(info.lastUpdate) : '未更新';
      const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '¥';
      return `
        <div class="token-balance-item">
          <div>
            <div class="token-balance-provider">${provider}</div>
            <div class="token-balance-meta">${lastUpdate}</div>
          </div>
          <div class="token-balance-amount" onclick="editTokenBalance('${provider}', ${balance}, '${currency}')" title="点击编辑">
            ${symbol}${balance.toFixed(2)}
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('加载 Token 余额失败:', e);
  }
}

async function editTokenBalance(provider, currentBalance, currency) {
  // 使用内联编辑
  const newBalanceStr = prompt(`更新 ${provider} 余额 (当前: ${currentBalance}):`, currentBalance);
  if (newBalanceStr === null) return;
  const newBalance = parseFloat(newBalanceStr);
  if (isNaN(newBalance)) { alert('请输入有效数字'); return; }
  try {
    await window.electronAPI.tokenUpdateBalance(provider, newBalance, currency);
    await loadTokenBalances();
    const overview = await window.electronAPI.tokenGetOverview();
    renderTokenOverview(overview);
  } catch (e) {
    console.error('更新余额失败:', e);
  }
}

async function loadTokenEarnings(page) {
  if (page !== undefined) tokenEarningsPage = page;
  try {
    const typeFilter = document.getElementById('token-earnings-filter-type')?.value || '';
    const statusFilter = document.getElementById('token-earnings-filter-status')?.value || '';
    const filters = {};
    if (typeFilter) filters.type = typeFilter;
    if (statusFilter) filters.status = statusFilter;

    const data = await window.electronAPI.tokenGetEarnings(tokenEarningsPage, 20, filters);
    const container = document.getElementById('token-earnings-list');
    if (!container) return;

    if (!data.records || data.records.length === 0) {
      container.innerHTML = '<div class="model-empty">暂无推广收益记录</div>';
      const moreBtn = document.getElementById('btn-token-earnings-more');
      if (moreBtn) moreBtn.style.display = 'none';
      return;
    }

    const typeIcons = { promo: '👥', topup: '💰', usage: '📊' };
    const typeNames = { promo: '推广注册', topup: '充值返利', usage: '用量分成' };

    container.innerHTML = data.records.map(r => `
      <div class="token-record-item">
        <span class="token-record-type">${typeIcons[r.type] || '💰'}</span>
        <div class="token-record-info">
          <div class="token-record-provider">${r.provider || '—'} · ${typeNames[r.type] || r.type}</div>
          <div class="token-record-note">${escapeHtml(r.note || '')}</div>
        </div>
        <span class="token-record-amount">+¥${(r.amount || 0).toFixed(2)}</span>
        <span class="token-record-status ${r.status}">${r.status === 'settled' ? '已结算' : '待结算'}</span>
        <span class="token-record-time">${formatDate(r.timestamp)}</span>
      </div>
    `).join('');

    const moreBtn = document.getElementById('btn-token-earnings-more');
    if (moreBtn) {
      moreBtn.style.display = data.total > tokenEarningsPage * 20 ? '' : 'none';
    }
  } catch (e) {
    console.error('加载收益记录失败:', e);
  }
}

async function loadTokenTopupRecords(page) {
  if (page !== undefined) tokenTopupPage = page;
  try {
    const data = await window.electronAPI.tokenGetTopupRecords(tokenTopupPage, 20);
    const container = document.getElementById('token-topup-list');
    if (!container) return;

    if (!data.records || data.records.length === 0) {
      container.innerHTML = '<div class="model-empty">暂无充值记录</div>';
      return;
    }

    container.innerHTML = data.records.map(r => `
      <div class="token-record-item">
        <span class="token-record-type">💳</span>
        <div class="token-record-info">
          <div class="token-record-provider">${r.provider || '—'} ${r.method ? '· ' + r.method : ''}</div>
          <div class="token-record-note">${escapeHtml(r.note || '')}</div>
        </div>
        <span class="token-record-amount">¥${(r.amount || 0).toFixed(2)}</span>
        <span class="token-record-time">${formatDate(r.timestamp)}</span>
      </div>
    `).join('');
  } catch (e) {
    console.error('加载充值记录失败:', e);
  }
}

async function addTopupRecord() {
  const provider = prompt('平台名称 (如 deepseek):');
  if (!provider) return;
  const amountStr = prompt('充值金额 (CNY):');
  if (!amountStr) return;
  const amount = parseFloat(amountStr);
  if (isNaN(amount)) { alert('请输入有效金额'); return; }
  const method = prompt('充值方式 (alipay/wechat/bank/promo):', 'alipay') || '';

  try {
    await window.electronAPI.tokenAddTopup({ provider, amount, currency: 'CNY', method });
    await loadTokenTopupRecords();
    const overview = await window.electronAPI.tokenGetOverview();
    renderTokenOverview(overview);
  } catch (e) {
    console.error('添加充值记录失败:', e);
  }
}

async function loadMyPayment() {
  try {
    const config = await window.electronAPI.tokenGetMyPayment();
    const methodEl = document.getElementById('my-payment-method');
    if (methodEl) methodEl.value = config.method || 'alipay';

    const fields = {
      'my-alipay-account': config.alipayAccount || '',
      'my-wechat-account': config.wechatAccount || '',
      'my-bank-name': config.bankName || '',
      'my-bank-branch': config.bankBranch || '',
      'my-bank-account': config.bankAccount || '',
      'my-bank-holder': config.bankHolder || '',
      'my-usdt-address': config.usdtAddress || '',
      'my-custom-note': config.customNote || ''
    };
    for (const [id, val] of Object.entries(fields)) {
      const el = document.getElementById(id);
      if (el) el.value = val;
    }

    const networkEl = document.getElementById('my-usdt-network');
    if (networkEl) networkEl.value = config.usdtNetwork || 'TRC20';

    // 显示收款码预览
    if (config.alipayQR) {
      const preview = document.getElementById('my-alipay-qr-preview');
      if (preview) preview.innerHTML = `<img src="${config.alipayQR}" />`;
    }
    if (config.wechatQR) {
      const preview = document.getElementById('my-wechat-qr-preview');
      if (preview) preview.innerHTML = `<img src="${config.wechatQR}" />`;
    }

    // 显示/隐藏对应区块
    switchMyPaymentSection(config.method || 'alipay');
  } catch (e) {
    console.error('加载收款配置失败:', e);
  }
}

function switchMyPaymentSection(method) {
  const sections = ['alipay', 'wechat', 'bank', 'usdt', 'custom'];
  sections.forEach(s => {
    const el = document.getElementById('my-payment-' + s);
    if (el) el.style.display = s === method ? '' : 'none';
  });
}

async function saveMyPayment() {
  const method = document.getElementById('my-payment-method')?.value || 'alipay';

  // 收集收款码图片
  let alipayQR = '';
  let wechatQR = '';

  // 从已有的预览中获取
  const alipayPreview = document.getElementById('my-alipay-qr-preview');
  if (alipayPreview && alipayPreview.querySelector('img')) {
    alipayQR = alipayPreview.querySelector('img').src;
  }
  const wechatPreview = document.getElementById('my-wechat-qr-preview');
  if (wechatPreview && wechatPreview.querySelector('img')) {
    wechatQR = wechatPreview.querySelector('img').src;
  }

  const config = {
    method,
    alipayAccount: document.getElementById('my-alipay-account')?.value || '',
    alipayQR,
    wechatAccount: document.getElementById('my-wechat-account')?.value || '',
    wechatQR,
    bankName: document.getElementById('my-bank-name')?.value || '',
    bankBranch: document.getElementById('my-bank-branch')?.value || '',
    bankAccount: document.getElementById('my-bank-account')?.value || '',
    bankHolder: document.getElementById('my-bank-holder')?.value || '',
    usdtAddress: document.getElementById('my-usdt-address')?.value || '',
    usdtNetwork: document.getElementById('my-usdt-network')?.value || 'TRC20',
    customNote: document.getElementById('my-custom-note')?.value || ''
  };

  try {
    await window.electronAPI.tokenUpdateMyPayment(config);
    const hint = document.getElementById('my-payment-saved-hint');
    if (hint) { hint.style.display = ''; setTimeout(() => { hint.style.display = 'none'; }, 2000); }
  } catch (e) {
    console.error('保存收款配置失败:', e);
    alert('保存失败: ' + e.message);
  }
}

// 处理收款码图片上传
function handleQRUpload(fileInput, previewId) {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById(previewId);
    if (preview) {
      preview.innerHTML = `<img src="${e.target.result}" />`;
    }
  };
  reader.readAsDataURL(file);
}

// ===================== 工具函数 =====================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatSize(bytes) {
  if (!bytes) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  return gb.toFixed(1) + ' GB';
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.getFullYear() + '-' + 
    String(d.getMonth() + 1).padStart(2, '0') + '-' + 
    String(d.getDate()).padStart(2, '0') + ' ' + 
    String(d.getHours()).padStart(2, '0') + ':' + 
    String(d.getMinutes()).padStart(2, '0');
}
