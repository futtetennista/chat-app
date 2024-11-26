declare namespace NodeJS {
  interface ProcessEnv {
    ANTHROPIC_API_KEY?: string;
    CI: string | undefined;
    LOG_LEVEL?: string;
    OPENAI_API_KEY?: string;
    PERPLEXITY_API_KEY?: string;
    PERPLEXITY_BASE_URL?: string;
  }

  interface Process {
    env: ProcessEnv;
  }
}
