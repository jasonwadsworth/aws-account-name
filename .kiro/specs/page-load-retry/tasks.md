# Implementation Plan

- [x] 1. Create retry utility module with core retry logic
  - Create new file `src/retry-utils.js` with retry utility functions
  - Implement `retryWithBackoff(fn, config)` function with exponential and linear backoff support
  - Implement `waitForDOMReady()` function for DOM ready state detection
  - Implement `waitForElement(selector, timeout)` function for element polling
  - Add configuration validation logic
  - Add detailed logging for debugging
  - Export all utility functions for use in content scripts
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.5_

- [x] 1.1 Write property test for retry attempt limit
  - **Property 5: Retry mechanism respects maximum attempt limit**
  - **Validates: Requirements 1.4, 3.1**

- [x] 1.2 Write property test for early termination on success
  - **Property 6: Successful extraction terminates retry early**
  - **Validates: Requirements 1.5, 3.3**

- [x] 1.3 Write property test for initial delay threshold
  - **Property 2: Initial retry delay meets minimum threshold**
  - **Validates: Requirements 1.2**

- [x] 1.4 Write property test for exponential backoff calculation
  - **Property 3: Exponential backoff doubles delays up to maximum**
  - **Validates: Requirements 1.3**

- [x] 1.5 Write property test for linear backoff calculation
  - **Property 4: Linear backoff increments delays correctly**
  - **Validates: Requirements 3.2**

- [x] 1.6 Write property test for element polling timing
  - **Property 8: Element polling respects interval and timeout**
  - **Validates: Requirements 2.4, 2.5**

- [x] 1.7 Write property test for configuration overrides
  - **Property 9: Configuration overrides change retry behavior**
  - **Validates: Requirements 4.3, 4.4**

- [x] 1.8 Write property test for configuration structure
  - **Property 10: Configuration object contains required fields**
  - **Validates: Requirements 4.2**

- [x] 2. Define retry configuration constants
  - Add `RETRY_CONFIG` object to `src/retry-utils.js` with portal and console configurations
  - Define portal config: maxAttempts=5, initialDelay=200, maxDelay=2000, backoffMultiplier=2
  - Define console config: maxAttempts=5, initialDelay=500, maxDelay=2500, backoffMultiplier=500
  - Define elementPolling config: pollInterval=100, timeout=3000
  - Export configuration object
  - _Requirements: 4.1, 4.2_

- [x] 3. Enhance portal content script with retry logic
  - Import retry utilities into `src/portal-content.js`
  - Create `extractAccountsWithRetry()` function that wraps `extractAccountsFromPortal()` with retry logic
  - Update `init()` function to call `waitForDOMReady()` before extraction
  - Replace direct `extractAccountsFromPortal()` calls with `extractAccountsWithRetry()`
  - Update MutationObserver callback to use retry logic
  - Add logging for retry attempts and outcomes
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 4.3, 4.4, 4.5_

- [x] 3.1 Write property test for portal retry behavior
  - **Property 1: Retry mechanism attempts extraction multiple times on failure**
  - **Validates: Requirements 1.1**

- [x] 3.2 Write property test for DOM ready initialization
  - **Property 7: DOM ready state determines initialization path**
  - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 4. Enhance console content script with retry logic
  - Import retry utilities into `src/console-content.js`
  - Update `init()` function to use `waitForDOMReady()` and `retryWithBackoff()` for finding account menu
  - Replace `waitForAccountElement()` with new retry-based implementation using console config
  - Update account ID extraction to use retry logic
  - Add logging for retry attempts and outcomes
  - Ensure URL change detection restarts retry logic with fresh state
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.3, 4.4, 4.5_

- [x] 4.1 Write property test for console retry behavior
  - **Property 1: Retry mechanism attempts extraction multiple times on failure**
  - **Validates: Requirements 1.1**

- [x] 4.2 Write property test for URL change handling
  - **Property 12: URL changes restart retry logic**
  - **Validates: Requirements 3.5**

- [x] 4.3 Write property test for logging behavior
  - **Property 11: Retry attempts are logged with details**
  - **Validates: Requirements 3.4, 4.5**

- [x] 5. Update manifest and exports for testing
  - Ensure `src/retry-utils.js` is properly exported for testing
  - Update module exports in content scripts to include new retry functions
  - Verify no breaking changes to existing exports
  - _Requirements: 4.1_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
