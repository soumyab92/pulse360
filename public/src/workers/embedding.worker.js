/**
 * PULSE360 — Embedding Web Worker
 * Uses Transformers.js (all-MiniLM-L6-v2) for client-side dense embeddings.
 * Reports real-time download progress and runs feature extraction off the main thread.
 */

/* global importScripts, self */

let pipeline = null;
let embedder = null;
let isInitializing = false;

// Simple fast tokenization helper for fallback vectorization
function simpleVectorize(text, dim = 384) {
  const vec = new Float32Array(dim);
  const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return vec;

  words.forEach((w, idx) => {
    let hash = 0;
    for (let i = 0; i < w.length; i++) {
      hash = (hash << 5) - hash + w.charCodeAt(i);
      hash |= 0;
    }
    const bucket = Math.abs(hash) % dim;
    vec[bucket] += 1.0;
  });

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }
  return vec;
}

self.onmessage = async (e) => {
  const { type, id, payload } = e.data;

  // 1. Initialize Transformers.js Model (Opt-In)
  if (type === 'INIT_MODEL') {
    if (embedder) {
      self.postMessage({ type: 'INIT_SUCCESS', id, status: 'ready' });
      return;
    }
    if (isInitializing) return;

    isInitializing = true;
    try {
      // Import Transformers.js via CDN
      importScripts('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
      const { pipeline: hfPipeline, env } = self.transformers;

      // Configure cache and flags
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      embedder = await hfPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true,
        progress_callback: (prog) => {
          if (prog.status === 'progress') {
            self.postMessage({
              type: 'INIT_PROGRESS',
              file: prog.file,
              progress: prog.progress,
              loaded: prog.loaded,
              total: prog.total
            });
          }
        }
      });

      isInitializing = false;
      self.postMessage({ type: 'INIT_SUCCESS', id, status: 'ready', model: 'all-MiniLM-L6-v2 (23 MB)' });
    } catch (err) {
      isInitializing = false;
      console.warn('Transformers.js CDN load error, falling back to local dense tokenizer:', err);
      // Fallback enabled flag
      self.postMessage({ type: 'INIT_FALLBACK', id, message: 'Using local tokenizer fallback' });
    }
    return;
  }

  // 2. Embed a batch of knowledge chunks
  if (type === 'EMBED_CHUNKS') {
    const chunks = payload.chunks || [];
    const results = [];

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const text = `${c.heading}: ${c.content}`;
      let vector;

      if (embedder) {
        try {
          const out = await embedder(text, { pooling: 'mean', normalize: true });
          vector = Array.from(out.data);
        } catch {
          vector = Array.from(simpleVectorize(text));
        }
      } else {
        vector = Array.from(simpleVectorize(text));
      }

      results.push({
        id: c.id,
        file: c.file,
        heading: c.heading,
        content: c.content,
        embedding: vector
      });

      self.postMessage({
        type: 'EMBED_PROGRESS',
        current: i + 1,
        total: chunks.length
      });
    }

    self.postMessage({ type: 'EMBED_CHUNKS_SUCCESS', id, results });
    return;
  }

  // 3. Embed a search query
  if (type === 'EMBED_QUERY') {
    const query = payload.query || '';
    let vector;

    if (embedder) {
      try {
        const out = await embedder(query, { pooling: 'mean', normalize: true });
        vector = Array.from(out.data);
      } catch {
        vector = Array.from(simpleVectorize(query));
      }
    } else {
      vector = Array.from(simpleVectorize(query));
    }

    self.postMessage({ type: 'EMBED_QUERY_SUCCESS', id, vector });
  }
};

