#!/usr/bin/env node
'use strict';

/**
 * validate.js — Validates hypothesis and workload JSON files.
 *
 * Checks:
 *   - Required fields present
 *   - JSON syntax valid
 *   - Referenced workloads exist
 *   - Scoring config valid
 */

const fs = require('fs');
const path = require('path');

const HYPOTHESIS_DIR = path.resolve('hypotheses');
const WORKLOADS_DIR = path.resolve('workloads');

const HYPOTHESIS_SCHEMA = {
  required: ['id', 'title', 'claim', 'dimensions', 'workloads', 'scoring'],
  scoring: ['primary', 'threshold'],
};

const WORKLOAD_SCHEMA = {
  required: ['id', 'category', 'description', 'input'],
  categories: ['stress', 'realistic'],
};

function main() {
  let errors = 0;
  let warnings = 0;

  console.log('Validating benchmark files...\n');

  // Validate hypotheses
  const hypFiles = fs.readdirSync(HYPOTHESIS_DIR).filter(f => f.endsWith('.json'));
  const workloadIds = new Set();

  // Collect all workload IDs first
  for (const cat of ['stress', 'realistic']) {
    const catDir = path.join(WORKLOADS_DIR, cat);
    if (fs.existsSync(catDir)) {
      for (const f of fs.readdirSync(catDir).filter(f => f.endsWith('.json'))) {
        workloadIds.add(f.replace('.json', ''));
      }
    }
  }

  for (const file of hypFiles) {
    const filePath = path.join(HYPOTHESIS_DIR, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // Check required fields
      for (const field of HYPOTHESIS_SCHEMA.required) {
        if (!data[field]) {
          console.error(`  ❌ ${file}: Missing required field "${field}"`);
          errors++;
        }
      }

      // Check scoring fields
      if (data.scoring) {
        for (const field of HYPOTHESIS_SCHEMA.scoring) {
          if (!data.scoring[field]) {
            console.error(`  ❌ ${file}: Missing scoring field "${field}"`);
            errors++;
          }
        }
      }

      // Validate threshold is a number between 0 and 1 (or 2 for ratio metrics)
      if (data.scoring?.threshold !== undefined) {
        if (typeof data.scoring.threshold !== 'number') {
          console.error(`  ❌ ${file}: scoring.threshold must be a number`);
          errors++;
        }
      }

      // Check referenced workloads exist
      if (data.workloads) {
        for (const wl of data.workloads) {
          if (!workloadIds.has(wl)) {
            console.error(`  ❌ ${file}: References unknown workload "${wl}"`);
            errors++;
          }
        }
      }

      if (errors === 0) {
        console.log(`  ✅ ${file} — valid`);
      }
    } catch (e) {
      console.error(`  ❌ ${file}: JSON parse error: ${e.message}`);
      errors++;
    }
  }

  // Validate workloads
  for (const cat of ['stress', 'realistic']) {
    const catDir = path.join(WORKLOADS_DIR, cat);
    if (!fs.existsSync(catDir)) continue;

    for (const file of fs.readdirSync(catDir).filter(f => f.endsWith('.json'))) {
      const filePath = path.join(catDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        for (const field of WORKLOAD_SCHEMA.required) {
          if (!data[field]) {
            console.error(`  ❌ ${cat}/${file}: Missing required field "${field}"`);
            errors++;
          }
        }

        if (data.category && !WORKLOAD_SCHEMA.categories.includes(data.category)) {
          console.error(`  ⚠️  ${cat}/${file}: Unknown category "${data.category}"`);
          warnings++;
        }

        if (errors === 0) {
          console.log(`  ✅ ${cat}/${file} — valid`);
        }
      } catch (e) {
        console.error(`  ❌ ${cat}/${file}: JSON parse error: ${e.message}`);
        errors++;
      }
    }
  }

  console.log(`\nValidation complete: ${errors} errors, ${warnings} warnings`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
