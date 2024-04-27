import { ApiProperty } from "@nestjs/swagger";

export class CachePointsWithoutDecimalsDto {
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
    type: Boolean || Number,
    description: "result",
  })
  public readonly data?: boolean | number;
}
