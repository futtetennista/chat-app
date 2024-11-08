import type { Message, Model } from "@chat-app/contracts/index";
import { setupServer } from "msw/node";

import api from "./api";
import { handlers } from "./mocks/handlers";

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("sendMessage", () => {
  it("should send a message and return the response", async () => {
    const model: Model = "chatgpt";
    const message = "Hello, world!";
    const history: Message[] = [
      { role: "user", content: "Hi", timestamp: Date.now() },
    ];

    const response = await api.sendMessage({ model, message, history });

    expect(response).toBe("Mocked response");
  });

  it.skip("should handle server error", async () => {
    // server.use(
    //   http.post("/api", (req, res, ctx) => {
    //     return res(ctx.status(500));
    //   }),
    // );

    const model: Model = "chatgpt";
    const message = "Hello, world!";
    const history: Message[] = [
      { role: "user", content: "Hi", timestamp: Date.now() },
    ];

    await expect(
      api.sendMessage({ model, message, history }),
    ).rejects.toThrow();
  });
});
