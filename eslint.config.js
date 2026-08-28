// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/**
 * Every package that ships a Capacitor plugin. They are imported in `src/app/cross-cutting/plugins/`
 * and handed on as injection tokens; see that folder's README for why.
 */
const NATIVE_PACKAGES = [
  '@capacitor/*',
  '@capacitor-community/*',
  '@capawesome/*',
  '@capawesome-team/*',
  '@ebarooni/*',
  '@independo/*',
  'capacitor-native-settings',
  'jeep-sqlite',
];

const NATIVE_PACKAGE_MESSAGE =
  'Import a Capacitor plugin only in src/app/cross-cutting/plugins/, behind an injection token, and inject the token instead. See src/app/cross-cutting/plugins/README.md.';

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
  // Everything native the app touches. Two rules, one rule id, two disjoint file sets - a second
  // block naming the same rule would replace the first one's patterns for every file both match
  // instead of adding to them.
  //
  // Deliberately the typescript-eslint rule rather than the core one: the layer boundaries above
  // already use `no-restricted-imports`, and the same replacement trap applies across the two
  // blocks. It also carries `allowTypeImports`, which the core rule has no equivalent for - a
  // gateway naming a plugin's result type in a signature is not the coupling this prevents.
  //
  // Specs are exempt from both. Substituting a token is the entire reason it exists, and an
  // interactor spec that drives a real gateway has to provide one.
  {
    files: ['src/app/**/*.ts'],
    ignores: [
      'src/app/cross-cutting/plugins/**',
      'src/app/cross-cutting/infrastructure/**',
      'src/app/data/gateways/**',
      '**/*.spec.ts',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: NATIVE_PACKAGES,
              allowTypeImports: true,
              message: NATIVE_PACKAGE_MESSAGE,
            },
            {
              group: ['@app/cross-cutting/plugins', '@app/cross-cutting/plugins/*'],
              message:
                'Only data/gateways/** and cross-cutting/infrastructure/** may inject a plugin token. See src/app/cross-cutting/plugins/README.md.',
            },
          ],
        },
      ],
    },
  },
  {
    // The wrapper layer: allowed to hold a token, still not allowed to import a plugin package.
    // `device-platform.ts` is the one exception - it reads the Capacitor runtime rather than a
    // plugin, and it runs while the providers are still being assembled, before any injector
    // exists to hand it a token.
    files: ['src/app/data/gateways/**/*.ts', 'src/app/cross-cutting/infrastructure/**/*.ts'],
    ignores: ['src/app/cross-cutting/infrastructure/device-platform.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: NATIVE_PACKAGES, allowTypeImports: true, message: NATIVE_PACKAGE_MESSAGE },
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
