#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)

if [ -f "$REPO_ROOT/.bin/aws-sam-cli/sam" ]; then
  echo "[debug] AWS SAM CLI is already installed."
  exit 0
fi

if [ ! -f /tmp/aws-sam-cli-macos.pkg ]; then
  echo "[debug] AWS SAM CLI installer download will start."
  curl -L -o /tmp/aws-sam-cli-macos.pkg \
    https://github.com/aws/aws-sam-cli/releases/download/v1.131.0/aws-sam-cli-macos-x86_64.pkg
  echo "[debug] AWS SAM CLI installer download did end."
else
  echo "[debug] AWS SAM CLI already downloaded."
fi

cat <<EOF > /tmp/install-aws-sam-cli.xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <array>
    <dict>
      <key>choiceAttribute</key>
      <string>customLocation</string>
      <key>attributeSetting</key>
      <string>$REPO_ROOT/.bin</string>
      <key>choiceIdentifier</key>
      <string>default</string>
    </dict>
  </array>
</plist>
EOF

mkdir -p "$REPO_ROOT"/.bin

echo "[debug] AWS SAM CLI installation will start."

installer -pkg /tmp/aws-sam-cli-macos.pkg \
  -target CurrentUserHomeDirectory \
  -applyChoiceChangesXML /tmp/install-aws-sam-cli.xml

exit_code=$?

echo "[debug] AWS SAM CLI installation did complete."

if [ $exit_code -eq 0 ]; then
  echo "[debug] AWS SAM CLI installation succeeded."
else
  echo "[debug] AWS SAM CLI installation failed."
fi
