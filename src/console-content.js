/**
 * Console Content Script
 * Displays account name in AWS Console pages
 */

// Import retry utilities
let retryUtils;
if (typeof require !== 'undefined') {
  retryUtils = require('./retry-utils.js');
} else {
  // In browser context, retry-utils will be loaded separately
  retryUtils = {
    RETRY_CONFIG: window.RETRY_CONFIG,
    retryWithBackoff: window.retryWithBackoff,
    waitForDOMReady: window.waitForDOMReady
  };
}

// Configuration
const CONFIG = {
  maxNameLength: 30,
  waitTimeout: 5000,
  pollInterval: 100,
  displayElementId: 'aws-account-name-display'
};

// Selectors for AWS Console account elements
const CONSOLE_SELECTORS = {
  // Primary selectors for account info
  accountDetails: '[data-testid="aws-my-account-details"]',
  accountMenu: '[data-testid="awsc-nav-account-menu-button"]',
  // Additional selectors for different console versions
  accountMenuAlt: '#nav-usernameMenu, [data-testid="account-menu-button"], [data-testid="more-menu__awsc-nav-account-menu-button"]',
  // Navigation bar account info
  navAccountInfo: '[data-testid="account-detail-menu"], .nav-elt-label',
  // Account ID patterns in the page
  accountIdPattern: /\b(\d{12})\b/,
  // Pattern with dashes (AWS Console shows "Account ID: 1234-5678-9012")
  // Note: May not have word boundary after due to text like "6022-2330-6405AWSAdministratorAccess"
  accountIdPatternDashed: /(\d{4})-(\d{4})-(\d{4})/
};

/**
 * Extracts the current account name from the AWS Console page
 * The account name appears in the account menu button's description (e.g., "@ cloud913")
 * @returns {string|null} The account name or null if not found
 */
function getCurrentAccountName() {
  // Look for the account menu button and check its aria attributes
  const accountButton = document.querySelector('[data-testid="awsc-nav-account-menu-button"]') ||
                        document.querySelector('button[aria-label*="@"]');

  if (accountButton) {
    // Check aria-describedby or aria-label for account name
    const description = accountButton.getAttribute('aria-describedby');
    const label = accountButton.getAttribute('aria-label');
    const title = accountButton.getAttribute('title');

    // Try to find "@ accountName" pattern in any of these
    const textToSearch = [description, label, title].filter(Boolean).join(' ');

    // Also check the button's description element if aria-describedby points to one
    if (description) {
      const descEl = document.getElementById(description);
      if (descEl) {
        const descText = descEl.textContent || '';
        const match = descText.match(/@\s*([A-Za-z0-9\-_]+)/);
        if (match) {
          console.log('[AWS Account Display] Found account name in description element:', match[1]);
          return match[1];
        }
      }
    }

    // Check button's own text content and attributes
    const buttonText = accountButton.textContent || '';
    const allText = buttonText + ' ' + textToSearch;

    // Pattern: "@ accountName" at the end
    const match = allText.match(/@\s*([A-Za-z0-9\-_\s]+?)(?:\s*$|[,\|])/);
    if (match) {
      console.log('[AWS Account Display] Found account name in button:', match[1].trim());
      return match[1].trim();
    }
  }

  // Try to find account name in navigation elements
  const navElements = document.querySelectorAll('nav button, header button');
  for (const el of navElements) {
    const text = (el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '');
    const match = text.match(/@\s*([A-Za-z0-9\-_\s]+?)(?:\s*$|[,\|])/);
    if (match) {
      console.log('[AWS Account Display] Found account name in nav element:', match[1].trim());
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extracts the current account ID from the AWS Console page
 * @returns {string|null} The 12-digit account ID or null if not found
 */
function getCurrentAccountId() {
  // List of selectors to try in order
  const selectorsToTry = [
    CONSOLE_SELECTORS.accountDetails,
    CONSOLE_SELECTORS.accountMenu,
    CONSOLE_SELECTORS.accountMenuAlt,
    CONSOLE_SELECTORS.navAccountInfo
  ];

  // First, check the account menu button directly (most reliable)
  const accountButton = document.querySelector('[data-testid="awsc-nav-account-menu-button"]');
  if (accountButton) {
    const buttonText = accountButton.textContent || '';

    // Try dashed pattern first (AWS Console shows 1234-5678-9012)
    const dashedMatch = buttonText.match(CONSOLE_SELECTORS.accountIdPatternDashed);
    if (dashedMatch) {
      console.log('[AWS Account Display] Found dashed account ID in account button');
      return dashedMatch[1] + dashedMatch[2] + dashedMatch[3];
    }

    // Try standard 12-digit pattern
    const match = buttonText.match(CONSOLE_SELECTORS.accountIdPattern);
    if (match) {
      console.log('[AWS Account Display] Found account ID in account button');
      return match[1];
    }
  }

  // Try each selector
  for (const selector of selectorsToTry) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent || '';

        // Try standard 12-digit pattern
        const match = text.match(CONSOLE_SELECTORS.accountIdPattern);
        if (match) {
          console.log('[AWS Account Display] Found account ID via selector:', selector);
          return match[1];
        }

        // Try dashed pattern (1234-5678-9012)
        const dashedMatch = text.match(CONSOLE_SELECTORS.accountIdPatternDashed);
        if (dashedMatch) {
          console.log('[AWS Account Display] Found dashed account ID via selector:', selector);
          return dashedMatch[1] + dashedMatch[2] + dashedMatch[3];
        }
      }
    } catch (e) {
      // Invalid selector, skip
    }
  }

  // Try to find in the entire nav bar area
  const navBar = document.querySelector('nav, header, [role="navigation"]');
  if (navBar) {
    const text = navBar.textContent || '';
    const match = text.match(CONSOLE_SELECTORS.accountIdPattern);
    if (match) {
      console.log('[AWS Account Display] Found account ID in nav bar');
      return match[1];
    }
    const dashedMatch = text.match(CONSOLE_SELECTORS.accountIdPatternDashed);
    if (dashedMatch) {
      console.log('[AWS Account Display] Found dashed account ID in nav bar');
      return dashedMatch[1] + dashedMatch[2] + dashedMatch[3];
    }
  }

  // Last resort: search visible text on page (limited to reduce false positives)
  const bodyText = document.body?.innerText?.substring(0, 10000) || '';
  const match = bodyText.match(CONSOLE_SELECTORS.accountIdPattern);
  if (match) {
    console.log('[AWS Account Display] Found account ID in body text');
    return match[1];
  }

  return null;
}

