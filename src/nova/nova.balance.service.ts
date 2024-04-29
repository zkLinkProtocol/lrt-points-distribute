import { Injectable, Logger } from "@nestjs/common";
import { ProjectRepository } from "src/repositories/project.repository";
import { PointsOfLpRepository } from "src/repositories/pointsOfLp.repository";
import { PointsOfLp } from "src/entities/pointsOfLp.entity";

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
        totalPoints: item.totalPoints,
      };
      const addressPoint = addrssPoints.find((x) => x.address === address);
      if (addressPoint) {
        addressPoint.totalPoints += item.totalPoints;
        addressPoint.projects.push(project);
      } else {
        addrssPoints.push({
          address,
          totalPoints: item.totalPoints,
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
    return addrssPoints;
  }
}
