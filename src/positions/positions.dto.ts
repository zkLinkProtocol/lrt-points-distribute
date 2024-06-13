import { ApiProperty } from "@nestjs/swagger";
import { PagingOptionsDto } from "src/common/pagingOptionsDto.dto";

export class GetUserPositionsDto extends PagingOptionsDto {
  @ApiProperty({
    required: false,
    description: "Comma separated list of token addresses",
  })
  tokenAddresses?: string;

  @ApiProperty({
    required: false,
    description: "query positions at the blockNumber",
  })
  blockNumber?: string;
}

export class UserPositionsDto {
  @ApiProperty()
  userAddress: string;

  @ApiProperty()
  tokenAddress: string;

  @ApiProperty()
  balance: string;
}

export class UserPositionsResponseDto {
  @ApiProperty({
    type: Number,
    description: "error code",
    example: 0,
  })
  public readonly errno: number;

  @ApiProperty({
    type: String,
    description: "error message",
    example: "no error",
  })
  public readonly errmsg: string;

  @ApiProperty({
    type: UserPositionsDto,
    description: "user points data",
    nullable: true,
  })
  public readonly data?: UserPositionsDto[];
}
