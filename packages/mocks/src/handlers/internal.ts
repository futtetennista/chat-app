import {
  ChatRequest,
  ChatResponse,
  defaultModel,
  RFC9457ErrorResponse,
} from "@chat-app/contracts";
// import * as Console from "fp-ts/Console";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
// import * as IO from "fp-ts/IO";
import * as TE from "fp-ts/TaskEither";
import * as D from "io-ts/Decoder";
import { http, HttpResponse, passthrough, StrictResponse } from "msw";

import { baseURL } from "../constants";

const handlers = [
  http.get(new URL("/assets/*", baseURL).toString(), () => {
    return passthrough();
  }),
  http.post(
    new URL("/v1/api/chat", baseURL).toString(),
    ({ request }): Promise<StrictResponse<ChatResponse>> => {
      return pipe(
        TE.tryCatch(
          () => request.json(),
          () => ({
            type: "empty_request_body",
            title: "Empty request body",
            status: "400",
            detail: "",
          }),
        ),
        // TE.tapIO((requestBody) => process.env.NODE_ENV === 'test' ? IO. of(void 0) : Console.log({ requestBody })),
        TE.flatMap((requestBody) =>
          TE.fromEither(ChatRequest.decode(requestBody)),
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
                        type: "tag:@chat-app:invalid_request_format",
                        title: "Invalid request format",
                        status: "400",
                        detail: D.draw(error),
                      },
                    },
                    { status: 400 },
                  ),
                (error) =>
                  HttpResponse.json<ChatResponse>(
                    {
                      _t: "ko",
                      error,
                    },
                    {
                      status: Number(error.status),
                    },
                  ),
              ),
            );
          },
          (data) => {
            if (data.message === "teapot418") {
              return HttpResponse.json<ChatResponse>(
                {
                  _t: "ko",
                  error: {
                    type: "tag:@chat-app:i_am_a_teapot",
                    title: "I'm a teapot",
                    status: "418",
                    detail: "This is a test error",
                  },
                },
                {
                  status: 418,
                },
              );
            }

            return HttpResponse.json<ChatResponse>({
              _t: "ok",
              data: {
                model: defaultModel,
                message: `Your message to ${data.model}: "${data.message}"`,
              },
            });
          },
        ),
      )();
    },
  ),
];

export default handlers;
