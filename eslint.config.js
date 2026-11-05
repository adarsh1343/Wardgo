// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    rules: {
      // Only meaningful when the React Compiler is enabled (experiments.reactCompiler),
      // which this project does not use. All other React hooks rules stay on.
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
]);
