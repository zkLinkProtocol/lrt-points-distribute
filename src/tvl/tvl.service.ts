import { Injectable, Logger } from "@nestjs/common";
import { ProjectRepository } from "src/repositories/project.repository";
import projectCategoryConfig from "src/config/projectCategory.config";
import { CategoryTvl } from "src/type/points";
import BigNumber from "bignumber.js";

@Injectable()
export class TvlService {
  private readonly logger: Logger;

  public constructor(private readonly projectRepository: ProjectRepository) {
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
}
