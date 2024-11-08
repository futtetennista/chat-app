import {
  ChatRequest,
  ChatResponse,
  RFC9457ErrorResponse,
} from "@chat-app/contracts";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import * as D from "io-ts/Decoder";
import { http, HttpResponse, StrictResponse } from "msw";

import { apiPath } from "../constants";

export const handlers = [
  http.post(apiPath, ({ request }): Promise<StrictResponse<ChatResponse>> => {
    return pipe(
      TE.tryCatch(
        () => request.json(),
        () => ({
          type: "empty_request_body",
          title: "Empty request body",
          status: "400",
          detail: "",
        })
      ),
      TE.flatMap((requestBody) =>
        TE.fromEither(ChatRequest.decode(requestBody))
      ),
      TE.match(
        (error) => {
          return pipe(
            RFC9457ErrorResponse.decode(error),
            E.match(
              (error) =>
                HttpResponse.json<ChatResponse>(
                  {
                    _t: "ko",
                    error: {
                      type: "invalid_request_body",
                      title: "Invalid request body",
                      status: "400",
                      detail: D.draw(error),
                    },
                  },
                  { status: 400 }
                ),
              (error) =>
                HttpResponse.json<ChatResponse>(
                  {
                    _t: "ko",
                    error,
                  },
                  {
                    status: Number(error.status),
                  }
                )
            )
          );
        },
        (data) => {
          return HttpResponse.json<ChatResponse>({
            _t: "ok",
            data: {
              message: `Your message to ${data.model}: "${data.message}"`,
            },
          });
        }
      )
    )();
  }),
];
