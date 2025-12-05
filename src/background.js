/**
 * Background Service Worker
 * Handles message passing and storage operations for the extension
 */

// Validation functions (inline for service worker context)
function isValidAccountId(id) {
  return typeof id === 'string' && /^\d{12}$/.test(id);
}

function isValidAccountName(name) {
  return typeof name === 'string' && name.trim().length > 0 && name.length <= 256;
}

function sanitizeAccountName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().substring(0, 256);
}

/**
 * Stores account mappings to Chrome local storage
 */
async function storeAccounts(accounts) {
  try {
    const validAccounts = {};

    for (const account of accounts) {
      if (isValidAccountId(account.accountId) && isValidAccountName(account.accountName)) {
        validAccounts[account.accountId] = {
          accountId: account.accountId,
          accountName: sanitizeAccountName(account.accountName),
          lastUpdated: Date.now()
        };
      }
    }

    await chrome.storage.local.set({ accounts: validAccounts, version: 1 });
    return { success: true };
  } catch (error) {
    console.error('[AWS Account Display] Storage error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Retrieves account name by ID from storage
 */
async function getAccountName(accountId) {
  try {
    if (!isValidAccountId(accountId)) {
      return { success: false, accountName: null, error: 'Invalid account ID' };
    }

    const result = await chrome.storage.local.get(['accounts']);
    const accounts = result.accounts || {};
    const account = accounts[accountId];

    return {
      success: true,
      accountName: account ? account.accountName : null
    };
  } catch (error) {
    console.error('[AWS Account Display] Get error:', error);
    return { success: false, accountName: null, error: error.message };
  }
}

/**
 * Retrieves account ID by name from storage
 * @param {string} accountName - The account name to look up
 * @returns {Promise<{success: boolean, accountId: string|null, error?: string}>}
 */
async function getAccountByName(accountName) {
  try {
    const result = await chrome.storage.local.get(['accounts']);
    const accounts = result.accounts || {};

    // Search for matching account name (case-insensitive)
    const searchName = accountName.toLowerCase().trim();

    for (const [accountId, account] of Object.entries(accounts)) {
      if (account.accountName.toLowerCase().trim() === searchName) {
        return { success: true, accountId: accountId, accountName: account.accountName };
      }
    }

    // Try partial match if exact match fails
    for (const [accountId, account] of Object.entries(accounts)) {
      if (account.accountName.toLowerCase().includes(searchName) ||
          searchName.includes(account.accountName.toLowerCase())) {
        return { success: true, accountId: accountId, accountName: account.accountName };
      }
    }

    return { success: true, accountId: null };
  } catch (error) {
    console.error('[AWS Account Display] Get by name error:', error);
    return { success: false, accountId: null, error: error.message };
  }
}

/**
 * Clears all stored account mappings
 */
async function clearAllAccounts() {
  try {
    await chrome.storage.local.clear();
    return { success: true };
  } catch (error) {
    console.error('[AWS Account Display] Clear error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Message handler for content script communication
 */
async function handleMessage(message, sender, sendResponse) {
  if (!message || !message.type) {
    return { success: false, error: 'Invalid message format' };
  }

  switch (message.type) {
    case 'STORE_ACCOUNTS':
      if (!Array.isArray(message.accounts)) {
        return { success: false, error: 'Accounts must be an array' };
      }
      return await storeAccounts(message.accounts);

    case 'GET_ACCOUNT_NAME':
      if (!message.accountId) {
        return { success: false, accountName: null, error: 'Account ID required' };
      }
      return await getAccountName(message.accountId);

    case 'GET_ACCOUNT_BY_NAME':
      if (!message.accountName) {
        return { success: false, accountId: null, error: 'Account name required' };
      }
      return await getAccountByName(message.accountName);

    case 'CLEAR_DATA':
      return await clearAllAccounts();

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

// Register message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle async response
  handleMessage(message, sender, sendResponse)
    .then(sendResponse)
    .catch(error => {
      console.error('[AWS Account Display] Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    });

  // Return true to indicate async response
  return true;
});

// Log when service worker starts
console.log('[AWS Account Display] Service worker initialized');

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleMessage,
    storeAccounts,
    getAccountName,
    clearAllAccounts,
    isValidAccountId,
    isValidAccountName,
    sanitizeAccountName
  };
}
