import { Test, TestingModule } from "@nestjs/testing";
import { PointsController } from "./points.controller";
import { AppModule } from "../app.module";
import { mock } from "jest-mock-extended";

import { RenzoService } from "../renzo/renzo.service";
import { ConfigService } from "@nestjs/config";
import { PuffPointsService } from "./puffPoints.service";
import { PointsRepository } from "../repositories/points.repository";
describe("PointsController", () => {
  let pointsController: PointsController;
  let puffPointsMock: PuffPointsService;
  let renzoServiceMock: RenzoService;
  let configServiceMock: ConfigService;
  let pointsRepositoryMock: PointsRepository;
  beforeEach(async () => {
    puffPointsMock = mock<PuffPointsService>();
    renzoServiceMock = mock<RenzoService>();
    configServiceMock = mock<ConfigService>();
    pointsRepositoryMock = mock<PointsRepository>();

    const point: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [PointsController],
      providers: [
        {
          provide: PuffPointsService,
          useValue: puffPointsMock,
        },
        {
          provide: RenzoService,

          useValue: renzoServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: PointsRepository,
          useValue: pointsRepositoryMock,
        },
      ],
    }).compile();
    pointsController = point.get<PointsController>(PointsController);
  });
});
