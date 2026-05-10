'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// We test the orchestrator by running a dry-run benchmark
const { Orchestrator } = require('../../harness/engine/orchestrator');

describe('Orchestrator', () => {
  it('loads hypotheses from directory', () => {
    const orchestrator = new Orchestrator({
      hypothesesDir: path.resolve('hypotheses'),
      workloadsDir: path.resolve('workloads'),
    });

    const hypotheses = orchestrator.loadHypotheses();
    assert.ok(hypotheses.length > 0, 'Should load at least one hypothesis');
    assert.ok(hypotheses[0].id, 'Hypothesis should have an id');
    assert.ok(hypotheses[0].title, 'Hypothesis should have a title');
    assert.ok(hypotheses[0].workloads, 'Hypothesis should have workloads');
  });

  it('filters hypotheses by ID', () => {
    const orchestrator = new Orchestrator({
      hypotheses: ['h1'],
      hypothesesDir: path.resolve('hypotheses'),
      workloadsDir: path.resolve('workloads'),
    });

    const hypotheses = orchestrator.loadHypotheses();
    assert.equal(hypotheses.length, 1);
    assert.equal(hypotheses[0].id, 'h1');
  });

  it('loads workload files', () => {
    const orchestrator = new Orchestrator({
      hypothesesDir: path.resolve('hypotheses'),
      workloadsDir: path.resolve('workloads'),
    });

    const workload = orchestrator.loadWorkload('context-flood');
    assert.equal(workload.id, 'context-flood');
    assert.equal(workload.category, 'stress');
    assert.ok(workload.input, 'Workload should have input');
    assert.ok(workload.expected, 'Workload should have expected');
  });

  it('resolves workloads for a hypothesis', () => {
    const orchestrator = new Orchestrator({
      hypothesesDir: path.resolve('hypotheses'),
      workloadsDir: path.resolve('workloads'),
    });

    const hypotheses = orchestrator.loadHypotheses();
    const h1 = hypotheses.find(h => h.id === 'h1');
    const workloads = orchestrator.resolveWorkloads(h1);

    assert.ok(workloads.length > 0, 'h1 should have at least one workload');
    assert.equal(workloads[0].id, 'context-flood');
  });

  it('computes composite score correctly', () => {
    const orchestrator = new Orchestrator();
    const hypothesis = { scoring: { threshold: 0.85 } };
    const workloadResults = [
      { result: { score: 0.9 } },
      { result: { score: 0.8 } },
    ];

    const score = orchestrator.computeCompositeScore(hypothesis, workloadResults);
    assert.ok(Math.abs(score - 0.85) < 0.001, `Expected ~0.85, got ${score}`);
  });

  it('computes summary correctly', () => {
    const orchestrator = new Orchestrator();
    const results = [
      { hypothesis: 'h1', score: 0.9, status: 'PASS' },
      { hypothesis: 'h2', score: 0.8, status: 'FAIL' },
    ];

    const summary = orchestrator.computeSummary(results);
    assert.equal(summary.passed, 1);
    assert.equal(summary.total, 2);
    assert.equal(summary.overallStatus, 'PARTIAL');
    assert.ok(Math.abs(summary.compositeScore - 0.85) < 0.001);
  });
});
