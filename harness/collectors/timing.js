'use strict';

/**
 * TimingCollector — Measures latency, throughput, and timing distributions.
 *
 * Tracks:
 *   - Per-request latency
 *   - P50/P95/P99 percentiles
 *   - Throughput (tasks per second)
 *   - Total wall-clock time
 */

class TimingCollector {
  constructor() {
    this.measurements = [];
    this.startTime = null;
    this.endTime = null;
    this.activeTimers = new Map();
  }

  start() {
    this.startTime = Date.now();
    this.measurements = [];
    this.activeTimers.clear();
  }

  stop() {
    this.endTime = Date.now();
  }

  /**
   * Start a named timer
   */
  startTimer(name) {
    this.activeTimers.set(name, Date.now());
  }

  /**
   * Stop a named timer and record the measurement
   */
  stopTimer(name) {
    const start = this.activeTimers.get(name);
    if (start !== undefined) {
      this.measurements.push({
        name,
        latencyMs: Date.now() - start,
        timestamp: Date.now(),
      });
      this.activeTimers.delete(name);
    }
  }

  /**
   * Record a measurement directly
   */
  record(name, latencyMs) {
    this.measurements.push({
      name,
      latencyMs,
      timestamp: Date.now(),
    });
  }

  /**
   * Collect all timing metrics
   */
  collect() {
    const latencies = this.measurements.map(m => m.latencyMs);
    const totalDuration = this.endTime && this.startTime
      ? this.endTime - this.startTime
      : 0;

    return {
      timing: {
        measurements: this.measurements.length,
        totalDurationMs: totalDuration,
        avgLatencyMs: this.average(latencies),
        p50LatencyMs: this.percentile(latencies, 0.5),
        p95LatencyMs: this.percentile(latencies, 0.95),
        p99LatencyMs: this.percentile(latencies, 0.99),
        minLatencyMs: latencies.length > 0 ? Math.min(...latencies) : 0,
        maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
        throughput: totalDuration > 0
          ? (this.measurements.length / (totalDuration / 1000)).toFixed(3)
          : 0,
      },
    };
  }

  average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }
}

module.exports = { TimingCollector };
