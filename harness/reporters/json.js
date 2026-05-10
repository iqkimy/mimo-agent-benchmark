'use strict';

/**
 * JSONReporter — Writes structured JSON results to the run directory.
 */

const fs = require('fs');
const path = require('path');

class JSONReporter {
  constructor(config = {}) {
    this.outputDir = config.outputDir || 'results';
  }

  render({ summary, results, manifest, runDir }) {
    const outputDir = runDir || this.outputDir;

    // Summary is already written by orchestrator, but we can add an enriched version
    const enrichedSummary = {
      ...summary,
      manifest,
      hypothesisDetails: results.map(r => ({
        id: r.hypothesis,
        title: r.title,
        score: r.score,
        status: r.status,
        dimensions: r.dimensions,
        workloads: r.workloads?.map(w => ({
          id: w.id,
          category: w.category,
          score: w.result?.score,
          metrics: w.metrics,
        })),
      })),
    };

    fs.writeFileSync(
      path.join(outputDir, 'summary-enriched.json'),
      JSON.stringify(enrichedSummary, null, 2)
    );
  }
}

module.exports = { JSONReporter };
