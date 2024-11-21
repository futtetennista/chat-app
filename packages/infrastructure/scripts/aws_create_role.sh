#!/usr/bin/env bash

set -euo pipefail
set -x

function mk_trust_policy() {
  if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "\e[31mAWS_ACCOUNT_ID is not set\e[0m"
    exit 1
  fi

  cat <<EOF > "${1?Missing file name}"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::$AWS_ACCOUNT_ID:user/chat-app"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
}

function main() {
  dir=$(mktemp -d)
  filename="$dir/trust-policy.json"

  mk_trust_policy "$filename"

  aws iam create-role \
    --role-name FrontendAppDeploy \
    --assume-role-policy-document "file://$filename"

  # Attach managed policy (example: S3ReadOnly)
  aws iam attach-role-policy \
    --role-name FrontendAppDeploy \
    --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

  aws iam attach-role-policy \
    --role-name FrontendAppDeploy \
    --policy-arn arn:aws:iam::aws:policy/CloudFrontFullAccess

  # Verify role
  aws iam get-role --role-name FrontendAppDeploy
}

main "$@"
