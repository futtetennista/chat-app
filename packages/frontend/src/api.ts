import { ChatRequest, ChatResponse } from "@chat-app/contracts";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import * as D from "io-ts/Decoder";

import { config } from "./config";

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

export interface API {
  readonly baseURL: string;

  chatTE({
    model,
    message,
    history,
  }: ChatRequest): TE.TaskEither<APIError, ChatResponse>;
}

const api: API = {
  baseURL: config.api.baseURL,

  chatTE({ model, message, history }) {
    console.log(`Sending message "${message}" to model "${model}"`);
    return pipe(
      TE.tryCatch(
        () => {
          return fetch(new URL(config.api.chatPath, this.baseURL), {
            body: ChatRequest.encode({ model: model, message, history }),
            method: "POST",
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

// export const api_ = {
//   chatTE({
//     model,
//     message,
//     history,
//   }: ChatRequest): TE.TaskEither<APIError, ChatResponse> {
//     console.log(`Sending message "${message}" to model "${model}"`);

//     return pipe(
//       TE.tryCatch(
//         () => {
//           return fetch(new URL("/v1/api/chat", config.apiBaseURL), {
//             body: ChatRequest.encode({ model, message, history }),
//             method: "POST",
//           });
//         },
//         (reason): APIError => ({ _tag: "network", error: reason }),
//       ),
//       TE.flatMap((response) =>
//         TE.tryCatch(
//           () => response.json(),
//           (reason): APIError => ({ _tag: "parse", error: reason }),
//         ),
//       ),
//       TE.flatMap((json) => {
//         return pipe(
//           TE.fromEither(ChatResponse.decode(json)),
//           TE.mapLeft((error): APIError => ({ _tag: "decode", error })),
//           TE.map((data) => {
//             return data;
//           }),
//         );
//       }),
//     );
//   },
// };

// export type API_ = typeof api_;

export default api;
