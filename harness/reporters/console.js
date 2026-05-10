'use strict';

/**
 * ConsoleReporter — Pretty-prints benchmark results to the terminal.
 */

class ConsoleReporter {
  constructor(config = {}) {
    this.verbose = config.verbose || false;
  }

  render({ summary, results, manifest }) {
    console.log('\n┌──────────────────────────────────────────────────────┐');
    console.log('│                  BENCHMARK RESULTS                   │');
    console.log('├──────────────────────────────────────────────────────┤');
    console.log(`│  Model:       ${(manifest.model || 'unknown').padEnd(36)}│`);
    console.log(`│  Duration:    ${((manifest.duration / 1000).toFixed(1) + 's').padEnd(36)}│`);
    console.log(`│  Status:      ${manifest.status.padEnd(36)}│`);
    console.log(`│  Score:       ${summary.compositeScore.toFixed(3).padEnd(36)}│`);
    console.log('└──────────────────────────────────────────────────────┘');

    console.log('\n  Hypothesis Results:');
    console.log('  ┌──────┬──────────┬────────┬────────────────────────┐');
    console.log('  │ ID   │ Score    │ Status │ Title                  │');
    console.log('  ├──────┼──────────┼────────┼────────────────────────┤');

    for (const result of results) {
      const id = (result.hypothesis || '').padEnd(4);
      const score = (result.score?.toFixed(3) || 'N/A').padStart(8);
      const status = (result.status === 'PASS' ? '✅ PASS' : '❌ FAIL').padEnd(6);
      const title = (result.title || '').substring(0, 22).padEnd(22);
      console.log(`  │ ${id} │ ${score} │ ${status} │ ${title} │`);
    }

    console.log('  └──────┴──────────┴────────┴────────────────────────┘');

    if (this.verbose) {
      console.log('\n  Detailed Metrics:');
      for (const result of results) {
        if (result.workloads) {
          for (const wl of result.workloads) {
            if (wl.metrics?.timing) {
              const t = wl.metrics.timing;
              console.log(`\n  ${result.hypothesis}/${wl.id}:`);
              console.log(`    Latency P50: ${t.p50LatencyMs}ms | P95: ${t.p95LatencyMs}ms`);
              console.log(`    Throughput:  ${t.throughput} req/s`);
            }
            if (wl.metrics?.tokens) {
              const tk = wl.metrics.tokens;
              console.log(`    Tokens:      ${tk.total.total} total (${tk.total.prompt} prompt + ${tk.total.completion} completion)`);
              console.log(`    Cost:        $${tk.estimatedCost.total.toFixed(4)}`);
            }
          }
        }
      }
    }

    console.log('');
  }
}

module.exports = { ConsoleReporter };
