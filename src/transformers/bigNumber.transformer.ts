// import { Bigint } from "ethers";
import { toBigInt } from "ethers";
import { ValueTransformer } from "typeorm";

export const bigNumberTransformer: ValueTransformer = {
  to(bigNumber: bigint): string {
    if (!bigNumber) {
      return "0";
    }
    return bigNumber.toString();
  },
  from(str: string): bigint {
    if (!str) {
      return 0n;
    }
    return toBigInt(str);
  },
};
