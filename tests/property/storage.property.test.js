const fc = require('fast-check');
const { storeAccounts, getAccountName, getAllAccounts, clearAllAccounts } = require('../../src/storage');

// Helper to generate valid 12-digit account IDs
const accountIdArb = fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 12, maxLength: 12 });

// Helper to generate valid account names (non-empty, max 256 chars)
const accountNameArb = fc.string({ minLength: 1, maxLength: 256 }).filter(s => s.trim().length > 0);

// Helper to generate account mapping
const accountMappingArb = fc.record({
  accountId: accountIdArb,
  accountName: accountNameArb
});

// Helper to generate array of unique account mappings
const accountMappingsArb = fc.array(accountMappingArb, { minLength: 1, maxLength: 10 })
  .map(accounts => {
    // Deduplicate by accountId, keeping last occurrence
    const map = new Map();
    accounts.forEach(a => map.set(a.accountId, a));
    return Array.from(map.values());
  });

describe('Storage Property Tests', () => {
  let storedData = {};

  beforeEach(() => {
    storedData = {};

    // Mock Chrome storage API
    chrome.storage.local.set.mockImplementation((data) => {
      Object.assign(storedData, data);
      return Promise.resolve();
    });

    chrome.storage.local.get.mockImplementation((keys) => {
      const result = {};
      keys.forEach(key => {
        if (storedData[key] !== undefined) {
          result[key] = storedData[key];
        }
      });
      return Promise.resolve(result);
    });

    chrome.storage.local.clear.mockImplementation(() => {
      storedData = {};
      return Promise.resolve();
    });
  });

  /**
   * Feature: iam-identity-center-chrome-plugin, Property 4: Storage round-trip consistency
   * For any array of account mappings, storing the mappings and then retrieving them
   * SHALL return equivalent account data (same account IDs mapped to same account names).
   * Validates: Requirements 2.2, 3.1, 3.2
   */
  test('Property 4: Storage round-trip consistency', async () => {
    await fc.assert(
      fc.asyncProperty(accountMappingsArb, async (accounts) => {
        // Store accounts
        const storeResult = await storeAccounts(accounts);
        expect(storeResult.success).toBe(true);

        // Retrieve each account and verify
        for (const account of accounts) {
          const getResult = await getAccountName(account.accountId);
          expect(getResult.success).toBe(true);
          expect(getResult.accountName).toBe(account.accountName.trim().substring(0, 256));
        }

        // Also verify via getAllAccounts
        const allResult = await getAllAccounts();
        expect(allResult.success).toBe(true);

        for (const account of accounts) {
          const stored = allResult.accounts[account.accountId];
          expect(stored).toBeDefined();
          expect(stored.accountName).toBe(account.accountName.trim().substring(0, 256));
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: iam-identity-center-chrome-plugin, Property 5: Storage update overwrites previous state
   * For any initial set of account mappings followed by an updated set,
   * after storing both sequentially, retrieving the data SHALL return only the most recent state.
   * Validates: Requirements 2.3
   */
  test('Property 5: Storage update overwrites previous state', async () => {
    await fc.assert(
      fc.asyncProperty(accountMappingsArb, accountMappingsArb, async (initial, updated) => {
        // Store initial accounts
        await storeAccounts(initial);

        // Store updated accounts (should overwrite)
        await storeAccounts(updated);

        // Verify only updated accounts exist
        const allResult = await getAllAccounts();
        expect(allResult.success).toBe(true);

        // Check that updated accounts are present with correct names
        for (const account of updated) {
          const stored = allResult.accounts[account.accountId];
          expect(stored).toBeDefined();
          expect(stored.accountName).toBe(account.accountName.trim().substring(0, 256));
        }

        // Check that initial accounts NOT in updated are gone
        for (const account of initial) {
          if (!updated.some(u => u.accountId === account.accountId)) {
            expect(allResult.accounts[account.accountId]).toBeUndefined();
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: iam-identity-center-chrome-plugin, Property 6: Clear removes all stored data
   * For any set of stored account mappings, after calling the clear function,
   * retrieving account data SHALL return an empty result (no mappings).
   * Validates: Requirements 3.3
   */
  test('Property 6: Clear removes all stored data', async () => {
    await fc.assert(
      fc.asyncProperty(accountMappingsArb, async (accounts) => {
        // Store accounts
        await storeAccounts(accounts);

        // Verify accounts are stored
        const beforeClear = await getAllAccounts();
        expect(Object.keys(beforeClear.accounts).length).toBeGreaterThan(0);

        // Clear all accounts
        const clearResult = await clearAllAccounts();
        expect(clearResult.success).toBe(true);

        // Verify storage is empty
        const afterClear = await getAllAccounts();
        expect(afterClear.success).toBe(true);
        expect(Object.keys(afterClear.accounts).length).toBe(0);

        // Verify individual lookups return null
        for (const account of accounts) {
          const getResult = await getAccountName(account.accountId);
          expect(getResult.accountName).toBeNull();
        }
      }),
      { numRuns: 100 }
    );
  });
});
