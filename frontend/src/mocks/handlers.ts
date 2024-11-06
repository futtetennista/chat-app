import { http, HttpResponse } from "msw";

export const handlers = [
  http.post("/api", async ({ request }) => {
    const requestBody = (await request.json()) ?? {};
    if (typeof requestBody !== "object") {
      return HttpResponse.json(
        {
          error: "Invalid request body (not an object)",
          status: 400,
        },
        { status: 400 },
      );
    }
    if (!("model" in requestBody)) {
      return HttpResponse.json(
        {
          error: "Model not provided",
          status: 400,
        },
        { status: 400 },
      );
    }

    return HttpResponse.json({ response: "Mocked response" });
  }),
];
