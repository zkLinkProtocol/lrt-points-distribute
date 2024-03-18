import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Points } from 'src/entities/points.entity';
import { PointsRepository } from 'src/repositories/points.repository';
import { PointsHistoryRepository } from 'src/repositories/pointsHistory.repository';
import { UserBalances } from 'src/type/userBalances';
import { formatEther } from 'ethers';

@Injectable()
export class PuffPointsProcessor {
  private readonly logger: Logger;

  private readonly unitPoints: bigint;
  private readonly unitInterval: number;
  public constructor(
    private readonly pointsRepository: PointsRepository,
    private readonly pointsHistoryRepository: PointsHistoryRepository,
    configService: ConfigService,
  ) {
    this.logger = new Logger(PuffPointsProcessor.name);
    this.unitPoints = configService.get<bigint>('puffPoints.unitPoints');
    this.unitInterval = configService.get<number>('puffPoints.unitInterval');
  }

  // return true: no need to try again
  // return false: need to try again()
  public async processNextUser(
    userBalance: UserBalances,
    tokenAddress: string,
  ): Promise<boolean> {
    const address = userBalance.address;
    const balance = BigInt(userBalance.balance);
    const puffPoints = await this.pointsRepository.find({
      where: {
        address: address,
        token: tokenAddress,
      },
    });
    if (puffPoints.length > 0) {
      const [newPoints, addPointsNumber] = this.updatePoints(
        puffPoints[0],
        balance,
      );
      if (newPoints) {
        await this.updatePointsDb(newPoints, addPointsNumber);
      }

      return true;
    }

    // return and run init
    return false;
  }

  //TODO need to test
  public updatePoints(
    pufPoint: Points,
    balance: bigint,
  ): [Partial<Points>, bigint] {
    const address = pufPoint.address;
    const tokenAddress = pufPoint.token;
    const diffInMs = Date.now() - pufPoint.updatedAt.getTime();
    const diffInHours = Math.floor(diffInMs / this.unitInterval);
    if (diffInHours < 1) {
      // return true to prevent try again
      this.logger.debug(
        `diffInHours < 1 for address: ${address} tokenAddress: ${tokenAddress} updateAt: ${pufPoint.updatedAt.toUTCString()} diffInHours:${diffInHours}`,
      );
      return [null, 0n];
    }
    const addPointsNumber = this.unitPoints * BigInt(diffInHours) * balance;
    const newPoints = {
      ...pufPoint,
      points: BigInt(pufPoint.points) + addPointsNumber,
      updatedAt: new Date(
        pufPoint.updatedAt.getTime() + diffInHours * this.unitInterval,
      ),
    };
    // update points and timestamp
    this.logger.log(
      `UPDATE PUFFER ${address} add:${formatEther(addPointsNumber)} total:${formatEther(pufPoint.points + addPointsNumber)}`,
    );
    return [newPoints, addPointsNumber];
  }

  private async updatePointsDb(
    pufPoint: Partial<Points>,
    addPoints: bigint,
  ): Promise<void> {
    await this.pointsRepository.update(pufPoint);

    await this.pointsHistoryRepository.add({
      address: pufPoint.address,
      token: pufPoint.token,
      points: addPoints,
      updatedAt: new Date(),
    });
  }
}
