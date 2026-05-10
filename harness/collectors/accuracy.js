'use strict';

/**
 * AccuracyCollector — Evaluates response correctness against expected outputs.
 *
 * Evaluates:
 *   - Tool call correctness (right tool, right arguments)
 *   - Response format compliance
 *   - Grounding in provided context
 *   - Instruction following
 */

class AccuracyCollector {
  constructor() {
    this.evaluations = [];
  }

  start() {
    this.evaluations = [];
  }

  stop() {
    // No-op
  }

  /**
   * Evaluate a response against expectations
   */
  evaluate(response, expectations) {
    const result = {
      toolCallCorrect: this.checkToolCalls(response.toolCalls, expectations.expectedTools),
      formatValid: this.checkFormat(response.content, expectations.format),
      groundedInContext: this.checkGrounding(response.content, expectations.context),
      instructionFollowed: this.checkInstruction(response.content, expectations.instruction),
      timestamp: Date.now(),
    };

    result.score = this.computeScore(result);
    this.evaluations.push(result);

    return result;
  }

  /**
   * Check if tool calls match expected tools
   */
  checkToolCalls(actual, expected) {
    if (!expected || expected.length === 0) return true;
    if (!actual || actual.length === 0) return false;

    const actualNames = actual.map(tc => tc.name || tc.function?.name);
    const matched = expected.filter(e => actualNames.includes(e));

    return matched.length / expected.length;
  }

  /**
   * Check if response matches expected format
   */
  checkFormat(content, expectedFormat) {
    if (!expectedFormat || !content) return true;

    if (expectedFormat === 'json') {
      try {
        JSON.parse(content);
        return true;
      } catch {
        return false;
      }
    }

    if (expectedFormat === 'markdown') {
      return content.includes('#') || content.includes('*') || content.includes('-');
    }

    if (expectedFormat === 'structured') {
      // Check for headers or numbered items
      return /^\d+\.|^- |^#|^\*\*/m.test(content);
    }

    return true;
  }

  /**
   * Check if response is grounded in provided context
   */
  checkGrounding(content, context) {
    if (!context || !content) return true;

    // Simple keyword overlap check
    const contextWords = new Set(context.toLowerCase().split(/\s+/));
    const contentWords = content.toLowerCase().split(/\s+/);

    const overlap = contentWords.filter(w => contextWords.has(w)).length;
    const ratio = contentWords.length > 0 ? overlap / contentWords.length : 0;

    return ratio > 0.3; // At least 30% word overlap with context
  }

  /**
   * Check if response follows the instruction
   */
  checkInstruction(content, instruction) {
    if (!instruction || !content) return true;

    // Check for key phrases from instruction
    const phrases = instruction.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const contentLower = content.toLowerCase();

    const matched = phrases.filter(p => contentLower.includes(p));
    return matched.length / Math.max(phrases.length, 1);
  }

  /**
   * Compute overall score from evaluation dimensions
   */
  computeScore(result) {
    const weights = {
      toolCallCorrect: 0.35,
      formatValid: 0.15,
      groundedInContext: 0.25,
      instructionFollowed: 0.25,
    };

    let score = 0;
    for (const [key, weight] of Object.entries(weights)) {
      const val = typeof result[key] === 'number' ? result[key] : (result[key] ? 1 : 0);
      score += val * weight;
    }

    return parseFloat(score.toFixed(4));
  }

  /**
   * Collect all accuracy metrics
   */
  collect() {
    if (this.evaluations.length === 0) {
      return { accuracy: { score: 0, evaluations: 0 } };
    }

    const scores = this.evaluations.map(e => e.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
      accuracy: {
        score: parseFloat(avgScore.toFixed(4)),
        evaluations: this.evaluations.length,
        toolCallAccuracy: this.average(
          this.evaluations.map(e =>
            typeof e.toolCallCorrect === 'number' ? e.toolCallCorrect : (e.toolCallCorrect ? 1 : 0)
          )
        ),
        formatCompliance: this.average(
          this.evaluations.map(e =>
            typeof e.formatValid === 'number' ? e.formatValid : (e.formatValid ? 1 : 0)
          )
        ),
        groundingScore: this.average(
          this.evaluations.map(e =>
            typeof e.groundedInContext === 'number' ? e.groundedInContext : (e.groundedInContext ? 1 : 0)
          )
        ),
      },
    };
  }

  average(arr) {
    if (arr.length === 0) return 0;
    return parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(4));
  }
}

module.exports = { AccuracyCollector };
