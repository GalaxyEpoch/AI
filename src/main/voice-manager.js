// GalaxyEpoch - 语音对话管理器
// 支持：语音输入（浏览器 Web Speech API → 文字）+ 语音输出（TTS 文字转语音）
// 在线 TTS：OpenAI TTS / Edge TTS (免费) / 浏览器原生 SpeechSynthesis
// 语音识别：浏览器 Web Speech API（免费）+ OpenAI Whisper（在线）

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const JsonStore = require('./json-store');

class VoiceManager {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.store = new JsonStore('voice', {
      // 语音输入（识别）
      stt: {
        engine: 'web',    // 'web' (浏览器原生) | 'whisper' (OpenAI Whisper)
        language: 'zh-CN',
        autoSend: true    // 识别后自动发送
      },
      // 语音输出（合成）
      tts: {
        engine: 'web',    // 'web' (浏览器原生) | 'edge' (Edge TTS免费) | 'openai' (OpenAI TTS)
        voice: '',
        speed: 1.0,
        autoRead: false   // 自动朗读 AI 回复
      }
    });
    this.isRecording = false;
  }

  // ========== 语音识别（STT）==========

  /**
   * 获取 STT 配置
   */
  getSttConfig() {
    return this.store.get('stt', {
      engine: 'web',
      language: 'zh-CN',
      autoSend: true
    });
  }

  /**
   * 更新 STT 配置
   */
  updateSttConfig(updates) {
    const current = this.getSttConfig();
    this.store.set('stt', { ...current, ...updates });
    return { success: true };
  }

  /**
   * 使用 OpenAI Whisper 识别音频
   * 前端通过 MediaRecorder 录制音频，发送 Blob 到主进程
   */
  async transcribeWithWhisper(audioBuffer, options = {}) {
    const apiKey = this.settingsManager.getApiKey('openai');
    if (!apiKey) return { success: false, error: '未配置 OpenAI API Key' };

    try {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', audioBuffer, { filename: 'audio.webm', contentType: 'audio/webm' });
      form.append('model', 'whisper-1');
      form.append('language', options.language || 'zh');

      const resp = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...form.getHeaders()
        },
        timeout: 30000
      });

      return { success: true, text: resp.data.text };
    } catch (e) {
      return { success: false, error: `Whisper 识别失败: ${e.message}` };
    }
  }

  // ========== 语音合成（TTS）==========

  /**
   * 获取 TTS 配置
   */
  getTtsConfig() {
    return this.store.get('tts', {
      engine: 'web',
      voice: '',
      speed: 1.0,
      autoRead: false
    });
  }

  /**
   * 更新 TTS 配置
   */
  updateTtsConfig(updates) {
    const current = this.getTtsConfig();
    this.store.set('tts', { ...current, ...updates });
    return { success: true };
  }

  /**
   * 使用 OpenAI TTS 生成语音
   * 返回音频文件路径，前端播放
   */
  async synthesizeWithOpenAI(text, options = {}) {
    const apiKey = this.settingsManager.getApiKey('openai');
    if (!apiKey) return { success: false, error: '未配置 OpenAI API Key' };

    try {
      const resp = await axios.post('https://api.openai.com/v1/audio/speech', {
        model: 'tts-1',
        input: text,
        voice: options.voice || 'alloy',
        speed: options.speed || 1.0
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        responseType: 'arraybuffer',
        timeout: 60000
      });

      // 保存到临时文件
      let userDataPath;
      try { userDataPath = require('electron').app.getPath('userData'); } catch(e) { userDataPath = require('os').tmpdir(); }
      const tempDir = path.join(userDataPath, 'voice_temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const filePath = path.join(tempDir, `tts_${Date.now()}.mp3`);
      fs.writeFileSync(filePath, resp.data);

      return { success: true, filePath, format: 'mp3' };
    } catch (e) {
      return { success: false, error: `OpenAI TTS 失败: ${e.message}` };
    }
  }

  /**
   * 使用 Edge TTS 生成语音（免费）
   * 需要系统安装 edge-tts Python 包
   */
  async synthesizeWithEdge(text, options = {}) {
    try {
      let userDataPath;
      try { userDataPath = require('electron').app.getPath('userData'); } catch(e) { userDataPath = require('os').tmpdir(); }
      const tempDir = path.join(userDataPath, 'voice_temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const filePath = path.join(tempDir, `tts_${Date.now()}.mp3`);

      const voice = options.voice || 'zh-CN-XiaoxiaoNeural';
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

      await new Promise((resolve, reject) => {
        const proc = execFile(pythonCmd, [
          '-m', 'edge_tts',
          '--voice', voice,
          '--rate', `+${Math.round(((options.speed || 1.0) - 1) * 100)}%`,
          '--text', text,
          '--write-media', filePath
        ], { timeout: 30000 }, (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve();
        });
      });

      return { success: true, filePath, format: 'mp3' };
    } catch (e) {
      return { success: false, error: `Edge TTS 失败: ${e.message}` };
    }
  }

  /**
   * 获取可用的 TTS 语音列表
   */
  getAvailableVoices() {
    return {
      web: {
        name: '浏览器原生',
        type: 'free',
        description: '使用浏览器内置语音合成引擎，无需联网'
      },
      edge: {
        name: 'Edge TTS',
        type: 'free',
        voices: [
          { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓（女）' },
          { id: 'zh-CN-YunxiNeural', name: '云希（男）' },
          { id: 'zh-CN-XiaohanNeural', name: '晓涵（女）' },
          { id: 'zh-CN-YunjianNeural', name: '云健（男）' },
          { id: 'en-US-JennyNeural', name: 'Jenny (Female)' },
          { id: 'en-US-GuyNeural', name: 'Guy (Male)' },
          { id: 'ja-JP-NanamiNeural', name: '七海（女）' }
        ]
      },
      openai: {
        name: 'OpenAI TTS',
        type: 'paid',
        voices: [
          { id: 'alloy', name: 'Alloy' },
          { id: 'echo', name: 'Echo' },
          { id: 'fable', name: 'Fable' },
          { id: 'onyx', name: 'Onyx' },
          { id: 'nova', name: 'Nova' },
          { id: 'shimmer', name: 'Shimmer' }
        ]
      }
    };
  }

  // ========== 录音控制 ==========

  setRecording(recording) {
    this.isRecording = recording;
    return { success: true, recording };
  }

  getRecording() {
    return this.isRecording;
  }

  // ========== 清理 ==========

  cleanupTempFiles() {
    try {
      let userDataPath;
      try { userDataPath = require('electron').app.getPath('userData'); } catch(e) { userDataPath = require('os').tmpdir(); }
      const tempDir = path.join(userDataPath, 'voice_temp');
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        const now = Date.now();
        for (const file of files) {
          const filePath = path.join(tempDir, file);
          const stat = fs.statSync(filePath);
          // 清理超过 1 小时的临时文件
          if (now - stat.mtimeMs > 3600000) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (e) { /* ignore */ }
  }
}

module.exports = VoiceManager;
