import { ChatRequest, ChatResponse } from "@chat-app/contracts";
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
};
