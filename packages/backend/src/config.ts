import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as D from "io-ts/Decoder";

const ConfigD = D.partial({
  openai: D.struct({
    apiKey: D.string,
    model: D.string,
    stream: D.boolean,
  }),
  anthropic: D.struct({
    apiKey: D.string,
    model: D.string,
    stream: D.boolean,
  }),
  perplexity: D.struct({
    apiKey: D.string,
    model: D.string,
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

export function mkConfig(callback: {
  onError: (
    error:
      | { _t: "config"; error: Error }
      | { _t: "decode"; error: D.DecodeError },
  ) => void;
}): Config {
  return pipe(
    E.fromNullable(new Error("CHAT_APP_CONFIG_JSON is not set"))(
      process.env.CHAT_APP_CONFIG_JSON,
    ),
    E.tap((configRaw) => {
      console.log("Config raw", configRaw);
      return E.of(configRaw);
    }),
    E.flatMap((configRaw) => {
      return E.tryCatch(
        () => JSON.parse(configRaw) as Config,
        (e: unknown) => {
          return e as Error;
        },
      );
    }),
    E.flatMap(ConfigD.decode),
    E.match(
      (e) => {
        if (e instanceof Error) {
          callback.onError({ _t: "config", error: e });
          throw e;
        }

        callback.onError({ _t: "decode", error: e });
        throw new Error("Failed to decode JSON configuration");
      },
      (config) => config,
    ),
  );
}
