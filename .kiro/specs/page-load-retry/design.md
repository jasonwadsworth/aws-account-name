# Design Document

## Overview

This design enhances the AWS Account Name Display extension with robust retry logic and improved page load detection. The core enhancement is a reusable retry mechanism that handles the asynchronous nature of modern web applications where content loads dynamically after the initial page load.

The design introduces:
1. A generic retry utility function with exponential backoff
2. Enhanced initialization logic that waits for appropriate DOM ready states
3. Element polling utilities that wait for specific DOM elements to appear
4. Configurable retry parameters for different extraction scenarios

## Architecture

### High-Level Flow

```
Page Load → Wait for DOM Ready → Attempt Extraction → Success?
                                          ↓ No
                                    Retry with Delay → Success?
                                          ↓ No
                                    Increase Delay → Retry → Success?
                                          ↓ No
                                    ... (up to max attempts)
                                          ↓ No
                                    Log Failure & Stop
```

### Component Interaction

```
┌─────────────────────────────────────────┐
│         Content Script Init             │
│  (portal-content.js / console-content.js)│
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      waitForDOMReady()                  │
│  Ensures DOM is in ready state          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   retryWithBackoff()                    │
│  Generic retry mechanism                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   waitForElement() / extractAccounts()  │
│  Specific extraction logic              │
└─────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Retry Configuration Object

A centralized configuration object that defines retry behavior:

```javascript
const RETRY_CONFIG = {
  portal: {
    maxAttempts: 5,
    initialDelay: 200,
    maxDelay: 2000,
    backoffMultiplier: 2
  },
  console: {
    maxAttempts: 5,
    initialDelay: 500,
    maxDelay: 2500,
    backoffMultiplier: 500  // Linear backoff for console
  },
  elementPolling: {
    pollInterval: 100,
    timeout: 3000
  }
};
```

### 2. Retry Utility Function

**Function:** `retryWithBackoff(fn, config)`

**Purpose:** Executes a function with retry logic and exponential/linear backoff

**Parameters:**
- `fn`: Async function that returns a result or null/undefined on failure
- `config`: Configuration object with `maxAttempts`, `initialDelay`, `maxDelay`, `backoffMultiplier`

**Returns:** Promise that resolves to the function result or null if all attempts fail

**Behavior:**
- Attempts to execute `fn`
- If result is truthy, returns immediately
- If result is falsy, waits for calculated delay and retries
- Calculates delay using: `min(initialDelay * (backoffMultiplier ^ attemptNumber), maxDelay)` for exponential
- Or: `min(initialDelay + (backoffMultiplier * attemptNumber), maxDelay)` for linear
- Logs each attempt with attempt number and delay
- Returns null after exhausting all attempts

### 3. DOM Ready Utility

**Function:** `waitForDOMReady()`

**Purpose:** Ensures the DOM is in a ready state before proceeding

**Returns:** Promise that resolves when DOM is ready

**Behavior:**
- If `document.readyState` is "complete" or "interactive", resolves immediately
- Otherwise, waits for "DOMContentLoaded" event
- Provides a consistent way to wait for DOM across both content scripts

### 4. Element Polling Utility

**Function:** `waitForElement(selector, timeout)`

**Purpose:** Polls for a DOM element to appear

**Parameters:**
- `selector`: CSS selector string
- `timeout`: Maximum time to wait in milliseconds (default: 3000)

**Returns:** Promise that resolves to the element or null if timeout reached

**Behavior:**
- Checks for element every 100ms
- Returns element immediately if found
- Returns null after timeout
- Used for waiting for specific elements before extraction

### 5. Enhanced Portal Extraction

**Function:** `extractAccountsWithRetry()`

**Purpose:** Wraps existing `extractAccountsFromPortal()` with retry logic

**Returns:** Promise that resolves to array of accounts

**Behavior:**
- Uses `retryWithBackoff` with portal configuration
- Calls existing `extractAccountsFromPortal()` function
- Returns empty array if all retries fail
- Logs success/failure appropriately

### 6. Enhanced Console Initialization

**Function:** `initWithRetry()`

**Purpose:** Replaces existing `init()` with retry-aware initialization

**Returns:** Promise

**Behavior:**
- Waits for DOM ready
- Uses `retryWithBackoff` to find account menu element
- Once element found, proceeds with account extraction
- Sets up navigation observer as before
- Logs retry attempts and final outcome

## Data Models

### RetryConfig Interface

```javascript
{
  maxAttempts: number,      // Maximum number of retry attempts
  initialDelay: number,     // Initial delay in milliseconds
  maxDelay: number,         // Maximum delay cap in milliseconds
  backoffMultiplier: number // Multiplier for exponential backoff or increment for linear
}
```

### RetryResult

```javascript
{
  success: boolean,         // Whether extraction succeeded
  result: any,              // The extracted data (accounts, element, etc.)
  attempts: number,         // Number of attempts made
  totalTime: number         // Total time spent in milliseconds
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Retry mechanism attempts extraction multiple times on failure

*For any* extraction function that initially fails, the retry mechanism should call the function multiple times until success or max attempts reached.
**Validates: Requirements 1.1**

### Property 2: Initial retry delay meets minimum threshold

*For any* retry sequence, the delay between the first and second attempt should be at least the configured initial delay (200ms for portal).
**Validates: Requirements 1.2**

### Property 3: Exponential backoff doubles delays up to maximum

*For any* retry sequence using exponential backoff, each delay should be double the previous delay, capped at the configured maximum delay (2000ms for portal).
**Validates: Requirements 1.3**

### Property 4: Linear backoff increments delays correctly

*For any* retry sequence using linear backoff, delays should follow the sequence: initialDelay, initialDelay + multiplier, initialDelay + 2*multiplier, etc., capped at maxDelay.
**Validates: Requirements 3.2**

### Property 5: Retry mechanism respects maximum attempt limit

*For any* extraction function that always fails, the retry mechanism should call it exactly maxAttempts times, then stop.
**Validates: Requirements 1.4, 3.1**

### Property 6: Successful extraction terminates retry early

*For any* extraction function that succeeds on attempt N (where N <= maxAttempts), the retry mechanism should call it exactly N times and return the result.
**Validates: Requirements 1.5, 3.3**

### Property 7: DOM ready state determines initialization path

*For any* document ready state, if the state is "complete" or "interactive", extraction should proceed immediately; if "loading", it should wait for DOMContentLoaded event.
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 8: Element polling respects interval and timeout

*For any* element selector, polling should check for the element at the configured interval (100ms) and stop after the configured timeout (3000ms).
**Validates: Requirements 2.4, 2.5**

### Property 9: Configuration overrides change retry behavior

*For any* extraction function, passing a custom configuration object should result in retry behavior that uses the custom parameters instead of defaults.
**Validates: Requirements 4.3, 4.4**

### Property 10: Configuration object contains required fields

*For any* retry configuration object, it should contain the fields: maxAttempts, initialDelay, maxDelay, and backoffMultiplier.
**Validates: Requirements 4.2**

### Property 11: Retry attempts are logged with details

*For any* retry sequence, each attempt should result in a log entry containing the attempt number and delay time.
**Validates: Requirements 3.4, 4.5**

### Property 12: URL changes restart retry logic

*For any* URL change in a single-page application, the retry logic should restart from attempt 1 with fresh state.
**Validates: Requirements 3.5**

## Error Handling

### Retry Exhaustion

When all retry attempts are exhausted without success:
- Log a clear warning message with context (which page, what was being extracted)
- Return a safe default value (empty array for accounts, null for elements)
- Do not throw exceptions that would break the content script
- Allow the MutationObserver to continue watching for future changes

### Invalid Configuration

When invalid retry configuration is provided:
- Validate configuration parameters (positive numbers, maxDelay >= initialDelay)
- Log a warning about invalid configuration
- Fall back to default configuration values
- Continue execution rather than failing

### Timeout Scenarios

When element polling or retry logic times out:
- Log the timeout with relevant context
- Return null or empty result
- Do not block indefinitely
- Allow other extension functionality to continue

### DOM Access Errors

When DOM queries fail (element not found, invalid selector):
- Catch and log the error
- Return null/empty result for that attempt
- Continue with retry logic if attempts remain
- Do not crash the content script

## Testing Strategy

### Unit Testing

Unit tests will cover:
- Individual utility functions (waitForDOMReady, waitForElement, retryWithBackoff)
- Configuration validation logic
- Delay calculation for both exponential and linear backoff
- Edge cases: zero attempts, negative delays, invalid selectors
- Mock DOM states and timing functions for deterministic tests

### Property-Based Testing

Property-based tests will verify the correctness properties defined above using a JavaScript PBT library (fast-check). Each property test will:
- Run a minimum of 100 iterations with randomized inputs
- Generate random configurations, extraction functions, and DOM states
- Verify the universal properties hold across all generated inputs
- Tag each test with the corresponding property number from this design document

**Testing Framework:** fast-check (JavaScript property-based testing library)

**Test Configuration:**
- Minimum iterations per property: 100
- Timeout per test: 5000ms
- Seed for reproducibility: logged on failure

**Property Test Tagging Format:**
Each property-based test must include a comment:
```javascript
// Feature: page-load-retry, Property N: [property description]
```

### Integration Testing

Integration tests will verify:
- End-to-end extraction flow with simulated page loads
- Interaction between retry logic and existing extraction functions
- MutationObserver behavior with retry logic
- Message passing to background service worker after successful extraction

### Manual Testing

Manual testing scenarios:
- Test on slow network connections (throttled to 3G)
- Test on pages with delayed JavaScript execution
- Test on different AWS portal versions
- Test console page navigation in SPA mode
- Verify logging output in browser console

## Implementation Notes

### Backward Compatibility

- Existing extraction functions (extractAccountsFromPortal, getCurrentAccountId) remain unchanged
- New retry logic wraps existing functions rather than modifying them
- Configuration is additive - no breaking changes to existing code
- MutationObserver continues to work as before

### Performance Considerations

- Retry delays are configurable to balance reliability vs. speed
- Exponential backoff prevents excessive retry attempts
- Element polling uses efficient intervals (100ms)
- Early termination on success minimizes unnecessary work
- Logging can be disabled in production if needed

### Browser Compatibility

- Uses standard Promise API (supported in all modern browsers)
- setTimeout for delays (universally supported)
- document.readyState and DOMContentLoaded (standard APIs)
- No dependencies on external libraries for core retry logic
- fast-check only used in tests, not in production code
