const readline = require("readline");

// Readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Ask a question and wait for user input
 * @param {string} question - The question to ask
 * @returns {Promise<string>} - The user's answer
 */
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Ask a question with masked input (for passwords/keys)
 * @param {string} question - The question to ask
 * @returns {Promise<string>} - The user's answer
 */
function askSecretQuestion(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    // Save original stdin state
    const originalRawMode = stdin.isRaw;
    const originalPaused = stdin.isPaused();

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let input = "";

    const onData = (char) => {
      char = char.toString();

      if (char === "\n" || char === "\r" || char === "\u0004") {
        // Clean up and restore stdin
        stdin.removeListener("data", onData);
        stdin.setRawMode(originalRawMode);
        if (originalPaused) {
          stdin.pause();
        }
        stdout.write("\n");
        resolve(input);
        return;
      }

      if (char === "\u0003") {
        // Clean up before exit
        stdin.removeListener("data", onData);
        stdin.setRawMode(originalRawMode);
        process.exit();
      }

      if (char === "\u0008" || char === "\u007f") {
        if (input.length > 0) {
          input = input.slice(0, -1);
          stdout.write("\b \b");
        }
      } else {
        input += char;
        stdout.write("*");
      }
    };

    stdin.on("data", onData);
  });
}

/**
 * Validate month input
 * @param {number} month - Month to validate
 * @returns {boolean} - Whether the month is valid
 */
function validateMonth(month) {
  const monthNum = parseInt(month, 10);
  return monthNum >= 1 && monthNum <= 12;
}

/**
 * Format month with leading zero
 * @param {number} month - Month number
 * @returns {string} - Formatted month (e.g., "05")
 */
function formatMonth(month) {
  return month.toString().padStart(2, "0");
}

/**
 * Close the readline interface
 */
function closeInterface() {
  rl.close();
}

module.exports = {
  askQuestion,
  askSecretQuestion,
  validateMonth,
  formatMonth,
  closeInterface,
};
