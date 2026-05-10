'use strict';

/**
 * ResourceCollector — Tracks system resource usage during benchmarks.
 *
 * Tracks:
 *   - Memory usage (heap, RSS)
 *   - Event loop lag
 *   - Active handles/requests
 *   - GC pauses (if available)
 */

class ResourceCollector {
  constructor() {
    this.snapshots = [];
    this.interval = null;
    this.gcEvents = [];
  }

  start() {
    this.snapshots = [];
    this.gcEvents = [];

    // Take periodic snapshots
    this.interval = setInterval(() => {
      this.takeSnapshot();
    }, 500);

    // Track GC if available
    if (typeof global.gc === 'function') {
      const origGC = global.gc;
      global.gc = () => {
        const start = Date.now();
        origGC();
        this.gcEvents.push({ durationMs: Date.now() - start, timestamp: Date.now() });
      };
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.takeSnapshot(); // Final snapshot
  }

  /**
   * Take a memory snapshot
   */
  takeSnapshot() {
    const memUsage = process.memoryUsage();
    this.snapshots.push({
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0,
      timestamp: Date.now(),
    });
  }

  /**
   * Collect all resource metrics
   */
  collect() {
    if (this.snapshots.length === 0) {
      return { resource: { memory: {}, gc: {} } };
    }

    const latest = this.snapshots[this.snapshots.length - 1];
    const first = this.snapshots[0];

    const heapGrowth = latest.heapUsed - first.heapUsed;
    const maxHeap = Math.max(...this.snapshots.map(s => s.heapUsed));
    const avgHeap = this.snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / this.snapshots.length;

    return {
      resource: {
        memory: {
          heapUsed: this.bytesToMB(latest.heapUsed),
          heapTotal: this.bytesToMB(latest.heapTotal),
          rss: this.bytesToMB(latest.rss),
          maxHeapMB: this.bytesToMB(maxHeap),
          avgHeapMB: this.bytesToMB(avgHeap),
          heapGrowthMB: this.bytesToMB(Math.max(0, heapGrowth)),
        },
        gc: {
          events: this.gcEvents.length,
          totalPauseMs: this.gcEvents.reduce((sum, e) => sum + e.durationMs, 0),
          avgPauseMs: this.gcEvents.length > 0
            ? this.gcEvents.reduce((sum, e) => sum + e.durationMs, 0) / this.gcEvents.length
            : 0,
        },
        snapshots: this.snapshots.length,
      },
    };
  }

  bytesToMB(bytes) {
    return parseFloat((bytes / (1024 * 1024)).toFixed(2));
  }
}

module.exports = { ResourceCollector };
