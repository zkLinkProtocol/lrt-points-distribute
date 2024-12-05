import { Injectable } from "@nestjs/common";
import * as path from "path";
import * as fs from "fs";

import { ProjectService } from "../common/service/project.service";
import { SeasonTotalPointRepository } from "../repositories/seasonTotalPoint.repository";

@Injectable()
export class ExportAllUserSeaonPoint {
  constructor(
    private readonly projectService: ProjectService,
    private readonly seasonTotalPointRepository: SeasonTotalPointRepository,
  ) {}

  async output() {
    // 获取所有类别的 pairAddress 列表
    const catePairAddressesList =
      await this.projectService.getCategoryPairAddress();
    console.log("catePairAddressesList : ", catePairAddressesList);

    // pairAddress => category 名称的映射
    const pairAddressesCateMap = new Map<string, string>();
    for (const item of catePairAddressesList) {
      for (const pairAddress of item.pairAddresses) {
        pairAddressesCateMap.set(pairAddress, item.category);
      }
    }

    // 初始化存储累加结果
    const aggregatedData: Record<string, any> = {};
    let hasMoreData = true;
    let page = 1;
    const limit = 10000;
    while (hasMoreData) {
      const pagePointList = await this.seasonTotalPointRepository.find({
        select: ["userAddress", "pairAddress", "point", "season"],
        order: {
          createdAt: "asc",
        },
        take: limit,
        skip: (page - 1) * limit,
      });

      if (pagePointList.length < limit) {
        hasMoreData = false;
      }

      // 遍历 pointList，进行累加操作
      for (const item of pagePointList) {
        const { userAddress, pairAddress, point, season } = item;

        // 获取对应的 categoryName
        const categoryName = pairAddressesCateMap.get(pairAddress);
        if (!categoryName) {
          continue; // 如果没有找到categoryName，跳过当前条目
        }

        // 构建 key 用于唯一标识某个用户在某个赛季某个类别的记录
        const key = `${userAddress}-${season}`;

        // 如果该用户在某个赛季的数据尚未初始化，则初始化
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
            totalPoint: 0, // 用于累计每个用户在某个赛季的总分数
          };
        }

        // 累加分数到对应的类别字段
        aggregatedData[key][categoryName] += Number(point);
      }

      page++;
    }

    // 计算每个类别每个赛季的总得分
    const categorySeasonTotals: Record<string, number> = {};

    // 遍历 aggregatedData 来计算每个类别每个赛季的总得分
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
    // 遍历 aggregatedData 生成 finalData
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

      // 奖励池
      const seasonRewardPool = rewardsPool[season];

      // 计算每个类别的奖励
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

      // 如果该用户的 finalData 中没有对应的记录，则初始化
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

      // 将数据填充到 finalData 中的对应赛季
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

    // 生成 CSV 文件内容
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
    ];

    const rows = [];
    finalData.forEach((userData, userAddress) => {
      const row = [userAddress];
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
      });
      rows.push(row.join(","));
    });

    // 写入 CSV 文件
    const csvContent = [header.join(","), ...rows].join("\n");
    const outputPath = path.resolve(
      __dirname,
      "../../../data/output_with_rewards.csv",
    );
    fs.writeFileSync(outputPath, csvContent, "utf8");
    console.log("CSV file has been generated at:", outputPath);
  }
}
