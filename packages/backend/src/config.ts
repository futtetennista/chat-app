import {
  AnthropicModelD,
  ChatErrorResponse,
  OpenAIModelD,
  PerplexityModelD,
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
  configParsed: Record<string, unknown>;
  configUnparsed: string;
}

export function mkConfig(
  env?: "production" | "dev",
): E.Either<ChatErrorResponse, MkConfigResult> {
  return pipe(
    E.Do,
    E.bind("configUnparsed", () => {
      return E.fromNullable<{ _t: "notFound"; value: string }>({
        _t: "notFound",
        value: "CHAT_APP_CONFIG_JSON is not set",
      })(process.env.CHAT_APP_CONFIG_JSON);
    }),
    E.bindW("configParsed", ({ configUnparsed }) => {
      return E.tryCatch<
        { _t: "parse"; configUnparsed: string; value: string },
        Config
      >(
        () => JSON.parse(configUnparsed) as Config,
        () => {
          return {
            _t: "parse",
            value: "Failed to parse JSON configuration",
            configUnparsed,
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
      | { _t: "decode"; configParsed: unknown; value: D.DecodeError }
      | { _t: "notFound"; value: string }
      | { _t: "parse"; configUnparsed: string; value: string },
      ChatErrorResponse,
      MkConfigResult,
      MkConfigResult
    >(
      (e) => {
        switch (e._t) {
          case "notFound": {
            return {
              status: "500",
              title: e.value,
              type: "tag:@chat-app:configuration_not_found_error",
            };
          }
          case "parse": {
            return {
              detail:
                env !== "production"
                  ? e.configUnparsed || "<empty-string>"
                  : "",
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
      ({ configParsed, configDecoded, configUnparsed }) => {
        return { configDecoded, configUnparsed, configParsed };
      },
    ),
  );
}
