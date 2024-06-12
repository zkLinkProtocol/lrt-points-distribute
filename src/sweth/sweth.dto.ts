import { ApiProperty } from "@nestjs/swagger";
import { PagingMetaDto } from "src/common/paging.dto";

export class SwethPointItem {
  @ApiProperty({
    type: String,
    description: "user address",
    example: "0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8",
  })
  public readonly address: string;

  @ApiProperty({
    type: Number,
    description: "user points",
    example: 437936.342254,
  })
  public readonly points: number;

  @ApiProperty({
    type: String,
    description: "token address",
    example: "0xd754Ff5e8a6f257E162F72578A4bB0493c0681d8",
    required: false,
  })
  public readonly tokenAddress?: string;

  @ApiProperty({
    type: String,
    description: "user balance",
    example: "1759.589382",
  })
  public readonly balance?: number;

  @ApiProperty({
    type: Number,
    description: "The timestamp when the points was updated",
    example: 1710834827,
  })
  public readonly updated_at: number;
}

export class SwethReturnDto {
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
    type: Number,
    description: "elPoints and kelpMiles",
    example: 437936.342254,
    required: false,
  })
  public readonly points?: number;

  @ApiProperty({
    type: PagingMetaDto,
    description: "page meta",
    example: 0,
  })
  public readonly meta?: PagingMetaDto;

  @ApiProperty({
    type: [SwethPointItem],
    description: "user points data",
    nullable: true,
  })
  public readonly data?: SwethPointItem[];
}
