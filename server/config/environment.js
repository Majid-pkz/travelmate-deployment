const { existsSync } = require('node:fs');
const path = require('node:path');

// Always resolve the private file from the project root, regardless of cwd.
// Existing runtime environment variables take precedence over file values.
const envPath = path.resolve(__dirname, '../../.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

function requireEnvironment(name, minimumLength = 1) {
  const value = process.env[name]?.trim();
  if (!value || value.length < minimumLength) {
    const requirement = minimumLength > 1
      ? ` and must contain at least ${minimumLength} characters`
      : '';
    throw new Error(
      `${name} is required${requirement}. Configure it in the project root .env file or the hosting runtime environment.`
    );
  }
  return value;
}

module.exports = { requireEnvironment };

