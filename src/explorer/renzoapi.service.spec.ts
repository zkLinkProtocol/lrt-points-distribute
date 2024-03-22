import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { RenzoApiService } from './renzoapi.service';
import { ConfigService } from '@nestjs/config';

describe('RenzoApiService', () => {
  let app: INestApplication;
  let renzoApiService: RenzoApiService;
  let configService: ConfigService;
  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      providers: [RenzoApiService, ConfigService],
    }).compile();
    renzoApiService = moduleFixture.get<RenzoApiService>(RenzoApiService);
    configService = moduleFixture.get<ConfigService>(ConfigService);
  });

  it('fetchRenzoPoints', async () => {
    const renzoPoints = await renzoApiService.fetchRenzoPoints();
    const renzoPoints2 = [
      await renzoApiService._fetchRenzoPoints(
        configService.get<string>('l1Erc20BridgeEthereum'),
      ),
      await renzoApiService._fetchRenzoPoints(
        configService.get<string>('l1Erc20BridgeArbitrum'),
      ),
      await renzoApiService._fetchRenzoPoints(
        configService.get<string>('l1Erc20BridgeLinea'),
      ),
      await renzoApiService._fetchRenzoPoints(
        configService.get<string>('l1Erc20BridgeBlast'),
      ),
    ]
      .flat()
      .reduce(
        (acc, renzoPoints) => {
          acc.renzoPoints += renzoPoints.renzoPoints;
          acc.eigenLayerPoints += renzoPoints.eigenLayerPoints;
          return acc;
        },
        { renzoPoints: 0, eigenLayerPoints: 0 },
      );
    expect(renzoPoints).toEqual(renzoPoints2);
  });
});
