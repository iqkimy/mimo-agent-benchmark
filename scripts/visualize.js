#!/usr/bin/env node
'use strict';

/**
 * visualize.js — Generate visualization data from benchmark results.
 *
 * Usage:
 *   node scripts/visualize.js [run-dir]
 *
 * Reads results from the specified run directory (or latest)
 * and outputs formatted charts and statistics.
 */

const fs = require('fs');
const path = require('path');

function main() {
  const runDir = process.argv[2] || 'results/latest';
  const resolvedDir = path.resolve(runDir);

  if (!fs.existsSync(resolvedDir)) {
    console.error(`Run directory not found: ${resolvedDir}`);
    console.error('Run a benchmark first: node scripts/run.js');
    process.exit(1);
  }

  const manifest = loadJSON(path.join(resolvedDir, 'manifest.json'));
  const summary = loadJSON(path.join(resolvedDir, 'summary.json'));

  if (!manifest || !summary) {
    console.error('Invalid run directory: missing manifest.json or summary.json');
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║        MiMo Agent Benchmark — Visualization         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\n  Run: ${manifest.runId}`);
  console.log(`  Model: ${manifest.model}`);
  console.log(`  Status: ${manifest.status}`);

  // Load hypothesis results
  const hypothesisFiles = fs.readdirSync(resolvedDir)
    .filter(f => f.startsWith('h') && f.endsWith('.json'));

  console.log('\n  ┌──────────────────────────────────────────────────┐');
  console.log('  │              HYPOTHESIS SCORES                    │');
  console.log('  ├──────┬───────────────────────────────────────────┤');

  for (const file of hypothesisFiles) {
    const data = loadJSON(path.join(resolvedDir, file));
    if (!data) continue;

    const id = (data.hypothesis || file.replace('.json', '')).padEnd(4);
    const score = data.score?.toFixed(3) || 'N/A';
    const status = data.status === 'PASS' ? '✅' : '❌';

    // Build bar
    const barWidth = 30;
    const scoreVal = data.score || 0;
    const filled = Math.round(scoreVal * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

    console.log(`  │ ${id} │ ${bar} ${score.padStart(6)} ${status} │`);
  }

  console.log('  └──────┴───────────────────────────────────────────┘');

  // Overall score
  const composite = summary.compositeScore || 0;
  const compositeBar = '█'.repeat(Math.round(composite * 40)) + '░'.repeat(40 - Math.round(composite * 40));
  console.log(`\n  Composite: ${compositeBar} ${composite.toFixed(3)}`);
  console.log('');

  // Summary stats
  if (summary.hypothesisScores) {
    console.log('  Summary:');
    console.log(`    Passed: ${summary.passed}/${summary.total}`);
    console.log(`    Overall: ${summary.overallStatus}`);
  }
}

function loadJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

main();
