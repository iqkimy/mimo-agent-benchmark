#!/usr/bin/env node
'use strict';

/**
 * compare.js — Compare two benchmark runs side by side.
 *
 * Usage:
 *   node scripts/compare.js <runA.json> <runB.json>
 *
 * Reads summary/summary-enriched.json from each run directory
 * and outputs a comparison table.
 */

const fs = require('fs');
const path = require('path');
const { Comparator } = require('../scoring/comparison');

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node scripts/compare.js <runA-path> <runB-path>');
    console.error('');
    console.error('Examples:');
    console.error('  node scripts/compare.js results/2026-05-10 results/2026-05-11');
    console.error('  node scripts/compare.js results/latest results/baseline.json');
    process.exit(1);
  }

  const pathA = path.resolve(args[0]);
  const pathB = path.resolve(args[1]);

  // Load run data
  const runA = loadRunData(pathA);
  const runB = loadRunData(pathB);

  if (!runA) {
    console.error(`Could not load run data from: ${pathA}`);
    process.exit(1);
  }
  if (!runB) {
    console.error(`Could not load run data from: ${pathB}`);
    process.exit(1);
  }

  // Compare
  const comparator = new Comparator();
  const comparison = comparator.compare(runA, runB);

  // Render
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║           BENCHMARK COMPARISON                       ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\n  Run A: ${comparison.runA.model} (${comparison.runA.timestamp})`);
  console.log(`  Run B: ${comparison.runB.model} (${comparison.runB.timestamp})`);

  console.log(comparator.renderTable(comparison));

  // Save comparison to Run B directory
  const outputDir = pathA.endsWith('.json') ? path.dirname(pathA) : pathA;
  const compPath = path.join(outputDir, 'comparison-vs-' + path.basename(pathB, '.json') + '.json');
  fs.writeFileSync(compPath, JSON.stringify(comparison, null, 2));
  console.log(`\nComparison saved to: ${compPath}`);
}

function loadRunData(runPath) {
  // Try loading as a file
  if (fs.existsSync(runPath) && fs.statSync(runPath).isFile()) {
    return JSON.parse(fs.readFileSync(runPath, 'utf-8'));
  }

  // Try loading summary from directory
  const summaryPath = path.join(runPath, 'summary.json');
  if (fs.existsSync(summaryPath)) {
    return JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
  }

  // Try enriched summary
  const enrichedPath = path.join(runPath, 'summary-enriched.json');
  if (fs.existsSync(enrichedPath)) {
    return JSON.parse(fs.readFileSync(enrichedPath, 'utf-8'));
  }

  // Try manifest
  const manifestPath = path.join(runPath, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  return null;
}

main();
