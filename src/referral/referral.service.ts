import { Injectable, Logger } from "@nestjs/common";
import { ProjectService } from "src/common/service/project.service";
import { ReferralRepository } from "src/repositories/referral.repository";
import { SeasonTotalPointRepository } from "src/repositories/seasonTotalPoint.repository";

@Injectable()
export class ReferralService {
  private readonly logger: Logger;

  public constructor(
    private readonly referralRepository: ReferralRepository,
    private readonly seasonTotalPointRepository: SeasonTotalPointRepository,
    private readonly projectService: ProjectService,
  ) {
    this.logger = new Logger(ReferralService.name);
  }

  public async getReferralPoints(
    address: string,
    season: number,
  ): Promise<
    {
      userAddress: string;
      userName: string;
      totalPoint: {
        category: string;
        point: number;
      }[];
    }[]
  > {
    const referrals = await this.referralRepository.getReferral(address);
    const referralPoints =
      await this.seasonTotalPointRepository.getSeasonTotalPoint(
        referrals,
        season,
      );
    const categoryPairAddresses =
      await this.projectService.getCategoryPairAddress();

    // key is `userName_address_category`, value is total point
    const userAddressMap: Map<string, number> = new Map();
    for (const referralPoint of referralPoints) {
      for (const categoryPairAddress of categoryPairAddresses) {
        const key = `${referralPoint.userName}_${referralPoint.userAddress}_${categoryPairAddress.category}`;
        if (!userAddressMap.has(key)) {
          userAddressMap.set(key, 0);
        }
        if (
          categoryPairAddress.pairAddresses.includes(referralPoint.pairAddress)
        ) {
          userAddressMap.set(
            key,
            userAddressMap.get(key) + referralPoint.totalPoint,
          );
        }
      }
    }

    // return result
    const result = [];
    for (const [key, value] of userAddressMap) {
      const [userName, userAddress, category] = key.split("_");
      const found = result.find(
        (item) =>
          item.userAddress === userAddress && item.userName === userName,
      );
      if (found) {
        found.totalPoint.push({
          category,
          point: value,
        });
      } else {
        result.push({
          userAddress,
          userName,
          totalPoint: [
            {
              category,
              point: value,
            },
          ],
        });
      }
    }

    return result;
  }
}
