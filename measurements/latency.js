/**
 * Latency Measurement Module
 *
 * Provides timing utilities for benchmark runs.
 */

export function createTimer() {
  const marks = [];
  return {
    mark(label) { marks.push({ label, time: performance.now() }); },
    elapsed(fromLabel, toLabel) {
      const from = marks.find((m) => m.label === fromLabel);
      const to = marks.find((m) => m.label === toLabel);
      return from && to ? to.time - from.time : null;
    },
    getAll() { return [...marks]; },
  };
}

export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * p)];
}

export function computeStats(values) {
  if (!values.length) return null;
  return {
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.reduce((a, b) => a + b, 0) / values.length,
  };
}
