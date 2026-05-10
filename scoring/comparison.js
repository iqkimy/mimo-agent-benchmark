'use strict';

/**
 * Comparator — Computes diffs between two benchmark runs.
 *
 * Produces a structured comparison with per-metric deltas and
 * statistical significance indicators.
 */

class Comparator {
  constructor() {
    this.metrics = [
      { key: 'compositeScore', label: 'Composite Score', format: 'decimal' },
      { key: 'accuracy', label: 'Accuracy', format: 'percent' },
      { key: 'latency_p50', label: 'Latency P50', format: 'ms', invert: true },
      { key: 'latency_p95', label: 'Latency P95', format: 'ms', invert: true },
      { key: 'token_efficiency', label: 'Token Efficiency', format: 'decimal' },
      { key: 'tool_accuracy', label: 'Tool Accuracy', format: 'percent' },
      { key: 'cost_per_task', label: 'Cost/Task', format: 'currency', invert: true },
    ];
  }

  /**
   * Compare two benchmark result sets
   */
  compare(runA, runB) {
    const comparison = {
      runA: this.extractMetadata(runA),
      runB: this.extractMetadata(runB),
      metrics: [],
      overall: null,
    };

    for (const metric of this.metrics) {
      const valueA = this.getMetricValue(runA, metric.key);
      const valueB = this.getMetricValue(runB, metric.key);

      if (valueA !== null && valueB !== null) {
        const delta = valueB - valueA;
        const deltaPercent = valueA !== 0 ? (delta / Math.abs(valueA)) * 100 : 0;

        // For inverted metrics (lower is better), flip the interpretation
        const isImprovement = metric.invert ? delta < 0 : delta > 0;

        comparison.metrics.push({
          label: metric.label,
          valueA: this.formatValue(valueA, metric.format),
          valueB: this.formatValue(valueB, metric.format),
          delta: this.formatValue(delta, metric.format),
          deltaPercent: `${deltaPercent > 0 ? '+' : ''}${deltaPercent.toFixed(1)}%`,
          improvement: isImprovement,
          rawA: valueA,
          rawB: valueB,
        });
      }
    }

    // Overall assessment
    const improvements = comparison.metrics.filter(m => m.improvement).length;
    const total = comparison.metrics.length;
    comparison.overall = {
      improvements,
      regressions: total - improvements,
      verdict: improvements > total / 2 ? 'B is better' : 'A is better',
    };

    return comparison;
  }

  /**
   * Extract metadata from a run
   */
  extractMetadata(run) {
    if (run.manifest) {
      return {
        model: run.manifest.model,
        timestamp: run.manifest.timestamp,
        score: run.manifest.totalScore,
      };
    }
    return {
      model: run.model || 'unknown',
      timestamp: run.timestamp || new Date().toISOString(),
      score: run.summary?.compositeScore || run.compositeScore || 0,
    };
  }

  /**
   * Get a metric value from results
   */
  getMetricValue(run, key) {
    // Try manifest/summary first
    if (key === 'compositeScore') {
      return run.manifest?.totalScore || run.summary?.compositeScore || run.compositeScore || null;
    }

    // Search through hypothesis results
    const results = run.results || [];
    for (const r of results) {
      if (r.metrics) {
        if (key === 'accuracy' && r.metrics.accuracy) return r.metrics.accuracy.score;
        if (key === 'token_efficiency' && r.metrics.tokens) return r.metrics.tokens.efficiency;
        if (key === 'latency_p50' && r.metrics.timing) return r.metrics.timing.p50LatencyMs;
        if (key === 'latency_p95' && r.metrics.timing) return r.metrics.timing.p95LatencyMs;
        if (key === 'tool_accuracy' && r.metrics.accuracy) return r.metrics.accuracy.toolCallAccuracy;
        if (key === 'cost_per_task' && r.metrics.tokens) return r.metrics.tokens.estimatedCost.total;
      }
    }

    // Try summary
    if (run.summary) {
      for (const hs of (run.summary.hypothesisScores || [])) {
        if (hs.id && hs[key] !== undefined) return hs[key];
      }
    }

    return null;
  }

  /**
   * Format a value for display
   */
  formatValue(value, format) {
    if (format === 'percent') return `${(value * 100).toFixed(1)}%`;
    if (format === 'ms') return `${Math.round(value)}ms`;
    if (format === 'currency') return `$${value.toFixed(4)}`;
    if (format === 'decimal') return value.toFixed(3);
    return String(value);
  }

  /**
   * Render comparison as a table
   */
  renderTable(comparison) {
    const lines = [];
    lines.push('');
    lines.push('┌──────────────────┬──────────┬──────────┬──────────┬─────────┬───────────┐');
    lines.push('│ Metric           │ Run A    │ Run B    │ Delta    │ Δ%      │ Direction │');
    lines.push('├──────────────────┼──────────┼──────────┼──────────┼─────────┼───────────┤');

    for (const m of comparison.metrics) {
      const label = m.label.padEnd(16);
      const a = m.valueA.padStart(8);
      const b = m.valueB.padStart(8);
      const d = m.delta.padStart(8);
      const p = m.deltaPercent.padStart(7);
      const dir = m.improvement ? '    ↑ IMP' : '    ↓ REG';
      lines.push(`│ ${label} │ ${a} │ ${b} │ ${d} │ ${p} │${dir}  │`);
    }

    lines.push('└──────────────────┴──────────┴──────────┴──────────┴─────────┴───────────┘');
    lines.push('');
    lines.push(`Verdict: ${comparison.overall.verdict} (${comparison.overall.improvements}↑ ${comparison.overall.regressions}↓)`);

    return lines.join('\n');
  }
}

module.exports = { Comparator };
