#!/usr/bin/env bash

set -euo pipefail

missing_vars=()

function ensure_env_var() {
  set +u
  if [ -z "${!1:-}" ]; then
    missing_vars+=("$1")
  fi
  set -u
}

function source_local_env() {
  if [[ "${CI:-false}" != "true" && -f "$(dirname "$0")"/../secret.env ]]; then
    # shellcheck source=/dev/null
    source "$(dirname "${BASH_SOURCE[0]}")"/../secret.env
  fi
}

main() {
  ensure_env_var "AWS_ACCESS_KEY_ID"
  ensure_env_var "AWS_S3_BUCKET_NAME"
  ensure_env_var "AWS_REGION"
  ensure_env_var "AWS_SECRET_ACCESS_KEY"
  ensure_env_var "AWS_LAMBDA_RUNTIME"
  ensure_env_var "AWS_LAMBDA_HANDLER"
  ensure_env_var "AWS_LAMBDA_NAME"
  ensure_env_var "AWS_LAMBDA_VERSION"

  if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "\e[31mThe following environment variables are not set: ${missing_vars[*]}\e[0m"
    exit 1
  fi

  jq --null-input --compact-output \
    --arg accessKey "$AWS_ACCESS_KEY_ID" \
    --arg secretKey "$AWS_SECRET_ACCESS_KEY" \
    --arg bucket "$AWS_S3_BUCKET_NAME" \
    --arg region "$AWS_REGION" \
    --arg runtime "$AWS_LAMBDA_RUNTIME" \
    --arg handler "$AWS_LAMBDA_HANDLER" \
    --arg name "$AWS_LAMBDA_NAME" \
    --arg version "$AWS_LAMBDA_VERSION" \
  '{
      frontend: {
        bucket: $bucket
      },
      backend: {
        name: $name,
        handler: $handler,
        runtime: $runtime,
        version: $version
      },
      accessKey: $accessKey,
      region: $region,
      secretKey: $secretKey
  }'
}

main "$@"
