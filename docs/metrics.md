# Metrics

## Latency

| Metric | Description | Percentiles |
|--------|-------------|-------------|
| TTFT | Time to first token | P50, P95, P99 |
| TPOT | Time per output token | P50, P95, P99 |
| E2E | End-to-end response time | P50, P95, P99 |

## Resource

| Metric | Description |
|--------|-------------|
| Token throughput | Tokens/second sustained rate |
| Context utilization | Active tokens / max capacity |
| API efficiency | Tokens consumed / useful output tokens |

## Quality

| Metric | Description |
|--------|-------------|
| Task success rate | Percentage of scenarios completing successfully |
| Regression rate | Performance degradation over session duration |
| Error classification | Timeout, rate limit, context overflow, etc. |
