'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { TimingCollector } = require('../../harness/collectors/timing');
const { TokenCollector } = require('../../harness/collectors/tokens');
const { AccuracyCollector } = require('../../harness/collectors/accuracy');
const { ResourceCollector } = require('../../harness/collectors/resource');

describe('TimingCollector', () => {
  it('measures basic timing', () => {
    const collector = new TimingCollector();
    collector.start();

    // Simulate some work
    const start = Date.now();
    while (Date.now() - start < 10) {}

    collector.stop();
    const metrics = collector.collect();

    assert.ok(metrics.timing.measurements >= 0);
    assert.ok(metrics.timing.totalDurationMs >= 0);
  });

  it('records named timers', () => {
    const collector = new TimingCollector();
    collector.start();

    collector.startTimer('test');
    // Simulate work
    const start = Date.now();
    while (Date.now() - start < 5) {}
    collector.stopTimer('test');

    collector.stop();
    const metrics = collector.collect();

    assert.equal(metrics.timing.measurements, 1);
    assert.ok(metrics.timing.avgLatencyMs >= 0);
  });

  it('computes percentiles', () => {
    const collector = new TimingCollector();
    collector.start();

    // Add known measurements
    for (let i = 1; i <= 100; i++) {
      collector.record('req', i);
    }

    collector.stop();
    const metrics = collector.collect();

    assert.equal(metrics.timing.p50LatencyMs, 50);
    assert.equal(metrics.timing.p95LatencyMs, 95);
    assert.equal(metrics.timing.p99LatencyMs, 99);
  });
});

describe('TokenCollector', () => {
  it('tracks token usage', () => {
    const collector = new TokenCollector();
    collector.start();

    collector.record({ promptTokens: 100, completionTokens: 50 });
    collector.record({ promptTokens: 200, completionTokens: 80 });

    collector.stop();
    const metrics = collector.collect();

    assert.equal(metrics.tokens.total.prompt, 300);
    assert.equal(metrics.tokens.total.completion, 130);
    assert.equal(metrics.tokens.requests, 2);
  });

  it('computes efficiency ratio', () => {
    const collector = new TokenCollector();
    collector.start();

    collector.record({ promptTokens: 1000, completionTokens: 500 });

    collector.stop();
    const metrics = collector.collect();

    assert.equal(metrics.tokens.efficiency, 0.3333);
  });

  it('estimates cost', () => {
    const collector = new TokenCollector();
    collector.start();

    collector.record({ promptTokens: 1_000_000, completionTokens: 1_000_000 });

    collector.stop();
    const metrics = collector.collect();

    assert.equal(metrics.tokens.estimatedCost.prompt, 2.5);
    assert.equal(metrics.tokens.estimatedCost.completion, 10);
    assert.equal(metrics.tokens.estimatedCost.total, 12.5);
  });
});

describe('AccuracyCollector', () => {
  it('evaluates tool call correctness', () => {
    const collector = new AccuracyCollector();
    collector.start();

    const result = collector.evaluate(
      { content: 'Here is the result', toolCalls: [{ name: 'query_db' }] },
      { expectedTools: ['query_db'], context: 'Here is the result' }
    );

    collector.stop();
    assert.ok(result.score > 0);
    assert.ok(result.toolCallCorrect > 0);
  });

  it('returns low score for empty response with expected tools', () => {
    const collector = new AccuracyCollector();
    collector.start();

    const result = collector.evaluate(
      { content: '', toolCalls: [] },
      { expectedTools: ['query_db'] }
    );

    collector.stop();
    // Empty content + missing expected tools → lower score
    assert.ok(result.score <= 0.7, `Expected <= 0.7, got ${result.score}`);
    assert.equal(result.toolCallCorrect, false);
  });
});

describe('ResourceCollector', () => {
  it('tracks memory usage', () => {
    const collector = new ResourceCollector();
    collector.start();

    // Allocate some memory
    const data = new Array(10000).fill('x'.repeat(100));

    collector.stop();
    const metrics = collector.collect();

    assert.ok(metrics.resource.memory.heapUsed > 0);
    assert.ok(metrics.resource.memory.rss > 0);

    // Keep reference to avoid GC
    void data;
  });
});
