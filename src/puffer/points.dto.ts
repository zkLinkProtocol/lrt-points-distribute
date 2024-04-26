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

class ElBalanceDetails {
  @ApiProperty({
    type: String,
    description: "dapp name",
    example: "LayerBank",
  })
  dappName: string;

  @ApiProperty({
    type: String,
    description: "el balance in the protocol",
    example: "0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8",
  })
  balance: string;
}

export class ElPointsDtoData {
  @ApiProperty({
    type: String,
    description: "user address",
    example: "0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8",
  })
  address: string;

  @ApiProperty({
    type: String,
    description: "point",
    example: "437936.234525",
  })
  points: string;

  @ApiProperty({
    type: String,
    description: "token address",
    example: "0x012726f9f458a63f86055b24e67ba0aa26505028",
  })
  tokenAddress: string;

  @ApiProperty({
    type: String,
    description: "user Account balance",
    example: "1000000000",
  })
  balanceFromDappTotal: string;

  @Type(() => ElBalanceDetails)
  balanceFromDappTotalDetails: ElBalanceDetails[];
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
    type: [ElPointsDto],
    description: "token address",
    nullable: true,
  })
  public readonly data: ElPointsDtoData;
}
