import { Injectable, Logger } from "@nestjs/common";
import { ProjectRepository } from "src/repositories/project.repository";
import { PointsOfLpRepository } from "src/repositories/pointsOfLp.repository";
import { PointsOfLp } from "src/entities/pointsOfLp.entity";
import { BlockAddressPointOfLpRepository } from "src/repositories/blockAddressPointOfLp.repository";
import { BalanceOfLpRepository } from "src/repositories/balanceOfLp.repository";
import projectCategoryConfig from "src/config/projectCategory.config";
import { ProjectCategoryPoints } from "src/type/points";
import { SeasonTotalPointRepository } from "src/repositories/seasonTotalPoint.repository";
import { ProjectService } from "src/common/service/project.service";
import { Worker } from "src/common/worker";
import waitFor from "src/utils/waitFor";
import s2_1Milestone from "../config/season2-1.milestone";
import { verifyMessage } from "ethers";
import { SupplementPointRepository } from "src/repositories/supplementPoint.repository";

interface ProjectPoints {
  name: string;
  totalPoints: number;
}

interface UserPoints {
  userAddress: string;
  userName: string;
  totalPoints: number;
}

interface UserPointsZkl {
  userAddress: string;
  categoryName: string;
  categoryPoints: number;
  categoryZkl: number;
  userPoints: number;
  percentage: number;
  zkl: number;
}

export interface AddressPoints {
  address: string;
  totalPoints: number;
  projects: ProjectPoints[];
}

@Injectable()
export class NovaBalanceService extends Worker {
  private readonly logger: Logger;
  private seasonCategoryUserList: Map<number, Map<string, UserPoints[]>> =
    new Map(); // season=>category=>userPoints[]
  private seasonUserPointsList: Map<number, Map<string, UserPointsZkl[]>> =
    new Map();

