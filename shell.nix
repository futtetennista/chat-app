{
  sources ? import ./npins,
  system ? builtins.currentSystem,
  pkgs ? import sources.nixpkgs { inherit system; config = {}; overlays = []; },
}:

let
  aws-sam-cli-macos = (pkgs.callPackage ./nix/vendor/aws-sam-cli { });
in
pkgs.mkShellNoCC {
  AWS_PROFILE = "softwareeng";

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

  shellHook = ''
    "$(git rev-parse --show-toplevel)"/packages/backend/scripts/localdev/install-aws-sam-cli.sh
    export PATH="$PATH":"$PWD"/.bin/aws-sam-cli
    # https://github.com/aws/aws-sam-cli/issues/5059#issuecomment-1518256371
    if [ ! -S /var/run/docker.sock ]; then
      echo -e "\033[33m[debug] Docker socket not found, need sudo to create '/var/run/docker.sock' symlink...\033[0m"
      sudo ln -sf "$HOME/.docker/run/docker.sock" /var/run/docker.sock
    fi

    # Install git hooks
    pnpm husky

    git-crypt init || true
  '';
}
