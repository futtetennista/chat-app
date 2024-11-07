// import type { Response } from "@contracts/index";
import { http, HttpResponse } from "msw";

import { apiPath } from "@/constants";

export const handlers = [
  http.post(apiPath, async ({ request }) => {
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
