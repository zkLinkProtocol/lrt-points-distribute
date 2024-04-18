import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { RenzoApiService } from '../renzo/renzoapi.service';
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
});
