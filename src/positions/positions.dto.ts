import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";
import { PagingOptionsDto } from "src/common/pagingOptionsDto.dto";

export class GetAGXPositionDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  blockNumber: number;
}

export class GetUserPositionsDto extends PagingOptionsDto {
  @ApiProperty({
    required: false,
    description: "Comma separated list of token addresses",
  })
  @IsOptional()
  tokenAddresses?: string;

  @ApiProperty({
    required: false,
    description: "query positions at the blockNumber",
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  blockNumber?: number;

  @ApiProperty({
    required: false,
    description: "user Address",
  })
  @IsOptional()
  userAddress?: string;
}

export class UserPositionsDto {
  @ApiProperty({
    type: String,
    description: "user address",
    example: "0xc48F99afe872c2541f530C6c87E3A6427e0C40d5",
  })
  userAddress: string;

  @ApiProperty({
    type: String,
    description: "token address",
    example: "0x8280a4e7D5B3B658ec4580d3Bc30f5e50454F169",
  })
  tokenAddress: string;

  @ApiProperty({
    type: String,
    description: "token balance",
    example: "10000000000000000",
  })
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
    description: "user position list",
    nullable: true,
  })
  public readonly data?: UserPositionsDto[];
}
