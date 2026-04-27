// 对话管理器
const JsonStore = require('./json-store');

class ConversationManager {
  constructor() {
    this.store = new JsonStore('conversations', {
      conversations: []
    });
  }

  /**
   * 获取对话列表
   */
  listConversations() {
    const convs = this.store.get('conversations', []);
    return convs.map(c => ({
      id: c.id,
      title: c.title,
      model: c.model,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: (c.messages || []).length
    }));
  }

  /**
   * 创建新对话
   */
  createConversation(title = '新对话') {
    const convs = this.store.get('conversations', []);
    const conv = {
      id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title,
      model: '',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    convs.unshift(conv);
    this.store.set('conversations', convs);
    return conv;
  }

  /**
   * 删除对话
   */
  deleteConversation(id) {
    let convs = this.store.get('conversations', []);
    convs = convs.filter(c => c.id !== id);
    this.store.set('conversations', convs);
    return { success: true };
  }

  /**
   * 重命名对话
   */
  renameConversation(id, title) {
    const convs = this.store.get('conversations', []);
    const conv = convs.find(c => c.id === id);
    if (conv) {
      conv.title = title;
      conv.updatedAt = new Date().toISOString();
      this.store.set('conversations', convs);
      return { success: true };
    }
    return { success: false, error: '对话不存在' };
  }

  /**
   * 获取对话消息
   */
  getMessages(id) {
    const convs = this.store.get('conversations', []);
    const conv = convs.find(c => c.id === id);
    return conv ? conv.messages : [];
  }

  /**
   * 保存消息
   */
  saveMessage(convId, message) {
    const convs = this.store.get('conversations', []);
    const conv = convs.find(c => c.id === convId);
    if (conv) {
      message.id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      message.timestamp = new Date().toISOString();
      conv.messages.push(message);
      conv.updatedAt = new Date().toISOString();
      // 如果没有设置模型，设置当前对话模型
      if (!conv.model && message.model) {
        conv.model = message.model;
      }
      this.store.set('conversations', convs);
      return { success: true, message };
    }
    return { success: false, error: '对话不存在' };
  }

  /**
   * 清空对话消息
   */
  clearMessages(id) {
    const convs = this.store.get('conversations', []);
    const conv = convs.find(c => c.id === id);
    if (conv) {
      conv.messages = [];
      conv.updatedAt = new Date().toISOString();
      this.store.set('conversations', convs);
      return { success: true };
    }
    return { success: false };
  }
}

module.exports = ConversationManager;
