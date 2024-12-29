{
  sources ? import ./npins,
  system ? builtins.currentSystem,
  pkgs ? import sources.nixpkgs { inherit system; config = {}; overlays = []; },
}:

let
  aws-sam-cli-macos = (pkgs.callPackage ./nix/vendor/aws-sam-cli { });
in
pkgs.mkShellNoCC {
  # AWS_PROFILE = "softwareeng";

  # Explicitly set these because the Nix shell sets them something like
  # '/private/tmp/nix-shell-72073-0' but the folder isn't actually created.
  TMP = "/tmp";
  TMPDIR = "/tmp";

  packages = with pkgs; [
    #   doInstallCheck = false;
    # (aws-sam-cli.overrideAttrs (oldAttrs: {
    # }))
    awscli2
    check-jsonschema
    curl
    gh
    git
    git-crypt
    jq
    nodePackages.cdktf-cli
    nodejs_20
    pnpm
    pre-commit
    shellcheck
    terraform
  ];

  AWS_GROUP_NAME = "ChatAppGroup";
  AWS_REGION = "eu-west-1";
  AWS_USERNAME = "ChatApp";
  GITHUB_REPOSITORY = "chat-app";
  GITHUB_USERNAME = "futtetennista";

  shellHook = ''
    REPO_ROOT="$(git rev-parse --show-toplevel)"

    export AWS_CONFIG_FILE="$PWD/.aws/config"
    export AWS_SHARED_CREDENTIALS_FILE="$PWD/.aws/credentials"

    # Install aws-cli
    "$(git rev-parse --show-toplevel)"/packages/backend/scripts/localdev/install-aws-sam-cli.sh
    export PATH="$PATH":"$PWD"/.bin/aws-sam-cli

    # https://github.com/aws/aws-sam-cli/issues/5059#issuecomment-1518256371
    if [ ! -L /var/run/docker.sock ]; then
      echo -e "\033[33m[debug] Docker socket not found, need sudo to create '/var/run/docker.sock' symlink (https://github.com/aws/aws-sam-cli/issues/5059#issuecomment-1518256371)\033[0m"
      sudo ln -sf "$HOME/.docker/run/docker.sock" /var/run/docker.sock
    else
      echo '[debug] Docker socket found'
    fi

    # Make sure dependencies are up-to-date
    pnpm install
    # Install git hooks
    pnpm husky

    git-crypt init 2>/dev/null || true
  '';
}
