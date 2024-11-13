export const config: {
  apiBaseURL: string;
  apiChatPath: string;
} = {
  apiBaseURL: (function () {
    if (!process.env.REACT_APP_API_BASE_URL) {
      throw new Error("REACT_APP_API_BASE_URL is not set");
    }
    return process.env.REACT_APP_API_BASE_URL;
  })(),
  apiChatPath: process.env.REACT_APP_API_CHAT_PATH ?? "/api/chat",
} as const;
