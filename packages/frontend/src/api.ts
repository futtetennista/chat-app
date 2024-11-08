import { ChatRequest, ChatResponse } from "@chat-app/contracts";
import { Either, isLeft } from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import * as D from "io-ts/Decoder";

import { apiPath } from "./constants";

export type APIError =
  | {
      _tag: "network";
      error: unknown;
    }
  | {
      _tag: "parse";
      error: unknown;
    }
  | {
      _tag: "decode";
      error: D.DecodeError;
    };

export default {
  sendMessageTE({
    model,
    message,
    history,
  }: ChatRequest): TE.TaskEither<APIError, ChatResponse> {
    console.log(`Sending message "${message}" to model "${model}"`);

    return pipe(
      TE.tryCatch(
        () => {
          return fetch(apiPath, {
            method: "POST",
            body: ChatRequest.encode({ model, message, history }),
          });
        },
        (reason): APIError => ({ _tag: "network", error: reason }),
      ),
      TE.flatMap((response) =>
        TE.tryCatch(
          () => response.json(),
          (reason): APIError => ({ _tag: "parse", error: reason }),
        ),
      ),
      TE.flatMap((json) => {
        return pipe(
          TE.fromEither(ChatResponse.decode(json)),
          TE.mapLeft((error): APIError => ({ _tag: "decode", error })),
          TE.map((data) => {
            return data;
          }),
        );
      }),
    );
  },

  async sendMessage({
    model,
    message,
    history,
  }: ChatRequest): Promise<Either<D.DecodeError, ChatResponse>> {
    console.log(`Sending message "${message}"" to model "${model}"`);

    const response = await fetch(apiPath, {
      method: "POST",
      body: ChatRequest.encode({ model, message, history }),
    });
    const result = await response.json().then(ChatResponse.decode);
    if (isLeft(result)) {
      console.error("Invalid response format", D.draw(result.left));
    }

    return result;
  },
};
