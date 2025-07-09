const fs = require("fs").promises;
const path = require("path");
const Stripe = require("stripe");
const { formatMonth } = require("../utils/input");

let stripe = null;

/**
 * Initialize Stripe client with profile
 * @param {object} profile - Profile containing secret key
 * @returns {boolean} Success status
 */
function initializeStripe(profile) {
  try {
    stripe = new Stripe(profile.secretKey, {
      apiVersion: "2024-12-18.acacia",
    });
    console.log(`🔌 Connected to Stripe with profile: ${profile.name}`);
    return true;
  } catch (error) {
    console.error("❌ Error initializing Stripe:", error);
    return false;
  }
}

/**
 * Create download folder with new structure: downloads/ProfileName/YYYY/MM/
 * @param {string} profileName - Profile name for folder organization
 * @param {number} month - Month number
 * @param {number} year - Year number
 * @returns {Promise<string>} Folder path
 */
async function createDownloadFolder(profileName, month, year) {
  // Create safe profile name for folder
  const safeProfileName = profileName.replace(/[^a-zA-Z0-9_\-]/g, "_");

  const folderPath = path.join(
    process.cwd(),
    "downloads",
    safeProfileName,
    year.toString(),
    formatMonth(month)
  );

  try {
    await fs.mkdir(folderPath, { recursive: true });
    console.log(`📁 Created download folder: ${folderPath}`);
    return folderPath;
  } catch (error) {
    console.error("❌ Error creating download folder:", error);
    throw error;
  }
}

/**
 * Fetch Stripe invoices for a specific month and year
 * @param {number} month - Month number (1-12)
 * @param {number} year - Year number
 * @returns {Promise<Array>} Array of invoices
 */
async function getStripeInvoices(month, year) {
  console.log(
    `🔍 Searching for Stripe invoices for ${formatMonth(month)}/${year}...`
  );

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const startTimestamp = Math.floor(startDate.getTime() / 1000);
  const endTimestamp = Math.floor(endDate.getTime() / 1000);

  const invoices = [];
  let hasMore = true;
  let startingAfter = null;

  while (hasMore) {
    const params = {
      status: "paid",
      created: {
        gte: startTimestamp,
        lte: endTimestamp,
      },
      limit: 100,
      expand: [
        "data.customer",
        "data.customer.address",
        "data.lines",
        "data.lines.data.tax_rates",
        "data.total_tax_amounts",
        "data.total_tax_amounts.tax_rate",
      ],
    };

    if (startingAfter) {
      params.starting_after = startingAfter;
    }

    try {
      const result = await stripe.invoices.list(params);
      invoices.push(...result.data);

      hasMore = result.has_more;
      if (hasMore && result.data.length > 0) {
        startingAfter = result.data[result.data.length - 1].id;
      }
    } catch (error) {
      console.error("❌ Error fetching Stripe invoices:", error);
      throw error;
    }
  }

  console.log(`📊 Found ${invoices.length} paid Stripe invoices`);
  return invoices;
}

/**
 * Download a single Stripe invoice PDF
 * @param {object} invoice - Stripe invoice object
 * @param {string} folderPath - Destination folder path
 * @returns {Promise<boolean>} Success status
 */
async function downloadStripeInvoice(invoice, folderPath) {
  try {
    const customer = invoice.customer;
    const customerName =
      customer?.name ||
      invoice.customer_name ||
      customer?.email ||
      invoice.customer_email ||
      "Unknown";
    const invoiceNumber = invoice.number || invoice.id;
    // Use amount_paid if available, otherwise use total amount
    const amount = ((invoice.amount_paid || invoice.total) / 100).toFixed(2);
    const currency = invoice.currency.toUpperCase();

    // Create safe filenames
    const safeCustomerName = customerName.replace(/[^a-zA-Z0-9_\-]/g, "_");
    const safeInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9_\-]/g, "_");

    const filename = `${safeInvoiceNumber}_${safeCustomerName}_${amount}${currency}.pdf`;
    const filepath = path.join(folderPath, filename);

    // Check if invoice has PDF URL
    if (invoice.invoice_pdf) {
      const response = await fetch(invoice.invoice_pdf);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(filepath, Buffer.from(buffer));

      console.log(`✅ Downloaded: ${filename}`);
      return true;
    } else {
      console.log(`⚠️  No PDF available for invoice ${invoiceNumber}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error downloading Stripe invoice ${invoice.id}:`, error);
    return false;
  }
}

/**
 * Display invoice details summary
 * @param {Array} invoices - Array of invoices
 */
function displayInvoiceDetails(invoices) {
  console.log("\n📋 Found Invoices:");
  console.log("==================");

  let totalAmount = 0;
  const currencyCount = {};

  invoices.forEach((invoice, index) => {
    const customer = invoice.customer;
    const customerName =
      customer?.name ||
      invoice.customer_name ||
      customer?.email ||
      invoice.customer_email ||
      "Unknown";
    // Use amount_paid if available, otherwise use total amount
    const amount = (invoice.amount_paid || invoice.total) / 100;
    const currency = invoice.currency.toUpperCase();
    const date = new Date(invoice.created * 1000).toLocaleDateString("en-US");

    console.log(
      `${index + 1}. ${
        invoice.number
      } - ${customerName} - ${amount} ${currency} - ${date}`
    );

    if (currency === "EUR") {
      totalAmount += amount;
    }

    currencyCount[currency] = (currencyCount[currency] || 0) + amount;
  });

  console.log("\n💰 Summary:");
  Object.entries(currencyCount).forEach(([currency, amount]) => {
    console.log(`   ${currency}: ${amount.toFixed(2)}`);
  });
  console.log("");
}

module.exports = {
  initializeStripe,
  createDownloadFolder,
  getStripeInvoices,
  downloadStripeInvoice,
  displayInvoiceDetails,
};
