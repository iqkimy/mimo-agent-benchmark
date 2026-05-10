'use strict';

/**
 * Executor — Runs a single workload through the model adapter.
 *
 * For each iteration:
 *   1. Builds the prompt from the workload definition
 *   2. Sends it to the adapter
 *   3. Collects the response
 *   4. Scores the response against expectations
 *
 * Returns a Result object with per-iteration data and aggregate score.
 */

class Executor {
  constructor({ adapter, workload, hypothesis, iterations, timeout, verbose }) {
    this.adapter = adapter;
    this.workload = workload;
    this.hypothesis = hypothesis;
    this.iterations = iterations || 3;
    this.timeout = timeout || 30000;
    this.verbose = verbose || false;
  }

  /**
   * Execute the workload for all iterations
   */
  async run() {
    const iterations = [];

    for (let i = 0; i < this.iterations; i++) {
      if (this.verbose) {
        console.log(`     [iter ${i + 1}/${this.iterations}]`);
      }

      const iterResult = await this.runIteration(i);
      iterations.push(iterResult);
    }

    // Aggregate
    const score = this.scoreIterations(iterations);
    const aggregatedMetrics = this.aggregateMetrics(iterations);

    return {
      workloadId: this.workload.id,
      hypothesisId: this.hypothesis.id,
      iterations,
      score,
      metrics: aggregatedMetrics,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Run a single iteration of the workload
   */
  async runIteration(index) {
    const startTime = Date.now();
    const iteration = {
      index,
      startTime: new Date(startTime).toISOString(),
      requests: [],
      tokens: { prompt: 0, completion: 0, total: 0 },
      errors: [],
    };

    try {
      // Build the actual test input from the workload definition
      const testInput = this.buildTestInput();

      // Send request to adapter
      const requestStart = Date.now();
      const response = await this.sendRequest(testInput);
      const requestEnd = Date.now();

      iteration.requests.push({
        prompt: testInput.prompt,
        response: response.content,
        toolCalls: response.toolCalls || [],
        latencyMs: requestEnd - requestStart,
        tokens: response.usage || { promptTokens: 0, completionTokens: 0 },
      });

      iteration.tokens.prompt += response.usage?.promptTokens || 0;
      iteration.tokens.completion += response.usage?.completionTokens || 0;
      iteration.tokens.total += (response.usage?.promptTokens || 0) + (response.usage?.completionTokens || 0);

      // Score this iteration
      iteration.score = this.scoreIteration(iteration, response);

    } catch (error) {
      iteration.errors.push({
        message: error.message,
        code: error.code || 'UNKNOWN',
        timestamp: new Date().toISOString(),
      });
      iteration.score = 0;
    }

    iteration.endTime = new Date().toISOString();
    iteration.durationMs = Date.now() - startTime;

    return iteration;
  }

  /**
   * Build the actual test input from the workload definition.
   * This transforms the abstract workload spec into concrete API calls.
   */
  buildTestInput() {
    const input = this.workload.input;
    const params = this.workload.params;

    // Generate the prompt based on workload type
    let prompt = '';
    let tools = [];
    let systemPrompt = '';

    if (input.systemPrompt) {
      systemPrompt = input.systemPrompt;
    }

    // For context-flood workloads, generate padded context
    if (this.workload.id === 'context-flood' && input.generateContext) {
      prompt = this.generateContextPrompt(input, params);
    }
    // For tool-avalanche, build tool definitions
    else if (this.workload.id === 'tool-avalanche' && input.toolDefinitions) {
      tools = this.buildToolDefinitions(input, params);
      prompt = input.queries[0]?.intent || 'Execute the appropriate tool';
    }
    // For parallel-agents, build task prompt
    else if (this.workload.id === 'parallel-agents' && input.taskTemplate) {
      prompt = input.taskTemplate.tasks[0]?.prompt || 'Process the request';
    }
    // For nested-tools, build chain prompt
    else if (this.workload.id === 'nested-tools' && input.chains) {
      const chain = input.chains[0];
      prompt = chain.steps.map(s => `[${s.tool}] ${s.input}`).join('\n');
    }
    // For adversarial-prompt, build attack prompt
    else if (this.workload.id === 'adversarial-prompt' && input.attacks) {
      const attack = input.attacks[0];
      prompt = attack.injection || attack.context || 'Execute the task';
    }
    // For realistic workloads
    else if (input.scenario) {
      prompt = input.scenario;
    }
    // Generic fallback
    else {
      prompt = input.prompt || JSON.stringify(input);
    }

    return {
      system: systemPrompt,
      prompt,
      tools,
      maxTokens: params.maxTokens || 2048,
    };
  }

  /**
   * Generate a context-padded prompt for context flood testing
   */
  generateContextPrompt(input, params) {
    const targetSize = params.contextSizes?.[params.contextSizes.length - 1] || 4096;
    const template = input.generateContext?.template;

    // Build repeated conversation turns to fill context
    const turns = [];
    const topics = template?.topics || ['general'];
    let tokenEstimate = 0;

    while (tokenEstimate < targetSize) {
      const topic = topics[turns.length % topics.length];
      turns.push({ role: 'user', content: `Analyze ${topic} data for this period` });
      turns.push({ role: 'assistant', content: `Here's the analysis for ${topic}: The data shows key trends...`.padEnd(200, 'x') });
      tokenEstimate += 100; // rough estimate
    }

    // Add the actual question
    const question = input.questions?.[0]?.prompt || 'What was discussed?';

    return {
      system: input.systemPrompt || '',
      messages: turns,
      prompt: question,
      maxTokens: 2048,
    };
  }

  /**
   * Build tool definitions for tool-avalanche testing
   */
  buildToolDefinitions(input, params) {
    const toolCounts = params.toolCounts || [5];
    const maxTools = toolCounts[toolCounts.length - 1];
    const categories = input.toolDefinitions.categories || [];

    const tools = [];
    let count = 0;

    for (const cat of categories) {
      for (const variant of cat.variants) {
        if (count >= maxTools) break;
        tools.push({
          type: 'function',
          function: {
            name: variant,
            description: `${cat.name} operation: ${variant}`,
            parameters: {
              type: 'object',
              properties: {
                input: { type: 'string', description: 'Input data' },
                options: { type: 'object', description: 'Additional options' },
              },
              required: ['input'],
            },
          },
        });
        count++;
      }
      if (count >= maxTools) break;
    }

    return tools;
  }

  /**
   * Send a request to the model adapter
   */
  async sendRequest(testInput) {
    if (!this.adapter) {
      // Mock adapter for testing
      return this.mockResponse(testInput);
    }

    return this.adapter.complete(testInput);
  }

  /**
   * Mock response for testing without API access
   */
  mockResponse(testInput) {
    const latency = 100 + Math.random() * 200;
    const promptTokens = Math.ceil(testInput.prompt?.length / 4 || 100);
    const completionTokens = 150 + Math.floor(Math.random() * 100);

    return {
      content: `Mock response to: ${(testInput.prompt || '').substring(0, 50)}...`,
      toolCalls: testInput.tools?.length > 0
        ? [{ name: testInput.tools[0]?.function?.name || 'mock_tool', arguments: '{}' }]
        : [],
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  /**
   * Score a single iteration
   */
  scoreIteration(iteration, response) {
    // Basic scoring: check if response exists and is valid
    let score = 0;

    // Has a response
    if (response.content && response.content.length > 0) {
      score += 0.4;
    }

    // No errors
    if (iteration.errors.length === 0) {
      score += 0.3;
    }

    // Has tool calls (if expected)
    if (this.workload.input.toolDefinitions || this.workload.input.toolSequence) {
      if (response.toolCalls && response.toolCalls.length > 0) {
        score += 0.3;
      }
    } else {
      score += 0.3; // no tools expected
    }

    return score;
  }

  /**
   * Score across all iterations
   */
  scoreIterations(iterations) {
    const scores = iterations.map(i => i.score).filter(s => s !== undefined);
    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * Aggregate metrics across iterations
   */
  aggregateMetrics(iterations) {
    const latencies = iterations
      .flatMap(i => i.requests.map(r => r.latencyMs))
      .filter(l => l !== undefined);

    const tokens = iterations.reduce(
      (acc, i) => ({
        prompt: acc.prompt + i.tokens.prompt,
        completion: acc.completion + i.tokens.completion,
        total: acc.total + i.tokens.total,
      }),
      { prompt: 0, completion: 0, total: 0 }
    );

    const totalErrors = iterations.reduce((sum, i) => sum + i.errors.length, 0);

    return {
      avgLatencyMs: latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0,
      p50LatencyMs: this.percentile(latencies, 0.5),
      p95LatencyMs: this.percentile(latencies, 0.95),
      p99LatencyMs: this.percentile(latencies, 0.99),
      tokens,
      totalErrors,
      errorRate: iterations.length > 0 ? totalErrors / iterations.length : 0,
    };
  }

  /**
   * Compute percentile
   */
  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }
}

module.exports = { Executor };
