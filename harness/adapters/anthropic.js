'use strict';

/**
 * Anthropic Adapter — Connects the benchmark harness to Anthropic's Claude API.
 *
 * Configuration via environment:
 *   ANTHROPIC_API_KEY — API authentication key
 *   ANTHROPIC_MODEL   — Model name (default: claude-3-5-sonnet-20241022)
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class AnthropicAdapter {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    this.baseUrl = config.baseUrl || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1';
    this.model = config.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
  }

  async complete(input) {
    const { system, messages } = this.buildMessages(input);
    const body = {
      model: this.model,
      max_tokens: input.maxTokens || 2048,
      messages,
    };

    if (system) body.system = system;

    if (input.tools && input.tools.length > 0) {
      body.tools = input.tools.map(t => ({
        name: t.function?.name || t.name,
        description: t.function?.description || t.description || '',
        input_schema: t.function?.parameters || t.parameters || { type: 'object', properties: {} },
      }));
    }

    let lastError;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.request('/messages', body);
        return this.parseResponse(response);
      } catch (error) {
        lastError = error;
        if (error.status === 429) {
          const retryAfter = parseInt(error.headers?.['retry-after'] || '5') * 1000;
          await this.sleep(retryAfter);
          continue;
        }
        if (error.status >= 500) {
          await this.sleep(1000 * (attempt + 1));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  buildMessages(input) {
    const system = input.system || '';
    const messages = [];

    if (input.messages) {
      for (const msg of input.messages) {
        if (msg.role === 'system') continue;
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: input.prompt });
    return { system, messages };
  }

  parseResponse(response) {
    const content = response.content || [];
    const textBlock = content.find(b => b.type === 'text');
    const toolBlocks = content.filter(b => b.type === 'tool_use');

    return {
      content: textBlock?.text || '',
      toolCalls: toolBlocks.map(b => ({
        id: b.id,
        name: b.name,
        arguments: JSON.stringify(b.input),
      })),
      finishReason: response.stop_reason,
      usage: {
        promptTokens: response.usage?.input_tokens || 0,
        completionTokens: response.usage?.output_tokens || 0,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      },
      model: response.model,
    };
  }

  async request(path, body) {
    const url = new URL(path, this.baseUrl);
    return new Promise((resolve, reject) => {
      const client = url.protocol === 'https:' ? https : http;
      const req = client.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        timeout: this.timeout,
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              const error = new Error(parsed.error?.message || `HTTP ${res.statusCode}`);
              error.status = res.statusCode;
              error.headers = res.headers;
              reject(error);
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(JSON.stringify(body));
      req.end();
    });
  }

  sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
}

module.exports = { AnthropicAdapter };
