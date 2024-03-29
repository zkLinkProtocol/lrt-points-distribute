import { ApiProperty } from '@nestjs/swagger';

export interface Points {
  eigenpiePoints: string;
  eigenLayerPoints: string;
}

export class PointsWithoutDecimalsDto {
  @ApiProperty({
    type: String,
    description: 'user address',
    example: '0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8',
  })
  public readonly address: string;
  
  @ApiProperty({
    type: 'object',
    description: 'user points',
    example: {
        "eigenpiePoints": "175914.339633725220551495",
        "eigenLayerPoints": "110323.698841306158218947"
    },
  })
  public readonly points: Points;
  
  @ApiProperty({
    type: String,
    description: 'token address',
    example: '0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8',
    required: false,
  })
  public readonly tokenAddress?: string;

  @ApiProperty({
    type: String,
    description: 'user balance',
    example: "1759.589382",
  })
  public readonly balance?: string;

  @ApiProperty({
    type: Number,
    description: 'The timestamp when the points was updated',
    example: 1710834827,
  })
  public readonly updated_at: number;
}

export class MagiePointsWithoutDecimalsDto {
  @ApiProperty({
    type: Number,
    description: 'error code',
    example: 0,
  })
  public readonly errno: number;
  
  @ApiProperty({
    type: String,
    description: 'error message',
    example: 'no error',
  })
  public readonly errmsg: string;

  @ApiProperty({
    type: 'object',
    description: 'totals',
    example: {
      "eigenpiePoints": "175914.339633725220551495",
      "eigenLayerPoints": "110323.698841306158218947"
    },
  })
  public readonly totals?: Points;

  @ApiProperty({
    type: [PointsWithoutDecimalsDto],
    description: 'user points data',
    nullable: true,
  })
  public readonly data?: PointsWithoutDecimalsDto[];
}