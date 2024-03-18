import { Controller, Get, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiExcludeController,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiOkResponse({
    description:
      "Return all users' PufferPoints with a decimals of 18. The rule is to add 30 points per hour.\nTiming starts from the user's first deposit, with each user having an independent timer.",
    type: TokenPointsDto,
  })
  @ApiBadRequestResponse({ description: '{ "message": "Not Found", "statusCode": 404 }' })
  public async allPufferPoints(): Promise<TokenPointsDto> {
    this.logger.log('allPufferPoints');
    let allPoints;
    try {
      allPoints = await this.pointsRepository.find({
        where: {
          token: this.puffPointsTokenAddress,
        },
      });
    } catch (e) {
      this.logger.error(e);
      throw new NotFoundException();
    }

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
