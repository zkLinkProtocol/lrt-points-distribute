import { Injectable, Logger } from "@nestjs/common";
import { GraphQueryService } from "src/common/service/graphQuery.service";
import { NovaService, PointData } from "src/nova/nova.service";

@Injectable()
export class AquaService {
  private readonly logger: Logger;
  private readonly projectName: string = "aqua";

  public constructor(
    private graphQueryService: GraphQueryService,
    private novaService: NovaService,
  ) {
    this.logger = new Logger(NovaService.name);
  }

  public async getPoints(
    tokenAddress: string,
    addresses: string[],
  ): Promise<PointData> {
    const finalPoints = [];
    const finalTotalPoints = BigInt(0);
    const projects = this.graphQueryService.getAllProjectIds(this.projectName);
    const project = `${this.projectName}-${tokenAddress}`;
    if (!projects.includes(project)) {
      this.logger.error(`Notfound GraphQL data, project is : ${project} .`);
      return { finalPoints, finalTotalPoints };
    }

    const [points, totalPoints] =
      await this.graphQueryService.queryPointsRedistributedByAddress(
        addresses,
        project,
      );

    if (Array.isArray(points) && totalPoints) {
      return this.novaService.getPointData(points, totalPoints);
    } else {
      // Exception in fetching GraphQL data.
      throw new Error(
        `Exception in fetching GraphQL data, project is : ${project}.`,
      );
    }
  }
}
