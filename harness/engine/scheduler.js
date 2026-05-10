'use strict';

/**
 * Scheduler — Manages concurrency and resource allocation for benchmark runs.
 *
 * Controls:
 *   - How many concurrent requests are allowed
 *   - Rate limiting to avoid API throttling
 *   - Timeout enforcement
 *   - Retry logic for transient failures
 */

class Scheduler {
  constructor(config = {}) {
    this.concurrency = config.concurrency || 1;
    this.rateLimit = config.rateLimit || null;  // requests per minute
    this.maxRetries = config.maxRetries || 2;
    this.retryDelay = config.retryDelay || 1000;
    this.timeout = config.timeout || 30000;

    this.running = 0;
    this.queue = [];
    this.lastRequestTime = 0;
  }

  /**
   * Schedule a task for execution
   * Returns a promise that resolves with the task result
   */
  async schedule(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject, retries: 0 });
      this.processQueue();
    });
  }

  /**
   * Process the task queue respecting concurrency limits
   */
  async processQueue() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      this.running++;

      this.executeTask(task).finally(() => {
        this.running--;
        this.processQueue();
      });
    }
  }

  /**
   * Execute a single task with retry logic
   */
  async executeTask(task) {
    // Rate limiting
    if (this.rateLimit) {
      const now = Date.now();
      const minInterval = 60000 / this.rateLimit;
      const waitTime = minInterval - (now - this.lastRequestTime);
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
      this.lastRequestTime = Date.now();
    }

    // Timeout wrapper
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Task timed out after ${this.timeout}ms`)), this.timeout);
    });

    try {
      const result = await Promise.race([
        task.taskFn(),
        timeoutPromise,
      ]);
      task.resolve(result);
    } catch (error) {
      if (task.retries < this.maxRetries) {
        task.retries++;
        if (task.retries > 1) {
          // Exponential backoff
          await this.sleep(this.retryDelay * task.retries);
        }
        this.queue.unshift(task);
      } else {
        task.reject(error);
      }
    }
  }

  /**
   * Get current queue status
   */
  status() {
    return {
      running: this.running,
      queued: this.queue.length,
      concurrency: this.concurrency,
    };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Drain all queued tasks
   */
  async drain() {
    while (this.running > 0 || this.queue.length > 0) {
      await this.sleep(100);
    }
  }
}

module.exports = { Scheduler };
