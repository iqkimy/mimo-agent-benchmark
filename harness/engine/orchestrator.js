'use strict';

/**
 * Orchestrator — The central coordinator for benchmark runs.
 *
 * Responsibilities:
 *   1. Load hypotheses and resolve their workloads
 *   2. Pass execution to the Scheduler
 *   3. Collect results from Collectors
 *   4. Delegate rendering to Reporters
 *
 * Usage:
 *   const orchestrator = new Orchestrator(config);
 *   const results = await orchestrator.run();
 */

const fs = require('fs');
const path = require('path');
const { Scheduler } = require('./scheduler');
const { Executor } = require('./executor');
const { TimingCollector } = require('../collectors/timing');
const { TokenCollector } = require('../collectors/tokens');
const { AccuracyCollector } = require('../collectors/accuracy');
const { ResourceCollector } = require('../collectors/resource');

class Orchestrator {
  constructor(config = {}) {
    this.config = {
      iterations: config.iterations || 3,
      concurrency: config.concurrency || 1,
      timeout: config.timeout || 30000,
      verbose: config.verbose || false,
      hypotheses: config.hypotheses || null,  // null = all
      category: config.category || null,       // null = all
      model: config.model || 'mimo-v2.5',
      ...config,
    };

    this.resultsDir = path.resolve(config.resultsDir || 'results');
    this.hypothesesDir = path.resolve(config.hypothesesDir || 'hypotheses');
    this.workloadsDir = path.resolve(config.workloadsDir || 'workloads');

    this.adapter = null;
    this.collectors = [];
    this.reporters = [];
  }

  /**
   * Set the model adapter (mimo, openai, anthropic)
   */
  setAdapter(adapter) {
    this.adapter = adapter;
    return this;
  }

  /**
   * Add a metrics collector
   */
  addCollector(collector) {
    this.collectors.push(collector);
    return this;
  }

  /**
   * Add a result reporter
   */
  addReporter(reporter) {
    this.reporters.push(reporter);
    return this;
  }

  /**
   * Load all hypothesis files from the hypotheses directory
   */
  loadHypotheses() {
    const files = fs.readdirSync(this.hypothesesDir)
      .filter(f => f.endsWith('.json'));

    let hypotheses = files.map(f => {
      const content = fs.readFileSync(path.join(this.hypothesesDir, f), 'utf-8');
      return JSON.parse(content);
    });

    // Filter by specific hypothesis IDs if configured
    if (this.config.hypotheses) {
      const ids = Array.isArray(this.config.hypotheses)
        ? this.config.hypotheses
        : [this.config.hypotheses];
      hypotheses = hypotheses.filter(h => ids.includes(h.id));
    }

    if (this.config.verbose) {
      console.log(`[orchestrator] Loaded ${hypotheses.length} hypotheses`);
    }

    return hypotheses;
  }

  /**
   * Load a workload file by ID
   */
  loadWorkload(workloadId) {
    // Search in stress and realistic directories
    const categories = ['stress', 'realistic'];
    for (const cat of categories) {
      const filePath = path.join(this.workloadsDir, cat, `${workloadId}.json`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      }
    }
    throw new Error(`Workload not found: ${workloadId}`);
  }

  /**
   * Resolve workloads for a hypothesis
   */
  resolveWorkloads(hypothesis) {
    return hypothesis.workloads.map(id => this.loadWorkload(id));
  }

