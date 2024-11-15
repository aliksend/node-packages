import love from 'eslint-config-love'
import comments from 'eslint-plugin-eslint-comments'
import jsdoc from 'eslint-plugin-jsdoc'
import unicorn from 'eslint-plugin-unicorn'
import ignoreGenerated from 'eslint-plugin-ignore-generated'

export default [{
  ...love,
  files: ["**/*.ts", "**/*.tsx"],
  plugins: {
    ...love.plugins,
    comments,
    jsdoc,
    unicorn,
    ignoreGenerated,
  },
  languageOptions: {
    ...love.languageOptions,
    "parserOptions": {
      ...love.languageOptions.parserOptions,
      "project": "./tsconfig.json"
    },
  },
  "rules": {
    ...love.rules,
    "@typescript-eslint/no-redeclare": "off",
    "no-console": "error",
    "multiline-comment-style": [
      "error",
      "separate-lines"
    ],
    "curly": [
      "error",
      "all"
    ],
    "no-implicit-coercion": [
      "error"
    ],
    "no-process-env": [
      "error"
    ],
    "function-call-argument-newline": [
      "error",
      "never"
    ],
    "one-var": [
      "error",
      "never"
    ],
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/naming-convention": [
      "error",
      {
        "selector": "variableLike",
        "format": [
          "camelCase",
          "PascalCase",
          "UPPER_CASE"
        ],
        "leadingUnderscore": "allow",
        "trailingUnderscore": "forbid"
      },
      {
        "selector": "memberLike",
        "modifiers": [
          "protected"
        ],
        "format": [
          "camelCase"
        ],
        "leadingUnderscore": "require",
        "trailingUnderscore": "forbid"
      },
      {
        "selector": "memberLike",
        "modifiers": [
          "private"
        ],
        "format": [
          "camelCase"
        ],
        "prefix": [
          "#"
        ],
        "leadingUnderscore": "forbid",
        "trailingUnderscore": "forbid"
      }
    ],
    // "@typescript-eslint/brace-style": ["error", "1tbs"],
    // "@typescript-eslint/comma-dangle": [
    //   "error",
    //   {
    //     "arrays": "always-multiline",
    //     "objects": "always-multiline"
    //   }
    // ],
    "jsdoc/check-alignment": "error",
    "eslint-comments/disable-enable-pair": [
      "error",
      {
        "allowWholeFile": true
      }
    ],
    "eslint-comments/no-duplicate-disable": "error",
    "eslint-comments/no-unlimited-disable": "error",
    "eslint-comments/no-unused-disable": "error",
    "eslint-comments/no-unused-enable": "error",
    "unicorn/catch-error-name": [
      "error",
      {
        "name": "err"
      }
    ],
    "n/no-restricted-import": [
      "error",
      [
        {
          "name": "env-var",
          "message": "Use config to depend on env var values"
        }
      ]
    ]
  }
}, {
  "files": [
    "./src/config/config.ts",
    "./src/config.ts"
  ],
  "rules": {
    "n/no-restricted-import": [
      "error",
      []
    ]
  }
}]
