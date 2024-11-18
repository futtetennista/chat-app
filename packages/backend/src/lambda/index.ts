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

import { mkService } from "@/index";

// https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger
const logger = new Logger();

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
    process.env.USE_MOCKS === "true"
  ) {
    const { setupServer } = await import("msw/node");
    const { internalHandlers } = await import("@chat-app/mocks");
    const server = setupServer(...internalHandlers);
    server.listen();
  }

  const service = mkService({
    callback: {
      onUnsupported(message) {
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
        onResponse(response) {
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