  /**
   * Run the full benchmark suite
   */
  async run() {
    const startTime = Date.now();
    const runId = new Date().toISOString().replace(/[:.]/g, '-');
    const runDir = path.join(this.resultsDir, runId);

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║           MiMo Agent Benchmark v0.1.0               ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    console.log(`Run ID:   ${runId}`);
    console.log(`Model:    ${this.config.model}`);
    console.log(`Iter:     ${this.config.iterations}`);
    console.log(`Timeout:  ${this.config.timeout}ms`);
    console.log('');

    // Create run directory
    fs.mkdirSync(runDir, { recursive: true });

    // Load hypotheses
    const hypotheses = this.loadHypotheses();
    if (hypotheses.length === 0) {
      console.error('No hypotheses to run. Check your --hypothesis filter.');
      process.exit(1);
    }

    // Initialize collectors
    this.collectors = [
      new TimingCollector(),
      new TokenCollector(),
      new ResourceCollector(),
    ];

    const allResults = [];

    for (const hypothesis of hypotheses) {
      console.log(`\n── Hypothesis: ${hypothesis.id} ──────────────────────────`);
      console.log(`   ${hypothesis.title}`);

      const workloads = this.resolveWorkloads(hypothesis);
      const hypothesisResults = {
        hypothesis: hypothesis.id,
        title: hypothesis.title,
        claim: hypothesis.claim,
        dimensions: hypothesis.dimensions,
        scoring: hypothesis.scoring,
        workloads: [],
        timestamp: new Date().toISOString(),
      };

      for (const workload of workloads) {
        console.log(`   Workload: ${workload.id} (${workload.category})`);

        // Start collectors
        for (const collector of this.collectors) {
          collector.start();
        }

        const executor = new Executor({
          adapter: this.adapter,
          workload,
          hypothesis,
          iterations: this.config.iterations,
          timeout: this.config.timeout,
          verbose: this.config.verbose,
        });

        const workloadResult = await executor.run();

        // Stop collectors and gather metrics
        const metrics = {};
        for (const collector of this.collectors) {
          collector.stop();
          Object.assign(metrics, collector.collect());
        }

        hypothesisResults.workloads.push({
          id: workload.id,
          category: workload.category,
          result: workloadResult,
          metrics,
        });

        const pass = this.evaluateHypothesis(hypothesis, workloadResult, metrics);
        console.log(`   → ${pass ? '✅ PASS' : '❌ FAIL'} (score: ${workloadResult.score?.toFixed(3) || 'N/A'})`);
      }

      // Compute composite score
      hypothesisResults.score = this.computeCompositeScore(
        hypothesis,
        hypothesisResults.workloads
      );
      hypothesisResults.status = hypothesisResults.score >= (hypothesis.scoring.threshold || 0.85)
        ? 'PASS' : 'FAIL';

      allResults.push(hypothesisResults);

      // Save per-hypothesis result
      const hypFile = path.join(runDir, `${hypothesis.id}.json`);
      fs.writeFileSync(hypFile, JSON.stringify(hypothesisResults, null, 2));
    }

    // Compute summary
    const summary = this.computeSummary(allResults);
    const summaryFile = path.join(runDir, 'summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

    // Save manifest
    const manifest = {
      runId,
      model: this.config.model,
      hypothesesRun: allResults.length,
      totalScore: summary.compositeScore,
      status: summary.overallStatus,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // Update latest symlink
    const latestPath = path.join(this.resultsDir, 'latest');
    try {
      fs.unlinkSync(latestPath);
    } catch {}
    try {
      fs.symlinkSync(runDir, latestPath, 'junction');
    } catch {}

    // Run reporters
    for (const reporter of this.reporters) {
      reporter.render({ summary, results: allResults, manifest, runDir });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n╔══════════════════════════════════════════════════════╗`);
    console.log(`║  Benchmark Complete  |  ${duration}s  |  ${summary.overallStatus}          ║`);
    console.log(`║  Composite Score: ${summary.compositeScore.toFixed(3)}                              ║`);
    console.log(`║  Results: ${runDir}`);
    console.log(`╚══════════════════════════════════════════════════════╝\n`);

    return { summary, results: allResults, manifest, runDir };
  }

  /**
   * Evaluate whether a hypothesis passed based on results
   */
  evaluateHypothesis(hypothesis, workloadResult, metrics) {
    if (!workloadResult.score && workloadResult.score !== 0) return false;
    const threshold = hypothesis.scoring?.threshold || 0.85;
    const direction = hypothesis.scoring?.direction || 'above';

    if (direction === 'above') {
      return workloadResult.score >= threshold;
    } else {
      return workloadResult.score <= threshold;
    }
  }

  /**
   * Compute composite score from workload results
   */
  computeCompositeScore(hypothesis, workloadResults) {
    if (workloadResults.length === 0) return 0;
    const scores = workloadResults
      .map(w => w.result?.score)
      .filter(s => s !== undefined && s !== null);
    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * Compute overall summary
   */
  computeSummary(results) {
    const scores = results.map(r => r.score).filter(s => s !== undefined);
    const compositeScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    const passed = results.filter(r => r.status === 'PASS').length;
    const total = results.length;

    return {
      compositeScore,
      overallStatus: passed === total ? 'PASS' : 'PARTIAL',
      passed,
      total,
      hypothesisScores: results.map(r => ({
        id: r.hypothesis,
        score: r.score,
        status: r.status,
      })),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { Orchestrator };