/**
 * Waits for the account element to appear in the DOM with retry logic
 * @param {number} timeout - Maximum wait time in milliseconds
 * @returns {Promise<Element|null>}
 */
async function waitForAccountElement(timeout = CONFIG.waitTimeout) {
  const config = retryUtils?.RETRY_CONFIG?.console || {
    maxAttempts: 5,
    initialDelay: 500,
    maxDelay: 2500,
    backoffMultiplier: 500,
    backoffType: 'linear'
  };

  const retryFn = retryUtils?.retryWithBackoff ||
                  (typeof window !== 'undefined' && window.retryWithBackoff);

  if (!retryFn) {
    // Fallback to original polling logic
    return new Promise((resolve) => {
      const startTime = Date.now();

      const check = () => {
        const element = document.querySelector(CONSOLE_SELECTORS.accountMenu) ||
                        document.querySelector(CONSOLE_SELECTORS.accountMenuAlt);

        if (element) {
          resolve(element);
          return;
        }

        if (Date.now() - startTime >= timeout) {
          resolve(null);
          return;
        }

        setTimeout(check, CONFIG.pollInterval);
      };

      check();
    });
  }

  // Use retry logic
  const result = await retryFn(
    () => {
      const element = document.querySelector(CONSOLE_SELECTORS.accountMenu) ||
                      document.querySelector(CONSOLE_SELECTORS.accountMenuAlt);
      return element || null;
    },
    config
  );

  return result;
}

/**
 * Truncates a string with ellipsis if it exceeds max length
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated text with ellipsis or original text
 */
function truncateText(text, maxLength = CONFIG.maxNameLength) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Creates the display element HTML
 * @param {string} accountName - The account name to display
 * @param {string} accountId - The 12-digit account ID
 * @returns {{displayText: string, tooltipText: string, element: HTMLElement}}
 */
function createDisplayElement(accountName, accountId) {
  const displayText = truncateText(accountName);
  const tooltipText = `${accountName} (${accountId})`;

  const element = document.createElement('span');
  element.id = CONFIG.displayElementId;
  element.className = 'aws-account-name-display';
  element.textContent = displayText;
  element.title = tooltipText;
  element.setAttribute('data-account-id', accountId);
  element.setAttribute('data-full-name', accountName);

  return { displayText, tooltipText, element };
}

