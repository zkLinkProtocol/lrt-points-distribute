import { ApiProperty } from '@nestjs/swagger';
import { PointsDto } from './points.dto';
import { PagingMetaDto } from 'src/common/paging.dto';

export class TokenPointsDto {
  @ApiProperty({
    type: String,
    description: 'token address',
    example: '0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8',
  })
  public readonly tokenAddress: string;

  @ApiProperty({
    type: Number,
    description: 'points decimals value',
    example: 18,
  })
  public readonly decimals: number;

  @ApiProperty({
    type: String,
    description: 'points total supply',
    example: '1000000000000000000',
    examples: ['1000000000000000000', null],
    required: false,
  })
  public readonly totalPoints: string;

  @ApiProperty({
    type: PagingMetaDto,
    description: 'page meta',
    example: 0,
  })
  public readonly meta?: PagingMetaDto;

  @ApiProperty({
    type: [PointsDto],
    description: 'user point',
    nullable: true,
  })
  public readonly result?: PointsDto[];
}
