// GalaxyEpoch - 知识库管理器
// 支持文档上传、文本切分、向量化存储、语义检索（RAG）

const fs = require('fs');
const path = require('path');
const JsonStore = require('./json-store');

class KnowledgeManager {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.store = new JsonStore('knowledge', {
      libraries: []  // { id, name, docs: [{ id, name, chunks, addedAt }] }
    });
  }

  // ========== 知识库 CRUD ==========

  /**
   * 创建知识库
   */
  createLibrary(name, description = '') {
    const libraries = this.store.get('libraries', []);
    const lib = {
      id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      description,
      docs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    libraries.push(lib);
    this.store.set('libraries', libraries);
    return { success: true, library: lib };
  }

  /**
   * 获取所有知识库
   */
  listLibraries() {
    return this.store.get('libraries', []).map(lib => ({
      id: lib.id,
      name: lib.name,
      description: lib.description,
      docCount: lib.docs.length,
      totalChunks: lib.docs.reduce((sum, d) => sum + d.chunks.length, 0),
      createdAt: lib.createdAt,
      updatedAt: lib.updatedAt
    }));
  }

  /**
   * 获取知识库详情（含文档列表）
   */
  getLibrary(libraryId) {
    const libraries = this.store.get('libraries', []);
    return libraries.find(l => l.id === libraryId) || null;
  }

  /**
   * 更新知识库信息
   */
  updateLibrary(libraryId, updates) {
    const libraries = this.store.get('libraries', []);
    const idx = libraries.findIndex(l => l.id === libraryId);
    if (idx === -1) return { success: false, error: '知识库不存在' };
    Object.assign(libraries[idx], updates, { updatedAt: new Date().toISOString() });
    this.store.set('libraries', libraries);
    return { success: true };
  }

  /**
   * 删除知识库
   */
  deleteLibrary(libraryId) {
    let libraries = this.store.get('libraries', []);
    libraries = libraries.filter(l => l.id !== libraryId);
    this.store.set('libraries', libraries);
    return { success: true };
  }

  // ========== 文档管理 ==========

  /**
   * 添加文档到知识库
   * @param {string} libraryId - 知识库ID
   * @param {string} fileName - 文件名
   * @param {string} content - 文件内容
   * @param {object} options - 切分选项 { chunkSize, overlap }
   */
  addDocument(libraryId, fileName, content, options = {}) {
    const libraries = this.store.get('libraries', []);
    const lib = libraries.find(l => l.id === libraryId);
    if (!lib) return { success: false, error: '知识库不存在' };

    const chunkSize = options.chunkSize || 500;
    const overlap = options.overlap || 50;
    const chunks = this._splitText(content, chunkSize, overlap);

    const doc = {
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: fileName,
      content,
      chunks,
      chunkCount: chunks.length,
      addedAt: new Date().toISOString()
    };

    lib.docs.push(doc);
    lib.updatedAt = new Date().toISOString();
    this.store.set('libraries', libraries);

    return { success: true, document: { id: doc.id, name: doc.name, chunkCount: doc.chunkCount } };
  }

  /**
   * 从文件路径添加文档
   */
  addDocumentFromFile(libraryId, filePath, options = {}) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileName = path.basename(filePath);
      return this.addDocument(libraryId, fileName, content, options);
    } catch (e) {
      return { success: false, error: `读取文件失败: ${e.message}` };
    }
  }

  /**
   * 删除文档
   */
  removeDocument(libraryId, docId) {
    const libraries = this.store.get('libraries', []);
    const lib = libraries.find(l => l.id === libraryId);
    if (!lib) return { success: false, error: '知识库不存在' };

    lib.docs = lib.docs.filter(d => d.id !== docId);
    lib.updatedAt = new Date().toISOString();
    this.store.set('libraries', libraries);
    return { success: true };
  }

  // ========== RAG 检索 ==========

  /**
   * 语义检索：根据查询文本在知识库中查找最相关的片段
   * 使用关键词 + TF-IDF 简易相似度匹配（无外部向量数据库依赖）
   * 
   * @param {string} libraryId - 知识库ID
   * @param {string} query - 查询文本
   * @param {object} options - { topK: 返回条数, threshold: 最低相似度 }
   * @returns {Array<{ text: string, score: number, docName: string }>}
   */
  search(libraryId, query, options = {}) {
    const topK = options.topK || 5;
    const threshold = options.threshold || 0.1;
    
    const lib = this.getLibrary(libraryId);
    if (!lib) return [];

    const queryTerms = this._tokenize(query);
    if (queryTerms.length === 0) return [];

    const results = [];
    
    for (const doc of lib.docs) {
      for (const chunk of doc.chunks) {
        const score = this._computeSimilarity(queryTerms, chunk);
        if (score >= threshold) {
          results.push({
            text: chunk,
            score,
            docName: doc.name,
            docId: doc.id
          });
        }
      }
    }

    // 按相似度排序，取 topK
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * 构建 RAG 上下文：将检索结果拼接为系统提示
   */
  buildRAGContext(libraryId, query, options = {}) {
    const results = this.search(libraryId, query, options);
    if (results.length === 0) return '';

    let context = '以下是从知识库中检索到的相关内容：\n\n';
    results.forEach((r, i) => {
      context += `【文档: ${r.docName} | 相关度: ${(r.score * 100).toFixed(1)}%】\n${r.text}\n\n`;
    });
    context += '请根据以上知识库内容回答用户的问题。如果知识库中没有相关信息，请说明。';

    return context;
  }

  // ========== 文本处理 ==========

  /**
   * 文本切分
   */
  _splitText(text, chunkSize = 500, overlap = 50) {
    const chunks = [];
    // 先按段落/换行分割
    const paragraphs = text.split(/\n{2,}|\r\n{2,}/);
    let currentChunk = '';

    for (const para of paragraphs) {
      if ((currentChunk + '\n\n' + para).length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        // 保留 overlap 字符作为重叠
        currentChunk = currentChunk.slice(-overlap) + '\n\n' + para;
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // 对过长的 chunk 进一步切分
    const finalChunks = [];
    for (const chunk of chunks) {
      if (chunk.length <= chunkSize * 1.5) {
        finalChunks.push(chunk);
      } else {
        // 按句号分割
        const sentences = chunk.split(/(?<=[。！？.!?])\s*/);
        let subChunk = '';
        for (const s of sentences) {
          if ((subChunk + s).length > chunkSize && subChunk.length > 0) {
            finalChunks.push(subChunk.trim());
            subChunk = s;
          } else {
            subChunk += s;
          }
        }
        if (subChunk.trim()) finalChunks.push(subChunk.trim());
      }
    }

    return finalChunks;
  }

  /**
   * 简易分词
   */
  _tokenize(text) {
    // 中文按字符，英文按单词
    const tokens = [];
    // 提取英文单词
    const englishWords = text.toLowerCase().match(/[a-z0-9]{2,}/g) || [];
    tokens.push(...englishWords);
    // 提取中文词组（2-4字的组合）
    const chineseChars = text.replace(/[^\u4e00-\u9fff]/g, '');
    for (let len = 2; len <= Math.min(4, chineseChars.length); len++) {
      for (let i = 0; i <= chineseChars.length - len; i++) {
        tokens.push(chineseChars.substring(i, i + len));
      }
    }
    return [...new Set(tokens)];
  }

  /**
   * 简易 TF-IDF 相似度计算
   */
  _computeSimilarity(queryTerms, text) {
    const textLower = text.toLowerCase();
    let matchCount = 0;
    let totalWeight = 0;

    for (const term of queryTerms) {
      const count = (textLower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      if (count > 0) {
        // 长词权重更高
        const weight = term.length >= 4 ? 2 : 1;
        matchCount += count * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) return 0;
    // 归一化：匹配度 / 查询词数
    return Math.min(matchCount / (queryTerms.length * 1.5), 1.0);
  }
}

module.exports = KnowledgeManager;
