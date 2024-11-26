"use strict";
var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
var __rest =
  (this && this.__rest) ||
  function (s, e) {
    var t = {};
    for (var p in s)
      if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
      for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
        if (
          e.indexOf(p[i]) < 0 &&
          Object.prototype.propertyIsEnumerable.call(s, p[i])
        )
          t[p[i]] = s[p[i]];
      }
    return t;
  };
Object.defineProperty(exports, "__esModule", { value: true });
var extra_typings_1 = require("@commander-js/extra-typings");
var fs = require("fs");
var path = require("path");
var bundle_1 = require("./bundle");
var mkConfig_1 = require("./mkConfig");
function main() {
  var cli = new extra_typings_1.Command();
  cli
    .command("bundle")
    .description("Bundle the lambda function")
    .addArgument(
      new extra_typings_1.Argument("<environment>").choices([
        "prod",
        "non-prod",
      ]),
    )
    .action((0, bundle_1.default)(cli));
  cli
    .command("config:create")
    .description("Create the config file.")
    .option("--local-dev", "Output file", false)
    .addOption(
      new extra_typings_1.Option("--openai-model <name>")
        .choices(mkConfig_1.openAIModels)
        .default("gpt-4o-mini"),
    )
    // https://docs.anthropic.com/en/docs/about-claude/models#model-comparison-table
    .addOption(
      new extra_typings_1.Option("--anthropic-model <name>")
        .choices(mkConfig_1.anthropicModels)
        .default("claude-3-sonnet-latest"),
    )
    .option("--stream", "Use streaming API", false)
    .helpOption("-h, --help")
    .action(function (_a) {
      var anthropicModel = _a.anthropicModel,
        openaiModel = _a.openaiModel,
        rest = __rest(_a, ["anthropicModel", "openaiModel"]);
      return (0, mkConfig_1.default)(cli)(
        __assign(__assign({}, rest), {
          anthropicModel: anthropicModel,
          openaiModel: openaiModel,
        }),
      );
    });
  var version = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"),
  ).version;
  cli
    .allowExcessArguments(false)
    .allowUnknownOption(false)
    .version(version)
    .parse();
}
main();
