import { defaultModel, type Message } from "@chat-app/contracts";
import { baseURL, internalHandlers } from "@chat-app/mocks";
import { setupServer } from "msw/node";

import type { API } from "./api";

const server = setupServer(...internalHandlers);

let api: API;

beforeAll(() => {
  server.listen();
  process.env.REACT_APP_API_BASE_URL = baseURL;
});

beforeEach(async () => {
  api = (await import("./api")).default;
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("chat", () => {
  it("should send a message and return the response", async function () {
    const history: Message[] = [
      { role: "user", content: "Hi", timestamp: Date.now() },
    ];

    const response = await api.chatTE({
      model: defaultModel,
      message: "Hello, world!",
      history,
    })();

    expect(response._tag).toBe("Right");
  });

  it.skip("should handle server error", async () => {
    // server.use(
    //   http.post("/api", (req, res, ctx) => {
    //     return res(ctx.status(500));
    //   }),
    // );

    const message = "Hello, world!";
    const history: Message[] = [
      { role: "user", content: "Hi", timestamp: Date.now() },
    ];

    await expect(
      api.chatTE({ model: defaultModel, message, history })(),
    ).rejects.toThrow();
  });
});
