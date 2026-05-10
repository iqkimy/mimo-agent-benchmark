'use strict';

/**
 * TokenCollector — Tracks token usage and efficiency metrics.
 *
 * Tracks:
 *   - Prompt tokens per request
 *   - Completion tokens per request
 *   - Total tokens used
 *   - Token efficiency ratio (useful / total)
 *   - Estimated cost
 */

class TokenCollector {
  constructor() {
    this.requests = [];
    this.costPerMillionTokens = {
      prompt: 2.50,      // $2.50 per 1M prompt tokens
      completion: 10.00,  // $10.00 per 1M completion tokens
    };
  }

  start() {
    this.requests = [];
  }

  stop() {
    // No-op
  }

  /**
   * Record token usage for a request
   */
  record(usage) {
    this.requests.push({
      promptTokens: usage.promptTokens || 0,
      completionTokens: usage.completionTokens || 0,
      totalTokens: (usage.promptTokens || 0) + (usage.completionTokens || 0),
      timestamp: Date.now(),
    });
  }

  /**
   * Collect all token metrics
   */
  collect() {
    const totals = this.requests.reduce(
      (acc, r) => ({
        prompt: acc.prompt + r.promptTokens,
        completion: acc.completion + r.completionTokens,
        total: acc.total + r.totalTokens,
      }),
      { prompt: 0, completion: 0, total: 0 }
    );

    const avgTokens = this.requests.length > 0
      ? {
          prompt: Math.round(totals.prompt / this.requests.length),
          completion: Math.round(totals.completion / this.requests.length),
          total: Math.round(totals.total / this.requests.length),
        }
      : { prompt: 0, completion: 0, total: 0 };

    // Estimate cost
    const cost = {
      prompt: (totals.prompt / 1_000_000) * this.costPerMillionTokens.prompt,
      completion: (totals.completion / 1_000_000) * this.costPerMillionTokens.completion,
      total: 0,
    };
    cost.total = cost.prompt + cost.completion;

    // Token efficiency: completion / total (higher = more useful output relative to input)
    const efficiency = totals.total > 0
      ? totals.completion / totals.total
      : 0;

    return {
      tokens: {
        total: totals,
        average: avgTokens,
        requests: this.requests.length,
        efficiency: parseFloat(efficiency.toFixed(4)),
        estimatedCost: {
          prompt: parseFloat(cost.prompt.toFixed(6)),
          completion: parseFloat(cost.completion.toFixed(6)),
          total: parseFloat(cost.total.toFixed(6)),
        },
      },
    };
  }
}

module.exports = { TokenCollector };
