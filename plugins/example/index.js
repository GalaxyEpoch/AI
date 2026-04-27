// GalaxyEpoch 示例插件
// 展示插件 API 用法

class ExamplePlugin {
  constructor(ctx) {
    this.ctx = ctx;
    this.pluginId = ctx.pluginId;
  }

  onActivate() {
    console.log(`[${this.pluginId}] 插件已激活`);

    // 注册 hook：在消息发送前处理
    this.ctx.onHook('chat:before-send', (messages, model) => {
      console.log(`[${this.pluginId}] 消息即将发送，模型: ${model?.name}`);
      // 可以修改 messages 后返回
      return messages;
    });

    // 注册 hook：在收到回复后处理
    this.ctx.onHook('chat:after-response', (response, model) => {
      console.log(`[${this.pluginId}] 收到回复，长度: ${response?.length}`);
      // 可以记录日志、触发其他操作等
      this.ctx.setSetting('lastResponseAt', new Date().toISOString());
    });

    // 注册 hook：在侧边栏添加操作按钮
    this.ctx.onHook('ui:sidebar-action', () => {
      return {
        id: 'example-action',
        label: '示例操作',
        icon: '🧩',
        onClick: () => {
          this.ctx.notify('show-message', { text: '示例插件被点击了！' });
        }
      };
    });
  }

  onDeactivate() {
    console.log(`[${this.pluginId}] 插件已停用`);
  }
}

module.exports = ExamplePlugin;
