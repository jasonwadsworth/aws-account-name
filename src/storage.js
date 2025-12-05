/**
 * Storage service for AWS account mappings
 */

const { isValidAccountId, isValidAccountName, sanitizeAccountName } =
  typeof require !== 'undefined' ? require('./validation') : { isValidAccountId, isValidAccountName, sanitizeAccountName };

/**
 * Stores account mappings to Chrome local storage
 * @param {Array<{accountId: string, accountName: string}>} accounts - Account mappings to store
 * @returns {Promise<{success: boolean, error?: string}>}
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
    return { success: false, error: error.message };
  }
}

/**
 * Retrieves account name by ID from storage
 * @param {string} accountId - The 12-digit account ID
 * @returns {Promise<{success: boolean, accountName: string|null, error?: string}>}
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
    return { success: false, accountName: null, error: error.message };
  }
}

/**
 * Retrieves all stored account mappings
 * @returns {Promise<{success: boolean, accounts: Object, error?: string}>}
 */
async function getAllAccounts() {
  try {
    const result = await chrome.storage.local.get(['accounts']);
    return { success: true, accounts: result.accounts || {} };
  } catch (error) {
    return { success: false, accounts: {}, error: error.message };
  }
}

/**
 * Clears all stored account mappings
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function clearAllAccounts() {
  try {
    await chrome.storage.local.clear();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Export for testing and use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { storeAccounts, getAccountName, getAllAccounts, clearAllAccounts };
}
