{
  sources ? import ./npins,
  system ? builtins.currentSystem,
  pkgs ? import sources.nixpkgs { inherit system; config = {}; overlays = []; },
}:

pkgs.mkShell {
  packages = [
    pkgs.git
    pkgs.nodejs_20
    pkgs.pnpm
    pkgs.shellcheck
    # pkgs.husky
  ];
}
