# MiMo Agent Benchmark

**Hypothesis-driven performance benchmarking for LLM agent workloads on [MiMo-V2.5](https://github.com/XiaomiMiMo/MiMo).**

[![CI](https://github.com/iqkimy/mimo-agent-benchmark/actions/workflows/ci.yml/badge.svg)](https://github.com/iqkimy/mimo-agent-benchmark/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-green.svg)](https://nodejs.org)

---

## Why This Exists

When developers use MiMo-V2.5 in agent frameworks (tool-calling loops, multi-agent pipelines, RAG chains), they encounter performance degradation patterns that aren't captured by standard LLM benchmarks:

| Problem | What Happens | Impact |
|---------|-------------|--------|
| **Context degradation** | Model loses track of earlier tool results as context grows past 8K tokens | Silent wrong answers, missed instructions |
| **Tool routing failures** | Model calls wrong tools or passes malformed arguments at scale | Broken pipelines, retry storms |
| **Parallel agent slowdown** | Multi-agent systems see 3-5x latency increase vs single-agent | Unacceptable UX in production |
| **Retrieval grounding drift** | Model hallucinates answers instead of citing retrieved documents | Unreliable RAG outputs |
| **Token inefficiency** | Model generates verbose reasoning for simple tool calls | Higher cost, slower throughput |

**MiMo Agent Benchmark** quantifies each of these with reproducible, structured test suites. It doesn't measure "how smart" the model is — it measures **how well it performs under real agent workload pressure**.

## Quick Start

```bash
# Clone
git clone git@github.com:iqkimy/mimo-agent-benchmark.git
cd mimo-agent-benchmark
npm install

# Set up API access
cp .env.example .env
# Edit .env with your MiMo API key

# Run the full benchmark suite
node scripts/run.js

# Run a specific hypothesis
node scripts/run.js --hypothesis h1

# Run only stress tests
node scripts/run.js --category stress

# Compare against baseline
node scripts/compare.js results/latest.json results/baseline.json
```

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CLI Layer                         │
│         run.js · compare.js · visualize.js          │
├─────────────────────────────────────────────────────┤
│                  Harness Engine                      │
│  ┌───────────┐  ┌────────────┐  ┌───────────────┐  │
│  │ Orchestrator│  │  Scheduler  │  │   Executor    │  │
│  └───────────┘  └────────────┘  └───────────────┘  │
├─────────────────────────────────────────────────────┤
│               Adapters · Collectors · Reporters     │
│    mimo.js    │  timing  │  tokens  │  console     │
│    openai.js  │  accuracy│  memory  │  json        │
│               │          │          │  markdown     │
├─────────────────────────────────────────────────────┤
│           Hypotheses · Workloads · Scoring           │
│  h1-context.json │ stress/ │ realistic/ │ scoring/  │
└─────────────────────────────────────────────────────┘
```

The benchmark is organized around three layers:

1. **Hypotheses** (`hypotheses/`) — Testable claims about model behavior
2. **Workloads** (`workloads/`) — Concrete input definitions with parameters
3. **Harness** (`harness/`) — The engine that executes tests and collects metrics

### Hypothesis → Workload → Result

Each hypothesis defines a claim to test. Workloads provide the actual test inputs. The harness runs them and produces scored results.

```
Hypothesis: "MiMo-V2.5 retains >90% tool-calling accuracy with 50+ tools in context"
    ↓
Workload: workloads/stress/tool-avalanche.json (50 tools, 10 test cases)
    ↓
Harness: Runs each case 5x, collects timing + accuracy metrics
    ↓
Result: 93.2% accuracy @ 284ms avg latency → PASS
```

## Hypotheses

| ID | Hypothesis | Dimensions | Status |
|----|-----------|------------|--------|
| `h1` | Context degradation is <10% across 4K→16K token range | latency, accuracy | ✅ Active |
| `h2` | Tool routing accuracy stays >95% with 20+ tools | accuracy, throughput | ✅ Active |
| `h3` | Multi-agent coordination adds <2x latency overhead | latency, resource | ✅ Active |
| `h4` | RAG grounding accuracy >85% at 10K token context | accuracy, grounding | ✅ Active |
| `h5` | Token efficiency ratio >0.7 vs GPT-4o baseline | efficiency, cost | ✅ Active |

## Workload Categories

### Stress Tests (`workloads/stress/`)

Designed to push the model to its limits:

- **`context-flood.json`** — Gradually increases context size (1K → 32K tokens) while measuring accuracy decay
- **`tool-avalanche.json`** — Tests tool-calling with 5, 10, 20, 50, and 100 tools available
- **`parallel-agents.json`** — Runs 1→8 concurrent agent instances, measures coordination overhead
- **`nested-tools.json`** — Chains tool calls where each result feeds the next (10-level deep)
- **`adversarial-prompt.json`** — Tests robustness against prompt injection in tool outputs

### Realistic Scenarios (`workloads/realistic/`)

Based on actual production workloads:

- **`code-refactor-session.json`** — Multi-file code refactoring with context dependencies
- **`data-analysis-pipeline.json`** — Sequential data processing with tool outputs feeding analysis
- **`customer-support-chain.json`** — Multi-turn support with knowledge base retrieval
- **`research-assistant-flow.json`** — Research synthesis with web search, summarization, and citation

### Reference Baselines (`workloads/reference/`)

Pre-configured comparison sets against other models:

- **`gpt4o-baseline.json`** — GPT-4o reference results
- **`claude35-baseline.json`** — Claude 3.5 Sonnet reference results
- **`qwen-max-baseline.json`** — Qwen-Max reference results

## Metrics

### Core Metrics

| Metric | Unit | Description |
|--------|------|-------------|
| `latency_p50` | ms | Median end-to-end latency |
| `latency_p95` | ms | 95th percentile latency |
| `latency_p99` | ms | 99th percentile latency |
| `throughput` | tasks/s | Completed tasks per second |
| `accuracy` | % | Percentage of correct outputs |
| `token_efficiency` | ratio | Useful tokens / total tokens |
| `cost_per_task` | $ | Estimated cost per completed task |

### Agent-Specific Metrics

| Metric | Unit | Description |
|--------|------|-------------|
| `tool_call_accuracy` | % | Correct tool selection and argument generation |
| `tool_call_latency` | ms | Time from decision to tool call completion |
| `context_retention` | % | Accuracy on references from early context |
| `multi_agent_sync` | ratio | Coordination efficiency (1.0 = no overhead) |
| `grounding_score` | % | Answers grounded in retrieved context |
| `retry_rate` | % | Percentage of tool calls that needed retry |

### Scoring

Each hypothesis has a composite score computed from its dimensions:

```
composite_score = Σ(dimension_weight × dimension_score) / Σ(dimension_weight)
```

Weights are configurable in `scoring/weights.json`. Default weights prioritize accuracy (0.4) over latency (0.3) and efficiency (0.3).

## Output Artifacts

Each run produces structured JSON in `results/`:

```
results/
├── 2026-05-10T17-52-00/
│   ├── manifest.json        # Run metadata
│   ├── h1-context.json      # Hypothesis 1 results
│   ├── h2-tools.json        # Hypothesis 2 results
│   ├── h3-agents.json       # Hypothesis 3 results
│   ├── h4-rag.json          # Hypothesis 4 results
│   ├── h5-efficiency.json   # Hypothesis 5 results
│   ├── summary.json         # Composite scores
│   └── comparison.json      # vs. baseline (if --baseline provided)
├── latest → 2026-05-10T17-52-00  # Symlink to latest run
```

### Sample Result

```json
{
  "hypothesis": "h1",
  "title": "Context degradation is <10% across 4K→16K token range",
  "status": "PASS",
  "score": 0.913,
  "dimensions": {
    "latency": {
      "p50": 342,
      "p95": 621,
      "p99": 891,
      "degradation_at_16k": 0.12
    },
    "accuracy": {
      "at_4k": 0.96,
      "at_8k": 0.94,
      "at_16k": 0.89,
      "degradation": 0.073
    }
  },
  "iterations": 5,
  "timestamp": "2026-05-10T17:52:00Z"
}
```

## Comparison Mode

Compare two benchmark runs side-by-side:

```bash
node scripts/compare.js results/run-a.json results/run-b.json
```

Output:

```
┌──────────────────┬──────────┬──────────┬─────────┐
│ Metric           │ Run A    │ Run B    │ Delta   │
├──────────────────┼──────────┼──────────┼─────────┤
│ Composite Score  │ 0.913    │ 0.887    │ +2.9%   │
│ Accuracy (h1)    │ 89.0%    │ 86.2%    │ +3.2%   │
│ Latency p50      │ 342ms    │ 401ms    │ -14.7%  │
│ Tool Accuracy    │ 94.1%    │ 91.8%    │ +2.5%   │
│ Token Efficiency │ 0.73     │ 0.68     │ +7.4%   │
└──────────────────┴──────────┴──────────┴─────────┘
```

## CI/CD Integration

### GitHub Actions

The included workflow runs:
- **On PR:** Lightweight smoke test (h1 + h2, 2 iterations)
- **Nightly:** Full benchmark suite (all hypotheses, 5 iterations)
- **On tag:** Full suite + comparison against previous release

### Self-Hosted Runners

For consistent results, use self-hosted runners with:
- Fixed CPU/memory allocation
- Stable network (API latency affects results)
- No other workloads during benchmark

```yaml
# .github/workflows/ci.yml excerpt
runs-on: [self-hosted, benchmark]
env:
  MIMO_API_KEY: ${{ secrets.MIMO_API_KEY }}
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MIMO_API_KEY` | Yes | MiMo API authentication |
| `MIMO_BASE_URL` | No | API endpoint (default: official) |
| `MIMO_MODEL` | No | Model variant (default: MiMo-V2.5) |
| `BENCH_ITERATIONS` | No | Iterations per test (default: 3) |
| `BENCH_TIMEOUT` | No | Per-request timeout in ms (default: 30000) |
| `BENCH_CONCURRENCY` | No | Parallel test slots (default: 1) |
| `BENCH_VERBOSE` | No | Enable detailed logging (default: false) |

### Config Profiles

Use `--config` to load preset configurations:

```bash
node scripts/run.js --config workloads/reference/ci.json    # Fast CI run
node scripts/run.js --config workloads/reference/full.json   # Full benchmark
node scripts/run.js --config workloads/reference/stress.json # Stress only
```

## Design Principles

1. **Hypothesis-first** — Every test validates a specific claim, not just "run and see"
2. **Deterministic inputs** — Workloads use fixed seeds and parameterized inputs
3. **Structured outputs** — All results are JSON; no parsing required
4. **Zero-dependency harness** — Core engine uses only Node.js built-ins
5. **Adapter pattern** — Easy to add new model providers
6. **Reproducible** — Same config + same model = same results

## Roadmap

- [ ] v0.2: Web UI for result visualization
- [ ] v0.3: Multi-model parallel comparison mode
- [ ] v0.4: Cost optimization advisor (suggests model/config changes)
- [ ] v0.5: Plugin system for custom collectors and reporters
- [ ] v1.0: Stable API with semantic versioning

## License

MIT — see [LICENSE](LICENSE)

## Acknowledgments

- [Xiaomi MiMo](https://github.com/XiaomiMiMo/MiMo) for the MiMo-V2.5 model
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) for inspiration on tool-calling evaluation
- [AgentBench](https://github.com/THUDM/AgentBench) for foundational agent evaluation concepts
