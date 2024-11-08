import type { Response } from "@chat-app/contracts/index";
import { http, HttpResponse, StrictResponse } from "msw";

import { apiPath } from "../constants";

export const handlers = [
  http.post(apiPath, async ({ request }): Promise<StrictResponse<Response>> => {
    const requestBody = (await request.json()) ?? {};
    if (typeof requestBody !== "object") {
      return HttpResponse.json(
        {
          code: "invalid_request_body",
          error: "Invalid request body (not an object)",
          status: "error",
          statusCode: 400,
        },
        { status: 400 },
      );
    }
    if (!("model" in requestBody)) {
      return HttpResponse.json(
        {
          code: "model_not_provided",
          error: "Model not provided",
          status: "error",
          statusCode: 400,
        },
        { status: 400 },
      );
    }

    return HttpResponse.json({ status: "success", message: "Mocked response" });
  }),
];
