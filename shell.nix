{
  sources ? import ./npins,
  system ? builtins.currentSystem,
  pkgs ? import sources.nixpkgs { inherit system; config = {}; overlays = []; },
}:

pkgs.mkShellNoCC {
  packages = with pkgs; [
    git
    gh
    nodejs_20
    pnpm
    shellcheck
    (aws-sam-cli.overrideAttrs (oldAttrs: {
      doInstallCheck = false;
    }))
    terraform
    nodePackages.cdktf-cli
  ];

  shellHook = ''
    # Install git hooks
    pnpm husky
  '';
}
