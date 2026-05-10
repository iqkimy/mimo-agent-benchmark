#!/usr/bin/env node

/**
 * MiMo Agent Benchmark - Runner
 *
 * Executes workload definitions against MiMo endpoints and records results.
 *
 * Usage:
 *   node run.js                     # run all workloads
 *   node run.js --workload long-context  # run one workload
 *   node run.js --report            # generate report from latest results
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKLOADS_DIR = join(__dirname, 'workloads');
const RESULTS_DIR = join(__dirname, 'results');

function loadWorkloads() {
  const dirs = readdirSync(WORKLOADS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  return dirs.map((d) => {
    const def = JSON.parse(readFileSync(join(WORKLOADS_DIR, d.name, 'definition.json'), 'utf8'));
    return def;
  });
}

async function runWorkload(workload) {
  console.log(`\n▸ Running: ${workload.name}`);
  console.log(`  ${workload.description}`);

  const results = [];
  const iterations = workload.params.iterations || 10;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      // TODO: Replace with real MiMo API call
      throw new Error('MiMo API not configured');
    } catch (err) {
      results.push({
        iteration: i,
        success: false,
        error: err.message,
        duration: performance.now() - start,
      });
    }
  }

  return {
    workload: workload.id,
    name: workload.name,
    timestamp: new Date().toISOString(),
    iterations,
    results,
  };
}

function saveResult(result) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const filename = `${result.workload}-${Date.now()}.json`;
  writeFileSync(join(RESULTS_DIR, filename), JSON.stringify(result, null, 2));
  console.log(`  ✓ Saved: results/${filename}`);
}

async function main() {
  const args = process.argv.slice(2);
  const workloadFilter = args.includes('--workload') ? args[args.indexOf('--workload') + 1] : null;

  const workloads = loadWorkloads();
  const toRun = workloadFilter ? workloads.filter((w) => w.id === workloadFilter) : workloads;

  console.log(`MiMo Agent Benchmark`);
  console.log(`Running ${toRun.length} workload(s)...\n`);

  for (const workload of toRun) {
    const result = await runWorkload(workload);
    saveResult(result);
  }

  console.log('\nDone.');
}

main().catch((err) => { console.error(err); process.exit(1); });
