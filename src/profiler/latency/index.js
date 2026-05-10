/**
 * MiMo Latency Profiler
 */

export class LatencyProfiler {
  constructor() {
    this.results = [];
  }

  async profile(apiCall, metadata = {}) {
    const timestamps = { requestStart: null, firstToken: null, tokens: [], responseEnd: null };
    const startTime = performance.now();
    timestamps.requestStart = startTime;

    try {
      const stream = await apiCall();
      let tokenCount = 0;
      let outputText = '';

      for await (const chunk of stream) {
        const now = performance.now();
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          tokenCount++;
          outputText += content;
          if (!timestamps.firstToken) timestamps.firstToken = now;
          timestamps.tokens.push({ index: tokenCount, timestamp: now });
        }
      }

      timestamps.responseEnd = performance.now();
      const result = this._calculateMetrics(timestamps, { ...metadata, outputLength: outputText.length, tokenCount });
      this.results.push(result);
      return result;
    } catch (error) {
      timestamps.responseEnd = performance.now();
      const result = { error: error.message, totalDuration: timestamps.responseEnd - startTime, ...metadata };
      this.results.push(result);
      return result;
    }
  }

  _calculateMetrics(timestamps, metadata) {
    const ttft = timestamps.firstToken ? timestamps.firstToken - timestamps.requestStart : null;
    const totalDuration = timestamps.responseEnd - timestamps.requestStart;
    let tpot = null;
    if (timestamps.tokens.length > 1) {
      const intervals = [];
      for (let i = 1; i < timestamps.tokens.length; i++) {
        intervals.push(timestamps.tokens[i].timestamp - timestamps.tokens[i - 1].timestamp);
      }
      tpot = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }
    return { ...metadata, ttft, tpot, totalDuration, tokenCount: metadata.tokenCount, timestamp: new Date().toISOString() };
  }

  getStats() {
    if (this.results.length === 0) return null;
    const valid = this.results.filter(r => !r.error);
    if (valid.length === 0) return null;
    return {
      count: valid.length,
      errors: this.results.length - valid.length,
      ttft: this._percentiles(valid.map(r => r.ttft).filter(Boolean)),
      tpot: this._percentiles(valid.map(r => r.tpot).filter(Boolean)),
      totalDuration: this._percentiles(valid.map(r => r.totalDuration)),
    };
  }

  _percentiles(values) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    };
  }

  export() { return { results: this.results, stats: this.getStats(), exportedAt: new Date().toISOString() }; }
}

export default LatencyProfiler;