  public constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly pointsOfLpRepository: PointsOfLpRepository,
    private readonly blockAddressPointOfLpRepository: BlockAddressPointOfLpRepository,
    private readonly seasonTotalPointRepository: SeasonTotalPointRepository,
    private readonly projectService: ProjectService,
    private readonly balanceOfLp: BalanceOfLpRepository,
    private readonly supplementPointRepository: SupplementPointRepository,
  ) {
    super();
    this.logger = new Logger(NovaBalanceService.name);
  }

  public async runProcess() {
    this.logger.log(`Init ${NovaBalanceService.name} onmoduleinit`);
    try {
      await this.loadCategoryUserList();
    } catch (err) {
      this.logger.error(`${NovaBalanceService.name} init failed.`, err.stack);
    }
    await waitFor(() => !this.currentProcessPromise, 300 * 1000, 300 * 1000);
    if (!this.currentProcessPromise) {
      return;
    }
    return this.runProcess();
  }

  public async loadCategoryUserList() {
    const seasons = await this.seasonTotalPointRepository.getSeasons();
    const categoryPairAddresses =
      await this.projectService.getCategoryPairAddress();

    for (const season of seasons) {
      const categoryUserList: Map<string, UserPoints[]> = new Map();
      for (const item of categoryPairAddresses) {
        const category = item.category;
        const pairAddresses = item.pairAddresses;
        const result =
          await this.seasonTotalPointRepository.getSeasonTotalPointByPairAddresses(
            pairAddresses,
            season,
          );
        categoryUserList.set(category, result);
      }
      this.seasonCategoryUserList.set(season, categoryUserList);
    }
    for (const season of seasons) {
      if (this.seasonUserPointsList.has(season)) {
        continue;
      }
      const result = await this.getUserPercentileInCategory(season);
      this.seasonUserPointsList.set(season, result);
    }
  }

  public async getPoints(
    address: string,
    projectName: string,
  ): Promise<PointsOfLp[]> {
    // 1. select pairAddress from project where name = projectName
    // 2. select stakePoint from pointsOfLp where address = address and pairAddress in (pairAddresses)
    const pairAddresses =
      await this.projectRepository.getPairAddresses(projectName);
    if (pairAddresses.length === 0) {
      this.logger.log(`No pair addresses found for project ${projectName}`);
      return [];
    }
    return await this.pointsOfLpRepository.getStakePoints(
      pairAddresses,
      address,
    );
  }

  public async getProjectTotalPoints(projectName: string): Promise<string> {
    // 1. select pairAddress from project where name = projectName
    // 2. select stakePoint from pointsOfLp where address = address and pairAddress in (pairAddresses)
    const pairAddresses =
      await this.projectRepository.getPairAddresses(projectName);
    if (pairAddresses.length === 0) {
      this.logger.log(`No pair addresses found for project ${projectName}`);
      return "0";
    }
    return await this.pointsOfLpRepository.getTotalNovaPointsByPairAddresses(
      pairAddresses,
    );
  }

  public async getAddressByTotalPoints(
    page: number,
    limit: number,
  ): Promise<AddressPoints[]> {
    // 1. select address from pointsOfLp group by address order by totalPoints desc
    const addresses =
      await this.pointsOfLpRepository.getAddressPagingOrderBySumPoints(
        page,
        limit,
      );
    // 2. select name, address, sum(totalPoints) as totalPoints from pointsOfLp where address in (addresses) group by name, address
    const addressPointsList =
      await this.pointsOfLpRepository.getSumPointsGroupByProjectNameAndAddress(
        addresses,
      );
    // 3. loop addressPointsList, group by address, put name into address
    const addrssPoints: AddressPoints[] = [];
    for (const item of addressPointsList) {
      const address = item.address;
      const project = {
        name: item.name,
        totalPoints: Number(item.totalPoints),
      };
      const addressPoint = addrssPoints.find((x) => x.address === address);
      if (addressPoint) {
        addressPoint.totalPoints += Number(item.totalPoints);
        addressPoint.projects.push(project);
      } else {
        addrssPoints.push({
          address,
          totalPoints: Number(item.totalPoints),
          projects: [project],
        });
      }
    }
    // 4. get all project
    const projects = await this.projectRepository.getAllProjects();
    // 5. fill missing project with 0 points into addrssPoints
    for (const addressPoint of addrssPoints) {
      for (const project of projects) {
        if (!addressPoint.projects.find((x) => x.name === project)) {
          addressPoint.projects.push({
            name: project,
            totalPoints: 0,
          });
        }
      }
    }
    addrssPoints.sort((a, b) => b.totalPoints - a.totalPoints);
    return addrssPoints;
  }

  public async getAddressCount(): Promise<number> {
    return await this.pointsOfLpRepository.getAddressCount();
  }

  public async getAddressByDailyTotalPoints(
    page: number,
    limit: number,
  ): Promise<AddressPoints[]> {
    // calculate yesterday start and end time
    // const today = new Date(new Date().getTime() - 10 * 3600 * 1000);
    const today = new Date("2024-05-09 10:00:00");
    const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
    const yesterdayStartStr = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()} 10:00:00`;
    const yesterdayEndStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()} 10:00:00`;

    // 1. select address from pointsOfLp group by address order by totalPoints desc
    const addresses =
      await this.blockAddressPointOfLpRepository.getAddressPagingOrderBySumDailyPoints(
        page,
        limit,
        yesterdayStartStr,
        yesterdayEndStr,
      );
    // 2. select name, address, sum(totalPoints) as totalPoints from pointsOfLp where address in (addresses) group by name, address
    const addressPointsList =
      await this.blockAddressPointOfLpRepository.getSumDailyPointsGroupByProjectNameAndAddress(
        addresses,
        yesterdayStartStr,
        yesterdayEndStr,
      );
    // 3. loop addressPointsList, group by address, put name into address
    const addrssPoints: AddressPoints[] = [];
    for (const item of addressPointsList) {
      const address = item.address;
      const project = {
        name: item.name,
        totalPoints: Number(item.totalPoints),
      };
      const addressPoint = addrssPoints.find((x) => x.address === address);
      if (addressPoint) {
        addressPoint.totalPoints += Number(item.totalPoints);
        addressPoint.projects.push(project);
      } else {
        addrssPoints.push({
          address,
          totalPoints: Number(item.totalPoints),
          projects: [project],
        });
      }
    }
    // 4. get all project
    const projects = await this.projectRepository.getAllProjects();
    // 5. fill missing project with 0 points into addrssPoints
    for (const addressPoint of addrssPoints) {
      for (const project of projects) {
        if (!addressPoint.projects.find((x) => x.name === project)) {
          addressPoint.projects.push({
            name: project,
            totalPoints: 0,
          });
        }
      }
    }
    addrssPoints.sort((a, b) => b.totalPoints - a.totalPoints);
    return addrssPoints;
  }

  public async getAddressDailyCount(): Promise<number> {
    // calculate yesterday start and end time
    // const today = new Date(new Date().getTime() - 10 * 3600 * 1000);
    const today = new Date("2024-05-09 10:00:00");
    const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
    const yesterdayStartStr = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()} 10:00:00`;
    const yesterdayEndStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()} 10:00:00`;
    return await this.blockAddressPointOfLpRepository.getAddressDailyCount(
      yesterdayStartStr,
      yesterdayEndStr,
    );
  }

  /**
   * Get the balance of the address in the pair by blockNumber
   */
  public async getBalanceByBlockNumber(
    addresses: string[],
    tokenAddress: string,
    pairAddress: string,
    blockNumber: number = 0,
  ): Promise<bigint> {
    // if blockNumber is 0, get the latest balance
    let data;
    if (blockNumber == 0) {
      data = await this.balanceOfLp.getLastList(
        addresses,
        tokenAddress,
        pairAddress,
      );
    } else {
      data = await this.balanceOfLp.getListByBlockNumber(
        addresses,
        tokenAddress,
        pairAddress,
        blockNumber,
      );
    }

    return data ? BigInt(data.balance) : BigInt(0);
  }

  public async getPointsByAddress(
    season: number,
    address: string,
  ): Promise<ProjectCategoryPoints[]> {
    const pairAddressPointsList =
      await this.seasonTotalPointRepository.getSeasonTotalPointByAddress(
        season,
        address,
      );
    const pairAddressPointsMap: Map<
      string,
      {
        pairAddress: string;
        totalPoint: number;
        type: string;
      }[]
    > = new Map();
    for (const item of pairAddressPointsList) {
      const points = pairAddressPointsMap.get(item.pairAddress);
      if (points) {
        points.push({
          pairAddress: item.pairAddress,
          totalPoint: Number(item.totalPoint),
          type: item.type,
        });
      } else {
        pairAddressPointsMap.set(item.pairAddress, [
          {
            pairAddress: item.pairAddress,
            totalPoint: Number(item.totalPoint),
            type: item.type,
          },
        ]);
      }
    }

    const projectPairAddressesMap =
      await this.projectService.getProjectPairAddresses();

    const projectCategoryPoints: ProjectCategoryPoints[] = [];
    for (const item of projectCategoryConfig) {
      const pairAddresses = projectPairAddressesMap.get(item.project);
      let totalPoints = 0;
      let referralPoints = 0;
      if (pairAddresses) {
        for (const pairAddress of pairAddresses) {
          const points = pairAddressPointsMap.get(pairAddress);
          if (points) {
            for (const point of points) {
              if (point.type === "referral") {
                referralPoints += point.totalPoint;
              } else {
                totalPoints += point.totalPoint;
              }
            }
          }
        }
      }
      projectCategoryPoints.push({
        category: item.category,
        project: item.project,
        holdingPoints: totalPoints,
        refPoints: referralPoints,
      });
    }
    return projectCategoryPoints;
  }

  public async getAllCategoryPoints(season: number): Promise<
    {
      category: string;
      referralPoints: number;
      ecoPoints: number;
      otherPoints: number;
    }[]
  > {
    // 1. get all pairAddress points group by pairAddress
    const pairAddressPointsList =
      await this.seasonTotalPointRepository.getSeasonTotalPointGroupByPairAddressesType(
        season,
      );

    const pairAddressPointsMap: Map<
      string,
      {
        type: string;
        totalPoints: number;
      }[]
    > = new Map();
    for (const item of pairAddressPointsList) {
      if (!pairAddressPointsMap.has(item.pairAddress)) {
        pairAddressPointsMap.set(item.pairAddress, []);
      }
      pairAddressPointsMap.get(item.pairAddress).push({
        type: item.type,
        totalPoints: Number(item.totalPoints),
      });
    }

    // 2. get [category ,pairAddress[]]
    const categoryPairAddresses =
      await this.projectService.getCategoryPairAddress();

    // 3. loop categoryPairAddresses, get total points
    const result = [];
    for (const item of categoryPairAddresses) {
      let ecoPoints = 0;
      let referralPoints = 0;
      let otherPoints = 0;
      for (const pairAddress of item.pairAddresses) {
        const typePointsArr = pairAddressPointsMap.get(pairAddress);
        if ((typePointsArr?.length ?? 0) === 0) {
          continue;
        }
        for (const typePoints of typePointsArr) {
          if (typePoints.type === "referral") {
            referralPoints += typePoints.totalPoints;
          } else if (typePoints.type === "other") {
            otherPoints += typePoints.totalPoints;
          } else {
            ecoPoints += typePoints.totalPoints;
          }
        }
      }
      result.push({
        category: item.category,
        referralPoints,
        ecoPoints,
        otherPoints,
      });
    }
    return result;
  }

  public async getPointsListByCategory(
    category: string,
    season: number,
    pageSize: number = 100,
    address?: string,
  ): Promise<{
    current: {
      userIndex: number;
      username: string;
      address: string;
      totalPoints: number;
    };
    data: {
      username: string;
      address: string;
      totalPoints: number;
    }[];
  }> {
    const result = this.seasonCategoryUserList.get(season)?.get(category) ?? [];
    if (!result || result.length === 0) {
      return {
        current: null,
        data: [],
      };
    }

    let current = null;
    if (address) {
      const userIndex = result.findIndex(
        (item) => item.userAddress === address,
      );
      if (userIndex !== -1) {
        const currentData = result[userIndex];
        current = {
          userIndex,
          address: currentData.userAddress,
          userName: currentData.userName,
          totalPoints: currentData.totalPoints,
        };
      }
    }

    const resultData = result.slice(0, pageSize);
    return {
      current,
      data: resultData.map((item) => {
        return {
          username: item.userName,
          address: item.userAddress,
          totalPoints: item.totalPoints,
        };
      }),
    };
  }

  public async getHoldPointsByAddress(
    address: string,
    season: number,
  ): Promise<number> {
    return await this.seasonTotalPointRepository.getSeasonTotalPointByType(
      address,
      season,
      "directHold",
    );
  }

  public async getUserCategoryPointsDetail(
    season: number,
    address: string,
  ): Promise<
    {
      category: string;
      ecoPoints: number;
      referralPoints: number;
      otherPoints: number;
    }[]
  > {
    // 1. get all pairAddress points group by pairAddress
    const pairAddressPointsList =
      await this.seasonTotalPointRepository.getSeasonTotalPointByAddress(
        season,
        address,
      );
    const pairAddressPointsMap: Map<
      string,
      {
        pairAddress: string;
        type: string;
        totalPoint: number;
      }[]
    > = new Map();
    for (const item of pairAddressPointsList) {
      if (!pairAddressPointsMap.has(item.pairAddress)) {
        pairAddressPointsMap.set(item.pairAddress, []);
      }
      pairAddressPointsMap.get(item.pairAddress)?.push(item);
    }

    // 2. get [category ,pairAddress[]]
    const categoryPairAddresses =
      await this.projectService.getCategoryPairAddress();

    // 3. loop categoryPairAddresses, get total points
    const result = [];
    for (const item of categoryPairAddresses) {
      let ecoPoints = 0;
      let referralPoints = 0;
      let otherPoints = 0;
      for (const pairAddress of item.pairAddresses) {
        const points = pairAddressPointsMap.get(pairAddress);
        if (!points) {
          continue;
        }
        for (const point of points) {
          if (point.type === "referral") {
            referralPoints += point.totalPoint;
          } else if (point.type === "other") {
            otherPoints += point.totalPoint;
          } else {
            ecoPoints += point.totalPoint;
          }
        }
      }
      result.push({
        category: item.category,
        ecoPoints,
        referralPoints,
        otherPoints,
      });
    }
    return result;
  }

  public async getAllProjectPoints(season: number): Promise<
    {
      project: string;
      referralPoints: number;
      ecoPoints: number;
    }[]
  > {
    // 1. get all pairAddress points group by pairAddress
    const pairAddressPointsList =
      await this.seasonTotalPointRepository.getSeasonTotalPointGroupByPairAddressesType(
        season,
      );
    const pairAddressPointsMap: Map<
      string,
      {
        type: string;
        totalPoints: number;
      }[]
    > = new Map();
    for (const item of pairAddressPointsList) {
      if (!pairAddressPointsMap.has(item.pairAddress)) {
        pairAddressPointsMap.set(item.pairAddress, []);
      }
      pairAddressPointsMap.get(item.pairAddress).push({
        type: item.type,
        totalPoints: Number(item.totalPoints),
      });
    }

    // 2. get [project ,pairAddress[]]
    const projectPairAddressesMap =
      await this.projectService.getProjectPairAddresses();
    const projectPairAddresses = [];
    for (const [key, value] of projectPairAddressesMap) {
      projectPairAddresses.push({
        project: key,
        pairAddresses: value,
      });
    }

    // 3. loop projectPairAddresses, get total points
    const result = [];
    for (const item of projectPairAddresses) {
      let referralPoints = 0;
      let ecoPoints = 0;
      for (const pairAddress of item.pairAddresses) {
        const typePointsArr = pairAddressPointsMap.get(pairAddress);
        if ((typePointsArr?.length ?? 0) === 0) {
          continue;
        }
        for (const typePoints of typePointsArr) {
          if (typePoints.type === "referral") {
            referralPoints += typePoints.totalPoints;
          } else {
            ecoPoints += typePoints.totalPoints;
          }
        }
      }
      result.push({
        project: item.project,
        referralPoints,
        ecoPoints,
      });
    }
    return result;
  }

  public async getPointsZkl(
    season: number,
    address: string,
  ): Promise<UserPointsZkl[]> {
    const result = this.seasonUserPointsList?.get(season)?.get(address) ?? [];
    return result;
  }

  public async getAllPointsZkl(season: number): Promise<UserPointsZkl[]> {
    const allPoints = this.seasonUserPointsList?.get(season);
    if (!allPoints) {
      return [];
    }
    return Array.from(allPoints.values()).flat();
  }

  public async getUserPercentileInCategory(
    season: number,
  ): Promise<Map<string, UserPointsZkl[]>> {
    const allPoints = this.seasonCategoryUserList.get(season);
    if (!allPoints) {
      return null;
    }
    const allPointsArr: {
      category: string;
      userPoints: UserPoints[];
    }[] = Array.from(allPoints, ([key, value]) => ({
      category: key,
      userPoints: value,
    }));

    const result: Map<string, UserPointsZkl[]> = new Map();

    for (const item of allPointsArr) {
      const totalPoints = item.userPoints.reduce(
        (acc, cur) => Number(acc) + Number(cur.totalPoints),
        0,
      );
      const mileStones = s2_1Milestone.filter(
        (mile) => mile.name == item.category,
      );
      if (mileStones.length !== 1) {
        return;
      }
      const mileStone = mileStones[0];
      for (const userPoint of item.userPoints) {
        const percentage = Number(userPoint.totalPoints) / totalPoints;
        if (!result.has(userPoint.userAddress)) {
          result.set(userPoint.userAddress, []);
        }
        const userPoints = result.get(userPoint.userAddress);
        userPoints.push({
          categoryName: item.category,
          userAddress: userPoint.userAddress,
          categoryPoints: totalPoints,
          categoryZkl: mileStone.zkl,
          userPoints: Number(userPoint.totalPoints),
          percentage: percentage,
          zkl: Math.round(percentage * mileStone.zkl),
        });
      }
    }

    return result;
  }

  async uploadOtherPoints(
    data: { address: string; point: number }[],
    signature,
    batchString,
  ): Promise<boolean> {
    const message = "supplementPoint";
    const address = "0xfb5eb3d27128a9dde885304e2653c41396e36662";
    const valid = await this.validatePrivatekey(address, message, signature);
    if (!valid) {
      return false;
    }
    await this.supplementPointRepository.addManyDirectPoint(data, batchString);
    return true;
  }

  async validatePrivatekey(
    address: string,
    message: string,
    signature: string,
  ): Promise<boolean> {
    try {
      const recoveredAddress = verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      this.logger.log(
        `validatePrivatekey: ${address} ${message} ${signature}, error: ${error.stack}`,
      );
      return false;
    }
  }
}
