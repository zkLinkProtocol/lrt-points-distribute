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

interface ProjectPoints {
  name: string;
  totalPoints: number;
}

export interface AddressPoints {
  address: string;
  totalPoints: number;
  projects: ProjectPoints[];
}

@Injectable()
export class NovaBalanceService {
  private readonly logger: Logger;

  public constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly pointsOfLpRepository: PointsOfLpRepository,
    private readonly blockAddressPointOfLpRepository: BlockAddressPointOfLpRepository,
    private readonly seasonTotalPointRepository: SeasonTotalPointRepository,
    private readonly projectService: ProjectService,
    private readonly balanceOfLp: BalanceOfLpRepository,
  ) {
    this.logger = new Logger(NovaBalanceService.name);
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
    address: string,
  ): Promise<ProjectCategoryPoints[]> {
    const addressBuffer = Buffer.from(address.slice(2), "hex");
    const projectPointsList =
      await this.pointsOfLpRepository.getSumPointsGroupByProjectNameAndAddress([
        addressBuffer,
      ]);
    const projectPointsMap: Map<string, number> = new Map();
    for (const item of projectPointsList) {
      projectPointsMap.set(item.name, Number(item.totalPoints));
    }
    const projectCategoryPoints: ProjectCategoryPoints[] = [];
    for (const item of projectCategoryConfig) {
      const totalPoints = projectPointsMap.get(item.project);
      projectCategoryPoints.push({
        category: item.category,
        project: item.project,
        holdingPoints: totalPoints ? totalPoints : 0,
        refPoints: 0,
      });
    }
    return projectCategoryPoints;
  }

  public async getAllCategoryPoints(season: number): Promise<
    {
      category: string;
      totalPoints: number;
    }[]
  > {
    // 1. get all pairAddress points group by pairAddress
    const pairAddressPointsList =
      await this.seasonTotalPointRepository.getSeasonTotalPointGroupByPairAddresses(
        season,
      );
    const pairAddressPointsMap: Map<string, number> = new Map();
    for (const item of pairAddressPointsList) {
      pairAddressPointsMap.set(item.pairAddress, Number(item.totalPoints));
    }

    // 2. get [category ,pairAddress[]]
    const categoryPairAddresses =
      await this.projectService.getCategoryPairAddress();

    // 3. loop categoryPairAddresses, get total points
    const result = [];
    for (const item of categoryPairAddresses) {
      let totalPoints = 0;
      for (const pairAddress of item.pairAddresses) {
        const points = pairAddressPointsMap.get(pairAddress);
        if (points) {
          totalPoints += points;
        }
      }
      result.push({
        category: item.category,
        totalPoints,
      });
    }
    return result;
  }

  public async getPointsListByCategory(
    category: string,
    season: number,
    page: number = 1,
    pageSize: number = 100,
  ): Promise<
    {
      username: string;
      address: string;
      totalPoint: number;
    }[]
  > {
    // 1. get all projects in the category
    // 2. get all pairAddress in the projects
    // 3. get sum points in pairAddress group by address
    // 4. sort by points
    // 5. return
    const categoryPairAddresses =
      await this.projectService.getCategoryPairAddress();
    const pairAddresses = categoryPairAddresses.find(
      (x) => x.category === category,
    )?.pairAddresses;
    const pointsList =
      await this.seasonTotalPointRepository.getSeasonTotalPointByPairAddresses(
        pairAddresses,
        season,
        page,
        pageSize,
      );
    return pointsList.map((item) => {
      return {
        username: item.userName,
        address: item.userAddress,
        totalPoint: item.totalPoints,
      };
    });
  }
}
