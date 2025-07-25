const fs = require("fs").promises;
const path = require("path");
const { classifyTax, extractTaxInfo } = require("../tax/classifier");

/**
 * Generate CSV files for accounting purposes
 * @param {Array} invoices - Array of Stripe invoices
 * @param {string} folderPath - Output folder path
 * @returns {Promise<object>} Paths to generated CSV files
 */
async function generateAccountingCSV(invoices, folderPath) {
  try {
    const csvData = [];
    const countrySummary = {};

    // Extract company country from first invoice
    const companyCountry =
      invoices.length > 0 ? invoices[0].account_country : "Unknown";

    if (companyCountry && companyCountry !== "Unknown") {
      console.log(`🏢 Detected company country: ${companyCountry}`);
    } else {
      console.log(
        "⚠️  Warning: Could not detect company country from invoices"
      );
    }

    // Process each invoice
    for (const invoice of invoices) {
      const customer = invoice.customer;
      const customerName =
        customer?.name ||
        invoice.customer_name ||
        customer?.email ||
        invoice.customer_email ||
        "Unknown";

      // Try multiple sources for customer country - prioritize invoice address (historical)
      const customerCountry =
        invoice.customer_address?.country || // Direct invoice field (historical, correct!)
        customer?.address?.country || // Expanded customer object (current, fallback)
        "Unknown";
      const invoiceNumber = invoice.number || invoice.id;
      const currency = invoice.currency.toUpperCase();
      const date = new Date(invoice.created * 1000).toLocaleDateString("de-DE");

      // Calculate amounts
      const totalAmount = (invoice.amount_paid || invoice.total) / 100;

      // Extract tax information
      const taxRateInfo = extractTaxInfo(invoice);
      taxRateInfo.invoiceId = invoiceNumber; // Add for debug logging
      const taxAmount = taxRateInfo.amount;

      // Debug: Log wenn Daten fehlen
      if (customerCountry === "Unknown") {
        console.log(
          `⚠️  Debug: Invoice ${invoiceNumber} - Customer country unknown! Customer ID: ${
            customer?.id || "N/A"
          }`
        );
      }
      // Only log if it's an unexpected case (has tax but no rate)
      if (!taxRateInfo.rate && taxAmount > 0) {
        console.log(
          `⚠️  Debug: Invoice ${invoiceNumber} - No tax rate found for non-zero tax amount. Using fallback logic.`
        );
      }

      // Calculate net amount
      const netAmount = totalAmount - taxAmount;

      // Classify tax type
      const taxClassification = classifyTax(
        companyCountry,
        customerCountry,
        taxAmount,
        taxRateInfo
      );

      // Add to CSV data
      csvData.push({
        invoiceNumber,
        customerName,
        customerCountry,
        date,
        currency,
        grossAmount: totalAmount.toFixed(2),
        netAmount: netAmount.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        taxRate: taxClassification.taxRateDisplay,
        taxInfo: taxClassification.taxInfo,
      });

      // Summarize by country, tax rate and reverse charge status
      const key = `${customerCountry}-${taxClassification.taxRateDisplay}-${currency}`;
      if (!countrySummary[key]) {
        countrySummary[key] = {
          country: customerCountry,
          taxRate: taxClassification.taxRateDisplay,
          currency,
          taxInfo: taxClassification.taxInfo,
          totalGross: 0,
          totalNet: 0,
          totalTax: 0,
          invoiceCount: 0,
        };
      }

      countrySummary[key].totalGross += totalAmount;
      countrySummary[key].totalNet += netAmount;
      countrySummary[key].totalTax += taxAmount;
      countrySummary[key].invoiceCount++;
    }

    // Create detailed CSV content
    let csvContent =
      "Invoice Number,Customer,Country,Date,Currency,Gross Amount,Net Amount,Tax Amount,Tax Rate,Tax Info\n";
    csvData.forEach((row) => {
      csvContent += `"${row.invoiceNumber}","${row.customerName}","${row.customerCountry}","${row.date}","${row.currency}","${row.grossAmount}","${row.netAmount}","${row.taxAmount}","${row.taxRate}","${row.taxInfo}"\n`;
    });

    // Create summary CSV content
    let summaryContent =
      "Country,Tax Rate,Currency,Tax Info,Total Gross,Total Net,Total Tax,Invoice Count\n";
    Object.values(countrySummary).forEach((summary) => {
      summaryContent += `"${summary.country}","${summary.taxRate}","${
        summary.currency
      }","${summary.taxInfo}","${summary.totalGross.toFixed(
        2
      )}","${summary.totalNet.toFixed(2)}","${summary.totalTax.toFixed(2)}","${
        summary.invoiceCount
      }"\n`;
    });

    // Write CSV files
    const detailedCsvPath = path.join(folderPath, "invoices_detailed.csv");
    const summaryCsvPath = path.join(folderPath, "invoices_summary.csv");

    await fs.writeFile(detailedCsvPath, csvContent, "utf8");
    await fs.writeFile(summaryCsvPath, summaryContent, "utf8");

    console.log(`📊 CSV files created:`);
    console.log(`   📄 Detailed: ${detailedCsvPath}`);
    console.log(`   📋 Summary: ${summaryCsvPath}`);

    return { detailedCsvPath, summaryCsvPath };
  } catch (error) {
    console.error("❌ Error generating CSV files:", error);
    throw error;
  }
}

module.exports = {
  generateAccountingCSV,
};
