'use strict';

/**
 * ChartReporter — Generates ASCII chart data from benchmark results.
 *
 * Outputs simple text-based visualizations for terminal display.
 */

class ChartReporter {
  constructor(config = {}) {
    this.width = config.width || 60;
  }

  render({ summary, results }) {
    console.log('\n  Score Distribution:');
    console.log('  ─────────────────────────────────────────────────');

    for (const result of results) {
      const score = result.score || 0;
      const barLength = Math.round(score * this.width);
      const bar = '█'.repeat(barLength) + '░'.repeat(this.width - barLength);
      const label = `${result.hypothesis}`.padEnd(4);
      const value = score.toFixed(3).padStart(6);
      console.log(`  ${label} │${bar}│ ${value}`);
    }

    console.log('  ─────────────────────────────────────────────────');
    console.log(`  ${''.padEnd(4)} │${'─'.repeat(this.width)}│`);
    console.log(`  ${''.padEnd(4)} 0${''.padEnd(this.width - 3)}0.5${''.padEnd(this.width - 3)}1.0`);
    console.log('');

    // Composite score
    const composite = summary.compositeScore;
    const compositeBar = '▓'.repeat(Math.round(composite * this.width));
    console.log(`  Composite: ${compositeBar} ${composite.toFixed(3)}`);
    console.log('');
  }
}

module.exports = { ChartReporter };
