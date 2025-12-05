# AWS Account Name Display

A Chrome extension that displays AWS account names alongside account numbers in the AWS Console. Instead of seeing just "Account ID: 1234-5678-9012", you'll see "MyAccountName: 1234-5678-9012".

## How It Works

1. **Capture**: When you visit your IAM Identity Center access portal, the extension automatically extracts account names and their corresponding account IDs.

2. **Display**: When you navigate to any AWS Console page, the extension replaces "Account ID:" with your account's friendly name.

## Installation

### From Source (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/aws-account-name-display.git
   cd aws-account-name-display
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable "Developer mode" (toggle in top right)

4. Click "Load unpacked"

5. Select the cloned folder (the one containing `manifest.json`)

### First-Time Setup

1. After installing, visit your IAM Identity Center access portal (e.g., `https://your-org.awsapps.com/start`)

2. The extension will automatically capture your account names

3. Navigate to any AWS Console page - you should now see account names instead of "Account ID:"

## Features

- Automatically extracts account names from IAM Identity Center portal
- Persists account mappings across browser sessions
- Works across all AWS Console pages
- Non-intrusive - only modifies the account label text
- No external network requests - all data stays in your browser

## Permissions

- `storage`: To persist account name mappings locally
- `https://*.awsapps.com/*`: To read account info from IAM Identity Center portal
- `https://*.aws.amazon.com/*`: To display account names in AWS Console

## Development

### Install Dependencies
```bash
npm install
```

### Run Tests
```bash
npm test
```

## License

MIT
