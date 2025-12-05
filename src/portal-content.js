/**
 * Portal Content Script
 * Extracts account information from IAM Identity Center access portal
 */

// Selectors for IAM Identity Center Portal elements
const PORTAL_SELECTORS = {
  // Primary selectors based on common portal structure
  accountList: 'portal-application',
  accountItem: 'portal-instance',
  accountName: '.name',
  accountId: '.accountId, .account-id, [class*="accountId"]'
};

// Fallback selectors for different portal versions
const FALLBACK_SELECTORS = {
  accountItem: '[data-testid="account-list-cell"], .sso-account-card, [class*="account"]',
  accountName: '[data-testid="account-name"], .account-name, [class*="accountName"]',
  accountId: '[data-testid="account-id"], .account-id, [class*="accountId"]'
};

/**
 * Extracts account information from the portal page DOM
 * @returns {Array<{accountId: string, accountName: string}>}
 */
function extractAccountsFromPortal() {
  const accounts = [];

  // Try to find account buttons in the AWS SSO portal
  // These have format: "AccountName AccountId | email" (may or may not have space before ID)
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    const text = button.textContent || '';
    // Match: AccountName (with optional spaces) followed by 12-digit ID and pipe
    const match = text.match(/^([A-Za-z][A-Za-z0-9\s\-_]*?)\s*(\d{12})\s*\|/);
    if (match) {
      accounts.push({
        accountName: match[1].trim(),
        accountId: match[2]
      });
    }
  }

  if (accounts.length > 0) {
    console.log('[AWS Account Display] Found accounts via button elements');
    return accounts;
  }

  // Try to find account items using primary selectors
  let accountItems = document.querySelectorAll(PORTAL_SELECTORS.accountItem);

  // Fallback to alternative selectors if primary fails
  if (accountItems.length === 0) {
    accountItems = document.querySelectorAll(FALLBACK_SELECTORS.accountItem);
  }

  // Also try to find accounts in the page text using regex
  if (accountItems.length === 0) {
    return extractAccountsFromText();
  }

  accountItems.forEach(item => {
    const account = extractAccountFromElement(item);
    if (account) {
      accounts.push(account);
    }
  });

  return accounts;
}

/**
 * Extracts account data from a single DOM element
 * @param {Element} element - The account item element
 * @returns {{accountId: string, accountName: string}|null}
 */
function extractAccountFromElement(element) {
  // Try primary selectors
  let nameEl = element.querySelector(PORTAL_SELECTORS.accountName);
  let idEl = element.querySelector(PORTAL_SELECTORS.accountId);

  // Fallback selectors
  if (!nameEl) {
    nameEl = element.querySelector(FALLBACK_SELECTORS.accountName);
  }
  if (!idEl) {
    idEl = element.querySelector(FALLBACK_SELECTORS.accountId);
  }

  // Try to extract from element text if selectors fail
  if (!nameEl || !idEl) {
    const text = element.textContent || '';
    const idMatch = text.match(/\b(\d{12})\b/);

    if (idMatch) {
      // Account name is typically the first line or before the ID
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      const accountName = lines[0] || 'Unknown';

      return {
        accountId: idMatch[1],
        accountName: accountName.replace(/\d{12}/, '').trim() || accountName
      };
    }
    return null;
  }

  const accountId = (idEl.textContent || '').replace(/[^\d]/g, '');
  const accountName = (nameEl.textContent || '').trim();

  // Validate 12-digit account ID
  if (accountId.length !== 12) {
    return null;
  }

  return { accountId, accountName };
}

/**
 * Fallback extraction using regex on page text
 * @returns {Array<{accountId: string, accountName: string}>}
 */
function extractAccountsFromText() {
  const accounts = [];
  const bodyText = document.body.innerText || '';

  // Pattern 1: "AccountName AccountId | email" format (AWS SSO portal)
  // Example: "Audit641945723773 | jasonwadsworth+aws-audit@outlook.com"
  // Note: May or may not have space between name and ID
  const ssoPattern = /([A-Za-z][A-Za-z0-9\s\-_]*?)\s*(\d{12})\s*\|/g;
  let match;

  while ((match = ssoPattern.exec(bodyText)) !== null) {
    accounts.push({
      accountName: match[1].trim(),
      accountId: match[2]
    });
  }

  // If SSO pattern found accounts, return them
  if (accounts.length > 0) {
    console.log('[AWS Account Display] Extracted accounts using SSO pattern');
    return accounts;
  }

  // Pattern 2: Account name followed by 12-digit ID on next line
  const pattern = /([A-Za-z][A-Za-z0-9\s\-_]+?)\s*[\n\r]+\s*(\d{12})/g;

  while ((match = pattern.exec(bodyText)) !== null) {
    accounts.push({
      accountName: match[1].trim(),
      accountId: match[2]
    });
  }

  return accounts;
}

/**
 * Sets up a MutationObserver to watch for portal content changes
 * @param {Function} callback - Function to call when changes detected
 * @returns {MutationObserver}
 */
function observePortalChanges(callback) {
  const observer = new MutationObserver((mutations) => {
    // Debounce rapid changes
    clearTimeout(observer._debounceTimer);
    observer._debounceTimer = setTimeout(() => {
      callback();
    }, 500);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  return observer;
}

/**
 * Sends extracted accounts to the background service worker
 * @param {Array<{accountId: string, accountName: string}>} accounts
 * @returns {Promise<{success: boolean}>}
 */
async function sendAccountsToBackground(accounts) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'STORE_ACCOUNTS',
      accounts: accounts
    });
    return response || { success: false };
  } catch (error) {
    console.error('[AWS Account Display] Failed to send accounts:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Main initialization function
 */
function init() {
  // Initial extraction
  const accounts = extractAccountsFromPortal();

  if (accounts.length > 0) {
    console.log('[AWS Account Display] Found', accounts.length, 'accounts');
    sendAccountsToBackground(accounts);
  }

  // Watch for dynamic content changes
  observePortalChanges(() => {
    const updatedAccounts = extractAccountsFromPortal();
    if (updatedAccounts.length > 0) {
      console.log('[AWS Account Display] Updated accounts:', updatedAccounts.length);
      sendAccountsToBackground(updatedAccounts);
    }
  });
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
    extractAccountsFromPortal,
    extractAccountFromElement,
    extractAccountsFromText,
    observePortalChanges,
    sendAccountsToBackground,
    PORTAL_SELECTORS,
    FALLBACK_SELECTORS
  };
}
