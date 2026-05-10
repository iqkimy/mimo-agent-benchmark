'use strict';

/**
 * Composite Scorer — Computes weighted composite scores from dimension results.
 */

const fs = require('fs');
const path = require('path');

class CompositeScorer {
  constructor(weightsPath) {
    const weightsFile = weightsPath || path.join(__dirname, 'weights.json');
    this.config = JSON.parse(fs.readFileSync(weightsFile, 'utf-8'));
  }

  /**
   * Compute composite score from hypothesis results
   */
  compute(results) {
    const weights = this.config.dimensions;
    const totalWeight = Object.values(weights).reduce((sum, d) => sum + d.weight, 0);

    let weightedScore = 0;

    for (const [dimension, config] of Object.entries(weights)) {
      const dimensionScore = this.extractDimensionScore(results, dimension);
      weightedScore += (dimensionScore * config.weight) / totalWeight;
    }

    return {
      compositeScore: parseFloat(weightedScore.toFixed(4)),
      breakdown: this.computeBreakdown(results),
      passedThreshold: weightedScore >= this.config.scoring.passThreshold,
    };
  }

  /**
   * Extract score for a specific dimension from results
   */
  extractDimensionScore(results, dimension) {
    // Look through results for metrics matching this dimension
    let scores = [];

    for (const result of results) {
      if (result.metrics) {
        if (dimension === 'accuracy' && result.metrics.accuracy) {
          scores.push(result.metrics.accuracy.score || 0);
        }
        if (dimension === 'latency' && result.metrics.timing) {
          // Normalize latency: lower is better, cap at 5s
          const p50 = result.metrics.timing.p50LatencyMs || 0;
          scores.push(Math.max(0, 1 - p50 / 5000));
        }
        if (dimension === 'efficiency' && result.metrics.tokens) {
          scores.push(result.metrics.tokens.efficiency || 0);
        }
      }
    }

    if (scores.length === 0) return 0.5; // Default neutral score
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * Compute detailed breakdown
   */
  computeBreakdown(results) {
    const breakdown = {};

    for (const result of results) {
      const id = result.hypothesis || result.hypothesisId || 'unknown';
      if (!breakdown[id]) {
        breakdown[id] = {
          score: result.score || 0,
          status: result.status || 'UNKNOWN',
          dimensions: {},
        };
      }

      if (result.metrics) {
        if (result.metrics.timing) {
          breakdown[id].dimensions.latency = {
            p50: result.metrics.timing.p50LatencyMs,
            p95: result.metrics.timing.p95LatencyMs,
          };
        }
        if (result.metrics.tokens) {
          breakdown[id].dimensions.efficiency = {
            totalTokens: result.metrics.tokens.total.total,
            cost: result.metrics.tokens.estimatedCost.total,
          };
        }
        if (result.metrics.accuracy) {
          breakdown[id].dimensions.accuracy = {
            score: result.metrics.accuracy.score,
          };
        }
      }
    }

    return breakdown;
  }
}

module.exports = { CompositeScorer };
