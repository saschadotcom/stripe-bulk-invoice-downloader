# 🚀 Stripe Invoice Downloader

A Node.js command-line tool to download paid Stripe invoices for a specific month and year with multi-profile support.

## ✨ Features

- 📅 Download invoices for any specific month and year
- 🔐 Multi-profile support for managing multiple Stripe accounts
- 🛡️ Secure API key handling (keys are masked during input)
- 📊 Invoice summary with totals by currency
- 📁 Automatic folder creation with organized naming (`invoices_YYYY_MM`)
- 💾 Configuration persistence (profiles are saved for future use)
- 🎯 Only downloads paid invoices
- 📋 Detailed invoice information display before download
- 📈 **CSV Export for Accounting** - Automatically generates detailed and summary CSV files with tax information

## 🛠️ Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd stripe-invoice-downloader
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Make the script executable (optional):**
   ```bash
   chmod +x index.js
   ```

## 🚀 Usage

### Basic Usage

Run the script using Node.js:

```bash
node index.js
```

Or if you made it executable:

```bash
./index.js
```

### First Time Setup

When you run the script for the first time, you'll be prompted to create a profile:

1. **Profile Creation:**

   - Enter a profile name (e.g., "My Business", "Client A")
   - Enter your Stripe Secret Key (starts with `sk_`)
   - Enter your company country (e.g., DE, AT, US) for correct tax classification
   - The key will be masked during input for security

2. **Download Process:**
   - Select the month (1-12)
   - Select the year (2020-2030)
   - Review the found invoices
   - Confirm the download

### Multi-Profile Support

If you have multiple Stripe accounts, you can create multiple profiles:

- On subsequent runs, you can select from existing profiles
- Create new profiles as needed
- Each profile stores the account name and API key securely

## 📋 Example Output

```
🚀 Stripe Invoice Downloader
=============================

📋 Available profiles:
1. My Business Account
2. Client Project A
3. Create new profile

🔢 Select profile (1-3): 1
✅ Selected profile: My Business Account
🔌 Connected to Stripe with profile: My Business Account

📅 Which month? (e.g. 05 for May, 12 for December): 12
📅 Which year? (e.g. 2024): 2024

🔄 Searching for paid invoices for 12/2024...

📁 Created download folder: /path/to/invoices_2024_12
🔍 Searching for Stripe invoices for 12/2024...
📊 Found 5 paid Stripe invoices

📋 Found Invoices:
==================
1. INV-001 - John Doe - 99.99 USD - 12/1/2024
2. INV-002 - Jane Smith - 149.99 EUR - 12/3/2024
3. INV-003 - Company Ltd - 299.99 USD - 12/5/2024

💰 Summary:
   USD: 399.98
   EUR: 149.99

🤔 Do you want to download all found invoices? (y/n): y

📥 Starting invoice download...

✅ Downloaded: INV-001_John_Doe_99.99USD.pdf
✅ Downloaded: INV-002_Jane_Smith_149.99EUR.pdf
✅ Downloaded: INV-003_Company_Ltd_299.99USD.pdf

📊 Generating CSV files for accounting...
📊 CSV files created:
   📄 Detailed: /path/to/downloads/2024/12/invoices_detailed.csv
   📋 Summary: /path/to/downloads/2024/12/invoices_summary.csv

📋 Download Summary:
====================
✅ Successfully downloaded invoices: 3/3
📁 Files saved to: /path/to/downloads/2024/12
```

## 📈 CSV Export for Accounting

The script automatically generates two CSV files for easy accounting integration:

### 1. **invoices_detailed.csv**

Contains all invoice details with tax information:

- Invoice Number
- Customer Name
- Customer Country
- Date
- Currency
- Gross Amount
- Net Amount
- Tax Amount
- Tax Rate
- Tax Info (Standard/Reverse Charge)

### 2. **invoices_summary.csv**

Contains summarized data grouped by country, tax rate and tax type:

- Country
- Tax Rate
- Currency
- Tax Info (Standard/Reverse Charge)
- Total Gross Amount
- Total Net Amount
- Total Tax Amount
- Invoice Count

### Tax Calculation

- **Gross Amount**: Total invoice amount (including tax)
- **Net Amount**: Amount before tax
- **Tax Amount**: Calculated tax amount
- **Tax Rate**: Actual tax rate from Stripe (not calculated approximation)
- **Tax Info**: Indicates whether it's standard tax or reverse charge

