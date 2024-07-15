import { Injectable, Logger } from "@nestjs/common";
import { ProjectRepository } from "src/repositories/project.repository";
import projectCategoryConfig from "src/config/projectCategory.config";
import { CategoryTvl } from "src/type/points";
import BigNumber from "bignumber.js";
import { TxDataOfPointsRepository } from "src/repositories/txDataOfPoints.repository";

@Injectable()
export class TvlService {
  private readonly logger: Logger;

  public constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly txDataOfPointsRepository: TxDataOfPointsRepository,
  ) {
    this.logger = new Logger(TvlService.name);
  }

  public async getCategoryTvl(): Promise<CategoryTvl[]> {
    const projectsTvl = await this.projectRepository.getAllProjectsTvl();
    const projectsTvlMap = new Map<string, BigNumber>();
    for (const project of projectsTvl) {
      projectsTvlMap.set(project.name, project.tvl);
    }
    const categoryTvlMap: Map<string, BigNumber> = new Map();
    for (const item of projectCategoryConfig) {
      if (!categoryTvlMap.has(item.category)) {
        categoryTvlMap.set(item.category, new BigNumber(0));
      }
      const projectTvl = projectsTvlMap.get(item.project) ?? new BigNumber(0);
      categoryTvlMap.set(
        item.category,
        categoryTvlMap.get(item.category).plus(projectTvl),
      );
    }
    const categoryTvl = Array.from(categoryTvlMap, ([name, tvl]) => ({
      name,
      tvl,
    }));
    return categoryTvl;
  }

  public async getCategoryMilestone(): Promise<
    {
      name: string;
      data: BigNumber;
      type: string;
    }[]
  > {
    const category = "perpdex";
    let totalVolume = BigNumber(0);
    const startTime = "2024-05-30 00:00:00";
    const endTime = "2024-07-15 21:00:00";
    const categoryTvl = await this.getCategoryTvl();
    const result = categoryTvl.map((item) => ({
      name: item.name,
      data: item.tvl,
      type: "tvl",
    }));
    const projects = projectCategoryConfig
      .filter((item) => item.category === category)
      .map((item) => item.project);
    if (projects.length > 0) {
      const pairAddresses =
        await this.projectRepository.getPairAddressesByProjects(projects);
      if (pairAddresses.length > 0) {
        const volumeList = await this.txDataOfPointsRepository.getListByTime(
          startTime,
          endTime,
          pairAddresses,
        );
        if (volumeList.length > 0) {
          for (const item of volumeList) {
            totalVolume = totalVolume.plus(
              new BigNumber(item.quantity.toString())
                .dividedBy(BigNumber(10 ** item.decimals))
                .multipliedBy(BigNumber(item.price)),
            );
          }
        }
      }
    }
    // replace perpdex's data and type with total volume and "volume"
    const perpdexIndex = result.findIndex((item) => item.name === category);
    result[perpdexIndex].data = totalVolume;
    result[perpdexIndex].type = "volume";
    return result;
  }
}
