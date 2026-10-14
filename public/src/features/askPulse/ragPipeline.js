/**
 * PULSE360 — Ask PULSE Grounded RAG Pipeline Controller
 * Coordinates the Embedding Web Worker, IndexedDB Vector Store,
 * Context Builder, and Streaming Provider.
 */

import { storeChunkVectors, searchTopK, hasVectors } from '../../lib/vectorStore.js';
import { buildGroundedContext } from './contextBuilder.js';
import { activeLlmProvider } from './llmProvider.js';

class RagPipeline {
  constructor() {
    this.worker = null;
    this.workerStatus = 'idle'; // 'idle' | 'downloading' | 'ready' | 'fallback'
    this.modelProgress = { progress: 0, loaded: 0, total: 23000000 };
    this.isTestRunning = false;
    this.callbacks = new Map();
    this.onStateChange = null;
    this.initWorker();
  }

  initWorker() {
    if (typeof Worker === 'undefined') return;
    try {
      this.worker = new Worker('/src/workers/embedding.worker.js');
      this.worker.onmessage = (e) => this.handleWorkerMessage(e.data);
    } catch (err) {
      console.warn('Worker init error:', err);
    }
  }

  setTestRunning(running) {
    this.isTestRunning = running;
    if (this.onStateChange) this.onStateChange({ status: this.workerStatus, isTestRunning: running });
  }

  handleWorkerMessage(data) {
    const { type, id, ...rest } = data;

    if (type === 'INIT_PROGRESS') {
      const pct = Math.round((rest.progress || 0) * 100);
      this.modelProgress = { progress: pct, loaded: rest.loaded || 0, total: rest.total || 23000000 };
      this.workerStatus = 'downloading';
      if (this.onStateChange) this.onStateChange({ status: 'downloading', progress: this.modelProgress });
    } else if (type === 'INIT_SUCCESS') {
      this.workerStatus = 'ready';
      if (this.onStateChange) this.onStateChange({ status: 'ready', model: rest.model });
      const cb = this.callbacks.get(id);
      if (cb) { cb.resolve(rest); this.callbacks.delete(id); }
    } else if (type === 'INIT_FALLBACK') {
      this.workerStatus = 'fallback';
      if (this.onStateChange) this.onStateChange({ status: 'fallback' });
      const cb = this.callbacks.get(id);
      if (cb) { cb.resolve(rest); this.callbacks.delete(id); }
    } else if (type === 'EMBED_CHUNKS_SUCCESS') {
      const cb = this.callbacks.get(id);
      if (cb) { cb.resolve(rest.results); this.callbacks.delete(id); }
    } else if (type === 'EMBED_QUERY_SUCCESS') {
      const cb = this.callbacks.get(id);
      if (cb) { cb.resolve(rest.vector); this.callbacks.delete(id); }
    }
  }

  // Opt-in Model Loader
  async loadModel() {
    if (this.isTestRunning) {
      throw new Error('Speed test is currently executing. Embedding download is blocked to prevent network/CPU distortion.');
    }
    if (this.workerStatus === 'ready') return true;

    this.workerStatus = 'downloading';
    if (this.onStateChange) this.onStateChange({ status: 'downloading', progress: { progress: 0 } });

    const reqId = `init_${Date.now()}`;
    return new Promise((resolve, reject) => {
      this.callbacks.set(reqId, { resolve, reject });
      this.worker.postMessage({ type: 'INIT_MODEL', id: reqId });
    });
  }

  // Ensure knowledge base chunks are embedded in IndexedDB
  async indexKnowledgeBase() {
    const alreadyCached = await hasVectors();
    if (alreadyCached) return true;

    // Fetch chunks from backend
    const resp = await fetch('/api/knowledge');
    if (!resp.ok) throw new Error('Could not fetch knowledge chunks from server');
    const { chunks } = await resp.json();
    if (!chunks || chunks.length === 0) return false;

    // Embed via worker
    const reqId = `embed_${Date.now()}`;
    const chunkVectors = await new Promise((resolve, reject) => {
      this.callbacks.set(reqId, { resolve, reject });
      this.worker.postMessage({ type: 'EMBED_CHUNKS', id: reqId, payload: { chunks } });
    });

    await storeChunkVectors(chunkVectors);
    return true;
  }

  // Embed user query and retrieve top-k chunks
  async retrieveContext(query) {
    if (!this.worker) return [];

    const reqId = `query_${Date.now()}`;
    const queryVector = await new Promise((resolve, reject) => {
      this.callbacks.set(reqId, { resolve, reject });
      this.worker.postMessage({ type: 'EMBED_QUERY', id: reqId, payload: { query } });
    });

    const matches = await searchTopK(queryVector, 3, 0.2);
    return matches;
  }

  // Full RAG Query Execution
  async askPulse({
    prompt,
    telemetry,
    metrics,
    planAudit,
    dnsBenchmarks,
    history,
    onChunk,
    onComplete,
    onError,
    signal
  }) {
    if (this.isTestRunning) {
      throw new Error('Speed test is actively executing. Ask PULSE queries are paused to ensure zero telemetry distortion.');
    }

    try {
      // 1. Retrieve top-k knowledge chunks from vector store
      let retrievedChunks = [];
      try {
        retrievedChunks = await this.retrieveContext(prompt);
      } catch (e) {
        console.warn('Vector retrieval error, proceeding with live telemetry context:', e);
      }

      // 2. Build structured JSON context
      const context = buildGroundedContext({
        telemetry,
        metrics,
        planAudit,
        dnsBenchmarks,
        history,
        retrievedChunks
      });

      // 3. Call decoupled LLM provider
      await activeLlmProvider.generateStream(prompt, context, {
        onChunk,
        onComplete: (res) => {
          // Merge retrieved chunk citations with any provider sources
          const chunkSources = retrievedChunks.map(c => `knowledge/${c.file}#${c.heading}`);
          const combinedSources = Array.from(new Set([...chunkSources, ...(res.sources || [])]));
          onComplete({ ...res, sources: combinedSources, options: res.options || [] });
        },
        onError,
        signal
      });
    } catch (err) {
      if (onError) onError(err);
    }
  }
}

export const ragPipeline = new RagPipeline();

