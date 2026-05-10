'use strict';

/**
 * OpenAI Adapter — Connects the benchmark harness to OpenAI-compatible APIs.
 *
 * Supports:
 *   - Chat completions with tool calling
 *   - Any OpenAI-compatible endpoint (Azure, local proxies, etc.)
 *   - Token usage tracking
 *
 * Configuration via environment:
 *   OPENAI_API_KEY   — API authentication key
 *   OPENAI_BASE_URL  — API endpoint (default: api.openai.com)
 *   OPENAI_MODEL     — Model name (default: gpt-4o)
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class OpenAIAdapter {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.baseUrl = config.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.model = config.model || process.env.OPENAI_MODEL || 'gpt-4o';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
  }

  /**
   * Send a completion request
   */
  async complete(input) {
    const messages = this.buildMessages(input);
    const body = {
      model: this.model,
      messages,
      max_tokens: input.maxTokens || 2048,
      temperature: input.temperature || 0.1,
    };

    if (input.tools && input.tools.length > 0) {
      body.tools = input.tools;
      body.tool_choice = input.toolChoice || 'auto';
    }

    let lastError;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.request('/chat/completions', body);
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
    const messages = [];
    if (input.system) {
      messages.push({ role: 'system', content: input.system });
    }
    if (input.messages) {
      for (const msg of input.messages) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: 'user', content: input.prompt });
    return messages;
  }

  parseResponse(response) {
    const choice = response.choices?.[0];
    if (!choice) throw new Error('No choices in response');

    return {
      content: choice.message?.content || '',
      toolCalls: choice.message?.tool_calls || [],
      finishReason: choice.finish_reason,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
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
          'Authorization': `Bearer ${this.apiKey}`,
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

module.exports = { OpenAIAdapter };
