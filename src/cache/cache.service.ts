import { Injectable, Logger } from "@nestjs/common";
import { CacheRepository } from "src/repositories/cache.repository";

const PREFIX_ACTIVE = "active-";
const PREFIX_NEXT_TRANSFERPOINTS = "nextTransferPoints-";

@Injectable()
export class CacheService {
  private readonly logger: Logger;

  public constructor(private readonly cacheRepository: CacheRepository) {
    this.logger = new Logger(CacheService.name);
  }

  public async getAddressStatus(address: string): Promise<boolean> {
    const activeAddressKey = `${PREFIX_ACTIVE}-${address}`;
    const value = await this.cacheRepository.getValue(activeAddressKey);
    return value == "active";
  }

  public async getBridgeAddressNextPoints(bridgeName: string): Promise<number> {
    const nextTransferPointsKey = `${PREFIX_NEXT_TRANSFERPOINTS}-${bridgeName}`;
    const value = await this.cacheRepository.getValue(nextTransferPointsKey);
    return Number(value);
  }
}
