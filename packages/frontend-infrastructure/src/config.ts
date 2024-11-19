import * as D from "io-ts/Decoder";

export const Config = D.struct({
  frontend: D.struct({
    bucket: D.string,
    useCloudFront: D.boolean,
  }),
  accessKey: D.string,
  profile: D.string,
  region: D.string,
  secretKey: D.string,
});

// undo
export type Config = D.TypeOf<typeof Config>;
