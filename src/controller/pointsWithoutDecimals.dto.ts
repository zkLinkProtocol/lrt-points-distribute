import { ApiProperty } from '@nestjs/swagger';

export class PointsWithoutDecimalsDto {
  @ApiProperty({
    type: String,
    description: 'user address',
    example: '0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8',
  })
  public readonly address: string;

  @ApiProperty({
    type: String,
    description: 'user point',
    example: '437936.234525',
    examples: ['437936.234525', null],
    required: false,
  })
  public readonly points?: string;

  @ApiProperty({
    type: Number,
    description: 'The timestamp when the points was updated',
    example: 1710834827,
  })
  public readonly updated_at: number;
}
