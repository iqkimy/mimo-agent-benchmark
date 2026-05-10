# Contributing to MiMo Agent Benchmark

Thank you for your interest in improving agent benchmarking! Here's how to contribute.

## Development Setup

```bash
git clone git@github.com:iqkimy/mimo-agent-benchmark.git
cd mimo-agent-benchmark
npm install
cp .env.example .env  # Add your API keys
```

## Project Architecture

```
hypotheses/          → What we're testing (JSON test plans)
workloads/           → How we test it (input definitions)
harness/             → The engine that runs tests
scoring/             → How we evaluate results
scripts/             → CLI entry points
results/             → Output artifacts (gitignored)
```

## Adding a New Hypothesis

1. Create `hypotheses/h<N>-<name>.json` following the schema:
```json
{
  "id": "h<N>",
  "title": "Short title",
  "claim": "The hypothesis being tested",
  "dimensions": ["latency", "accuracy"],
  "workloads": ["<workload-id>"],
  "scoring": { "primary": "metric-name", "threshold": 0.85 }
}
```

2. Add matching workload definitions in `workloads/`
3. Implement the scenario adapter if needed
4. Run the benchmark and verify results

## Adding a New Workload

Workload definitions live in `workloads/{stress,realistic}/`. Each is a JSON file:

```json
{
  "id": "unique-id",
  "category": "stress|realistic",
  "description": "What this workload tests",
  "params": {
    "contextLength": 8000,
    "toolCalls": 5,
    "iterations": 3
  },
  "input": { "prompt": "...", "tools": [...] },
  "expected": { "minTools": 3, "maxLatencyMs": 5000 }
}
```

## Adding a New Collector

Collectors live in `harness/collectors/`. Each exports:
- `start()` — Begin measurement
- `stop()` — End measurement  
- `collect()` — Return metrics object

## Adding a New Reporter

Reporters live in `harness/reporters/`. Each exports:
- `render(results)` — Output results in the reporter's format

## Running Tests

```bash
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm run test:coverage       # With coverage
```

## Code Style

- Node.js (CommonJS for now)
- No external dependencies beyond the adapter
- Keep harness core zero-dependency
- Use `console` for logging (harness respects verbosity flags)

## Pull Request Guidelines

- Keep PRs focused — one hypothesis or workload per PR
- Include benchmark results for performance-related changes
- Update README if adding new features
- Add tests for new collectors or reporters

## Benchmarks on PR

The CI automatically runs a lightweight benchmark suite on every PR. Full benchmarks run nightly on `main`.
