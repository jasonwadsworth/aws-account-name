const { isValidAccountId, isValidAccountName, sanitizeAccountName } = require('../../src/validation');

describe('isValidAccountId', () => {
  test('accepts valid 12-digit account ID', () => {
    expect(isValidAccountId('123456789012')).toBe(true);
  });

  test('accepts account ID with all zeros', () => {
    expect(isValidAccountId('000000000000')).toBe(true);
  });

  test('rejects account ID with less than 12 digits', () => {
    expect(isValidAccountId('12345678901')).toBe(false);
  });

  test('rejects account ID with more than 12 digits', () => {
    expect(isValidAccountId('1234567890123')).toBe(false);
  });

  test('rejects account ID with letters', () => {
    expect(isValidAccountId('12345678901a')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidAccountId('')).toBe(false);
  });

  test('rejects non-string input', () => {
    expect(isValidAccountId(123456789012)).toBe(false);
    expect(isValidAccountId(null)).toBe(false);
    expect(isValidAccountId(undefined)).toBe(false);
  });
});

describe('isValidAccountName', () => {
  test('accepts valid account name', () => {
    expect(isValidAccountName('Production')).toBe(true);
  });

  test('accepts account name with spaces', () => {
    expect(isValidAccountName('My Production Account')).toBe(true);
  });

  test('rejects empty string', () => {
    expect(isValidAccountName('')).toBe(false);
  });

  test('rejects whitespace-only string', () => {
    expect(isValidAccountName('   ')).toBe(false);
  });

  test('rejects string longer than 256 characters', () => {
    expect(isValidAccountName('a'.repeat(257))).toBe(false);
  });

  test('accepts string exactly 256 characters', () => {
    expect(isValidAccountName('a'.repeat(256))).toBe(true);
  });

  test('rejects non-string input', () => {
    expect(isValidAccountName(123)).toBe(false);
    expect(isValidAccountName(null)).toBe(false);
  });
});

describe('sanitizeAccountName', () => {
  test('trims whitespace', () => {
    expect(sanitizeAccountName('  Production  ')).toBe('Production');
  });

  test('truncates to 256 characters', () => {
    const longName = 'a'.repeat(300);
    expect(sanitizeAccountName(longName)).toBe('a'.repeat(256));
  });

  test('returns empty string for non-string input', () => {
    expect(sanitizeAccountName(null)).toBe('');
    expect(sanitizeAccountName(undefined)).toBe('');
    expect(sanitizeAccountName(123)).toBe('');
  });

  test('preserves valid names', () => {
    expect(sanitizeAccountName('Production')).toBe('Production');
  });
});
