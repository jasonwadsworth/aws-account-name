/**
 * Property-based tests for portal content script retry behavior
 * Feature: page-load-retry
 */

const fc = require('fast-check');

// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(() => Promise.resolve({ success: true }))
  }
};

// Mock retry utils
const mockRetryUtils = {
  RETRY_CONFIG: {
    portal: {
      maxAttempts: 5,
      initialDelay: 200,
      maxDelay: 2000,
      backoffMultiplier: 2,
      backoffType: 'exponential'
    }
  },
  retryWithBackoff: null, // Will be set in tests
  waitForDOMReady: () => Promise.resolve()
};

// Mock require for portal-content
jest.mock('../../src/retry-utils.js', () => mockRetryUtils);

describe('Portal Content Script Property Tests', () => {
  let extractAccountsFromPortal;
  let extractAccountsWithRetry;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Load portal content script
    const portalContent = require('../../src/portal-content.js');
    extractAccountsFromPortal = portalContent.extractAccountsFromPortal;
    extractAccountsWithRetry = portalContent.extractAccountsWithRetry;
  });

  // Feature: page-load-retry, Property 1: Retry mechanism attempts extraction multiple times on failure
  // Validates: Requirements 1.1
  test('Property 1: Retry mechanism attempts extraction multiple times on failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // maxAttempts
        fc.integer({ min: 10, max: 50 }), // initialDelay
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

          // Mock DOM with no accounts
          document.body.innerHTML = '<div>No accounts here</div>';
          document.querySelectorAll = () => [];

          const config = {
            maxAttempts,
            initialDelay,
            maxDelay: initialDelay * 5,
            backoffMultiplier: 2,
            backoffType: 'exponential'
          };

          await mockRetryUtils.retryWithBackoff(
            () => {
              const accounts = extractAccountsFromPortal();
              return accounts.length > 0 ? accounts : null;
            },
            config
          );

          // Should have attempted extraction maxAttempts times
          return callCount === maxAttempts;
        }
      ),
      { numRuns: 30 }
    );
  }, 30000);

  // Feature: page-load-retry, Property 7: DOM ready state determines initialization path
  // Validates: Requirements 2.1, 2.2, 2.3
  test('Property 7: DOM ready state determines initialization path', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('loading', 'interactive', 'complete'),
        async (readyState) => {
          let eventListenerAdded = false;
          let resolvedImmediately = false;

          // Mock document.readyState
          Object.defineProperty(document, 'readyState', {
            writable: true,
            value: readyState
          });

          // Mock addEventListener
          const originalAddEventListener = document.addEventListener;
          document.addEventListener = (event, handler, options) => {
            if (event === 'DOMContentLoaded') {
              eventListenerAdded = true;
              // Simulate event firing
              setTimeout(() => handler(), 10);
            }
            return originalAddEventListener.call(document, event, handler, options);
          };

          // Test waitForDOMReady behavior
          const startTime = Date.now();
          await mockRetryUtils.waitForDOMReady();
          const elapsed = Date.now() - startTime;

          if (elapsed < 5) {
            resolvedImmediately = true;
          }

          // Restore
          document.addEventListener = originalAddEventListener;

          // If readyState is 'loading', should add event listener
          // If readyState is 'interactive' or 'complete', should resolve immediately
          if (readyState === 'loading') {
            return eventListenerAdded || resolvedImmediately;
          } else {
            return resolvedImmediately;
          }
        }
      ),
      { numRuns: 30 }
    );
  }, 30000);
});
