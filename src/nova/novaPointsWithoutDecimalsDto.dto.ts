import { ApiProperty } from "@nestjs/swagger";

export interface Points {
  novaPoint: string;
  referPoint: string;
}

export class PointsWithoutDecimalsDto {
  @ApiProperty({
    type: String,
    description: "user address",
    example: "0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8",
  })
  public readonly address: string;

  @ApiProperty({
    type: "object",
    description: "user points",
    example: "175914.339633725220551495",
  })
  public readonly points: string;

  @ApiProperty({
    type: String,
    description: "token address",
    example: "0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8",
    required: false,
  })
  public readonly tokenAddress?: string;

  @ApiProperty({
    type: String,
    description: "pool address",
    example: "0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8",
    required: false,
  })
  public readonly poolAddress?: string;

  @ApiProperty({
    type: String,
    description: "user balance",
    example: "1759.589382",
  })
  public readonly balance?: string;

  @ApiProperty({
    type: Number,
    description: "The timestamp when the points was updated",
    example: 1710834827,
  })
  public readonly updated_at: number;
}

export class NovaPointsWithoutDecimalsDto {
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
    type: "object",
    description: "total_points",
    example: "175914.339633725220551495",
  })
  public readonly total_points?: string;

  @ApiProperty({
    type: [PointsWithoutDecimalsDto],
    description: "user points data",
    nullable: true,
  })
  public readonly data?: PointsWithoutDecimalsDto[];
}

export class ProjectNovaPoint {
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
    type: String,
    description: "project points data",
    nullable: true,
  })
  public readonly data?: string;
}
