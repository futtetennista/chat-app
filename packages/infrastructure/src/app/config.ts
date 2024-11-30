import { pipe } from "fp-ts/lib/function";
import * as D from "io-ts/Decoder";

const LambdaFunctionConfigD = pipe(
  D.struct({
    handler: D.string,
    name: D.string,
    runtime: D.string,
    // stageName: D.string,
    version: D.string,
  }),
  D.intersect(
    D.partial({
      codePath: D.string,
    }),
  ),
);

export type LambdaFunctionConfig = D.TypeOf<typeof LambdaFunctionConfigD>;

const FrontendConfigD = D.struct({
  bucket: D.string,
});

export type FrontendConfig = D.TypeOf<typeof FrontendConfigD>;

export const Config = pipe(
  D.struct({
    frontend: FrontendConfigD,
    backend: LambdaFunctionConfigD,
    region: D.string,
    accessKey: D.string,
    secretKey: D.string,
    roleArn: D.string,
  }),
  D.intersect(
    D.partial({
      profile: D.string,
    }),
  ),
);

export type Config = D.TypeOf<typeof Config>;
