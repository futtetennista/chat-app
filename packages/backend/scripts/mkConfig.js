#!/usr/bin/env tsx
"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g = Object.create(
        (typeof Iterator === "function" ? Iterator : Object).prototype,
      );
    return (
      (g.next = verb(0)),
      (g["throw"] = verb(1)),
      (g["return"] = verb(2)),
      typeof Symbol === "function" &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.");
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y["return"]
                  : op[0]
                    ? y["throw"] || ((t = y["return"]) && t.call(y), 0)
                    : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.openAIModels = exports.anthropicModels = void 0;
exports.default = default_1;
var dotenv = require("dotenv");
var fs = require("fs");
var path = require("path");
exports.anthropicModels = [
  "claude-3-opus-latest",
  "claude-3-sonnet-latest",
  "claude-3-haiku-latest",
  "claude-3-5-sonnet-latest",
  "claude-3-5-haiku-latest",
];
exports.openAIModels = ["gpt-4o", "gpt-4o-mini", "o1-preview", "o1-mini"];
function default_1(cmd) {
  return function (_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
      var envPath, result, config_1, config, core;
      var localDev = _b.localDev,
        openaiModel = _b.openaiModel,
        anthropicModel = _b.anthropicModel,
        _c = _b.stream,
        stream = _c === void 0 ? false : _c;
      return __generator(this, function (_d) {
        switch (_d.label) {
          case 0:
            if (localDev) {
              envPath = path.resolve(__dirname, "../../../secret.env");
              if (fs.existsSync(envPath)) {
                result = dotenv.config({ path: envPath });
                if (result.error) {
                  cmd.error(
                    "Error loading environment variables from ".concat(envPath),
                  );
                }
                if (!result.parsed) {
                  cmd.error("No environment variables loaded");
                }
                config_1 = createConfig({
                  env: result.parsed,
                  openaiModel: openaiModel,
                  anthropicModel: anthropicModel,
                  stream: stream,
                });
                console.log(JSON.stringify(config_1));
              } else {
                cmd.error("File not found: ".concat(envPath));
              }
            }
            config = createConfig({
              env: process.env,
              openaiModel: openaiModel,
              anthropicModel: anthropicModel,
              stream: stream,
            });
            if (!(process.env.CI === "true")) return [3 /*break*/, 2];
            return [
              4 /*yield*/,
              Promise.resolve().then(function () {
                return require("@actions/core");
              }),
            ];
          case 1:
            core = _d.sent();
            core.setOutput("config", config);
            _d.label = 2;
          case 2:
            return [2 /*return*/];
        }
      });
    });
  };
}
function createConfig(_a) {
  var _b;
  var env = _a.env,
    openaiModel = _a.openaiModel,
    anthropicModel = _a.anthropicModel,
    perplexityModel = _a.perplexityModel,
    stream = _a.stream;
  var config = {};
  if (env.LOG_LEVEL) {
    Object.assign(config, {
      logging: {
        level: env.LOG_LEVEL,
      },
    });
  }
  if (env.OPENAI_API_KEY) {
    Object.assign(config, {
      openai: {
        apiKey: env.OPENAI_API_KEY,
        model: openaiModel,
        stream: stream,
      },
    });
  }
  if (env.ANTHROPIC_API_KEY) {
    Object.assign(config, {
      anthropic: {
        apiKey: env.ANTHROPIC_API_KEY,
        model: anthropicModel,
        stream: stream,
      },
    });
  }
  if (env.PERPLEXITY_API_KEY) {
    Object.assign(config, {
      perplexity: {
        apiKey: env.PERPLEXITY_API_KEY,
        model:
          perplexityModel !== null && perplexityModel !== void 0
            ? perplexityModel
            : "",
        baseURL:
          (_b = env.PERPLEXITY_BASE_URL) !== null && _b !== void 0 ? _b : "",
        stream: stream,
      },
    });
  }
  return config;
}
