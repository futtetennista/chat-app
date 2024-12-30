import {
  AnthropicModelD,
  OpenAIModelD,
  PerplexityModelD,
  RFC9457ErrorResponse,
} from "@chat-app/contracts";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as D from "io-ts/Decoder";

const ConfigD = D.partial({
  openai: D.struct({
    apiKey: D.string,
    model: OpenAIModelD,
    stream: D.boolean,
  }),
  anthropic: D.struct({
    apiKey: D.string,
    model: AnthropicModelD,
    stream: D.boolean,
  }),
  perplexity: D.struct({
    apiKey: D.string,
    model: PerplexityModelD,
    baseURL: D.string,
    stream: D.boolean,
  }),
  logging: D.partial({
    enable: D.boolean,
    level: D.literal(
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "silent",
      "critical",
      "TRACE",
      "DEBUG",
      "INFO",
      "WARN",
      "ERROR",
      "SILENT",
      "CRITICAL",
    ),
  }),
});

export type Config = D.TypeOf<typeof ConfigD>;

export interface MkConfigResult {
  configDecoded: Config;
  configRaw: string;
  configParsed: Record<string, unknown>;
}

export function mkConfig(
  env?: "production" | "dev",
): E.Either<RFC9457ErrorResponse, MkConfigResult> {
  return pipe(
    E.Do,
    E.bind("configRaw", () => {
      return E.fromNullable<{ _t: "notFound"; value: string }>({
        _t: "notFound",
        value: "CHAT_APP_CONFIG_JSON is not set",
      })(process.env.CHAT_APP_CONFIG_JSON);
    }),
    E.bindW("configParsed", ({ configRaw }) => {
      return E.tryCatch<
        { _t: "parse"; configRaw: string; value: string },
        Config
      >(
        () => JSON.parse(configRaw) as Config,
        () => {
          return {
            _t: "parse",
            value: "Failed to parse JSON configuration",
            configRaw,
          };
        },
      );
    }),
    E.bindW("configDecoded", ({ configParsed }) => {
      return pipe(
        ConfigD.decode(configParsed),
        E.mapLeft<
          D.DecodeError,
          { _t: "decode"; configParsed: unknown; value: D.DecodeError }
        >((e) => ({
          _t: "decode",
          configParsed,
          value: e,
        })),
      );
    }),
    E.bimap<
      | { _t: "parse"; configRaw: string; value: string }
      | { _t: "notFound"; value: string }
      | { _t: "decode"; configParsed: unknown; value: D.DecodeError },
      RFC9457ErrorResponse,
      MkConfigResult,
      MkConfigResult
    >(
      (e) => {
        switch (e._t) {
          case "notFound": {
            return {
              detail: "",
              status: "500",
              title: e.value,
              type: "tag:@chat-app:configuration_not_found_error",
            };
          }
          case "parse": {
            return {
              detail:
                env !== "production" ? e.configRaw || "<empty-string>" : "",
              status: "500",
              title: e.value,
              type: "tag:@chat-app:configuration_parse_error",
            };
          }
          case "decode": {
            return {
              detail:
                env !== "production"
                  ? JSON.stringify(e.configParsed) || "<empty-string>"
                  : "",
              status: "500",
              title: D.draw(e.value),
              type: "tag:@chat-app:configuration_not_found_error",
            };
          }
          default: {
            const _exhaustiveCheck: never = e;
            return _exhaustiveCheck;
          }
        }
      },
      ({ configParsed, configDecoded, configRaw }) => {
        return { configDecoded, configRaw, configParsed };
      },
    ),
  );
}
