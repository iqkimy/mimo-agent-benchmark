# Claude Code Prompt - Benchmark Development

You are working on the MiMo Agent Benchmark project.

## Objective

Add or improve benchmark scenarios that test MiMo-V2.5 performance in real-world Agent workloads.

## Rules

- Each scenario must have a clear `buildPrompt` function and `evaluate` function
- Metrics must be measurable from streaming API responses
- Keep scenarios independent (no shared state between iterations)
- Test your changes with `npm test` before committing

## Scenario Design

A good benchmark scenario:
1. Targets a specific MiMo performance characteristic
2. Has parameterized variations (e.g., context sizes, tool counts)
3. Produces quantifiable metrics
4. Can be compared against future runs for regression detection

## Output Format

When creating a new scenario:
1. Scenario definition with id, name, config, buildPrompt, evaluate
2. Corresponding test in test/benchmark.test.js
3. Documentation in docs/metrics.md if adding new metrics
