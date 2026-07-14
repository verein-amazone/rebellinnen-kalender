// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  // Architecture layer boundaries. Enforces the dependency direction
  // View/Presenters -> Interactors -> Data. See docs/architecture/frontend-architecture.md.
  {
    files: ['src/app/view/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@app/data', '@app/data/*'],
              message:
                'view/** must not import from data/**. Go through an interactor. See docs/architecture/frontend-architecture.md.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/interactors/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@app/view', '@app/view/*'],
              message:
                'interactors/** must not import from view/**. Interactors are UI-agnostic. See docs/architecture/frontend-architecture.md.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/data/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@app/view', '@app/view/*', '@app/interactors', '@app/interactors/*'],
              message:
                'data/** must not import from view/** or interactors/**. The data layer sits at the bottom. See docs/architecture/frontend-architecture.md.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
