/**
 * Benchmark Runner
 */
import { scenarios } from '../scenarios/index.js';
import { LatencyProfiler } from '../../profiler/latency/index.js';

export class BenchmarkRunner {
  constructor(config) {
    this.config = config;
    this.profiler = new LatencyProfiler();
    this.results = [];
  }

  async runAll() {
    const scenarioNames = this.config.benchmark.scenarios;
    for (const name of scenarioNames) {
      if (!scenarios[name]) continue;
      const scenarioResults = await this._runScenario(name, scenarios[name]);
      this.results.push({ scenario: name, results: scenarioResults });
    }
    return this.getSummary();
  }

  async _runScenario(name, scenario) {
    const results = [];
    const iterations = scenario.config.iterations ?? 10;
    for (let i = 0; i < iterations; i++) {
      const prompt = scenario.generatePrompt(scenario.config.targetTokens?.[0] ?? scenario.config.toolCounts?.[0] ?? null);
      const result = await this.profiler.profile(() => this._makeAPICall(prompt), { scenario: name, iteration: i });
      const evaluation = scenario.evaluate(result);
      results.push({ ...result, evaluation });
    }
    return results;
  }

  async _makeAPICall(prompt) {
    throw new Error('API call not configured. Set MIMO_API_KEY in config.json');
  }

  getSummary() {
    const stats = this.profiler.getStats();
    return {
      totalScenarios: this.results.length,
      totalRuns: this.results.reduce((sum, r) => sum + r.results.length, 0),
      stats,
      scenarioSummaries: this.results.map(r => ({
        name: r.scenario,
        count: r.results.length,
        errors: r.results.filter(x => x.error).length,
      })),
    };
  }
}

export default BenchmarkRunner;
