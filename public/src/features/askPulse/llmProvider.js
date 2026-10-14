/**
 * PULSE360 — LLM Provider Interface
 * Decouples the UI from the LLM execution backend.
 * Milestone 6A: ServerStreamProvider (server-side streaming route with rate limiting).
 * Milestone 6B: WebLLMProvider (in-browser client model) will implement this exact interface.
 */

export class ServerStreamProvider {
  constructor(endpoint = '/api/pulse-llm') {
    this.endpoint = endpoint;
    this.id = 'server-stream';
    this.name = 'PULSE Serverless Engine';
  }

  async generateStream(prompt, context, { onChunk, onComplete, onError, signal }) {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, context }),
        signal
      });

      if (!response.ok) {
        let errMessage = `Server error (${response.status})`;
        try {
          const errData = await response.json();
          if (errData.error) errMessage = errData.error;
        } catch {}
        throw new Error(errMessage);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser response.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';
      let finalSources = [];
      let finalOptions = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete trailing fragment

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.substring(6).trim();
            if (jsonStr) {
              try {
                const data = JSON.parse(jsonStr);
                if (data.chunk) {
                  accumulatedText += data.chunk;
                  if (onChunk) onChunk(data.chunk);
                }
                if (data.done) {
                  if (data.sources) finalSources = data.sources;
                  if (data.options) finalOptions = data.options;
                }
              } catch (e) {
                console.warn('SSE parse error:', e);
              }
            }
          }
        }
      }

      if (onComplete) {
        onComplete({ text: accumulatedText, sources: finalSources, options: finalOptions });
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (onError) onError(err);
    }
  }
}

// Default singleton active provider
export const activeLlmProvider = new ServerStreamProvider();

