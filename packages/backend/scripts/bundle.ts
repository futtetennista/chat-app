import { Argument, Command } from "@commander-js/extra-typings";
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
  outfile: `dist/dev/index.js`,
};

const prodBuildOptions = {
  ...defaultBuildOptions,
  minify: false,
  sourcemap: true,
  outfile: `dist/prod/index.js`,
};

async function main() {
  const program = new Command()
    .addArgument(
      new Argument("<environment>").choices(["prod", "non-prod"] as const),
    )
    .allowExcessArguments(false)
    .allowUnknownOption(false)
    .version("1.0.0")
    .parse();

  const env = program.args[0];
  const buildOptions =
    env === "non-prod" ? nonProdBuildOptions : prodBuildOptions;

  await esbuild.build(buildOptions).catch((e: unknown) => {
    console.error("Build not successful", e);
    process.exit(1);
  });
}

void main();
