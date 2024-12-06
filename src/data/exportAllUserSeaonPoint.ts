import { Injectable } from "@nestjs/common";
import * as path from "path";
import * as fs from "fs";
import * as csv from "csv-parser";

import { ProjectService } from "../common/service/project.service";
import { SeasonTotalPointRepository } from "../repositories/seasonTotalPoint.repository";

@Injectable()
export class ExportAllUserSeaonPoint {
  constructor(
    private readonly projectService: ProjectService,
    private readonly seasonTotalPointRepository: SeasonTotalPointRepository,
  ) {}

  async output() {
    const catePairAddressesList =
      await this.projectService.getCategoryPairAddress();

    const pairAddressesCateMap = new Map<string, string[]>();
    for (const item of catePairAddressesList) {
      for (const pairAddress of item.pairAddresses) {
        if (!pairAddressesCateMap.has(pairAddress)) {
          pairAddressesCateMap.set(pairAddress, [item.category]);
        } else {
          pairAddressesCateMap.get(pairAddress).push(item.category);
        }
      }
    }

    const inputFilePath = path.join(__dirname, "../../../data/lrt.csv");

    const aggregatedData: Record<string, any> = {};

    const handleRow = (item: any) => {
      const { userAddress, pairAddress, point, season } = item;

      const categoryNames = pairAddressesCateMap.get(pairAddress);
      // if (userAddress != "0x4379a551662f4e09d5ecb180a0d52fb4ca7d7c13") {
      //   return;
      // }
      if (!categoryNames || categoryNames.length === 0) {
        return;
      }

      const key = `${userAddress}-${season}`;

      if (!aggregatedData[key]) {
        aggregatedData[key] = {
          userAddress,
          season,
          spotdex: 0,
          perpdex: 0,
          lending: 0,
          nativeboost: 0,
          other: 0,
          holding: 0,
          totalPoint: 0,
        };
      }

      categoryNames.forEach((categoryName) => {
        aggregatedData[key][categoryName] += Number(point);
      });
    };

    const parseCsv = async () => {
      return new Promise((resolve, reject) => {
        const results = [];

        const readStream = fs.createReadStream(inputFilePath);

        readStream
          .pipe(csv())
          .on("data", (row) => {
            handleRow(row);
          })
          .on("end", () => {
            resolve(results);
          })
          .on("error", (err) => {
            reject(err);
          });
      });
    };

    await parseCsv();
    // let hasMoreData = true;
    // let page = 1;
    // const limit = 10000;
    // while (hasMoreData) {
    //   const pagePointList = await this.seasonTotalPointRepository.find({
    //     select: ["userAddress", "pairAddress", "point", "season"],
    //     where: { userAddress: "0xc57cfd16526abb402b9cc82a423ff79ac691a66c" },
    //     order: {
    //       createdAt: "asc",
    //     },
    //     take: limit,
    //     skip: (page - 1) * limit,
    //   });

    //   if (pagePointList.length < limit) {
    //     hasMoreData = false;
    //   }

    //   page++;
    // }

    console.log(`Total ${Object.keys(aggregatedData).length} records`);
    const categorySeasonTotals: Record<string, number> = {};

    Object.values(aggregatedData).forEach((data) => {
      const { season, spotdex, perpdex, lending, nativeboost, other, holding } =
        data;
      if (!categorySeasonTotals[`${season}-spotdex`])
        categorySeasonTotals[`${season}-spotdex`] = 0;
      if (!categorySeasonTotals[`${season}-perpdex`])
        categorySeasonTotals[`${season}-perpdex`] = 0;
      if (!categorySeasonTotals[`${season}-lending`])
        categorySeasonTotals[`${season}-lending`] = 0;
      if (!categorySeasonTotals[`${season}-nativeboost`])
        categorySeasonTotals[`${season}-nativeboost`] = 0;
      if (!categorySeasonTotals[`${season}-other`])
        categorySeasonTotals[`${season}-other`] = 0;
      if (!categorySeasonTotals[`${season}-holding`])
        categorySeasonTotals[`${season}-holding`] = 0;

      categorySeasonTotals[`${season}-spotdex`] += spotdex;
      categorySeasonTotals[`${season}-perpdex`] += perpdex;
      categorySeasonTotals[`${season}-lending`] += lending;
      categorySeasonTotals[`${season}-nativeboost`] += nativeboost;
      categorySeasonTotals[`${season}-other`] += other;
      categorySeasonTotals[`${season}-holding`] += holding;
    });

    type SeasonData = {
      spotdex: number;
      perpdex: number;
      lending: number;
      nativeboost: number;
      other: number;
      holding: number;
      spotdexReward: number;
      perpdexReward: number;
      lendingReward: number;
      nativeboostReward: number;
      otherReward: number;
      holdingReward: number;
    };
    type UserSeasonData = {
      season2: SeasonData;
      season3: SeasonData;
      season4: SeasonData;
    };
    const finalData: Map<string, UserSeasonData> = new Map();

    const rewardsPool = {
      2: {
        holding: 3000000,
        spotdex: 100000,
        perpdex: 100000,
        lending: 1000000,
        nativeboost: 50000,
        other: 50000,
      },
      3: {
        holding: 2000000,
        spotdex: 1500000,
        perpdex: 2000000,
        lending: 1000000,
        nativeboost: 500000,
        other: 500000,
      },
      4: {
        holding: 1000000,
        spotdex: 1000000,
        perpdex: 1000000,
        lending: 1000000,
        nativeboost: 5000000,
        other: 500000,
      },
    };

    Object.values(aggregatedData).forEach((data) => {
      const {
        userAddress,
        season,
        spotdex,
        perpdex,
        lending,
        nativeboost,
        other,
        holding,
      } = data;

      const seasonRewardPool = rewardsPool[season];

      const spotdexReward =
        (spotdex / categorySeasonTotals[`${season}-spotdex`]) *
          seasonRewardPool.spotdex || 0;
      const perpdexReward =
        (perpdex / categorySeasonTotals[`${season}-perpdex`]) *
          seasonRewardPool.perpdex || 0;
      const lendingReward =
        (lending / categorySeasonTotals[`${season}-lending`]) *
          seasonRewardPool.lending || 0;
      const nativeboostReward =
        (nativeboost / categorySeasonTotals[`${season}-nativeboost`]) *
          seasonRewardPool.nativeboost || 0;
      const otherReward =
        (other / categorySeasonTotals[`${season}-other`]) *
          seasonRewardPool.other || 0;
      const holdingReward =
        (holding / categorySeasonTotals[`${season}-holding`]) *
          seasonRewardPool.holding || 0;

      if (!finalData.has(userAddress)) {
        finalData.set(userAddress, {
          season2: {
            spotdex: 0,
            perpdex: 0,
            lending: 0,
            nativeboost: 0,
            other: 0,
            holding: 0,
            spotdexReward: 0,
            perpdexReward: 0,
            lendingReward: 0,
            nativeboostReward: 0,
            otherReward: 0,
            holdingReward: 0,
          },
          season3: {
            spotdex: 0,
            perpdex: 0,
            lending: 0,
            nativeboost: 0,
            other: 0,
            holding: 0,
            spotdexReward: 0,
            perpdexReward: 0,
            lendingReward: 0,
            nativeboostReward: 0,
            otherReward: 0,
            holdingReward: 0,
          },
          season4: {
            spotdex: 0,
            perpdex: 0,
            lending: 0,
            nativeboost: 0,
            other: 0,
            holding: 0,
            spotdexReward: 0,
            perpdexReward: 0,
            lendingReward: 0,
            nativeboostReward: 0,
            otherReward: 0,
            holdingReward: 0,
          },
        });
      }

      const seasonKey = `season${season}`;
      const userSeasonData = finalData.get(userAddress)!;
      userSeasonData[seasonKey] = {
        spotdex,
        perpdex,
        lending,
        nativeboost,
        other,
        holding,
        spotdexReward,
        perpdexReward,
        lendingReward,
        nativeboostReward,
        otherReward,
        holdingReward,
      };
    });

    const header = [
      "userAddress",
      "spotdex-1",
      "perpdex-1",
      "lending-1",
      "nativeboost-1",
      "other-1",
      "holding-1",
      "spotdexReward-1",
      "perpdexReward-1",
      "lendingReward-1",
      "nativeboostReward-1",
      "otherReward-1",
      "holdingReward-1",
      "spotdex-2",
      "perpdex-2",
      "lending-2",
      "nativeboost-2",
      "other-2",
      "holding-2",
      "spotdexReward-2",
      "perpdexReward-2",
      "lendingReward-2",
      "nativeboostReward-2",
      "otherReward-2",
      "holdingReward-2",
      "spotdex-3",
      "perpdex-3",
      "lending-3",
      "nativeboost-3",
      "other-3",
      "holding-3",
      "spotdexReward-3",
      "perpdexReward-3",
      "lendingReward-3",
      "nativeboostReward-3",
      "otherReward-3",
      "holdingReward-3",
      "totalReward",
    ];

    const rows = [];
    finalData.forEach((userData, userAddress) => {
      const row = [userAddress];
      let totalReward = 0;
      ["season2", "season3", "season4"].forEach((seasonKey) => {
        const data = userData[seasonKey];
        row.push(
          data.spotdex,
          data.perpdex,
          data.lending,
          data.nativeboost,
          data.other,
          data.holding,
          data.spotdexReward,
          data.perpdexReward,
          data.lendingReward,
          data.nativeboostReward,
          data.otherReward,
          data.holdingReward,
        );
        totalReward =
          totalReward +
          data.spotdexReward +
          data.perpdexReward +
          data.lendingReward +
          data.nativeboostReward +
          data.otherReward +
          data.holdingReward;
      });
      if (totalReward >= 1) {
        row.push(totalReward.toFixed(10));
        rows.push(row.join(","));
      }
    });

    const csvContent = [header.join(","), ...rows].join("\n");
    const outputPath = path.resolve(
      __dirname,
      "../../../data/output_with_rewards.csv",
    );
    fs.writeFileSync(outputPath, csvContent, "utf8");
    console.log("CSV file has been generated at:", outputPath);
  }
}
