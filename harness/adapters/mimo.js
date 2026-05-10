'use strict';

/**
 * MiMo Adapter — Connects the benchmark harness to Xiaomi's MiMo-V2.5 API.
 *
 * Supports:
 *   - Chat completions with tool calling
 *   - Token usage tracking
 *   - Retry with exponential backoff
 *   - Rate limiting
 *
 * Configuration via environment:
 *   MIMO_API_KEY    — API authentication key
 *   MIMO_BASE_URL   — API endpoint (default: official)
 *   MIMO_MODEL      — Model variant (default: MiMo-V2.5)
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class MiMoAdapter {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.MIMO_API_KEY;
    this.baseUrl = config.baseUrl || process.env.MIMO_BASE_URL || 'https://api.mimo.xiaomi.com/v1';
    this.model = config.model || process.env.MIMO_MODEL || 'MiMo-V2.5';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;

    if (!this.apiKey) {
      throw new Error('MIMO_API_KEY is required. Set it in .env or pass via config.');
    }
  }

  /**
   * Send a completion request to MiMo
   */
  async complete(input) {
    const messages = this.buildMessages(input);
    const body = {
      model: this.model,
      messages,
      max_tokens: input.maxTokens || 2048,
      temperature: input.temperature || 0.1,
    };

    // Add tools if provided
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

        // Rate limit — respect Retry-After
        if (error.status === 429) {
          const retryAfter = parseInt(error.headers?.['retry-after'] || '5') * 1000;
          await this.sleep(retryAfter);
          continue;
        }

        // Server errors — retry with backoff
        if (error.status >= 500) {
          await this.sleep(1000 * (attempt + 1));
          continue;
        }

        // Client errors — don't retry
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Build messages array from input
   */
  buildMessages(input) {
    const messages = [];

    if (input.system) {
      messages.push({ role: 'system', content: input.system });
    }

    // If there are pre-built messages (for context flood), use them
    if (input.messages && input.messages.length > 0) {
      for (const msg of input.messages) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add the user prompt
    messages.push({ role: 'user', content: input.prompt });

    return messages;
  }

  /**
   * Parse API response into adapter format
   */
  parseResponse(response) {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error('No choices in response');
    }

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

  /**
   * Make an HTTP request to the API
   */
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
              error.body = parsed;
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
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out after ${this.timeout}ms`));
      });

      req.write(JSON.stringify(body));
      req.end();
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { MiMoAdapter };
