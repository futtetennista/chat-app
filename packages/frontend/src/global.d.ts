declare namespace NodeJSLike {
  interface ProcessEnv {
    NODE_ENV: string;
    CI: string | undefined;
    REACT_APP_API_BASE_URL: string | undefined;
    REACT_APP_PORT: string | undefined;
  }

  interface Process {
    env: ProcessEnv;
  }
}

// This is injected by Webpack
declare const process: NodeJSLike.Process;
