#!/usr/bin/env bash

set -euo pipefail

missing_vars=()

set +u
if [ -z "$AWS_ACCESS_KEY_ID" ]; then
  missing_vars+=("AWS_ACCESS_KEY_ID")
fi

if [ -z "$AWS_S3_BUCKET_NAME" ]; then
  missing_vars+=("AWS_S3_BUCKET_NAME")
fi

if [ -z "$AWS_REGION" ]; then
  missing_vars+=("AWS_REGION")
fi

if [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  missing_vars+=("AWS_SECRET_ACCESS_KEY")
fi

if [ ${#missing_vars[@]} -ne 0 ]; then
  echo -e "\e[31mThe following environment variables are not set: ${missing_vars[*]}\e[0m"
  exit 1
fi
set -u

jq --null-input --compact-output \
  --arg accessKey "$AWS_ACCESS_KEY_ID" \
  --arg bucket "$AWS_S3_BUCKET_NAME" \
  --arg region "$AWS_REGION" \
  --arg secretKey "$AWS_SECRET_ACCESS_KEY" \
'{
    frontend: {
      bucket: $bucket
    },
    accessKey: $accessKey,
    region: $region,
    secretKey: $secretKey
}'