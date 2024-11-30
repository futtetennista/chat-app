import { Logger } from "@aws-lambda-powertools/logger";
import {
  RFC9457ErrorResponse,
  SuccessResponse,
  Vendor,
} from "@chat-app/contracts";
import {
  APIGatewayEvent,
  APIGatewayProxyResult,
  Context,
  Handler,
} from "aws-lambda";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as D from "io-ts/Decoder";

import { mkConfig } from "@/config";
import { obfuscateObject } from "@/security";
import { mkService } from "@/service";

// https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger
const logger = new Logger({ serviceName: "chat" });

const commonHeaders = {
  "Content-Type": "application/json",
};

export const handler: Handler = async (
  event: APIGatewayEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  logger.addContext(context);
  logger.logEventIfEnabled(event);

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.USE_MOCKS?.match(/(true|1|enable[d]?|on)/i)
  ) {
    logger.info("Using mock API");
    // https://www.webdevtutor.net/blog/typescript-dynamic-import-javascript
    const { setupServer } = await import("msw/node");
    const { openaiHandlers } = await import("@chat-app/mocks");
    const server = setupServer(...openaiHandlers);
    server.listen();
  }

  const config = mkConfig({
    onConfigRead: (config) => {
      if (process.env.NODE_ENV !== "production") {
        logger.info("Config read", { config });
      }
    },
    onConfigParsed: (config) => {
      logger.info("Config parsed", obfuscateObject(config));
    },
    onError: (error) => {
      switch (error._t) {
        case "config": {
          logger.error(error.error.message);
          break;
        }
        case "decode": {
          logger.error("JSON config decode error", {
            details: D.draw(error.error),
          });
          break;
        }
        default: {
          const _exhaustiveCheck: never = error;
          return _exhaustiveCheck;
        }
      }
    },
  });

  if (
    config.logging?.enable === undefined ||
    (config.logging.enable && process.env.NODE_ENV !== "production")
  ) {
    // This is 'false' by default.
    process.env.POWERTOOLS_LOGGER_LOG_EVENT = "true";
  }

  if (config.logging?.level) {
    process.env.POWERTOOLS_LOG_LEVEL = config.logging.level;
    logger.setLogLevel(config.logging.level);
  }

  const service = mkService(config, {
    callback: {
      onEmptyPlugins(message) {
        logger.warn(message);
      },
      onError: (error) => {
        switch (error._t) {
          case "apiKey": {
            logger.error(error.error.message);
            break;
          }
          case "baseURL": {
            logger.error(error.error.message);
            break;
          }
          default: {
            const _exhaustiveCheck: never = error._t;
            return _exhaustiveCheck;
          }
        }
      },
      onUnsupported(message) {
        logger.warn(message);
      },
    },
  });

  return pipe(
    TE.fromEither(
      service.validateBody(event.body, {
        onValid(data) {
          logger.info("Valid data", { data });
        },
        onInvalid(error) {
          switch (error._t) {
            case "unsupported_vendor": {
              logger.error(error.message);
              break;
            }
            case "empty_body": {
              logger.error("No body");
              break;
            }
            case "decode": {
              logger.error("Body decode error", {
                details: D.draw(error.error),
              });
              break;
            }
            case "unknown": {
              logger.error(
                "Unknown error",
                error.error instanceof Error
                  ? error.error
                  : JSON.stringify(error.error),
              );
              break;
            }
            default: {
              const _exhaustiveCheck: never = error;
              return _exhaustiveCheck;
            }
          }
        },
      }),
    ),
    TE.flatMap((data) =>
      service.chatTE(data, {
        beforeRequest(service, request) {
          logger.info(`[${service}] Request: `, { request });
        },
        onError(e) {
          switch (e._t) {
            case "network": {
              if (e.data instanceof Error) {
                logger.error("Network error", e.data);
              }
              break;
            }
            case "api": {
              if (e.data instanceof Error) {
                logger.error("API error", e.data);
              } else {
                logger.error("API error", e.data);
              }
              break;
            }
            case "unsupported": {
              logger.error(e.message);
              break;
            }
            default: {
              const _exhaustiveCheck: never = e;
              return _exhaustiveCheck;
            }
          }
        },
        onMissingConfig(vendor: Vendor) {
          logger.error(`Missing configuration for ${vendor}`);
        },
        afterResponse(response) {
          logger.info("Response", { response });
        },
      }),
    ),
    TE.match(
      (e) => {
        logger.error(
          "Internal server error",
          e instanceof Error ? e : JSON.stringify(e),
        );
        return {
          statusCode: 500,
          headers: commonHeaders,
          body: RFC9457ErrorResponse.encode(e),
          // body: RFC9457ErrorResponse.encode({
          //   type: "tag:@chat-app:internal_error",
          //   status: "500",
          //   title: "Internal server error",
          //   detail: `An unexpected error occurred: ${e}`,
          // }),
        };
      },
      (response) => {
        logger.info("Response", { response });
        return {
          statusCode: 200,
          headers: commonHeaders,
          body: SuccessResponse.encode(response),
        };
      },
    ),
  )();
};
