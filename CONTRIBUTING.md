# Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development Setup

```bash
git clone https://github.com/USER/mimo-agent-benchmark.git
cd mimo-agent-benchmark
npm install
cp config/config.example.json config/config.json
npm test
```

## Adding Scenarios

1. Add scenario definition to `src/benchmark/scenarios/index.js`
2. Include `generatePrompt` and `evaluate` functions
3. Add test in `test/benchmark.test.js`
