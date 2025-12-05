const { handleMessage } = require('../../src/background');

describe('Message Handling', () => {
  let storedData = {};

  beforeEach(() => {
    storedData = {};

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

  describe('STORE_ACCOUNTS message', () => {
    test('stores valid accounts successfully', async () => {
      const message = {
        type: 'STORE_ACCOUNTS',
        accounts: [
          { accountId: '123456789012', accountName: 'Production' },
          { accountId: '234567890123', accountName: 'Development' }
        ]
      };

      const response = await handleMessage(message);

      expect(response.success).toBe(true);
      expect(storedData.accounts['123456789012'].accountName).toBe('Production');
      expect(storedData.accounts['234567890123'].accountName).toBe('Development');
    });

    test('returns error for non-array accounts', async () => {
      const message = {
        type: 'STORE_ACCOUNTS',
        accounts: 'not an array'
      };

      const response = await handleMessage(message);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Accounts must be an array');
    });

    test('filters out invalid accounts', async () => {
      const message = {
        type: 'STORE_ACCOUNTS',
        accounts: [
          { accountId: '123456789012', accountName: 'Valid' },
          { accountId: 'invalid', accountName: 'Invalid ID' },
          { accountId: '234567890123', accountName: '' }
        ]
      };

      const response = await handleMessage(message);

      expect(response.success).toBe(true);
      expect(Object.keys(storedData.accounts).length).toBe(1);
      expect(storedData.accounts['123456789012'].accountName).toBe('Valid');
    });
  });

  describe('GET_ACCOUNT_NAME message', () => {
    beforeEach(async () => {
      // Pre-populate storage
      storedData = {
        accounts: {
          '123456789012': { accountId: '123456789012', accountName: 'Production', lastUpdated: Date.now() }
        }
      };
    });

    test('returns account name for existing account', async () => {
      const message = {
        type: 'GET_ACCOUNT_NAME',
        accountId: '123456789012'
      };

      const response = await handleMessage(message);

      expect(response.success).toBe(true);
      expect(response.accountName).toBe('Production');
    });

    test('returns null for non-existent account', async () => {
      const message = {
        type: 'GET_ACCOUNT_NAME',
        accountId: '999999999999'
      };

      const response = await handleMessage(message);

      expect(response.success).toBe(true);
      expect(response.accountName).toBeNull();
    });

    test('returns error for missing account ID', async () => {
      const message = {
        type: 'GET_ACCOUNT_NAME'
      };

      const response = await handleMessage(message);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Account ID required');
    });

    test('returns error for invalid account ID format', async () => {
      const message = {
        type: 'GET_ACCOUNT_NAME',
        accountId: 'invalid'
      };

      const response = await handleMessage(message);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid account ID');
    });
  });

  describe('CLEAR_DATA message', () => {
    beforeEach(async () => {
      storedData = {
        accounts: {
          '123456789012': { accountId: '123456789012', accountName: 'Production', lastUpdated: Date.now() }
        }
      };
    });

    test('clears all stored data', async () => {
      const message = { type: 'CLEAR_DATA' };

      const response = await handleMessage(message);

      expect(response.success).toBe(true);
      expect(Object.keys(storedData).length).toBe(0);
    });
  });

  describe('Invalid messages', () => {
    test('returns error for null message', async () => {
      const response = await handleMessage(null);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid message format');
    });

    test('returns error for message without type', async () => {
      const response = await handleMessage({ data: 'test' });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid message format');
    });

    test('returns error for unknown message type', async () => {
      const response = await handleMessage({ type: 'UNKNOWN_TYPE' });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Unknown message type: UNKNOWN_TYPE');
    });
  });
});