/**
 * Injects the account name display into the page by replacing "Account ID:" text
 * @param {string} accountName - The account name to display
 * @param {string} accountId - The 12-digit account ID
 */
function injectAccountNameDisplay(accountName, accountId) {
  // Find the account menu button
  const accountMenu = document.querySelector(CONSOLE_SELECTORS.accountMenu);

  if (accountMenu) {
    // Look for text nodes containing "Account ID:" and replace with account name
    const walker = document.createTreeWalker(
      accountMenu,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.includes('Account ID:')) {
        // Replace "Account ID:" with the account name
        node.textContent = node.textContent.replace('Account ID:', accountName + ':');
        console.log('[AWS Account Display] Replaced "Account ID:" with account name');
        return;
      }
    }

    // If no "Account ID:" text found, the page may already show the account name
    console.log('[AWS Account Display] No "Account ID:" text found, page may already show account name');
  }
}

/**
 * Requests account name from background service worker
 * @param {string} accountId - The 12-digit account ID
 * @returns {Promise<string|null>}
 */
async function requestAccountName(accountId) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_ACCOUNT_NAME',
      accountId: accountId
    });

    return response?.success ? response.accountName : null;
  } catch (error) {
    console.error('[AWS Account Display] Failed to get account name:', error);
    return null;
  }
}

/**
 * Requests account ID by name from background service worker
 * @param {string} accountName - The account name to look up
 * @returns {Promise<string|null>}
 */
async function requestAccountIdByName(accountName) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_ACCOUNT_BY_NAME',
      accountName: accountName
    });

    return response?.success ? response.accountId : null;
  } catch (error) {
    console.error('[AWS Account Display] Failed to get account by name:', error);
    return null;
  }
}

/**
 * Updates the display with the current account information
 */
async function updateDisplay() {
  // First try to get account ID directly from the page
  let accountId = getCurrentAccountId();
  let accountName = null;

  if (accountId) {
    // We have the account ID, look up the name
    accountName = await requestAccountName(accountId);
  } else {
    // No account ID visible, try to get account name from the page
    const pageAccountName = getCurrentAccountName();

    if (pageAccountName) {
      console.log('[AWS Account Display] Found account name on page:', pageAccountName);
      // Look up the account ID by name
      accountId = await requestAccountIdByName(pageAccountName);

      if (accountId) {
        accountName = pageAccountName;
        console.log('[AWS Account Display] Matched account name to ID:', accountId);
      } else {
        // Account name found but not in storage - display it anyway
        accountName = pageAccountName;
        accountId = 'unknown';
        console.log('[AWS Account Display] Account name not in storage, displaying anyway');
      }
    }
  }

  if (!accountId && !accountName) {
    console.log('[AWS Account Display] No account ID or name found on page');
    return;
  }

  const displayName = accountName || 'Unknown Account';
  injectAccountNameDisplay(displayName, accountId);
  console.log('[AWS Account Display] Displaying:', displayName, 'for account', accountId);
}

/**
 * Sets up navigation change detection for SPA behavior
 */
function setupNavigationObserver() {
  // Watch for URL changes
  let lastUrl = location.href;

  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      console.log('[AWS Account Display] URL changed, restarting retry logic');
      // Restart initialization with fresh retry state
      init();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also listen for popstate events
  window.addEventListener('popstate', () => {
    console.log('[AWS Account Display] Popstate event, restarting retry logic');
    init();
  });
}

/**
 * Main initialization function
 */
async function init() {
  // Wait for DOM to be ready
  const waitFn = retryUtils?.waitForDOMReady ||
                 (typeof window !== 'undefined' && window.waitForDOMReady);

  if (waitFn) {
    await waitFn();
  }

  // Wait for account element to appear with retry logic
  const accountElement = await waitForAccountElement();

  if (!accountElement) {
    console.warn('[AWS Account Display] Account element not found after all retries');
    return;
  }

  // Update display
  await updateDisplay();

  // Set up navigation observer for SPA behavior
  setupNavigationObserver();
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getCurrentAccountId,
    waitForAccountElement,
    truncateText,
    createDisplayElement,
    injectAccountNameDisplay,
    requestAccountName,
    updateDisplay,
    CONFIG,
    CONSOLE_SELECTORS
  };
}
