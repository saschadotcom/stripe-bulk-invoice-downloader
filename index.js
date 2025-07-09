#!/usr/bin/env node

const {
  askQuestion,
  validateMonth,
  closeInterface,
} = require("./src/utils/input");
const { selectProfile } = require("./src/config/profileManager");
const {
  initializeStripe,
  createDownloadFolder,
  getStripeInvoices,
  downloadStripeInvoice,
  displayInvoiceDetails,
} = require("./src/stripe/client");
const { generateAccountingCSV } = require("./src/export/csvGenerator");

/**
 * Main function - Entry point of the application
 */
async function main() {
  console.log("🚀 Stripe Invoice Downloader");
  console.log("=============================\n");

  try {
    // Initialize Stripe with profile selection
    const profile = await selectProfile();
    if (!profile) {
      console.error("❌ Failed to select profile. Exiting.");
      process.exit(1);
    }

    const initialized = initializeStripe(profile);
    if (!initialized) {
      console.error("❌ Failed to initialize Stripe. Exiting.");
      process.exit(1);
    }

    // User interaction - get month and year
    const monthInput = await askQuestion(
      "📅 Which month? (e.g. 05 for May, 12 for December): "
    );
    const month = parseInt(monthInput, 10);

    if (!validateMonth(month)) {
      console.error(
        "❌ Invalid month! Please enter a number between 1 and 12."
      );
      process.exit(1);
    }

    const yearInput = await askQuestion("📅 Which year? (e.g. 2024): ");
    const year = parseInt(yearInput, 10);

    if (isNaN(year) || year < 2020 || year > 2030) {
      console.error(
        "❌ Invalid year! Please enter a year between 2020 and 2030."
      );
      process.exit(1);
    }

    console.log(
      `\n🔄 Searching for paid invoices for ${String(month).padStart(
        2,
        "0"
      )}/${year}...\n`
    );

    // Create download folder with profile-specific structure
    const folderPath = await createDownloadFolder(profile.name, month, year);

    // Fetch invoices
    const stripeInvoices = await getStripeInvoices(month, year);

    if (stripeInvoices.length === 0) {
      console.log("⚠️  No paid invoices found for the selected month.");
      return;
    }

    // Display invoice details
    displayInvoiceDetails(stripeInvoices);

    // Ask for PDF download
    const confirmDownload = await askQuestion(
      "🤔 Do you want to download all found invoices? (y/n): "
    );

    let downloaded = 0;
    let failed = 0;

    if (
      confirmDownload.toLowerCase() === "y" ||
      confirmDownload.toLowerCase() === "yes"
    ) {
      console.log(`\n📥 Starting invoice download...\n`);

      // Download Stripe invoices
      for (const invoice of stripeInvoices) {
        const success = await downloadStripeInvoice(invoice, folderPath);
        if (success) {
          downloaded++;
        } else {
          failed++;
        }
      }
    } else {
      console.log("❌ Invoice download cancelled.");
    }

    // Ask for CSV export even if download was cancelled
    const confirmCSV = await askQuestion(
      "📊 Do you want to generate CSV files for accounting? (y/n): "
    );

    if (
      confirmCSV.toLowerCase() === "y" ||
      confirmCSV.toLowerCase() === "yes"
    ) {
      console.log("\n📊 Generating CSV files for accounting...");
      try {
        await generateAccountingCSV(stripeInvoices, folderPath);
      } catch (error) {
        console.error(
          "⚠️  Warning: Could not generate CSV files:",
          error.message
        );
      }
    } else {
      console.log("❌ CSV export cancelled.");
    }

    // Summary
    console.log("\n📋 Summary:");
    console.log("====================");
    if (downloaded > 0) {
      console.log(
        `✅ Successfully downloaded invoices: ${downloaded}/${stripeInvoices.length}`
      );
      if (failed > 0) {
        console.log(`❌ Failed downloads: ${failed}`);
      }
    }
    console.log(`📁 Files saved to: ${folderPath}`);
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  } finally {
    // Close connections
    closeInterface();
  }
}

// Run script
if (require.main === module) {
  main();
}
