/**
 * Retry Utilities
 * Provides retry logic with exponential/linear backoff and DOM ready detection
 */

// Retry configuration for different scenarios
const RETRY_CONFIG = {
  portal: {
    maxAttempts: 5,
    initialDelay: 200,
    maxDelay: 2000,
    backoffMultiplier: 2,
    backoffType: 'exponential'
  },
  console: {
    maxAttempts: 5,
    initialDelay: 500,
    maxDelay: 2500,
    backoffMultiplier: 500,
    backoffType: 'linear'
  },
  elementPolling: {
    pollInterval: 100,
    timeout: 3000
  }
};

/**
 * Validates retry configuration object
 * @param {Object} config - Configuration to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    return false;
  }

  const { maxAttempts, initialDelay, maxDelay, backoffMultiplier } = config;

  if (typeof maxAttempts !== 'number' || maxAttempts <= 0) {
    return false;
  }

  if (typeof initialDelay !== 'number' || initialDelay < 0) {
    return false;
  }

  if (typeof maxDelay !== 'number' || maxDelay < 0) {
    return false;
  }

  if (typeof backoffMultiplier !== 'number' || backoffMultiplier <= 0) {
    return false;
  }

  if (maxDelay < initialDelay) {
    return false;
  }

  return true;
}

/**
 * Calculates the delay for a retry attempt
 * @param {number} attemptNumber - Current attempt number (0-indexed)
 * @param {Object} config - Retry configuration
 * @returns {number} Delay in milliseconds
 */
function calculateDelay(attemptNumber, config) {
  const { initialDelay, maxDelay, backoffMultiplier, backoffType } = config;

  let delay;
  if (backoffType === 'exponential') {
    // Exponential: initialDelay * (multiplier ^ attemptNumber)
    delay = initialDelay * Math.pow(backoffMultiplier, attemptNumber);
  } else {
    // Linear: initialDelay + (multiplier * attemptNumber)
    delay = initialDelay + (backoffMultiplier * attemptNumber);
  }

  return Math.min(delay, maxDelay);
}

/**
 * Executes a function with retry logic and backoff
 * @param {Function} fn - Async function to execute (should return truthy on success, falsy on failure)
 * @param {Object} config - Retry configuration
 * @returns {Promise<any>} Result from fn, or null if all attempts fail
 */
async function retryWithBackoff(fn, config) {
  // Validate and use default config if invalid
  if (!validateConfig(config)) {
    console.warn('[AWS Account Display] Invalid retry config, using portal defaults');
    config = RETRY_CONFIG.portal;
  }

  const { maxAttempts } = config;
  let lastResult = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`[AWS Account Display] Retry attempt ${attempt + 1}/${maxAttempts}`);

      const result = await fn();

      if (result) {
        console.log(`[AWS Account Display] Success on attempt ${attempt + 1}`);
        return result;
      }

      lastResult = result;

      // If this isn't the last attempt, wait before retrying
      if (attempt < maxAttempts - 1) {
        const delay = calculateDelay(attempt, config);
        console.log(`[AWS Account Display] Attempt ${attempt + 1} failed, retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`[AWS Account Display] Error on attempt ${attempt + 1}:`, error);

      // If this isn't the last attempt, wait before retrying
      if (attempt < maxAttempts - 1) {
        const delay = calculateDelay(attempt, config);
        console.log(`[AWS Account Display] Retrying in ${delay}ms after error`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.warn(`[AWS Account Display] All ${maxAttempts} attempts exhausted`);
  return lastResult;
}

/**
 * Waits for the DOM to be ready
 * @returns {Promise<void>} Resolves when DOM is ready
 */
function waitForDOMReady() {
  return new Promise((resolve) => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      console.log('[AWS Account Display] DOM already ready');
      resolve();
    } else {
      console.log('[AWS Account Display] Waiting for DOMContentLoaded');
      document.addEventListener('DOMContentLoaded', () => {
        console.log('[AWS Account Display] DOMContentLoaded fired');
        resolve();
      }, { once: true });
    }
  });
}

/**
 * Polls for a DOM element to appear
 * @param {string} selector - CSS selector for the element
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {Promise<Element|null>} The element if found, null if timeout
 */
function waitForElement(selector, timeout = RETRY_CONFIG.elementPolling.timeout) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const pollInterval = RETRY_CONFIG.elementPolling.pollInterval;

    const check = () => {
      const element = document.querySelector(selector);

      if (element) {
        console.log(`[AWS Account Display] Element found: ${selector}`);
        resolve(element);
        return;
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= timeout) {
        console.warn(`[AWS Account Display] Element not found after ${timeout}ms: ${selector}`);
        resolve(null);
        return;
      }

      setTimeout(check, pollInterval);
    };

    check();
  });
}

// Export for use in content scripts and testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RETRY_CONFIG,
    validateConfig,
    calculateDelay,
    retryWithBackoff,
    waitForDOMReady,
    waitForElement
  };
} else if (typeof window !== 'undefined') {
  // Browser context - expose to window
  window.RETRY_CONFIG = RETRY_CONFIG;
  window.validateConfig = validateConfig;
  window.calculateDelay = calculateDelay;
  window.retryWithBackoff = retryWithBackoff;
  window.waitForDOMReady = waitForDOMReady;
  window.waitForElement = waitForElement;
}
