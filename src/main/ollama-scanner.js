// 本地 Ollama 模型扫描器
const axios = require('axios');
const net = require('net');

class OllamaScanner {
  constructor() {
    this.defaultHost = '127.0.0.1';
    this.defaultPort = 11434;
    this.scanPorts = [11434, 11435, 8080, 8888, 5000, 8000, 8001];
  }

  /**
   * 检查 Ollama 服务状态
   */
  async checkStatus() {
    try {
      const resp = await axios.get(`http://${this.defaultHost}:${this.defaultPort}/api/tags`, {
        timeout: 5000
      });
      return {
        running: true,
        host: this.defaultHost,
        port: this.defaultPort,
        version: resp.headers['x-ollama-version'] || 'unknown'
      };
    } catch (e) {
      return {
        running: false,
        host: this.defaultHost,
        port: this.defaultPort
      };
    }
  }

  /**
   * 扫描本地所有可用模型
   */
  async scanLocalModels() {
    const results = [];

    // 1. 扫描 Ollama
    const ollamaModels = await this._scanOllama();
    results.push(...ollamaModels);

    // 2. 扫描其他常见本地服务端口
    const otherModels = await this._scanOtherPorts();
    results.push(...otherModels);

    return results;
  }

  /**
   * 扫描 Ollama 模型
   */
  async _scanOllama() {
    const models = [];
    for (const port of this.scanPorts) {
      try {
        const resp = await axios.get(`http://${this.defaultHost}:${port}/api/tags`, {
          timeout: 3000
        });
        if (resp.data && resp.data.models) {
          for (const m of resp.data.models) {
            models.push({
              id: `ollama_${m.name}`,
              name: m.name,
              model: m.name,  // Ollama API 需要的模型标识
              provider: 'ollama',
              type: 'local',
              host: this.defaultHost,
              port: port,
              size: m.size,
              modified: m.modified_at,
              details: m.details || {},
              apiBase: `http://${this.defaultHost}:${port}`
            });
          }
          break; // 找到一个可用端口就跳出
        }
      } catch (e) {
        // 此端口无服务，继续尝试
      }
    }
    return models;
  }

  /**
   * 扫描其他本地模型服务
   */
  async _scanOtherPorts() {
    const models = [];
    // 扫描 LM Studio (通常 1234 端口)
    const lmStudioPorts = [1234, 1235];
    for (const port of lmStudioPorts) {
      try {
        const resp = await axios.get(`http://${this.defaultHost}:${port}/v1/models`, {
          timeout: 3000
        });
        if (resp.data && resp.data.data) {
          for (const m of resp.data.data) {
            models.push({
              id: `lmstudio_${m.id}`,
              name: m.id,
              model: m.id,
              provider: 'lmstudio',
              type: 'local',
              host: this.defaultHost,
              port: port,
              apiBase: `http://${this.defaultHost}:${port}/v1`
            });
          }
          break;
        }
      } catch (e) {
        // 此端口无服务
      }
    }

    // 扫描 LocalAI (通常 8080)
    try {
      const resp = await axios.get(`http://${this.defaultHost}:8080/v1/models`, {
        timeout: 3000
      });
      if (resp.data && resp.data.data) {
        for (const m of resp.data.data) {
          models.push({
            id: `localai_${m.id}`,
            name: m.id,
            model: m.id,
            provider: 'localai',
            type: 'local',
            host: this.defaultHost,
            port: 8080,
            apiBase: `http://${this.defaultHost}:8080/v1`
          });
        }
      }
    } catch (e) {
      // 无服务
    }

    return models;
  }

  /**
   * 检查端口是否开放
   */
  _checkPort(host, port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2000);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, host);
    });
  }
}

module.exports = OllamaScanner;
