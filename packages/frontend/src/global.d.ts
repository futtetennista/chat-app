declare namespace NodeJSLike {
  interface ProcessEnv {
    NODE_ENV: string;
  }

  interface Process {
    env: ProcessEnv;
  }
}

// This is injected by Webpack
declare const process: NodeJSLike.Process;
