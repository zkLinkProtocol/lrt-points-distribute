import { ApiProperty } from "@nestjs/swagger";

export class TokensDto {
  @ApiProperty({
    type: Number,
    description: "error code",
    example: 0,
  })
  public readonly errno: number;
  //errmsg
  @ApiProperty({
    type: String,
    description: "error message",
    example: "no error",
  })
  public readonly errmsg: string;

  @ApiProperty({
    type: [String],
    description: "token address",
    nullable: true,
  })
  public readonly data?: string[];
}
