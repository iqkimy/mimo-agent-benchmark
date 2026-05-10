import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scenarios } from '../src/benchmark/scenarios/index.js';
import { LatencyProfiler } from '../src/profiler/latency/index.js';

describe('scenarios', () => {
  it('has at least one scenario', () => {
    assert.ok(Object.keys(scenarios).length > 0);
  });

  it('each scenario has required fields', () => {
    for (const [key, scenario] of Object.entries(scenarios)) {
      assert.ok(scenario.name, `Scenario "${key}" missing name`);
      assert.ok(scenario.config, `Scenario "${key}" missing config`);
      assert.equal(typeof scenario.generatePrompt, 'function', `Scenario "${key}" missing generatePrompt`);
      assert.equal(typeof scenario.evaluate, 'function', `Scenario "${key}" missing evaluate`);
    }
  });
});

describe('LatencyProfiler', () => {
  it('can be instantiated', () => {
    const profiler = new LatencyProfiler();
    assert.ok(profiler);
    assert.equal(profiler.results.length, 0);
  });

  it('returns null stats with no results', () => {
    const profiler = new LatencyProfiler();
    assert.equal(profiler.getStats(), null);
  });

  it('export returns structured data', () => {
    const profiler = new LatencyProfiler();
    const exported = profiler.export();
    assert.ok(exported.results);
    assert.ok(exported.exportedAt);
  });
});
