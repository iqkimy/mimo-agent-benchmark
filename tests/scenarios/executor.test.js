'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { Executor } = require('../../harness/engine/executor');

describe('Executor', () => {
  const mockAdapter = null; // Will use mock responses

  it('executes context-flood workload', async () => {
    const workload = JSON.parse(
      fs.readFileSync(path.resolve('workloads/stress/context-flood.json'), 'utf-8')
    );
    const hypothesis = JSON.parse(
      fs.readFileSync(path.resolve('hypotheses/h1-context-degradation.json'), 'utf-8')
    );

    const executor = new Executor({
      adapter: mockAdapter,
      workload,
      hypothesis,
      iterations: 2,
      timeout: 5000,
      verbose: false,
    });

    const result = await executor.run();

    assert.equal(result.workloadId, 'context-flood');
    assert.equal(result.iterations.length, 2);
    assert.ok(typeof result.score === 'number');
    assert.ok(result.metrics);
    assert.ok(result.metrics.tokens);
  });

  it('executes tool-avalanche workload', async () => {
    const workload = JSON.parse(
      fs.readFileSync(path.resolve('workloads/stress/tool-avalanche.json'), 'utf-8')
    );
    const hypothesis = JSON.parse(
      fs.readFileSync(path.resolve('hypotheses/h2-tool-routing.json'), 'utf-8')
    );

    const executor = new Executor({
      adapter: mockAdapter,
      workload,
      hypothesis,
      iterations: 1,
      timeout: 5000,
      verbose: false,
    });

    const result = await executor.run();

    assert.equal(result.workloadId, 'tool-avalanche');
    assert.equal(result.iterations.length, 1);
    assert.ok(result.score >= 0);
  });

  it('builds tool definitions correctly', () => {
    const workload = JSON.parse(
      fs.readFileSync(path.resolve('workloads/stress/tool-avalanche.json'), 'utf-8')
    );
    const hypothesis = JSON.parse(
      fs.readFileSync(path.resolve('hypotheses/h2-tool-routing.json'), 'utf-8')
    );

    const executor = new Executor({
      adapter: mockAdapter,
      workload,
      hypothesis,
      iterations: 1,
      timeout: 5000,
    });

    const testInput = executor.buildTestInput();

    assert.ok(testInput.tools.length > 0, 'Should generate tool definitions');
    assert.ok(testInput.tools[0].function, 'Tools should have function property');
    assert.ok(testInput.tools[0].function.name, 'Tool should have a name');
  });

  it('handles errors gracefully', async () => {
    const errorAdapter = {
      complete: () => { throw new Error('API Error'); },
    };

    const workload = {
      id: 'test-error',
      input: { prompt: 'test' },
      params: { iterations: 1 },
    };
    const hypothesis = { id: 'h-test', scoring: { threshold: 0.5 } };

    const executor = new Executor({
      adapter: errorAdapter,
      workload,
      hypothesis,
      iterations: 2,
      timeout: 5000,
    });

    const result = await executor.run();

    assert.equal(result.score, 0);
    assert.ok(result.iterations[0].errors.length > 0);
  });
});
