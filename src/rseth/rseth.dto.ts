import { ApiProperty } from '@nestjs/swagger';
import { PagingMetaDto } from 'src/common/paging.dto';

export class RsethTotalPointDto {
  @ApiProperty({
    type: String,
    description: 'elPoints',
    example: '1759.5893',
  })
  public readonly elPoints: string;

  @ApiProperty({
    type: String,
    description: 'kelpMiles',
    example: '1759.5893',
  })
  public readonly kelpMiles: string;
}

export class RsethPointItem {
  @ApiProperty({
    type: String,
    description: 'user address',
    example: '0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8',
  })
  public readonly address: string;
  
  @ApiProperty({
    type: RsethTotalPointDto,
    description: 'user points',
    example: {
      elPoints: '437936.342254',
      kelpMiles: '437936.342254',
    },
  })
  public readonly points: RsethTotalPointDto;
  
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

export class RsethReturnDto {
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
    type: RsethTotalPointDto,
    description: 'elPoints and kelpMiles',
    example: {
      elPoints: '437936.342254',
      kelpMiles: '437936.342254',
    },
    required: false,
  })
  public readonly points?: RsethTotalPointDto;

  @ApiProperty({
    type: PagingMetaDto,
    description: 'page meta',
    example: 0,
  })
  public readonly meta?: PagingMetaDto;

  @ApiProperty({
    type: [RsethPointItem],
    description: 'user points data',
    nullable: true,
  })
  public readonly data?: RsethPointItem[];
}
