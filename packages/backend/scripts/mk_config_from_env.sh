#!/usr/bin/env bash

set -eo pipefail

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
  # ensure_env_var "OPENAI_API_KEY"
  # ensure_env_var "OPENAI_MODEL"
  # ensure_env_var "OPENAI_STREAM"
  # ensure_env_var "LOG_LEVEL"

  if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "\e[31mThe following environment variables are not set: ${missing_vars[*]}\e[0m"
    exit 1
  fi

  if [ -z "${OPENAI_API_KEY:-}" ]; then
    jq --null-input --compact-output \
      --arg openAiApiKey "${OPENAI_API_KEY}" \
      --arg openAiApiModel "${OPENAI_API_MODEL}" \
      --arg openAiStream "${OPENAI_STREAM:-false}" \
      --arg level "${LOG_LEVEL:-debug}" \
    '{
        openai: {
          apiKey: $openaiApiKey,
          model: $openaiModel,
          stream: $openaiStream
        },
        logging: {
          level: $logLevel
        }
    }'
  else
    jq --null-input --compact-output \
      --arg logLevel "${LOG_LEVEL:-debug}" \
    '{
        logging: {
          level: $logLevel
        }
    }'
  fi
}

main "$@"
