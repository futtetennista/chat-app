import { Logger } from "@aws-lambda-powertools/logger";
import {
  ChatRequest,
  RFC9457ErrorResponse,
  SuccessResponse,
} from "@chat-app/contracts";
import {
  APIGatewayEvent,
  APIGatewayProxyResult,
  Context,
  Handler,
} from "aws-lambda";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as D from "io-ts/Decoder";

import { mkService } from "@/index";

// https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger
const logger = new Logger();

const commonHeaders = {
  "Content-Type": "application/json",
};

function validateBody(
  x: string | null,
): E.Either<RFC9457ErrorResponse, ChatRequest> {
  if (!x) {
    const type = "tag:@chat-app:empty_request_body";
    logger.error(`Error type ${type}`);
    return E.left({
      type,
      status: "400",
      title: "Invalid request body",
      detail: "Request body is empty",
    });
  }

  try {
    const validationResult = ChatRequest.decode(JSON.parse(x));
    if (E.isLeft(validationResult)) {
      const type = "tag:@chat-app:invalid_request_format";
      logger.error(`Error type ${type}`, {
        data: D.draw(validationResult.left),
      });
      return E.left({
        type,
        status: "400",
        detail: D.draw(validationResult.left),
        title: "Invalid request format",
      });
    }
    logger.debug("Request body", { data: validationResult.right });
    return E.right(validationResult.right);
  } catch (e) {
    const type = "tag:@chat-app:invalid_json";
    logger.error(`Error type "${type}"`, e as Error);
    return E.left({
      type,
      status: "400",
      title: "Invalid JSON in request body",
      detail: "",
    });
  }
}

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

  const logic = mkService(logger);

  return pipe(
    TE.fromEither(validateBody(event.body)),
    TE.flatMap(logic.chatTE),
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
