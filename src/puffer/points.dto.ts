import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
// import { IsArray, IsNumber, IsString } from "class-validator";

export class PointsDto {
  @ApiProperty({
    type: String,
    description: "user address",
    example: "0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8",
  })
  public readonly address: string;

  @ApiProperty({
    type: String,
    description: "token address",
    example: "0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8",
  })
  public readonly tokenAddress: string;

  @ApiProperty({
    type: String,
    description: "user point",
    example: "1000000000000000000",
    examples: ["1000000000000000000", null],
  })
  public readonly points: string;

  @ApiProperty({
    type: Date,
    description: "The timestamp when the points was updated",
    example: new Date("2023-11-21T18:16:51.000Z"),
  })
  public readonly updatedAt: Date;
}

class LiquidityDetails {
  @ApiProperty({
    type: String,
    description: "dapp name",
    example: "LayerBank",
  })
  dappName: string;

  @ApiProperty({
    type: String,
    description: "el balance in the protocol",
    example: "1000000000",
  })
  balance: string;
}

export class ElPointsDtoItem {
  @ApiProperty({
    type: String,
    description: "user address",
    example: "0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8",
  })
  userAddress: string;

  @ApiProperty({
    type: String,
    description: "token address",
    example: "0x012726f9f458a63f86055b24e67ba0aa26505028",
  })
  pufEthAddress: string;

  @ApiProperty({
    type: String,
    description: "user puffer points",
    example: "437936.234525",
  })
  pufferPoints: string;

  @ApiProperty({
    type: String,
    description: "total puffer balance",
    example: "1000000000",
  })
  totalBalance: string;

  @ApiProperty({
    type: String,
    description: "total withdrawn puffer balance in progress to l1",
    example: "1000000000",
  })
  withdrawingBalance: string;

  @ApiProperty({
    type: String,
    description: "user account balance",
    example: "1000000000",
  })
  userBalance: string;

  @ApiProperty({
    type: String,
    description: "user staked pufEth on protocols",
    example: "1000000000",
  })
  liquidityBalance: string;

  @ApiProperty({
    type: LiquidityDetails,
    description: "user staked details on protocols",
    example: "1000000000",
  })
  @Type(() => LiquidityDetails)
  liquidityDetails: LiquidityDetails[];

  @ApiProperty({
    type: Date,
    description: "The timestamp when the points was updated",
    example: new Date("2023-11-21T18:16:51.000Z"),
  })
  public readonly updatedAt: Date;
}

export class UserElPointsDto {
  @ApiProperty({
    type: Number,
    description: "error code",
    example: 0,
  })
  public readonly errno: number;
  //errmsg
  @ApiProperty({
    type: String,
    description: "error message",
    example: "no error",
  })
  public readonly errmsg: string;

  @ApiProperty({
    type: ElPointsDtoItem,
    description: "token address",
    nullable: true,
  })
  public readonly data: ElPointsDtoItem;
}

export class ElPointsDtoData {
  @ApiProperty({
    type: String,
    description: "total eigenlayer points",
    example: "10000",
  })
  public readonly totalPufferPoints: string;

  @ApiProperty({
    type: ElPointsDtoItem,
    description: "eigenlayer points list",
    example: "10000",
  })
  public readonly list: ElPointsDtoItem[];
}

export class ElPointsDto {
  @ApiProperty({
    type: Number,
    description: "error code",
    example: 0,
  })
  public readonly errno: number;
  //errmsg
  @ApiProperty({
    type: String,
    description: "error message",
    example: "no error",
  })
  public readonly errmsg: string;

  @ApiProperty({
    type: ElPointsDtoData,
    description: "eigenlayer points list",
    nullable: true,
  })
  public readonly data: ElPointsDtoData;
}
