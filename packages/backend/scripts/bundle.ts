import { Command } from "@commander-js/extra-typings";
import * as esbuild from "esbuild";

const defaultBuildOptions: esbuild.BuildOptions = {
  bundle: true,
  entryPoints: ["src/lambda/index.ts"],
  external: ["aws-lambda"],
  platform: "node",
  format: "cjs",
  target: "node20",
};

const nonProdBuildOptions = {
  ...defaultBuildOptions,
  minify: false,
  sourcemap: false,
  outfile: "dist/non-prod/index.js",
};

const prodBuildOptions = {
  ...defaultBuildOptions,
  minify: false,
  sourcemap: true,
  outfile: "dist/prod/index.js",
};

export default function bundle(cmd: Command) {
  return async function (arg: "prod" | "non-prod") {
    const buildOptions =
      arg === "non-prod" ? nonProdBuildOptions : prodBuildOptions;

    await esbuild.build(buildOptions).catch((e: unknown) => {
      console.error("Build not successful", e);
      cmd.error("Build not successful");
    });
  };
}
