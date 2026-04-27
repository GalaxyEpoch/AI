// 本地 JSON 存储模块（替代 electron-store，兼容 CommonJS）
// 支持 Electron 环境和纯 Node.js 环境（测试用）
const fs = require('fs');
const path = require('path');

let _electronApp = null;
try {
  _electronApp = require('electron').app;
} catch (e) {
  // 非 Electron 环境（单元测试），使用临时目录
}

class JsonStore {
  constructor(name, defaults = {}) {
    this.name = name;
    this.defaults = defaults;
    this._data = null;
    this._path = null;
  }

  _getUserDataPath() {
    if (_electronApp && _electronApp.getPath) {
      return _electronApp.getPath('userData');
    }
    // 纯 Node.js 环境降级：使用系统临时目录
    const os = require('os');
    return path.join(os.tmpdir(), 'galaxyepoch-test-data');
  }

  _ensureLoaded() {
    if (this._data) return;
    const userDataPath = this._getUserDataPath();
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    this._path = path.join(userDataPath, `${this.name}.json`);
    try {
      if (fs.existsSync(this._path)) {
        this._data = JSON.parse(fs.readFileSync(this._path, 'utf-8'));
      } else {
        this._data = { ...this.defaults };
        this._save();
      }
    } catch (e) {
      this._data = { ...this.defaults };
      this._save();
    }
  }

  _save() {
    if (!this._path) return;
    try {
      fs.writeFileSync(this._path, JSON.stringify(this._data, null, 2), 'utf-8');
    } catch (e) {
      console.error(`保存 ${this.name} 失败:`, e.message);
    }
  }

  get(key, defaultValue) {
    this._ensureLoaded();
    if (key === undefined) return this._data;
    const keys = key.split('.');
    let val = this._data;
    for (const k of keys) {
      if (val && typeof val === 'object' && k in val) {
        val = val[k];
      } else {
        return defaultValue;
      }
    }
    return val;
  }

  set(key, value) {
    this._ensureLoaded();
    const keys = key.split('.');
    let obj = this._data;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in obj) || typeof obj[keys[i]] !== 'object') {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    this._save();
    return true;
  }

  delete(key) {
    this._ensureLoaded();
    const keys = key.split('.');
    let obj = this._data;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in obj)) return;
      obj = obj[keys[i]];
    }
    delete obj[keys[keys.length - 1]];
    this._save();
  }

  get data() {
    this._ensureLoaded();
    return { ...this._data };
  }

  get store() {
    this._ensureLoaded();
    return { ...this._data };
  }

  getAll() {
    this._ensureLoaded();
    return { ...this._data };
  }
}

module.exports = JsonStore;
