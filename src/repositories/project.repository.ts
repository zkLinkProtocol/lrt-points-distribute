import { Injectable } from "@nestjs/common";
import { BaseRepository } from "./base.repository";
import { UnitOfWork } from "../unitOfWork";
import { Project } from "../entities/project.entity";

@Injectable()
export class ProjectRepository extends BaseRepository<Project> {
  public constructor(unitOfWork: UnitOfWork) {
    super(Project, unitOfWork);
  }

  // select pairAddress from project where name = projectName
  public async getPairAddresses(projectName: string): Promise<Buffer[]> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const result = await transactionManager.query(
      `select "pairAddress" from project where name = $1`,
      [projectName],
    );
    return result.map((row: any) => row.pairAddress);
  }

  // get all projects
  public async getAllProjects(): Promise<string[]> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const result = await transactionManager.query(
      `select DISTINCT name from project`,
    );
    return result.map((row: any) => (row.name == "owlet" ? "owlto" : row.name));
  }
}
