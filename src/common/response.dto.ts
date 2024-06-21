import { ApiProperty } from "@nestjs/swagger";
import { PagingMetaDto } from "./paging.dto";

export class ResponseDto<T> {
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
    description: "total points",
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
    type: "object",
    description:
      "if errno is 0, it will be the response data, otherwise it will be null",
    example: {},
  })
  //@Type(() => T)
  data?: T | null;
}
