import { ApiProperty } from '@nestjs/swagger';

export class PointsDto {
  @ApiProperty({
    type: String,
    description: 'user address',
    example: '0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8',
  })
  public readonly address: string;

  @ApiProperty({
    type: String,
    description: 'token address',
    example: '0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8',
    required: false,
  })
  public readonly tokenAddress?: string;

  @ApiProperty({
    type: String,
    description: 'user point',
    example: '1000000000000000000',
    examples: ['1000000000000000000', null],
    required: false,
  })
  public readonly points?: string;

  @ApiProperty({
    type: Date,
    description: 'The timestamp when the points was updated',
    example: new Date('2023-11-21T18:16:51.000Z'),
  })
  public readonly updatedAt: Date;
}