### Tax Classification System

The system automatically classifies transactions based on your company country and customer location:

#### 📋 **Tax Types:**

1. **Standard Tax**: Normal domestic tax applied (e.g., 19% VAT in Germany)
2. **Reverse Charge (RC)**: EU company → Different EU country B2B with 0% tax
3. **OSS**: EU company → Different EU country B2C with local tax rate
4. **Export**: EU company → Non-EU country with 0% tax
5. **Tax-free**: Other 0% tax scenarios

#### 🔍 **Detection Logic:**

- **Explicit Detection**: Checks for "Reverse Charge" in Stripe tax names
- **Geographic Logic**: Based on company country and customer country
- **EU Classification**: Uses official EU country list for accurate determination
- **Separate Grouping**: Each tax type is grouped separately for proper accounting

#### 🌍 **Examples:**

- **DE company → FR business, 0% tax** = Reverse Charge (RC)
- **DE company → FR consumer, 20% tax** = OSS
- **DE company → US customer, 0% tax** = Export
- **US company → CA customer, 0% tax** = Standard/Tax-free
- **DE company → DE customer, 19% tax** = Standard

#### 📊 **Multiple Entries per Country:**

The same country can appear multiple times with different tax treatments:

- **Netherlands (NL)**:
  - `"NL","0% (RC)","EUR","Reverse Charge"` (B2B transactions)
  - `"NL","21% (OSS)","EUR","OSS"` (B2C transactions via OSS)

This ensures accurate separation of different tax obligations for the same country.

This ensures accurate tax classification for different jurisdictions and prevents incorrect grouping of transactions.

## 🏗️ Code Architecture

The application is organized into a clean modular structure:

### 📦 **Modules:**

- **`src/config/`** - Profile and configuration management

  - Handles Stripe API key storage and company settings
  - Manages multiple profiles for different accounts

- **`src/tax/`** - Tax classification and calculation

  - EU country classification
  - Tax type determination (Standard, Reverse Charge, OSS, Export)
  - Tax rate extraction from Stripe data

- **`src/stripe/`** - Stripe API interactions

  - Invoice fetching with pagination
  - PDF download functionality
  - API client initialization

- **`src/export/`** - CSV generation and export

  - Detailed invoice data export
  - Summary reports grouped by country and tax type
  - Accounting-ready file formats

- **`src/utils/`** - Utility functions
  - User input handling (including masked password input)
  - Date formatting and validation
  - Common helper functions

### 🗂️ **Download Organization:**

Files are organized in a hierarchical structure:

```
downloads/
├── 2024/
│   ├── 01/     # January 2024
│   ├── 02/     # February 2024
│   └── 12/     # December 2024
└── 2025/
    └── 01/     # January 2025
```

This structure makes it easy to:

- Find invoices for specific time periods
- Archive old data
- Organize by tax year
- Backup specific months

### Example CSV Output

**invoices_detailed.csv:**

```csv
Invoice Number,Customer,Country,Date,Currency,Gross Amount,Net Amount,Tax Amount,Tax Rate,Tax Info
"INV-001","John Doe","DE","15.12.2024","EUR","119.00","100.00","19.00","19%","Standard"
"INV-002","Jane Smith","US","16.12.2024","USD","100.00","100.00","0.00","0% (Export)","Export"
"INV-003","Company Ltd","FR","17.12.2024","EUR","100.00","100.00","0.00","0% (RC)","Reverse Charge"
"INV-004","Private User","FR","18.12.2024","EUR","120.00","100.00","20.00","20% (OSS)","OSS"
"INV-005","Business NL","NL","19.12.2024","EUR","100.00","100.00","0.00","0% (RC)","Reverse Charge"
"INV-006","Consumer NL","NL","20.12.2024","EUR","121.00","100.00","21.00","21% (OSS)","OSS"
```

**invoices_summary.csv:**

```csv
Country,Tax Rate,Currency,Tax Info,Total Gross,Total Net,Total Tax,Invoice Count
"DE","19%","EUR","Standard","119.00","100.00","19.00","1"
"US","0% (Export)","USD","Export","100.00","100.00","0.00","1"
"FR","0% (RC)","EUR","Reverse Charge","100.00","100.00","0.00","1"
"FR","20% (OSS)","EUR","OSS","120.00","100.00","20.00","1"
"NL","0% (RC)","EUR","Reverse Charge","100.00","100.00","0.00","1"
"NL","21% (OSS)","EUR","OSS","121.00","100.00","21.00","1"
```

