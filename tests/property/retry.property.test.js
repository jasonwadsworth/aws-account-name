/**
 * Property-based tests for retry utilities
 * Feature: page-load-retry
 */

const fc = require('fast-check');
const {
  validateConfig,
  calculateDelay,
  retryWithBackoff,
  waitForElement
} = require('../../src/retry-utils');

describe('Retry Utilities Property Tests', () => {
  // Feature: page-load-retry, Property 5: Retry mechanism respects maximum attempt limit
  // Validates: Requirements 1.4, 3.1
  test('Property 5: Retry mechanism respects maximum attempt limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // maxAttempts
        fc.integer({ min: 10, max: 50 }), // initialDelay
        async (maxAttempts, initialDelay) => {
          let callCount = 0;
          const alwaysFailsFn = async () => {
            callCount++;
            return null; // Always fails
          };

          const config = {
            maxAttempts,
            initialDelay,
            maxDelay: initialDelay * 5,
            backoffMultiplier: 2,
            backoffType: 'exponential'
          };

          await retryWithBackoff(alwaysFailsFn, config);

          // Should be called exactly maxAttempts times
          return callCount === maxAttempts;
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  // Feature: page-load-retry, Property 6: Successful extraction terminates retry early
  // Validates: Requirements 1.5, 3.3
  test('Property 6: Successful extraction terminates retry early', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // maxAttempts
        fc.integer({ min: 1, max: 5 }), // successOnAttempt (1-indexed)
        fc.integer({ min: 10, max: 50 }), // initialDelay
        async (maxAttempts, successOnAttempt, initialDelay) => {
          // Ensure successOnAttempt is within maxAttempts
          const actualSuccessAttempt = Math.min(successOnAttempt, maxAttempts);

          let callCount = 0;
          const succeedsOnNthAttempt = async () => {
            callCount++;
            if (callCount === actualSuccessAttempt) {
              return { success: true, data: 'test' };
            }
            return null;
          };

          const config = {
            maxAttempts,
            initialDelay,
            maxDelay: initialDelay * 5,
            backoffMultiplier: 2,
            backoffType: 'exponential'
          };

          const result = await retryWithBackoff(succeedsOnNthAttempt, config);

          // Should be called exactly actualSuccessAttempt times and return result
          return callCount === actualSuccessAttempt && result !== null && result.success === true;
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  // Feature: page-load-retry, Property 2: Initial retry delay meets minimum threshold
  // Validates: Requirements 1.2
  test('Property 2: Initial retry delay meets minimum threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 300 }), // initialDelay
        async (initialDelay) => {
          let callCount = 0;
          let firstCallTime = 0;
          let secondCallTime = 0;

          const trackTimingFn = async () => {
            callCount++;
            if (callCount === 1) {
              firstCallTime = Date.now();
            } else if (callCount === 2) {
              secondCallTime = Date.now();
            }
            return null; // Always fails to trigger retry
          };

          const config = {
            maxAttempts: 2,
            initialDelay,
            maxDelay: initialDelay * 10,
            backoffMultiplier: 2,
            backoffType: 'exponential'
          };

          await retryWithBackoff(trackTimingFn, config);

          const actualDelay = secondCallTime - firstCallTime;
          // Allow 50ms tolerance for timing variations
          return actualDelay >= initialDelay - 50;
        }
      ),
      { numRuns: 30 }
    );
  }, 30000);

  // Feature: page-load-retry, Property 3: Exponential backoff doubles delays up to maximum
  // Validates: Requirements 1.3
  test('Property 3: Exponential backoff doubles delays up to maximum', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 500 }), // initialDelay
        fc.integer({ min: 1000, max: 5000 }), // maxDelay
        fc.integer({ min: 0, max: 5 }), // attemptNumber
        (initialDelay, maxDelay, attemptNumber) => {
          const config = {
            maxAttempts: 10,
            initialDelay,
            maxDelay,
            backoffMultiplier: 2,
            backoffType: 'exponential'
          };

          const delay = calculateDelay(attemptNumber, config);
          const expectedDelay = Math.min(
            initialDelay * Math.pow(2, attemptNumber),
            maxDelay
          );

          return delay === expectedDelay;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: page-load-retry, Property 4: Linear backoff increments delays correctly
  // Validates: Requirements 3.2
  test('Property 4: Linear backoff increments delays correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 500 }), // initialDelay
        fc.integer({ min: 100, max: 1000 }), // backoffMultiplier
        fc.integer({ min: 1000, max: 5000 }), // maxDelay
        fc.integer({ min: 0, max: 5 }), // attemptNumber
        (initialDelay, backoffMultiplier, maxDelay, attemptNumber) => {
          const config = {
            maxAttempts: 10,
            initialDelay,
            maxDelay,
            backoffMultiplier,
            backoffType: 'linear'
          };

          const delay = calculateDelay(attemptNumber, config);
          const expectedDelay = Math.min(
            initialDelay + (backoffMultiplier * attemptNumber),
            maxDelay
          );

          return delay === expectedDelay;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: page-load-retry, Property 8: Element polling respects interval and timeout
  // Validates: Requirements 2.4, 2.5
  test('Property 8: Element polling respects interval and timeout', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 500, max: 1500 }), // timeout
        async (timeout) => {
          // Create a mock DOM environment
          const originalQuerySelector = document.querySelector;
          let queryCount = 0;
          const startTime = Date.now();

          document.querySelector = () => {
            queryCount++;
            return null; // Element never found
          };

          try {
            await waitForElement('.non-existent-element', timeout);
            const elapsed = Date.now() - startTime;

            // Should have timed out around the specified timeout (allow 200ms tolerance)
            const timedOutCorrectly = elapsed >= timeout - 200 && elapsed <= timeout + 300;

            // Should have polled multiple times (at least timeout/pollInterval times)
            const expectedMinPolls = Math.floor(timeout / 100) - 1;
            const polledEnough = queryCount >= expectedMinPolls;

            return timedOutCorrectly && polledEnough;
          } finally {
            document.querySelector = originalQuerySelector;
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  // Feature: page-load-retry, Property 9: Configuration overrides change retry behavior
  // Validates: Requirements 4.3, 4.4
  test('Property 9: Configuration overrides change retry behavior', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 4 }), // customMaxAttempts
        fc.integer({ min: 20, max: 50 }), // customInitialDelay
        async (customMaxAttempts, customInitialDelay) => {
          let callCount = 0;
          const alwaysFailsFn = async () => {
            callCount++;
            return null;
          };

          const customConfig = {
            maxAttempts: customMaxAttempts,
            initialDelay: customInitialDelay,
            maxDelay: customInitialDelay * 10,
            backoffMultiplier: 2,
            backoffType: 'exponential'
          };

          await retryWithBackoff(alwaysFailsFn, customConfig);

          // Should use custom maxAttempts, not default
          return callCount === customMaxAttempts;
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  // Feature: page-load-retry, Property 10: Configuration object contains required fields
  // Validates: Requirements 4.2
  test('Property 10: Configuration object contains required fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          maxAttempts: fc.integer({ min: 1, max: 10 }),
          initialDelay: fc.integer({ min: 0, max: 1000 }),
          maxDelay: fc.integer({ min: 0, max: 5000 }),
          backoffMultiplier: fc.integer({ min: 1, max: 10 })
        }),
        (config) => {
          // Ensure maxDelay >= initialDelay for valid config
          if (config.maxDelay < config.initialDelay) {
            config.maxDelay = config.initialDelay;
          }

          const isValid = validateConfig(config);

          // Valid config should have all required fields
          const hasAllFields =
            'maxAttempts' in config &&
            'initialDelay' in config &&
            'maxDelay' in config &&
            'backoffMultiplier' in config;

          return isValid === hasAllFields;
        }
      ),
      { numRuns: 100 }
    );
  });
});
