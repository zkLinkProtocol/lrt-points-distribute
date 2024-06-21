import BigNumber from "bignumber.js";

export interface ProjectCategoryPoints {
  category: string;
  project: string;
  holdingPoints: number;
  refPoints: number;
}

export interface CategoryTvl {
  name: string;
  tvl: BigNumber;
}
