import { Controller, Get, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { PointsRepository } from 'src/repositories/points.repository';
import { TokenPointsDto } from './tokenPoints.dto';

@ApiTags('points')
@ApiExcludeController(false)
@Controller('points')
export class PointsController {
  private readonly logger = new Logger(PointsController.name);
  private readonly puffPointsTokenAddress: string;

  constructor(
    private readonly pointsRepository: PointsRepository,
    private configService: ConfigService,
  ) {
    this.puffPointsTokenAddress = configService.get<string>(
      'puffPoints.tokenAddress',
    );
  }

  @Get('/allpufferpoints')
  public async allPufferPoints(): Promise<TokenPointsDto> {
    const allPoints = await this.pointsRepository.find({
      where: {
        token: this.puffPointsTokenAddress,
      },
    });
    let totalPoints = 0n;
    const result = allPoints.map((p) => {
      totalPoints += p.points;
      return {
        address: p.address,
        updatedAt: p.updatedAt,
        points: p.points.toString(),
      };
    });
    return {
      decimals: 18,
      tokenAddress: this.puffPointsTokenAddress,
      totalPoints: totalPoints.toString(),
      result: result,
    };
  }
}
