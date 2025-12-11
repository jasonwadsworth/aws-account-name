# Requirements Document

## Introduction

This document specifies the requirements for a Chrome browser extension that enhances the AWS IAM Identity Center experience. The extension displays the friendly account name alongside the account number when users are working within an AWS account, making it easier to identify which account they are currently operating in. The account name is retrieved from the IAM Identity Center access portal page.

## Glossary

- **Chrome Extension**: A software module that customizes the Google Chrome browser experience
- **AWS IAM Identity Center**: AWS service (formerly AWS SSO) that manages workforce identities and access to AWS accounts
- **Access Portal**: The IAM Identity Center web page where users see and select from their available AWS accounts
- **Account Number**: The 12-digit unique identifier for an AWS account
- **Account Name**: The human-readable friendly name assigned to an AWS account in the organization
- **Content Script**: JavaScript that runs in the context of web pages loaded in the browser
- **Background Service Worker**: A script that runs in the background of a Chrome extension to handle events and manage state

## Requirements

### Requirement 1

**User Story:** As an AWS user, I want to see the account name displayed with the account number in the AWS Console, so that I can quickly identify which account I am working in without memorizing account numbers.

#### Acceptance Criteria

1. WHEN the user navigates to an AWS Console page THEN the Chrome Extension SHALL display the account name alongside the account number in a visible location
2. WHEN the account name is not available in storage THEN the Chrome Extension SHALL display only the account number with a placeholder indicating the name is unknown
3. WHEN the user hovers over the account display THEN the Chrome Extension SHALL show both the full account name and account number in a tooltip

### Requirement 2

**User Story:** As an AWS user, I want the extension to automatically capture account names from the IAM Identity Center access portal, so that I don't have to manually configure account names.

#### Acceptance Criteria

1. WHEN the user visits the IAM Identity Center access portal page THEN the Chrome Extension SHALL extract account names and their corresponding account numbers from the page content
2. WHEN account information is extracted THEN the Chrome Extension SHALL store the account name and number mappings in local storage
3. WHEN the access portal page content changes THEN the Chrome Extension SHALL update the stored account mappings to reflect the current state
4. WHEN parsing the access portal page THEN the Chrome Extension SHALL handle pages with multiple accounts correctly

### Requirement 3

**User Story:** As an AWS user, I want the account information to persist across browser sessions, so that I don't need to revisit the access portal every time I open the browser.

#### Acceptance Criteria

1. WHEN account mappings are stored THEN the Chrome Extension SHALL persist the data using Chrome's local storage API
2. WHEN the browser is restarted THEN the Chrome Extension SHALL retrieve previously stored account mappings
3. WHEN the user clears extension data THEN the Chrome Extension SHALL remove all stored account mappings

### Requirement 4

**User Story:** As an AWS user, I want the extension to work reliably across different AWS Console pages, so that I always know which account I'm in regardless of which service I'm using.

#### Acceptance Criteria

1. WHEN the user navigates between different AWS service pages THEN the Chrome Extension SHALL maintain the account display consistently
2. WHEN the AWS Console page structure varies by service THEN the Chrome Extension SHALL locate and display account information correctly
3. WHEN the page loads asynchronously THEN the Chrome Extension SHALL wait for the account number element to appear before displaying the account name

### Requirement 5

**User Story:** As an AWS user, I want the account display to be visually clear and non-intrusive, so that it enhances my workflow without cluttering the interface.

#### Acceptance Criteria

1. WHEN displaying the account name THEN the Chrome Extension SHALL use styling consistent with the AWS Console design
2. WHEN the account name is long THEN the Chrome Extension SHALL truncate the display with an ellipsis while showing the full name on hover
3. WHEN injecting display elements THEN the Chrome Extension SHALL position the account name near the existing account number display
