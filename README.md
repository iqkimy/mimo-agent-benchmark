# MiMo Agent Benchmark

Automated performance testing for Xiaomi MiMo-V2.5 across realistic AI Agent workloads.

[![CI](https://github.com/iqkimy/mimo-agent-benchmark/actions/workflows/ci.yml/badge.svg)](https://github.com/iqkimy/mimo-agent-benchmark/actions)

---

## Why Build This

Agent frameworks like OpenClaw and Claude Code are adopting MiMo-V2.5 at scale. But there's no public data on how MiMo actually performs under the kind of workloads these frameworks generate: long sessions with growing context, dozens of tool calls per turn, multi-agent parallelism, and hours of continuous operation.

This benchmark suite generates that data. Run it, get numbers, make informed decisions about MiMo configuration and optimization priorities.

## What Gets Tested

Five workload patterns, each designed to stress a different part of the MiMo inference stack:

**Long Context** — Pushes conversations from 32K to 128K tokens. Measures how context compaction affects TTFT and whether cache behavior degrades on token-plan providers.

**Multi-Tool Orchestration** — Fires 10, 20, or 50 tool definitions at MiMo per turn. Tests whether tool schema processing creates meaningful overhead.

**Complex Planning** — Runs multi-step planning tasks with increasing complexity (3, 5, 10 steps). Isolates reasoning overhead from output generation.

**Multi-Agent Parallelism** — Spawns 3, 5, or 10 concurrent sessions against MiMo. Measures throughput degradation under parallel load.

**Sustained Load** — Runs continuously for 8+ hours at 5-second intervals. Tracks latency drift and identifies when performance starts degrading.

## Metrics

Every test run produces:
- **TTFT** — Time to first token, at P50/P95/P99
- **TPOT** — Time per output token, at P50/P95/P99
- **E2E** — End-to-end response latency
- **Token throughput** — Sustained tokens/second
- **Error rate** — Timeouts, rate limits, context overflows

## Getting Started

```bash
git clone git@github.com:iqkimy/mimo-agent-benchmark.git
cd mimo-agent-benchmark
npm install

# Configure
cp config/config.example.json config.json
# Edit config.json → add your MiMo API key

# Run
npm run benchmark              # all scenarios
npm run benchmark -- --scenario long-context   # one scenario
npm run report                 # generate markdown report
```

## Configuration

```json
{
  "mimo": {
    "baseUrl": "https://token-plan-cn.xiaomimimo.com/v1",
    "apiKey": "YOUR_KEY",
    "model": "mimo-v2.5-pro"
  },
  "benchmark": {
    "scenarios": ["long-context", "multi-tool", "planning"],
    "iterations": 10,
    "concurrency": 3
  }
}
```

Models supported: `mimo-v2.5-pro`, `mimo-v2.5-omni`, `mimo-v2.5-flash`

## Project Structure

```
├── src/
│   ├── benchmark/
│   │   ├── scenarios/     ← workload definitions
│   │   └── runner/        ← execution engine
│   └── profiler/
│       └── latency/       ← timing measurement
├── config/                ← API credentials (gitignored)
├── docs/                  ← architecture + metric specs
├── test/                  ← unit tests
└── .github/workflows/     ← CI pipeline
```

## Roadmap

| Phase | Timeline | Deliverable |
|-------|----------|-------------|
| Core benchmark | Week 1-2 | Working scenario runner + latency profiler |
| Analysis | Week 3-4 | Bottleneck identification + comparative reports |
| Continuous | Week 5+ | 30-day run + weekly regression reports |

## Contributing

Open to contributions that add new scenarios, improve measurement accuracy, or expand model coverage. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
