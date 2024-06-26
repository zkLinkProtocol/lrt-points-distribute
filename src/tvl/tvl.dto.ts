import { ApiProperty } from "@nestjs/swagger";

export class CategoryTvlDto {
  @ApiProperty({
    type: String,
    description: "Name of the category, is unique identifier for the category",
    example: "spotdex",
  })
  public readonly name: string;

  @ApiProperty({
    type: Number,
    description: "tvl of the project in category",
    example: "5986.2523",
  })
  public readonly tvl: string;
}

export class CategoryMilestoneDto {
  @ApiProperty({
    type: String,
    description: "Name of the category, is unique identifier for the category",
    example: "spotdex",
  })
  public readonly name: string;

  @ApiProperty({
    type: String,
    description: "tvl or volume of the project in category",
    example: "5986.2523",
  })
  public readonly data: string;

  @ApiProperty({
    type: String,
    description: "tvl or volume",
    example: "tvl",
  })
  public readonly type: string;
}
