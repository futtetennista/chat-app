import { pipe } from "fp-ts/lib/function";
import * as D from "io-ts/Decoder";

export const Config = pipe(
  D.struct({
    frontend: D.struct({
      bucket: D.string,
    }),
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
