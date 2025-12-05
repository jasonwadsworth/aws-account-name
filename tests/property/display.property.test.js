const fc = require('fast-check');
const { createDisplayElement, truncateText, CONFIG } = require('../../src/console-content');

// Helper to generate valid 12-digit account IDs
const accountIdArb = fc.stringOf(
  fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
  { minLength: 12, maxLength: 12 }
);

// Helper to generate valid account names
const accountNameArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

// Helper to generate long account names (exceeding max length)
const longAccountNameArb = fc.string({ minLength: CONFIG.maxNameLength + 1, maxLength: 200 })
  .filter(s => s.trim().length > CONFIG.maxNameLength);

// Helper to generate short account names (within max length)
const shortAccountNameArb = fc.string({ minLength: 1, maxLength: CONFIG.maxNameLength })
  .filter(s => s.trim().length > 0 && s.length <= CONFIG.maxNameLength);

describe('Display Property Tests', () => {
  /**
   * Feature: iam-identity-center-chrome-plugin, Property 1: Display includes account name and number
   * For any stored account mapping with a valid account ID and name, when the display function
   * is called with that account ID, the resulting display element SHALL contain both the
   * account name and the account number.
   * Validates: Requirements 1.1
   */
  test('Property 1: Display includes account name and number', async () => {
    await fc.assert(
      fc.property(accountNameArb, accountIdArb, (accountName, accountId) => {
        const { element, displayText, tooltipText } = createDisplayElement(accountName, accountId);

        // Display element should exist
        expect(element).toBeDefined();
        expect(element.tagName).toBe('SPAN');

        // Element should have text content (either full name or truncated)
        expect(element.textContent.length).toBeGreaterThan(0);

        // Element should have data attributes with full info
        expect(element.getAttribute('data-account-id')).toBe(accountId);
        expect(element.getAttribute('data-full-name')).toBe(accountName);

        // Tooltip should contain both account name and account ID
        expect(tooltipText).toContain(accountName);
        expect(tooltipText).toContain(accountId);
        expect(element.title).toBe(tooltipText);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: iam-identity-center-chrome-plugin, Property 2: Tooltip contains complete information
   * For any account mapping, the tooltip element generated for that account SHALL contain
   * both the complete (non-truncated) account name and the full 12-digit account number.
   * Validates: Requirements 1.3
   */
  test('Property 2: Tooltip contains complete information', async () => {
    await fc.assert(
      fc.property(accountNameArb, accountIdArb, (accountName, accountId) => {
        const { element, tooltipText } = createDisplayElement(accountName, accountId);

        // Tooltip must contain the COMPLETE account name (not truncated)
        expect(tooltipText).toContain(accountName);

        // Tooltip must contain the FULL 12-digit account ID
        expect(tooltipText).toContain(accountId);
        expect(accountId.length).toBe(12);

        // Element's title attribute should match tooltip text
        expect(element.title).toBe(tooltipText);

        // Verify the format includes both pieces of information
        expect(tooltipText).toBe(`${accountName} (${accountId})`);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: iam-identity-center-chrome-plugin, Property 7: Long name truncation with full tooltip
   * For any account name exceeding the maximum display length, the displayed text SHALL be
   * truncated with an ellipsis, AND the tooltip SHALL contain the complete untruncated account name.
   * Validates: Requirements 5.2
   */
  test('Property 7: Long name truncation with full tooltip', async () => {
    await fc.assert(
      fc.property(longAccountNameArb, accountIdArb, (accountName, accountId) => {
        const { element, displayText, tooltipText } = createDisplayElement(accountName, accountId);

        // Display text should be truncated
        expect(displayText.length).toBeLessThanOrEqual(CONFIG.maxNameLength);

        // Display text should end with ellipsis
        expect(displayText.endsWith('...')).toBe(true);

        // Tooltip should contain the FULL untruncated account name
        expect(tooltipText).toContain(accountName);

        // Element's data attribute should have full name
        expect(element.getAttribute('data-full-name')).toBe(accountName);

        // Verify truncation preserves the beginning of the name
        const truncatedPart = displayText.slice(0, -3); // Remove '...'
        expect(accountName.startsWith(truncatedPart)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  describe('truncateText function', () => {
    test('does not truncate short text', async () => {
      await fc.assert(
        fc.property(shortAccountNameArb, (text) => {
          const result = truncateText(text);
          expect(result).toBe(text);
          expect(result.endsWith('...')).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    test('truncates long text with ellipsis', async () => {
      await fc.assert(
        fc.property(longAccountNameArb, (text) => {
          const result = truncateText(text);
          expect(result.length).toBeLessThanOrEqual(CONFIG.maxNameLength);
          expect(result.endsWith('...')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    test('handles empty and null input', () => {
      expect(truncateText('')).toBe('');
      expect(truncateText(null)).toBe(null);
      expect(truncateText(undefined)).toBe(undefined);
    });
  });
});
