/**
 * MiMo Benchmark Scenario Definitions
 */

export const scenarios = {
  'long-context': {
    name: 'Long Context Stress Test',
    description: 'Tests MiMo-V2.5 behavior under growing context windows (32K-128K tokens)',
    config: {
      targetTokens: [32000, 64000, 128000],
      compactionTrigger: 0.8,
      iterations: 10,
    },
    generatePrompt(contextSize) {
      return {
        system: 'You are a helpful assistant with extensive knowledge. Respond thoroughly.',
        messages: generateContextStuffedConversation(contextSize),
      };
    },
    evaluate(result) {
      return {
        ttft: result.firstTokenLatency,
        compactionOccurred: result.contextSize > result.maxContext * 0.7,
        responseQuality: result.outputLength > 100,
      };
    },
  },

  'multi-tool': {
    name: 'Multi-Tool Orchestration',
    description: 'Tests token throughput under heavy tool-call scenarios (10-50+ tools per turn)',
    config: {
      toolCounts: [10, 20, 50],
      iterations: 10,
    },
    generatePrompt(toolCount) {
      return {
        system: `You have access to ${toolCount} tools. Use them as needed.`,
        tools: generateToolDefinitions(toolCount),
        messages: [{ role: 'user', content: 'Analyze the current system state using all available tools.' }],
      };
    },
    evaluate(result) {
      return {
        tpot: result.outputTokenLatency,
        totalLatency: result.totalDuration,
        toolCallsParsed: result.toolCalls?.length || 0,
      };
    },
  },

  'planning': {
    name: 'Complex Planning & Reasoning',
    description: 'Tests reasoning overhead in multi-step planning tasks',
    config: {
      complexityLevels: [3, 5, 10],
      iterations: 10,
    },
    generatePrompt(steps) {
      return {
        system: 'You are a strategic planning assistant. Think step by step.',
        messages: [{
          role: 'user',
          content: `Create a detailed ${steps}-step plan for a complex software deployment.`,
        }],
      };
    },
    evaluate(result) {
      return {
        reasoningTokens: result.reasoningContent?.length || 0,
        outputTokens: result.outputLength,
        reasoningOverhead: (result.reasoningContent?.length || 0) / (result.outputLength || 1),
      };
    },
  },

  'multi-agent': {
    name: 'Multi-Agent Parallel Sessions',
    description: 'Tests throughput under concurrent agent sessions',
    config: {
      concurrency: [3, 5, 10],
      sessionLength: 20,
      iterations: 5,
    },
    generatePrompt() {
      return {
        system: 'You are a specialized agent. Respond concisely.',
        messages: [{ role: 'user', content: 'Execute the assigned subtask.' }],
      };
    },
    evaluate(result) {
      return {
        throughput: result.outputLength / (result.totalDuration / 1000),
        errorRate: result.error ? 1 : 0,
      };
    },
  },

  'sustained-load': {
    name: 'Sustained Load Endurance',
    description: 'Tests latency drift over 8+ hour continuous sessions',
    config: {
      durationHours: 8,
      requestIntervalMs: 5000,
      iterations: 1,
    },
    generatePrompt() {
      return {
        system: 'You are a helpful assistant.',
        messages: [{ role: 'user', content: 'Continue the current task.' }],
      };
    },
    evaluate(result) {
      return {
        latencyDrift: result.latencyTrend,
        p99Latency: result.p99,
        degraded: result.p99 > result.baselineP99 * 2,
      };
    },
  },
};

function generateContextStuffedConversation(targetTokens) {
  return [{ role: 'user', content: 'Start conversation' }];
}

function generateToolDefinitions(count) {
  return Array.from({ length: count }, (_, i) => ({
    type: 'function',
    function: {
      name: `tool_${i}`,
      description: `Test tool number ${i}`,
      parameters: { type: 'object', properties: {} },
    },
  }));
}

export default scenarios;
