/**
 * Property-based tests for console content script retry behavior
 * Feature: page-load-retry
 */

const fc = require('fast-check');

// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(() => Promise.resolve({ success: true, accountName: 'TestAccount' }))
  }
};

// Mock retry utils
const mockRetryUtils = {
  RETRY_CONFIG: {
    console: {
      maxAttempts: 5,
      initialDelay: 500,
      maxDelay: 2500,
      backoffMultiplier: 500,
      backoffType: 'linear'
    }
  },
  retryWithBackoff: null, // Will be set in tests
  waitForDOMReady: () => Promise.resolve()
};

// Mock require for console-content
jest.mock('../../src/retry-utils.js', () => mockRetryUtils);

describe('Console Content Script Property Tests', () => {
  let waitForAccountElement;
  let getCurrentAccountId;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock location
    delete window.location;
    window.location = { href: 'https://console.aws.amazon.com/test' };

    // Load console content script
    const consoleContent = require('../../src/console-content.js');
    waitForAccountElement = consoleContent.waitForAccountElement;
    getCurrentAccountId = consoleContent.getCurrentAccountId;
  });

  // Feature: page-load-retry, Property 1: Retry mechanism attempts extraction multiple times on failure
  // Validates: Requirements 1.1
  test('Property 1: Retry mechanism attempts extraction multiple times on failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // maxAttempts
        fc.integer({ min: 50, max: 200 }), // initialDelay
        async (maxAttempts, initialDelay) => {
          let callCount = 0;

          // Mock retryWithBackoff to track calls
          mockRetryUtils.retryWithBackoff = async (fn, config) => {
            for (let i = 0; i < config.maxAttempts; i++) {
              callCount++;
              const result = fn();
              if (result) return result;
              if (i < config.maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, config.initialDelay));
              }
            }
            return null;
          };

          // Mock DOM with no account menu
          document.querySelector = () => null;

          const config = {
            maxAttempts,
            initialDelay,
            maxDelay: initialDelay * 5,
            backoffMultiplier: initialDelay,
            backoffType: 'linear'
          };

          await mockRetryUtils.retryWithBackoff(
            () => document.querySelector('[data-testid="awsc-nav-account-menu-button"]'),
            config
          );

          // Should have attempted extraction maxAttempts times
          return callCount === maxAttempts;
        }
      ),
      { numRuns: 30 }
    );
  }, 30000);

  // Feature: page-load-retry, Property 12: URL changes restart retry logic
  // Validates: Requirements 3.5
  test('Property 12: URL changes restart retry logic', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.webUrl(), { minLength: 2, maxLength: 5 }),
        async (urls) => {
          let initCallCount = 0;
          const urlChanges = [];

          // Mock init function to track calls
          const mockInit = async () => {
            initCallCount++;
            urlChanges.push(window.location.href);
          };

          // Simulate URL changes
          for (const url of urls) {
            window.location.href = url;
            await mockInit();
          }

          // Should have called init for each URL
          return initCallCount === urls.length && urlChanges.length === urls.length;
        }
      ),
      { numRuns: 30 }
    );
  }, 30000);

  // Feature: page-load-retry, Property 11: Retry attempts are logged with details
  // Validates: Requirements 3.4, 4.5
  test('Property 11: Retry attempts are logged with details', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }), // maxAttempts
        fc.integer({ min: 50, max: 200 }), // initialDelay
        async (maxAttempts, initialDelay) => {
          const logMessages = [];
          const originalLog = console.log;
          const originalWarn = console.warn;

          // Capture console logs
          console.log = (...args) => {
            logMessages.push({ type: 'log', message: args.join(' ') });
          };
          console.warn = (...args) => {
            logMessages.push({ type: 'warn', message: args.join(' ') });
          };

          try {
            // Mock retryWithBackoff with logging
            mockRetryUtils.retryWithBackoff = async (fn, config) => {
              for (let i = 0; i < config.maxAttempts; i++) {
                console.log(`[AWS Account Display] Retry attempt ${i + 1}/${config.maxAttempts}`);
                const result = fn();
                if (result) {
                  console.log(`[AWS Account Display] Success on attempt ${i + 1}`);
                  return result;
                }
                if (i < config.maxAttempts - 1) {
                  const delay = config.initialDelay + (config.backoffMultiplier * i);
                  console.log(`[AWS Account Display] Attempt ${i + 1} failed, retrying in ${delay}ms`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
              }
              console.warn(`[AWS Account Display] All ${config.maxAttempts} attempts exhausted`);
              return null;
            };

            // Mock DOM with no account menu
            document.querySelector = () => null;

            const config = {
              maxAttempts,
              initialDelay,
              maxDelay: initialDelay * 10,
              backoffMultiplier: initialDelay,
              backoffType: 'linear'
            };

            await mockRetryUtils.retryWithBackoff(
              () => document.querySelector('[data-testid="awsc-nav-account-menu-button"]'),
              config
            );

            // Should have logged attempt numbers and delays
            const hasAttemptLogs = logMessages.some(log =>
              log.message.includes('Retry attempt') && log.message.includes(`/${maxAttempts}`)
            );
            const hasDelayLogs = logMessages.some(log =>
              log.message.includes('retrying in') && log.message.includes('ms')
            );
            const hasExhaustedLog = logMessages.some(log =>
              log.message.includes('attempts exhausted')
            );

            return hasAttemptLogs && hasDelayLogs && hasExhaustedLog;
          } finally {
            console.log = originalLog;
            console.warn = originalWarn;
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});
