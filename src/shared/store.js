const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Store {
  constructor(opts) {
    const userDataPath = app.getPath('userData');
    this.path = path.join(userDataPath, opts.configName + '.json');
    this.data = this._load();
  }

  _load() {
    try {
      return JSON.parse(fs.readFileSync(this.path, 'utf-8'));
    } catch {
      return {};
    }
  }

  _save() {
    try {
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('Store save error:', e);
    }
  }

  get(key, defaultValue) {
    const keys = key.split('.');
    let result = this.data;
    for (const k of keys) {
      if (result === undefined || result === null) return defaultValue;
      result = result[k];
    }
    return result !== undefined ? result : defaultValue;
  }

  set(key, value) {
    const keys = key.split('.');
    let obj = this.data;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in obj) || typeof obj[keys[i]] !== 'object') {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    this._save();
  }

  delete(key) {
    const keys = key.split('.');
    let obj = this.data;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in obj)) return;
      obj = obj[keys[i]];
    }
    delete obj[keys[keys.length - 1]];
    this._save();
  }

  getAll() {
    return { ...this.data };
  }
}

module.exports = Store;
