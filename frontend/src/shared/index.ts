export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export type Model = (typeof models)[number];

export const models = ["claude", "chatgpt"] as const;

export const apiPath = "/api/chat";
