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
  logging: pipe(
    D.struct({
      enable: D.boolean,
    }),
    D.intersect(D.partial({ level: D.string })),
  ),
});

export type Config = D.TypeOf<typeof ConfigD>;

export function mkConfig(): Config {
  return pipe(
    E.fromNullable(new Error("CHAT_APP_CONFIG_JSON is not set"))(
      process.env.CHAT_APP_CONFIG_JSON,
    ),
    E.flatMap((configRaw) => {
      return E.tryCatch(
        () => JSON.parse(configRaw) as Config,
        (e: unknown) => {
          return e as Error;
        },
      );
    }),
    E.flatMap(ConfigD.decode),
    E.tap((config) => {
      if (config.logging?.enable) {
        // This is 'false' by default.
        process.env.POWERTOOLS_LOGGER_LOG_EVENT = "true";
      }
      return E.of(config);
    }),
    E.match(
      (e) => {
        if (e instanceof Error) {
          logger.error(e.message, e);
          throw e;
        }

        logger.error("Failed to decode JSON configuration", D.draw(e));
        throw new Error("Failed to decode JSON configuration");
      },
      (config) => config,
    ),
  );
}
