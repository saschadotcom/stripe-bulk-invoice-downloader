// EU countries list for tax classification
const EU_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
];

/**
 * Tax types enum
 */
const TAX_TYPES = {
  STANDARD: "Standard",
  REVERSE_CHARGE: "Reverse Charge",
  OSS: "OSS",
  EXPORT: "Export",
  TAX_FREE: "Tax-free",
};

/**
 * Classify tax type based on company and customer countries and tax amount
 * @param {string} companyCountry - Company's country code
 * @param {string} customerCountry - Customer's country code
 * @param {number} taxAmount - Tax amount
 * @param {object} taxRateInfo - Tax rate information from Stripe
 * @returns {object} Classification result with taxInfo, isReverseCharge, and taxRateDisplay
 */
function classifyTax(companyCountry, customerCountry, taxAmount, taxRateInfo) {
  const isCompanyEU = EU_COUNTRIES.includes(companyCountry);
  const isCustomerEU = EU_COUNTRIES.includes(customerCountry);

  let taxInfo = TAX_TYPES.STANDARD;
  let isReverseCharge = false;
  let taxRate = taxRateInfo.rate || "0";

  // Check for explicit reverse charge indicators
  if (
    taxRateInfo.displayName &&
    (taxRateInfo.displayName.toLowerCase().includes("reverse charge") ||
      taxRateInfo.displayName.toLowerCase().includes("reverse") ||
      taxRateInfo.displayName.toLowerCase().includes("rc"))
  ) {
    isReverseCharge = true;
    taxInfo = TAX_TYPES.REVERSE_CHARGE;
  }

  // If no explicit indication, classify based on geography and amounts
  else if (taxAmount === 0 && customerCountry !== "Unknown") {
    if (isCompanyEU && isCustomerEU && customerCountry !== companyCountry) {
      // EU company selling to different EU country with 0% tax = Reverse Charge (B2B)
      isReverseCharge = true;
      taxInfo = TAX_TYPES.REVERSE_CHARGE;
    } else if (isCompanyEU && !isCustomerEU) {
      // EU company selling to non-EU country = Export
      taxInfo = TAX_TYPES.EXPORT;
    } else if (!isCompanyEU && !isCustomerEU) {
      // Non-EU company selling to non-EU country = Standard
      taxInfo = TAX_TYPES.STANDARD;
    } else {
      // Other cases with 0% tax
      taxInfo = TAX_TYPES.TAX_FREE;
    }
  } else if (taxAmount > 0) {
    // Standard tax case - could be domestic tax or OSS
    if (isCompanyEU && isCustomerEU && customerCountry !== companyCountry) {
      // EU company selling to different EU country with tax = OSS (B2C)
      taxInfo = TAX_TYPES.OSS;
    } else {
      // Domestic or other standard tax
      taxInfo = TAX_TYPES.STANDARD;
    }
  }

  // Format tax rate with tax info
  let taxRateDisplay = `${taxRate}%`;
  if (isReverseCharge) {
    taxRateDisplay = `${taxRate}% (RC)`;
  } else if (taxInfo === TAX_TYPES.EXPORT) {
    taxRateDisplay = `${taxRate}% (Export)`;
  } else if (taxInfo === TAX_TYPES.TAX_FREE) {
    taxRateDisplay = `${taxRate}% (Tax-free)`;
  } else if (taxInfo === TAX_TYPES.OSS) {
    taxRateDisplay = `${taxRate}% (OSS)`;
  }

  return {
    taxInfo,
    isReverseCharge,
    taxRateDisplay,
  };
}

/**
 * Extract tax information from invoice line items
 * @param {object} invoice - Stripe invoice object
 * @returns {object} Tax information with rate, amount, and display name
 */
function extractTaxInfo(invoice) {
  let taxAmount = 0;
  let taxRate = "0";
  let displayName = null;

  // Extract tax information from line items
  if (invoice.lines && invoice.lines.data) {
    for (const line of invoice.lines.data) {
      if (line.tax_rates && line.tax_rates.length > 0) {
        for (const tax of line.tax_rates) {
          // Use the actual tax rate from Stripe
          taxRate = tax.percentage.toString();
          taxAmount += (line.amount * tax.percentage) / 100 / 100;

          if (tax.display_name) {
            displayName = tax.display_name;
          }
        }
      }
    }
  }

  // Check for total tax on invoice level if no line item taxes
  if (taxAmount === 0 && invoice.tax && invoice.tax > 0) {
    taxAmount = invoice.tax / 100;
    // Try to determine tax rate from total
    if (taxAmount > 0) {
      const totalAmount = (invoice.amount_paid || invoice.total) / 100;
      const calculatedRate = (taxAmount / (totalAmount - taxAmount)) * 100;
      taxRate = Math.round(calculatedRate).toString();
    }
  }

  return {
    amount: taxAmount,
    rate: taxRate,
    displayName,
  };
}

module.exports = {
  EU_COUNTRIES,
  TAX_TYPES,
  classifyTax,
  extractTaxInfo,
};
