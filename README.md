# MiMo Agent Benchmark

A comprehensive, long-running automated benchmark system for Xiaomi MiMo-V2.5 series models in real-world AI Agent scenarios.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Stage: Alpha](https://img.shields.io/badge/Stage-Alpha-orange.svg)]()

## Why This Project

MiMo-V2.5 is Xiaomi's flagship model series covering text, multimodal, and voice. As Agent frameworks (OpenClaw, Claude Code, Cursor, etc.) increasingly adopt MiMo models via API, several real-world performance bottlenecks emerge under production-like workloads:

- **Context management overhead**: Compaction mechanisms behave differently across providers, causing unbounded context growth and degraded cache hit rates in long-running Agent sessions.
- **Reasoning field overhead**: MiMo's `reasoning_content` output adds processing latency in frameworks not optimized for this field.
- **Multi-tool orchestration stress**: Agent scenarios with heavy tool calls (10-50+ tools per turn) expose bottlenecks in token throughput and response time stability.
- **Sustained load degradation**: TTFT (Time To First Token) and TPOT (Time Per Output Token) degrade measurably over extended sessions, but there's no public benchmark quantifying this.

**This project fills that gap.** We build a continuously-running benchmark that tests MiMo-V2.5 in realistic, demanding Agent scenarios and produces actionable optimization data.

## Project Goals

1. **Quantify MiMo-V2.5 performance** across diverse Agent workloads (long context, multi-tool, multi-agent, planning tasks)
2. **Identify optimization opportunities** in MiMo's inference pipeline through systematic profiling
3. **Produce a public benchmark suite** that the MiMo community can use to evaluate and compare model configurations
4. **Contribute optimization patches** back to MiMo-compatible frameworks based on empirical data

## Benchmark Scenarios

| Scenario | Description | Key Metrics |
|----------|-------------|-------------|
| Long Context | 32K-128K token conversations with context compaction | TTFT, compaction time, cache hit rate |
| Multi-Tool | Agent tasks requiring 10-50+ tool calls per turn | TPOT, total latency, error rate |
| Planning & Reasoning | Complex multi-step planning with chain-of-thought | Reasoning overhead, accuracy |
| Multi-Agent | Parallel agent sessions with shared context | Throughput, memory usage |
| Sustained Load | 8+ hour continuous operation sessions | Latency drift, resource stability |

## System Architecture

```
src/
├── benchmark/
│   ├── scenarios/        # Scenario definitions and generators
│   ├── runner/           # Test execution engine
│   └── reporter/         # Structured performance reports
├── profiler/
│   ├── latency/          # TTFT, TPOT, E2E measurement
│   ├── resource/         # CPU, memory, network monitoring
│   └── context/          # Context window utilization tracking
├── optimizer/
│   ├── analyzer/         # Bottleneck identification
│   └── generator/        # Optimization suggestion generation
├── integrations/
│   ├── mimo-api/         # MiMo API client wrapper
│   └── github/           # Automated PR and CI integration
├── data/
│   ├── raw/              # Raw benchmark results
│   └── reports/          # Aggregated analysis reports
└── config/               # Benchmark configurations and thresholds
```

## Metrics Collected

### Latency
- **TTFT** (Time To First Token): Measured at P50, P95, P99
- **TPOT** (Time Per Output Token): Measured at P50, P95, P99
- **E2E Latency**: End-to-end response time including all overhead

### Resource
- **Token throughput**: Tokens/second sustained rate
- **Context window utilization**: Active tokens vs maximum capacity
- **API call efficiency**: Tokens consumed per useful output token

### Quality
- **Task completion rate**: Success rate across scenario types
- **Regression rate**: Performance degradation over session duration
- **Error classification**: Timeout, rate limit, context overflow, etc.

## Usage

```bash
git clone https://github.com/USER/mimo-agent-benchmark.git
cd mimo-agent-benchmark
npm install

cp config/config.example.json config/config.json
# Edit config.json with your MiMo API credentials

npm run benchmark
npm run benchmark -- --scenario long-context
npm run report
npm run analyze -- --input data/reports/latest.json
```

## Sample Configuration

```json
{
  "mimo": {
    "baseUrl": "https://token-plan-cn.xiaomimimo.com/v1",
    "model": "mimo-v2.5-pro",
    "maxTokens": 8192
  },
  "benchmark": {
    "scenarios": ["long-context", "multi-tool", "planning", "multi-agent"],
    "iterations": 10,
    "concurrency": 3,
    "duration": "8h"
  }
}
```

## Roadmap

### Phase 1: Core Benchmark (Week 1-2)
- [x] Project structure and scenario definitions
- [ ] Basic benchmark runner with latency profiling
- [ ] MiMo API integration and error handling
- [ ] First benchmark report generation

### Phase 2: Optimization Analysis (Week 3-4)
- [ ] Bottleneck identification engine
- [ ] Context management optimization testing
- [ ] Reasoning field overhead measurement
- [ ] Comparative analysis: MiMo-V2.5-Pro vs Omni vs Flash

### Phase 3: Continuous Operation (Week 5+)
- [ ] 30-day continuous benchmark pipeline
- [ ] Weekly performance regression reports
- [ ] Automated optimization PR generation
- [ ] Public benchmark dashboard

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT License - see [LICENSE](LICENSE).
