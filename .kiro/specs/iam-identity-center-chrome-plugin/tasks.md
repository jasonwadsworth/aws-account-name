# Implementation Plan

- [x] 1. Set up Chrome extension project structure
  - Create directory structure: `src/`, `tests/`, `icons/`
  - Create `manifest.json` with Manifest V3 configuration
  - Configure permissions for `storage` and host permissions for `*.awsapps.com/*` and `*.aws.amazon.com/*`
  - Set up `package.json` with Jest and fast-check dependencies
  - _Requirements: 1.1, 2.1_

- [x] 2. Implement storage service and validation utilities
  - [x] 2.1 Create validation functions for account ID and name
    - Implement `isValidAccountId()` to validate 12-digit account numbers
    - Implement `isValidAccountName()` and `sanitizeAccountName()` functions
    - _Requirements: 2.2, 3.1_
  - [x] 2.2 Write property test for storage round-trip
    - **Property 4: Storage round-trip consistency**
    - **Validates: Requirements 2.2, 3.1, 3.2**
  - [x] 2.3 Implement storage service in service worker
    - Create `storeAccounts()` function to save account mappings to Chrome local storage
    - Create `getAccountName()` function to retrieve account name by ID
    - Create `clearAllAccounts()` function to remove all stored data
    - _Requirements: 2.2, 3.1, 3.2, 3.3_
  - [x] 2.4 Write property test for storage update semantics
    - **Property 5: Storage update overwrites previous state**
    - **Validates: Requirements 2.3**
  - [x] 2.5 Write property test for clear functionality
    - **Property 6: Clear removes all stored data**
    - **Validates: Requirements 3.3**

- [x] 3. Implement portal content script for account extraction
  - [x] 3.1 Create portal content script with extraction logic
    - Implement `extractAccountsFromPortal()` to parse account data from DOM
    - Implement `observePortalChanges()` using MutationObserver for dynamic content
    - Wire up extraction to run on page load and content changes
    - _Requirements: 2.1, 2.3, 2.4_
  - [x] 3.2 Write property test for portal extraction
    - **Property 3: Portal extraction correctness**
    - **Validates: Requirements 2.1, 2.4**

- [x] 4. Implement service worker message handling
  - [x] 4.1 Create background service worker
    - Implement message listener for `STORE_ACCOUNTS`, `GET_ACCOUNT_NAME`, and `CLEAR_DATA` messages
    - Connect message handlers to storage service functions
    - _Requirements: 2.2, 3.1_
  - [x] 4.2 Write unit tests for message handling
    - Test each message type returns correct response format
    - Test error handling for invalid messages
    - _Requirements: 2.2, 3.1_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement console content script for display
  - [x] 6.1 Create console content script with account detection
    - Implement `getCurrentAccountId()` to extract account number from AWS Console page
    - Implement `waitForAccountElement()` with timeout for async page loads
    - _Requirements: 1.1, 4.1, 4.3_
  - [x] 6.2 Implement display injection logic
    - Implement `injectAccountNameDisplay()` to add account name element to page
    - Implement truncation logic for long account names with ellipsis
    - Implement tooltip with full account name and number on hover
    - Handle unknown accounts with placeholder text
    - _Requirements: 1.1, 1.2, 1.3, 5.2, 5.3_
  - [x] 6.3 Write property test for display completeness
    - **Property 1: Display includes account name and number**
    - **Validates: Requirements 1.1**
  - [x] 6.4 Write property test for tooltip content
    - **Property 2: Tooltip contains complete information**
    - **Validates: Requirements 1.3**
  - [x] 6.5 Write property test for truncation behavior
    - **Property 7: Long name truncation with full tooltip**
    - **Validates: Requirements 5.2**

- [x] 7. Create display styles
  - [x] 7.1 Create CSS file for account name display
    - Style account name display to match AWS Console aesthetic
    - Add truncation styles with text-overflow ellipsis
    - Style tooltip for hover state
    - _Requirements: 5.1, 5.2_

- [x] 8. Wire up content scripts and test integration
  - [x] 8.1 Connect portal content script to service worker
    - Send extracted accounts to service worker via message passing
    - Handle response and errors gracefully
    - _Requirements: 2.1, 2.2_
  - [x] 8.2 Connect console content script to service worker
    - Request account name from service worker when page loads
    - Update display when response received
    - Implement navigation change detection for SPA behavior
    - _Requirements: 1.1, 4.1_

- [x] 9. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
