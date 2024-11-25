import { pipe } from "fp-ts/lib/function";
import * as D from "io-ts/Decoder";

const LambdaFunctionConfig = pipe(
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

const FrontendConfig = D.struct({
  bucket: D.string,
});

export const Config = pipe(
  D.struct({
    frontend: FrontendConfig,
    backend: LambdaFunctionConfig,
    region: D.string,
    accessKey: D.string,
    secretKey: D.string,
    //roleArn: D.string,
  }),
  D.intersect(
    D.partial({
      profile: D.string,
    }),
  ),
);

export type Config = D.TypeOf<typeof Config>;
