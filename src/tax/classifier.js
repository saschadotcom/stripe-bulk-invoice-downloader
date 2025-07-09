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

  // Handle special taxability reasons from Stripe
  else if (taxRateInfo.taxabilityReason === "not_subject_to_tax") {
    if (isCompanyEU && !isCustomerEU) {
      taxInfo = TAX_TYPES.EXPORT;
      console.log(
        `📋 Debug: Invoice marked as "not_subject_to_tax" - EU to Non-EU = Export`
      );
    } else if (
      isCompanyEU &&
      isCustomerEU &&
      customerCountry !== companyCountry
    ) {
      taxInfo = TAX_TYPES.REVERSE_CHARGE;
      isReverseCharge = true;
      console.log(
        `📋 Debug: Invoice marked as "not_subject_to_tax" - EU to different EU = Reverse Charge`
      );
    } else {
      taxInfo = TAX_TYPES.TAX_FREE;
      console.log(
        `📋 Debug: Invoice marked as "not_subject_to_tax" - Other case = Tax-free`
      );
    }
  }

  // Handle "not_collecting" - typically for international transactions
  else if (taxRateInfo.taxabilityReason === "not_collecting") {
    if (isCompanyEU && !isCustomerEU) {
      taxInfo = TAX_TYPES.EXPORT;
      console.log(
        `📋 Debug: Invoice marked as "not_collecting" - EU to Non-EU = Export`
      );
    } else if (
      isCompanyEU &&
      isCustomerEU &&
      customerCountry !== companyCountry
    ) {
      taxInfo = TAX_TYPES.REVERSE_CHARGE;
      isReverseCharge = true;
      console.log(
        `📋 Debug: Invoice marked as "not_collecting" - EU to different EU = Reverse Charge`
      );
    } else {
      taxInfo = TAX_TYPES.TAX_FREE;
      console.log(
        `📋 Debug: Invoice marked as "not_collecting" - Other case = Tax-free`
      );
    }
  }

  // Handle unknown customer country
  else if (customerCountry === "Unknown") {
    if (taxAmount === 0) {
      taxInfo = TAX_TYPES.TAX_FREE;
      console.log(
        `⚠️  Warning: Invoice ${
          taxRateInfo.invoiceId || "unknown"
        } - Customer country unknown, treating 0% as Tax-free`
      );
    } else {
      taxInfo = TAX_TYPES.STANDARD;
      console.log(
        `⚠️  Warning: Invoice ${
          taxRateInfo.invoiceId || "unknown"
        } - Customer country unknown, treating ${taxRate}% as Standard`
      );
    }
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
    // Tax amount > 0 - determine correct classification
    if (isCompanyEU && isCustomerEU && customerCountry !== companyCountry) {
      // EU company selling to different EU country with tax = OSS (B2C)
      taxInfo = TAX_TYPES.OSS;
    } else if (isCompanyEU && !isCustomerEU) {
      // EU company selling to non-EU country with tax = Export (possibly wrong tax calculation)
      taxInfo = TAX_TYPES.EXPORT;
      console.log(
        `⚠️  Warning: Invoice ${
          taxRateInfo.invoiceId || "unknown"
        } - EU to Non-EU with tax! Should be 0% (Export)`
      );
    } else if (customerCountry === companyCountry) {
      // Domestic transaction
      taxInfo = TAX_TYPES.STANDARD;
    } else {
      // Other cases with tax
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
  let taxabilityReason = null;

  // Method 1: Extract from line items with tax_amounts (most common format)
  if (invoice.lines && invoice.lines.data) {
    for (const line of invoice.lines.data) {
      if (line.tax_amounts && line.tax_amounts.length > 0) {
        for (const taxAmountObj of line.tax_amounts) {
          taxAmount += taxAmountObj.amount / 100;

          // Get taxability reason
          if (taxAmountObj.taxability_reason) {
            taxabilityReason = taxAmountObj.taxability_reason;
          }

          // Try to get tax rate details - but only if tax amount > 0
          if (
            taxAmountObj.tax_rate &&
            typeof taxAmountObj.tax_rate === "object" &&
            taxAmountObj.amount > 0
          ) {
            if (taxAmountObj.tax_rate.percentage) {
              taxRate = taxAmountObj.tax_rate.percentage.toString();
            }
            if (taxAmountObj.tax_rate.display_name) {
              displayName = taxAmountObj.tax_rate.display_name;
            }
          }
        }
      }

      // Fallback to tax_rates array (older format with actual percentage)
      if (line.tax_rates && line.tax_rates.length > 0) {
        for (const tax of line.tax_rates) {
          if (tax.percentage) {
            taxRate = tax.percentage.toString();
            taxAmount += (line.amount * tax.percentage) / 100 / 100;
          }
          if (tax.display_name) {
            displayName = tax.display_name;
          }
        }
      }
    }
  }

  // Method 2: Use total_tax_amounts (comprehensive)
  if (invoice.total_tax_amounts && invoice.total_tax_amounts.length > 0) {
    let totalTaxFromAmounts = 0;
    for (const totalTax of invoice.total_tax_amounts) {
      totalTaxFromAmounts += totalTax.amount / 100;

      if (totalTax.taxability_reason) {
        taxabilityReason = totalTax.taxability_reason;
      }

      // Try to get percentage from tax_rate object - but only if tax amount > 0
      if (
        totalTax.tax_rate &&
        typeof totalTax.tax_rate === "object" &&
        totalTax.amount > 0
      ) {
        if (totalTax.tax_rate.percentage) {
          taxRate = totalTax.tax_rate.percentage.toString();
        }
        if (totalTax.tax_rate.display_name) {
          displayName = totalTax.tax_rate.display_name;
        }
      }
    }

    // Use total_tax_amounts as authoritative source for tax amount
    if (totalTaxFromAmounts > 0) {
      taxAmount = totalTaxFromAmounts;
    } else {
      // If total tax is 0, ensure rate is also 0
      taxAmount = 0;
      if (
        taxabilityReason === "not_collecting" ||
        taxabilityReason === "not_subject_to_tax"
      ) {
        taxRate = "0";
      }
    }
  }

  // Method 3: Calculate tax rate from amounts if we have tax but no rate
  if (taxAmount > 0 && (taxRate === "0" || !taxRate)) {
    const totalAmount = (invoice.amount_paid || invoice.total) / 100;
    const netAmount = totalAmount - taxAmount;

    if (netAmount > 0) {
      const calculatedRate = (taxAmount / netAmount) * 100;
      taxRate = Math.round(calculatedRate).toString();

      console.log(
        `🔧 Debug: Invoice ${
          invoice.number || invoice.id
        } - Calculated tax rate from amounts:`
      );
      console.log(
        `   Total: ${totalAmount.toFixed(2)}, Net: ${netAmount.toFixed(
          2
        )}, Tax: ${taxAmount.toFixed(2)}, Rate: ${calculatedRate.toFixed(
          2
        )}% → ${taxRate}%`
      );
    }
  }

  // Method 4: Fallback to invoice.tax if nothing else worked
  if (taxAmount === 0 && invoice.tax && invoice.tax > 0) {
    taxAmount = invoice.tax / 100;

    // Calculate rate from total if we have tax amount
    const totalAmount = (invoice.amount_paid || invoice.total) / 100;
    const netAmount = totalAmount - taxAmount;

    if (netAmount > 0) {
      const calculatedRate = (taxAmount / netAmount) * 100;
      taxRate = Math.round(calculatedRate).toString();

      console.log(
        `🔧 Debug: Invoice ${
          invoice.number || invoice.id
        } - Using invoice.tax fallback:`
      );
      console.log(
        `   Total: ${totalAmount.toFixed(2)}, Net: ${netAmount.toFixed(
          2
        )}, Tax: ${taxAmount.toFixed(2)}, Rate: ${calculatedRate.toFixed(
          2
        )}% → ${taxRate}%`
      );
    }
  }

  // Log taxability reasons for debugging
  if (taxabilityReason && taxabilityReason !== "standard_rated") {
    console.log(
      `📋 Debug: Invoice ${
        invoice.number || invoice.id
      } - Taxability reason: ${taxabilityReason}`
    );
  }

  // Final safety check: if tax amount is 0, rate should also be 0
  if (taxAmount === 0) {
    taxRate = "0";
  }

  return {
    amount: taxAmount,
    rate: taxRate,
    displayName,
    taxabilityReason,
  };
}

module.exports = {
  EU_COUNTRIES,
  TAX_TYPES,
  classifyTax,
  extractTaxInfo,
};
