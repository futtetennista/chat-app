{
  sources ? import ./npins,
  system ? builtins.currentSystem,
  pkgs ? import sources.nixpkgs { inherit system; config = {}; overlays = []; },
}:

pkgs.mkShellNoCC {
  packages = [
    pkgs.git
    pkgs.nodejs_20
    pkgs.pnpm
    pkgs.shellcheck
    (pkgs.aws-sam-cli.overrideAttrs (oldAttrs: {
      doInstallCheck = false;
    }))
    # pkgs.husky
  ];
}
