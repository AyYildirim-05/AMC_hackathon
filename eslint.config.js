const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  // server/ has its own toolchain.
  globalIgnores(['dist/*', '.expo/*', 'coverage/*', 'server/*']),
  expoConfig,
  prettierConfig,
]);
