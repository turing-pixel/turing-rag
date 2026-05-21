const path = require("path");
const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Monorepo: load `.env` / `.env.local` from repository root (same file as backend).
const repoRoot = path.join(__dirname, "..", "..");
try {
  const { loadEnvConfig } = require("@next/env");
  loadEnvConfig(repoRoot);
} catch (_) {
  /* optional during tooling without Next installed */
}

/** @type {import('next').NextConfig} */
module.exports = withNextIntl({
  output: "standalone",
  skipProxyUrlNormalize: true,
  skipTrailingSlashRedirect: true,
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
});
