import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString } from "class-validator";

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
    description: "The Unix timestamp when the points was updated",
    example: 1714397353087,
  })
  public readonly updatedAt: number;
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
    description: "pufEth balance in the dapp",
    example: "0.020000",
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
    description: "pufEth address",
    example: "0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3FC",
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
    description: "total pufEth balance",
    example: "0.020000",
  })
  totalBalance: string;

  @ApiProperty({
    type: String,
    description: "total withdrawn pufEth balance in progress to l1",
    example: "0.010000",
  })
  withdrawingBalance: string;

  @ApiProperty({
    type: String,
    description: "pufEth balance of the user account",
    example: "0.010000",
  })
  userBalance: string;

  @ApiProperty({
    type: String,
    description: "total user staked pufEth on dapps",
    example: "0.000000",
  })
  liquidityBalance: string;

  @ApiProperty({
    type: LiquidityDetails,
    description: "user staked details on dapps",
    example: [
      {
        dappName: "LayerBank",
        balance: "0.000023",
      },
    ],
  })
  @Type(() => LiquidityDetails)
  liquidityDetails: LiquidityDetails[];

  @ApiProperty({
    type: Date,
    description: "The Unix timestamp when the points was updated",
    example: 1714397353,
  })
  public readonly updatedAt: number;
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
    description: "puffer data",
    nullable: true,
    example: {
      totalPufferPoints: "1059581334.900963",
      list: [
        {
          userAddress: "0x02290a02e2065d87cb77773c7ca48e382c3b884e",
          pufEthAddress: "0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3FC",
          pufferPoints: "0.000025",
          totalBalance: "0.000000",
          withdrawingBalance: "0.000000",
          userBalance: "0.000000",
          liquidityBalance: "0.000000",
          liquidityDetails: [],
          updatedAt: 1714397353,
        },
      ],
    },
  })
  public readonly data: ElPointsDtoItem;
}

export class ElPointsDtoData {
  @ApiProperty({
    type: String,
    description: "total puffer points",
    example: "1059581334.900963",
  })
  public readonly totalPufferPoints: string;

  @ApiProperty({
    type: ElPointsDtoItem,
    description: "puffer data list",
    example: [
      {
        userAddress: "0x0000006c21964af0d420af8992851a30fa13c68b",
        pufEthAddress: "0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3FC",
        pufferPoints: "584.925022",
        totalBalance: "0.000034",
        withdrawingBalance: "0.000000",
        userBalance: "0.000034",
        liquidityBalance: "0.000000",
        liquidityDetails: [],
        updatedAt: 1714397353087,
      },
      {
        userAddress: "0x0000006d14ce3cf81449c3ba1f26108df0a4de8b",
        pufEthAddress: "0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3FC",
        pufferPoints: "4119.22257",
        totalBalance: "0.132600",
        withdrawingBalance: "0.000000",
        userBalance: "0.132600",
        liquidityBalance: "0.000000",
        liquidityDetails: [],
        updatedAt: 1714397353087,
      },
    ],
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
    description: "puffer points data",
    nullable: true,
  })
  public readonly data: ElPointsDtoData;
}

export class LayerBankPufferPointQueryOptionsDto {
  @ApiProperty({
    type: Number,
    description: "date time to query",
    example: "2024-04-28 10:20:22",
  })
  @IsDateString()
  public readonly time: string;
}

export class PufferPointUserBalanceData {
  @ApiProperty({
    type: String,
    description: "withdrawing balance",
    example: "0.020000",
  })
  public readonly withdrawingBalance: string;

  @ApiProperty({
    type: LiquidityDetails,
    description: "user staked details on dapps",
    example: [
      {
        dappName: "LayerBank",
        balance: "0.000023",
      },
      {
        dappName: "Aqua",
        balance: "0.010000",
      },
    ],
  })
  public readonly dappBalance: LiquidityDetails[];
}

export class PufferPointUserBalance {
  @ApiProperty({
    type: Number,
    description: "error code",
    example: 0,
  })
  public readonly errno: number;
  //err msg
  @ApiProperty({
    type: String,
    description: "error message",
    example: "no error",
  })
  public readonly errmsg: string;

  @ApiProperty({
    type: PufferPointUserBalanceData,
    description: "puffer points data",
    nullable: true,
  })
  public readonly data: PufferPointUserBalanceData;
}
