import { ApiProperty } from '@nestjs/swagger';
import { PointsWithoutDecimalsDto } from './pointsWithoutDecimals.dto';

export class TokenPointsWithoutDecimalsDto {
  @ApiProperty({
    type: Number,
    description: 'error code',
    example: 0,
  })
  public readonly errno: number;
  //errmsg
  @ApiProperty({
    type: String,
    description: 'error message',
    example: 'no error',
  })
  public readonly errmsg: string;

  @ApiProperty({
    type: String,
    description: 'points total supply',
    example: '437936.342254',
    examples: ['437936.342254', null],
    required: false,
  })
  public readonly total_points: string;

  @ApiProperty({
    type: [PointsWithoutDecimalsDto],
    description: 'user points data',
    nullable: true,
  })
  public readonly data?: PointsWithoutDecimalsDto[];
}
