# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in MiMo Agent Benchmark, please report it responsibly.

- **Email:** security@mimo-benchmark.dev
- **GitHub:** Use GitHub's private vulnerability reporting

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to acknowledge reports within 48 hours and provide a fix timeline within 7 days.

## Scope

This policy covers the benchmark harness and associated tooling. It does not cover:
- The MiMo model itself
- Third-party API services
- User-specific deployment configurations

## Authentication & API Keys

- API keys are **never** stored in benchmark results or logs
- `.env` files are gitignored by default
- The harness supports environment variable injection at runtime
- Never commit API keys to public repositories
