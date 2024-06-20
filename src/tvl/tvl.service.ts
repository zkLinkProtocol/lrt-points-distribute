import { Injectable, Logger } from "@nestjs/common";
import { ProjectRepository } from "src/repositories/project.repository";
import { categoryConfig } from "src/projectCategory.config";
import { CategoryTvl } from "src/type/points";
import BigNumber from "bignumber.js";

@Injectable()
export class TvlService {
  private readonly logger: Logger;

  public constructor(private readonly projectRepository: ProjectRepository) {
    this.logger = new Logger(TvlService.name);
  }

  public async getProjectTvl(): Promise<CategoryTvl[]> {
    const projectsTvl = await this.projectRepository.getAllProjectsTvl();
    const projectsTvlMap = new Map<string, BigNumber>();
    for (const project of projectsTvl) {
      projectsTvlMap.set(project.name, project.tvl);
    }
    const categoryTvlMap: Map<string, BigNumber> = new Map();
    for (const category of categoryConfig) {
      categoryTvlMap.set(category.name, new BigNumber(0));
      for (const project of category.items) {
        const projectTvl = projectsTvlMap.get(project) ?? new BigNumber(0);
        categoryTvlMap.set(
          category.name,
          categoryTvlMap.get(category.name).plus(projectTvl),
        );
      }
    }
    const categoryTvl: CategoryTvl[] = [];
    for (const [category, tvl] of categoryTvlMap) {
      categoryTvl.push({ name: category, tvl });
    }
    return categoryTvl;
  }
}
