import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class PagingOptionsDto {
  @ApiPropertyOptional({
    type: "integer",
    minimum: 1,
    default: 1,
    description: "The page number",
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  public readonly page: number = 1;

  @ApiPropertyOptional({
    type: "integer",
    minimum: 1,
    maximum: 500,
    default: 100,
    description: "The number of items returned per page",
    example: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  public readonly limit: number = 100;
}
