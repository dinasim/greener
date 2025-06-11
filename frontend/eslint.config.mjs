import eslintPluginReact from 'eslint-plugin-react';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/*.css',
      '**/*.png',
      '**/*.jpg',
      '**/*.svg',
      '**/*.json'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      react: eslintPluginReact,
    },
    rules: {},
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];
