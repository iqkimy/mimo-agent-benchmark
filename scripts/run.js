#!/usr/bin/env node
'use strict';

/**
 * run.js — Main CLI entry point for running benchmarks.
 *
 * Usage:
 *   node scripts/run.js [options]
 *
 * Options:
 *   --config <path>       Load config from JSON file
 *   --hypothesis <id>     Run specific hypothesis (e.g., h1, h2)
 *   --category <type>     Filter by category (stress, realistic)
 *   --iterations <n>      Number of iterations per test (default: 3)
 *   --model <name>        Model to benchmark (default: mimo-v2.5)
 *   --concurrency <n>     Parallel request slots (default: 1)
 *   --timeout <ms>        Per-request timeout (default: 30000)
 *   --verbose             Enable detailed output
 *   --adapter <type>      Adapter: mimo, openai, anthropic (default: mimo)
 *   --baseline <path>     Compare against baseline results
 *   --dry-run             Run without making API calls (uses mock responses)
 */

const path = require('path');
const fs = require('fs');

// Load .env if present
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  }
} catch {}

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    iterations: 3,
    concurrency: 1,
    timeout: 30000,
    verbose: false,
    adapter: 'mimo',
    model: 'mimo-v2.5',
    dryRun: false,
    hypotheses: null,
    category: null,
    baseline: null,
    configFile: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config':
        config.configFile = args[++i];
        break;
      case '--hypothesis':
        config.hypotheses = args[++i];
        break;
      case '--category':
        config.category = args[++i];
        break;
      case '--iterations':
        config.iterations = parseInt(args[++i]);
        break;
      case '--model':
        config.model = args[++i];
        break;
      case '--concurrency':
        config.concurrency = parseInt(args[++i]);
        break;
      case '--timeout':
        config.timeout = parseInt(args[++i]);
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--adapter':
        config.adapter = args[++i];
        break;
      case '--baseline':
        config.baseline = args[++i];
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  // Load config file if specified
  if (config.configFile) {
    const configPath = path.resolve(config.configFile);
    if (fs.existsSync(configPath)) {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      Object.assign(config, fileConfig);
    } else {
      console.error(`Config file not found: ${configPath}`);
      process.exit(1);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
MiMo Agent Benchmark — Run Benchmark Suite

Usage: node scripts/run.js [options]

Options:
  --config <path>       Load config from JSON file
  --hypothesis <id>     Run specific hypothesis (h1-h5)
  --category <type>     Filter by category (stress, realistic)
  --iterations <n>      Iterations per test (default: 3)
  --model <name>        Model to benchmark (default: mimo-v2.5)
  --concurrency <n>     Parallel request slots (default: 1)
  --timeout <ms>        Per-request timeout (default: 30000)
  --verbose             Enable detailed output
  --adapter <type>      Adapter: mimo, openai, anthropic (default: mimo)
  --baseline <path>     Compare against baseline results
  --dry-run             Run without API calls (mock responses)

Examples:
  node scripts/run.js
  node scripts/run.js --hypothesis h1 --iterations 5
  node scripts/run.js --config workloads/reference/ci.json
  node scripts/run.js --adapter openai --model gpt-4o --verbose
  node scripts/run.js --dry-run
`);
}

// Main
async function main() {
  const config = parseArgs();

  console.log(`\nMiMo Agent Benchmark v0.1.0`);
  console.log(`Adapter: ${config.adapter} | Model: ${config.model}`);
  console.log(`Iterations: ${config.iterations} | Timeout: ${config.timeout}ms`);
  if (config.dryRun) console.log('Mode: DRY RUN (mock responses)');

  // Initialize adapter
  let adapter = null;
  if (!config.dryRun) {
    try {
      switch (config.adapter) {
        case 'mimo': {
          const { MiMoAdapter } = require('../harness/adapters/mimo');
          adapter = new MiMoAdapter(config);
          break;
        }
        case 'openai': {
          const { OpenAIAdapter } = require('../harness/adapters/openai');
          adapter = new OpenAIAdapter(config);
          break;
        }
        case 'anthropic': {
          const { AnthropicAdapter } = require('../harness/adapters/anthropic');
          adapter = new AnthropicAdapter(config);
          break;
        }
        default:
          console.error(`Unknown adapter: ${config.adapter}`);
          process.exit(1);
      }
    } catch (error) {
      console.error(`Failed to initialize adapter: ${error.message}`);
      console.error('Use --dry-run for mock responses without API access.');
      process.exit(1);
    }
  }

  // Import and run orchestrator
  const { Orchestrator } = require('../harness/engine/orchestrator');
  const { ConsoleReporter } = require('../harness/reporters/console');
  const { JSONReporter } = require('../harness/reporters/json');
  const { MarkdownReporter } = require('../harness/reporters/markdown');
  const { ChartReporter } = require('../harness/reporters/chart');

  const orchestrator = new Orchestrator({
    ...config,
    resultsDir: path.resolve('results'),
    hypothesesDir: path.resolve('hypotheses'),
    workloadsDir: path.resolve('workloads'),
  });

  if (adapter) {
    orchestrator.setAdapter(adapter);
  }

  orchestrator
    .addReporter(new ConsoleReporter({ verbose: config.verbose }))
    .addReporter(new JSONReporter())
    .addReporter(new MarkdownReporter())
    .addReporter(new ChartReporter());

  try {
    const result = await orchestrator.run();

    // Compare with baseline if specified
    if (config.baseline) {
      const { Comparator } = require('../scoring/comparison');
      const comparator = new Comparator();

      const baselinePath = path.resolve(config.baseline);
      const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
      const comparison = comparator.compare(result, baseline);

      console.log(comparator.renderTable(comparison));

      // Save comparison
      const compPath = path.join(result.runDir, 'comparison.json');
      fs.writeFileSync(compPath, JSON.stringify(comparison, null, 2));
    }

    process.exit(result.summary.overallStatus === 'PASS' ? 0 : 1);
  } catch (error) {
    console.error(`\nBenchmark failed: ${error.message}`);
    if (config.verbose) console.error(error.stack);
    process.exit(1);
  }
}

main();