### Benefits for Accounting

- **Grouped by Country & Tax Type**: Easier to create accounting entries
- **Automatic Tax Calculation**: No manual calculation needed
- **CSV Format**: Easy to import into accounting software
- **Intelligent Tax Classification**: Automatic distinction between Standard, Reverse Charge, OSS, Export, and Tax-free
- **OSS Support**: Proper handling of One-Stop-Shop transactions for EU B2C sales
- **Multiple Tax Types per Country**: Same country can have different tax treatments (e.g., NL B2B vs NL B2C)
- **Geographic Accuracy**: Uses company country and EU classification for correct tax determination
- **Accurate Tax Rates**: Uses actual tax rates from Stripe instead of calculated approximations
- **Compliance Ready**: Proper categorization for VAT/tax reporting in different jurisdictions

## 🔧 Configuration

The script creates a `config.json` file to store your profiles:

```json
{
  "profiles": {
    "My Business Account": {
      "name": "My Business Account",
      "secretKey": "sk_live_...",
      "companyCountry": "DE",
      "createdAt": "2024-12-18T10:30:00.000Z"
    },
    "Client Project A": {
      "name": "Client Project A",
      "secretKey": "sk_test_...",
      "companyCountry": "US",
      "createdAt": "2024-12-18T11:00:00.000Z"
    }
  }
}
```

⚠️ **Important:** This file contains sensitive API keys. Make sure it's added to your `.gitignore` file.

## 🔐 Security

- API keys are masked during input (`*****`)
- Configuration file is excluded from version control
- Keys are stored locally and never transmitted except to Stripe's API
- The script validates that API keys start with `sk_`

## 📁 File Structure

```
stripe-invoice-downloader/
├── src/                          # Source code modules
│   ├── config/
│   │   └── profileManager.js     # Profile management
│   ├── tax/
│   │   └── classifier.js         # Tax classification logic
│   ├── stripe/
│   │   └── client.js             # Stripe API interactions
│   ├── export/
│   │   └── csvGenerator.js       # CSV export functionality
│   └── utils/
│       └── input.js              # User input utilities
├── downloads/                    # Main download directory
│   └── YYYY/                     # Year folders (e.g., 2024/)
│       └── MM/                   # Month folders (e.g., 12/)
│           ├── INV-001_Customer_99.99USD.pdf
│           ├── INV-002_Customer_149.99EUR.pdf
│           ├── invoices_detailed.csv
│           ├── invoices_summary.csv
│           └── ...
├── index.js                      # Main entry point
├── package.json                  # Dependencies and metadata
├── config.json                   # Profile configuration (created on first run)
├── .gitignore                    # Git ignore file
└── README.md                     # This file
```

## 🛡️ Requirements

- **Node.js** 14.0.0 or higher
- **Stripe Account** with API access
- **Stripe Secret Key** (starts with `sk_test_` or `sk_live_`)

## 🎯 Stripe API Permissions

The script requires the following Stripe API permissions:

- `invoices:read` - to list and fetch invoice data
- `customers:read` - to get customer information for file naming

## 📝 Generated File Names

Downloaded invoices are saved with the following naming convention:

```
{InvoiceNumber}_{CustomerName}_{Amount}{Currency}.pdf
```

Examples:

- `INV-2024-001_John_Doe_99.99USD.pdf`
- `INV-2024-002_Jane_Smith_149.99EUR.pdf`

## 🚫 Limitations

- Only downloads **paid** invoices
- Requires invoices to have PDF available (`invoice_pdf` field)
- Year range is limited to 2020-2030 (can be modified in code)
- Only processes invoices with PDF URLs

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid Stripe Secret Key"**

   - Ensure the key starts with `sk_`
   - Check if the key is correct and active

2. **"No invoices found"**

   - Verify the date range has paid invoices
   - Check if you're using the correct Stripe account

3. **"Failed to fetch PDF"**
   - Some invoices might not have PDF URLs
   - Check your Stripe dashboard for invoice status

### Error Handling

The script includes comprehensive error handling:

- Network errors during PDF download
- Invalid API responses
- File system errors
- Configuration file issues

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## ⚠️ Disclaimer

This tool is provided as-is. Always test with your Stripe test keys first before using with live data. The developers are not responsible for any data loss or API usage charges.

---

**Happy invoicing!** 🎉
