# Architecture

```mermaid
flowchart LR
  A[Scenario Generator] --> B[Benchmark Runner]
  B --> C[MiMo API]
  C --> D[Latency Profiler]
  D --> E[Data Store]
  E --> F[Report Generator]
  F --> G[CI Artifact]
```

## Layers

### Scenario Layer
Generates structured test prompts for each workload pattern. Scenarios are parameterized to allow variation in context size, tool count, and concurrency.

### Runner Layer
Executes scenarios against live MiMo endpoints with configurable concurrency and iteration counts.

### Profiling Layer
Collects per-call latency metrics: TTFT, TPOT, E2E at P50/P95/P99 percentiles.

### Analysis Layer
Aggregates profiling data into structured reports with regression detection.
