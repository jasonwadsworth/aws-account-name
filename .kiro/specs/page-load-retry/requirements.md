# Requirements Document

## Introduction

This feature enhances the AWS Account Name Display browser extension to reliably extract account information from dynamically loaded web pages. Currently, the extension may fail to find account IDs when pages haven't fully loaded their content. This enhancement adds retry logic with configurable delays and improved page load detection to ensure account information is consistently captured.

## Glossary

- **Extension**: The AWS Account Name Display browser extension
- **Content Script**: JavaScript code injected into web pages by the extension
- **Portal Page**: The AWS IAM Identity Center access portal page (*.awsapps.com/start/*)
- **Console Page**: AWS Console pages (*.console.aws.amazon.com/*)
- **Account Extraction**: The process of finding and parsing AWS account IDs and names from page content
- **DOM**: Document Object Model, the tree structure representing the HTML page
- **Retry Logic**: Code that attempts an operation multiple times with delays between attempts

## Requirements

### Requirement 1

**User Story:** As a user, I want the extension to reliably find account IDs on portal pages, so that account information is consistently captured even when pages load slowly.

#### Acceptance Criteria

1. WHEN the portal page content is not immediately available THEN the Extension SHALL retry account extraction with exponential backoff delays
2. WHEN the Extension performs retry attempts THEN the Extension SHALL wait at least 200ms between the first and second attempt
3. WHEN the Extension performs subsequent retry attempts THEN the Extension SHALL double the delay time for each attempt up to a maximum of 2000ms
4. WHEN the Extension has attempted extraction 5 times without finding accounts THEN the Extension SHALL stop retrying and log the failure
5. WHEN account information is found on any retry attempt THEN the Extension SHALL immediately stop retrying and process the found accounts

### Requirement 2

**User Story:** As a user, I want the extension to wait for page content to be ready before searching, so that extraction succeeds on the first attempt when possible.

#### Acceptance Criteria

1. WHEN the portal content script initializes THEN the Extension SHALL wait for the DOM to reach the "complete" or "interactive" ready state before attempting extraction
2. WHEN the page ready state is "loading" THEN the Extension SHALL register a listener for the DOMContentLoaded event
3. WHEN the page ready state is "complete" or "interactive" THEN the Extension SHALL proceed with account extraction immediately
4. WHEN specific DOM elements are required for extraction THEN the Extension SHALL poll for their presence before attempting to extract data from them
5. WHEN polling for DOM elements THEN the Extension SHALL check every 100ms for up to 3000ms before considering the element unavailable

### Requirement 3

**User Story:** As a user, I want the console page to reliably display account names, so that I can identify which account I'm working in even when the console loads slowly.

#### Acceptance Criteria

1. WHEN the console content script cannot find the account menu element THEN the Extension SHALL retry with delays up to 5 times
2. WHEN retrying on console pages THEN the Extension SHALL use delays of 500ms, 1000ms, 1500ms, 2000ms, and 2500ms between attempts
3. WHEN the account menu element appears during a retry THEN the Extension SHALL immediately proceed with account ID extraction
4. WHEN all retry attempts are exhausted without finding the account menu THEN the Extension SHALL log a warning and stop attempting
5. WHEN the page URL changes in a single-page application THEN the Extension SHALL restart the retry logic for the new page content

### Requirement 4

**User Story:** As a developer, I want configurable retry parameters, so that I can tune the extension's behavior for different network conditions and page load speeds.

#### Acceptance Criteria

1. WHEN retry logic is implemented THEN the Extension SHALL define retry configuration in a centralized configuration object
2. WHEN configuration is defined THEN the Extension SHALL include parameters for maximum retry attempts, initial delay, maximum delay, and backoff multiplier
3. WHEN extraction functions are called THEN the Extension SHALL accept optional configuration overrides for retry behavior
4. WHEN no configuration override is provided THEN the Extension SHALL use default retry parameters
5. WHEN retry attempts are in progress THEN the Extension SHALL log the current attempt number and delay time for debugging purposes
