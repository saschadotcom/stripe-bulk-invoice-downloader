const fs = require("fs").promises;
const path = require("path");
const { askQuestion, askSecretQuestion } = require("../utils/input");

// Configuration file path
const CONFIG_FILE = path.join(process.cwd(), "config.json");

/**
 * Load configuration from file
 * @returns {Promise<object>} Configuration object
 */
async function loadConfig() {
  try {
    const configData = await fs.readFile(CONFIG_FILE, "utf8");
    return JSON.parse(configData);
  } catch (error) {
    // Config file doesn't exist or is invalid
    return { profiles: {} };
  }
}

/**
 * Save configuration to file
 * @param {object} config - Configuration object to save
 */
async function saveConfig(config) {
  try {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(`💾 Configuration saved to ${CONFIG_FILE}`);
  } catch (error) {
    console.error("❌ Error saving configuration:", error);
    throw error;
  }
}

/**
 * Create a new profile
 * @param {object} config - Current configuration
 * @returns {Promise<object>} Created profile
 */
async function createProfile(config) {
  const profileName = await askQuestion("📝 Enter profile name: ");

  if (config.profiles[profileName]) {
    console.log("⚠️  Profile already exists!");
    const overwrite = await askQuestion(
      "🤔 Overwrite existing profile? (y/n): "
    );
    if (overwrite.toLowerCase() !== "y" && overwrite.toLowerCase() !== "yes") {
      return await createProfile(config);
    }
  }

  const secretKey = await askSecretQuestion("🔐 Enter Stripe Secret Key: ");

  if (!secretKey || !secretKey.startsWith("sk_")) {
    console.error("❌ Invalid Stripe Secret Key! It should start with 'sk_'");
    return await createProfile(config);
  }

  // Ask for company country for tax classification
  const companyCountry = await askQuestion(
    "🏢 Enter your company country (e.g. DE, AT, US): "
  );

  const profile = {
    name: profileName,
    secretKey: secretKey,
    companyCountry: companyCountry.toUpperCase(),
    createdAt: new Date().toISOString(),
  };

  config.profiles[profileName] = profile;
  await saveConfig(config);

  console.log(`✅ Profile "${profileName}" created successfully!`);
  return profile;
}

/**
 * Select or create a profile
 * @returns {Promise<object>} Selected profile
 */
async function selectProfile() {
  const config = await loadConfig();
  const profiles = Object.keys(config.profiles);

  if (profiles.length === 0) {
    console.log("📝 No profiles found. Let's create your first profile.");
    return await createProfile(config);
  }

  console.log("\n📋 Available profiles:");
  profiles.forEach((profile, index) => {
    console.log(`${index + 1}. ${profile}`);
  });
  console.log(`${profiles.length + 1}. Create new profile`);

  const selection = await askQuestion(
    `\n🔢 Select profile (1-${profiles.length + 1}): `
  );
  const selectionNum = parseInt(selection, 10);

  if (selectionNum === profiles.length + 1) {
    return await createProfile(config);
  }

  if (selectionNum >= 1 && selectionNum <= profiles.length) {
    const selectedProfile = profiles[selectionNum - 1];
    const profile = config.profiles[selectedProfile];

    // Check if profile has companyCountry, if not, ask for it
    if (!profile.companyCountry) {
      console.log(
        `⚠️  Profile "${selectedProfile}" doesn't have a company country set.`
      );
      const companyCountry = await askQuestion(
        "🏢 Enter your company country (e.g. DE, AT, US): "
      );
      profile.companyCountry = companyCountry.toUpperCase();
      await saveConfig(config);
    }

    console.log(`✅ Selected profile: ${selectedProfile}`);
    return profile;
  }

  console.error("❌ Invalid selection!");
  return await selectProfile();
}

module.exports = {
  loadConfig,
  saveConfig,
  createProfile,
  selectProfile,
  CONFIG_FILE,
};
