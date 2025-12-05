const fc = require('fast-check');
const { extractAccountFromElement, extractAccountsFromText } = require('../../src/portal-content');

// Helper to generate valid 12-digit account IDs
const accountIdArb = fc.stringOf(
  fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
  { minLength: 12, maxLength: 12 }
);

// Helper to generate valid account names (alphanumeric with spaces/dashes, starts with letter, no trailing spaces)
const accountNameArb = fc.tuple(
  fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'),
  fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '_'), { minLength: 1, maxLength: 30 })
).map(([first, rest]) => first + rest);

// Helper to generate account mapping
const accountMappingArb = fc.record({
  accountId: accountIdArb,
  accountName: accountNameArb
});

/**
 * Creates a mock DOM element with account data
 */
function createMockElement(accountId, accountName) {
  const element = document.createElement('div');
  element.className = 'portal-instance';

  const nameEl = document.createElement('div');
  nameEl.className = 'name';
  nameEl.textContent = accountName;

  const idEl = document.createElement('div');
  idEl.className = 'accountId';
  idEl.textContent = accountId;

  element.appendChild(nameEl);
  element.appendChild(idEl);

  return element;
}

/**
 * Creates mock page text with account data
 */
function createMockPageText(accounts) {
  return accounts.map(a => `${a.accountName}\n${a.accountId}`).join('\n\n');
}

describe('Portal Extraction Property Tests', () => {
  /**
   * Feature: iam-identity-center-chrome-plugin, Property 3: Portal extraction correctness
   * For any valid portal HTML structure containing account entries, the extraction function
   * SHALL return an array of account mappings where each extracted account ID matches the
   * account ID in the source HTML and each extracted account name matches the account name.
   * Validates: Requirements 2.1, 2.4
   */
  describe('Property 3: Portal extraction correctness', () => {
    test('extracts correct account ID and name from DOM element', async () => {
      await fc.assert(
        fc.property(accountMappingArb, (account) => {
          const element = createMockElement(account.accountId, account.accountName);
          const extracted = extractAccountFromElement(element);

          expect(extracted).not.toBeNull();
          expect(extracted.accountId).toBe(account.accountId);
          expect(extracted.accountName).toBe(account.accountName);
        }),
        { numRuns: 100 }
      );
    });

    test('extracts all accounts from text content', async () => {
      // Generate array of unique accounts
      const uniqueAccountsArb = fc.array(accountMappingArb, { minLength: 1, maxLength: 5 })
        .map(accounts => {
          const map = new Map();
          accounts.forEach(a => map.set(a.accountId, a));
          return Array.from(map.values());
        });

      await fc.assert(
        fc.property(uniqueAccountsArb, (accounts) => {
          // Create mock page text
          const pageText = createMockPageText(accounts);

          // Mock document.body.innerText
          const originalInnerText = document.body.innerText;
          Object.defineProperty(document.body, 'innerText', {
            value: pageText,
            writable: true,
            configurable: true
          });

          try {
            const extracted = extractAccountsFromText();

            // Verify all accounts were extracted
            expect(extracted.length).toBe(accounts.length);

            // Verify each account matches
            for (const account of accounts) {
              const found = extracted.find(e => e.accountId === account.accountId);
              expect(found).toBeDefined();
              expect(found.accountName).toBe(account.accountName);
            }
          } finally {
            // Restore original
            Object.defineProperty(document.body, 'innerText', {
              value: originalInnerText,
              writable: true,
              configurable: true
            });
          }
        }),
        { numRuns: 100 }
      );
    });

    test('handles multiple accounts correctly', async () => {
      const multipleAccountsArb = fc.array(accountMappingArb, { minLength: 2, maxLength: 10 })
        .map(accounts => {
          // Ensure unique account IDs
          const map = new Map();
          accounts.forEach(a => map.set(a.accountId, a));
          return Array.from(map.values());
        })
        .filter(accounts => accounts.length >= 2);

      await fc.assert(
        fc.property(multipleAccountsArb, (accounts) => {
          // Create container with multiple account elements
          const container = document.createElement('div');

          accounts.forEach(account => {
            const element = createMockElement(account.accountId, account.accountName);
            container.appendChild(element);
          });

          // Extract from each element
          const elements = container.querySelectorAll('.portal-instance');
          const extracted = Array.from(elements).map(el => extractAccountFromElement(el)).filter(Boolean);

          // Verify count matches
          expect(extracted.length).toBe(accounts.length);

          // Verify each account was extracted correctly
          for (const account of accounts) {
            const found = extracted.find(e => e.accountId === account.accountId);
            expect(found).toBeDefined();
            expect(found.accountName).toBe(account.accountName);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
