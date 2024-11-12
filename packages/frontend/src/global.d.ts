declare namespace NodeJSLike {
  interface ProcessEnv {
    NODE_ENV: string;
    REACT_APP_API_BASE_URL: string | undefined;
  }

  interface Process {
    env: ProcessEnv;
  }
}

// This is injected by Webpack
declare const process: NodeJSLike.Process;
