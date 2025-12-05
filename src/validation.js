/**
 * Validation utilities for AWS account data
 */

/**
 * Validates that an account ID is exactly 12 digits
 * @param {string} id - The account ID to validate
 * @returns {boolean} True if valid 12-digit account ID
 */
function isValidAccountId(id) {
  return typeof id === 'string' && /^\d{12}$/.test(id);
}

/**
 * Validates that an account name is a non-empty string within length limits
 * @param {string} name - The account name to validate
 * @returns {boolean} True if valid account name
 */
function isValidAccountName(name) {
  return typeof name === 'string' && name.trim().length > 0 && name.length <= 256;
}

/**
 * Sanitizes an account name by trimming whitespace and enforcing length limit
 * @param {string} name - The account name to sanitize
 * @returns {string} Sanitized account name
 */
function sanitizeAccountName(name) {
  if (typeof name !== 'string') {
    return '';
  }
  return name.trim().substring(0, 256);
}

// Export for testing and use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isValidAccountId, isValidAccountName, sanitizeAccountName };
}
