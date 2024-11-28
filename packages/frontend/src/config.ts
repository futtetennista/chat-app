export const config: {
  api: {
    baseURL: string;
    chatPath: string;
  };
} = {
  api: {
    baseURL: (function () {
      if (!process.env.REACT_APP_API_BASE_URL) {
        throw new Error("REACT_APP_API_BASE_URL is not set");
      }
      return process.env.REACT_APP_API_BASE_URL;
    })(),
    chatPath: process.env.REACT_APP_API_CHAT_PATH ?? "/v1/api/chat",
  },
} as const;
