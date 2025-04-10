import { Logger } from "@aws-lambda-powertools/logger";
import { ChatResponse, isChatErrorResponse } from "@chat-app/contracts";
import {
  APIGatewayEvent,
  APIGatewayProxyResult,
  Context,
  Handler,
} from "aws-lambda";
import * as IO from "fp-ts/IO";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";

import { mkConfig } from "@/config";
import { obfuscateObject } from "@/security";
import { mkService } from "@/service";

// https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger
const logger = new Logger({ serviceName: "chat" });

const commonHeaders = {
  "Content-Type": "application/json",
};

async function startMockServer(
  nodeEnv: string | undefined,
  useMocks: string | undefined,
) {
  if (nodeEnv !== "production" && useMocks?.match(/(true|1|enable[d]?|on)/i)) {
    logger.info("Using mock API");
    // https://www.webdevtutor.net/blog/typescript-dynamic-import-javascript
    const { setupServer } = await import("msw/node");
    const { openaiHandlers, anthropicHandlers } = await import(
      "@chat-app/mocks"
    );
    const server = setupServer(...openaiHandlers, ...anthropicHandlers);
    server.listen();
  }
}

export const handler: Handler = async (
  event: APIGatewayEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  logger.addContext(context);
  logger.logEventIfEnabled(event);

  await startMockServer(process.env.NODE_ENV, process.env.USE_MOCK_API);

  return pipe(
    TE.Do,
    TE.tapIO(() => {
      return IO.of(
        // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
        logger.info("NODE_ENV", {
          env: process.env.NODE_ENV ?? "undefined",
        }),
      );
    }),
    TE.bind("config", () =>
      TE.fromEither(mkConfig(process.env.NODE_ENV as "production" | "dev")),
    ),
    TE.tapIO(({ config }) => {
      return IO.of(
        // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
        logger.info("Config", {
          decoded: obfuscateObject(config.configDecoded),
          raw:
            process.env.NODE_ENV === "production" ? "" : config.configUnparsed,
        }),
      );
    }),
    TE.tap(({ config: { configDecoded } }) => {
      if (
        configDecoded.logging?.enable === undefined ||
        (configDecoded.logging.enable && process.env.NODE_ENV !== "production")
      ) {
        // This is 'false' by default.
        process.env.POWERTOOLS_LOGGER_LOG_EVENT = "true";
      }

      if (configDecoded.logging?.level) {
        process.env.POWERTOOLS_LOG_LEVEL = configDecoded.logging.level;
        logger.setLogLevel(configDecoded.logging.level);
      }

      return TE.of(undefined);
    }),
    TE.bindW("service", ({ config: { configDecoded } }) => {
      return TE.fromEither(mkService(configDecoded));
    }),
    TE.bindW("data", ({ service }) => {
      return TE.fromEither(service.validateBody(event.body));
    }),
    TE.bindW("response", ({ service, data }) => {
      return service.chatTE(data, event.headers); //, {
    }),
    TE.tapIO(({ response }) => {
      return IO.of(
        // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
        logger.info("Response", { response }),
      );
    }),
    TE.tapError((error) => {
      return TE.fromIO(
        IO.of(
          // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
          logger.error(
            error instanceof Error
              ? error.message
              : {
                  message:
                    !Array.isArray(error) && "title" in error
                      ? error.title
                      : "Multiple errors",
                },
            error instanceof Error ? error : JSON.stringify(error),
          ),
        ),
      );
    }),
    TE.match(
      (e) => {
        return {
          statusCode:
            isChatErrorResponse(e) && e.status ? parseInt(e.status) : 500,
          headers: commonHeaders,
          body: ChatResponse.encode({
            _t: "ko",
            ...e,
          }),
        };
      },
      ({ response }) => {
        return {
          statusCode: 200,
          headers: commonHeaders,
          body: ChatResponse.encode({
            _t: "ok",
            ...response,
          }),
        };
      },
    ),
  )();
};
