#!/usr/bin/env bash

set -e

PACKAGES=$(find ./packages -type f -name 'package.json' -not -path '*/node_modules/*')
ROOT_DIR=$(pwd)

for PACKAGE_JSON_PATH in $PACKAGES
do
  echo '----------'
  cd "$ROOT_DIR"

  PACKAGE_DIRNAME=$(dirname "$PACKAGE_JSON_PATH")
  echo "Processing package $PACKAGE_DIRNAME"

  if [[ ! -e "$PACKAGE_DIRNAME/.skip-template" ]]; then
    cp template/.gitignore template/.npmignore template/.npmrc template/tsconfig.json "$PACKAGE_DIRNAME/"

    jq '. +
      {
        license: "MIT",
        author: "Alik Send",
        main: "dist/index.js",
        types: "dist/index.d.ts",
        repository: {
          type: "git",
          url: "https://github.com/aliksend/node-packages.git"
        },
        publishConfig: {
          access: "public"
        },
        scripts: {
          "prepublishOnly": "npm run build",
          "test": "node --require ts-node/register --test ./src/*.test.ts",
          "build": "rm -rf dist && tsc",
          "lint": "npx @aliksend/linter --fix"
        },
      }
    ' "$PACKAGE_DIRNAME/package.json" > p.json
    mv p.json "$PACKAGE_DIRNAME/package.json"

    rm -rf "$PACKAGE_DIRNAME/.eslintrc.yml" "$PACKAGE_DIRNAME/LICENSE" "$PACKAGE_DIRNAME/.github"
  fi

  NAME=$(cat "$PACKAGE_JSON_PATH" | jq -r '.name')
  echo "  name: $NAME"

  PACKAGE_JSON_VERSION=$(cat "$PACKAGE_JSON_PATH" | jq -r '.version')
  echo "  version: $PACKAGE_JSON_VERSION"

  PACKAGE_INFO_FROM_REGISTY=$(curl --silent "https://registry.npmjs.org/$NAME")
  ERROR=$(echo "$PACKAGE_INFO_FROM_REGISTY" | jq -r '.error')
  if [[ "$ERROR" == "null" ]]; then
    CURRENT_VERSION_FOUND_IN_REGISTRY=$(echo "$PACKAGE_INFO_FROM_REGISTY" | jq -r --arg v "$PACKAGE_JSON_VERSION" '.versions[$v] != null')
    if [[ "$CURRENT_VERSION_FOUND_IN_REGISTRY" == "true" ]]; then
      echo "Current version already present in registry. Skipping"
      continue
    fi
  elif [[ "$ERROR" == "Not found" ]]; then
    echo "Package not found in registry"
  else
    echo "$PACKAGE_INFO_FROM_REGISTY"
    exit 1
  fi

  echo "Current version not found in registry. Publishing"
  cd "$PACKAGE_DIRNAME"
  # npx sort-package-json
  npm ci
  npm publish
done
