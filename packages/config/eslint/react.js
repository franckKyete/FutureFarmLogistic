const base = require('./base');

/** @type {import("eslint").Linter.Config} */
module.exports = {
  ...base,
  extends: [
    ...base.extends,
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  plugins: [...(base.plugins ?? []), 'react', 'react-hooks', 'jsx-a11y'],
  rules: {
    ...base.rules,
    'react/prop-types': 'off', // TypeScript handles this
    'react/display-name': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
  settings: {
    ...base.settings,
    react: {
      version: 'detect',
    },
  },
};
