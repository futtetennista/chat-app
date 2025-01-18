import Anthropic from "@anthropic-ai/sdk";
import * as Console from "fp-ts/Console";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { http, HttpResponse } from "msw";

const handlers = [
  http.post(
    "https://api.anthropic.com/v1/messages",
    async ({
      request,
    }) /* : Promise<StrictResponse<OpenAI.Chat.Completions.ChatCompletion>> */ => {
      return pipe(
        TE.Do,
        TE.tapIO(() => Console.log({ headers: request.headers })),
        TE.tap(
          (): TE.TaskEither<
            {
              error: {
                type: string;
                name: string;
                status: string;
                foo?: string;
              };
            },
            undefined
          > => {
            return /(1|true|on)/.test(
              request.headers.get("X-Chat-App-Test-Failure") ?? "",
            )
              ? TE.left({
                  error: {
                    type: "test_error",
                    name: "TestError",
                    status: "400",
                  },
                })
              : TE.right(undefined);
          },
        ),
        TE.bind("requestBody", () =>
          TE.tryCatch(
            async () =>
              (await request.json()) as Anthropic.MessageCreateParamsNonStreaming,
            () => ({
              error: {
                type: "bad_request_error",
                name: "BadRequestError",
                status: "400",
              },
            }),
          ),
        ),
        TE.tapIO(({ requestBody }) => Console.log({ requestBody })),
        TE.match(
          (error) => HttpResponse.json(error, { status: 400 }),
          ({ requestBody }) =>
            HttpResponse.json<Anthropic.Message>({
              id: `chatcmpl-${new Date().toLocaleTimeString()}`,
              content: [
                {
                  type: "text",
                  text: `[echo] ${requestBody.messages
                    .slice(-1)
                    .map((x) => x.content)
                    .join("")}`,
                },
              ],
              usage: {
                input_tokens: requestBody.messages
                  .slice(-1)
                  .map((x) => x.content)
                  .join("").length,
                output_tokens:
                  7 +
                  requestBody.messages
                    .slice(-1)
                    .map((x) => x.content)
                    .join("").length,
              },
              model: requestBody.model,
              role: "assistant",
              stop_reason: null,
              stop_sequence: null,
              type: "message",
            }),
        ),
      )();
    },
  ),
];

export default handlers;
