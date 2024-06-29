import { ApiProperty } from "@nestjs/swagger";

export class CategoryPointsDto {
  @ApiProperty({
    type: String,
    description:
      "Category of the project, is unique identifier for the category",
    example: "spotdex",
  })
  public readonly category: string;

  @ApiProperty({
    type: String,
    description: "Name of the project, is unique identifier for the project",
    example: "aqua",
  })
  public readonly project: string;

  @ApiProperty({
    type: Number,
    description: "User's holding points in the project",
    example: 5986.25,
  })
  public readonly holdingPoints: number;

  @ApiProperty({
    type: Number,
    description: "User's ref points in the project",
    example: 156.26,
  })
  public readonly refPoints: number;
}

export class CategoryPointsUserListDto {
  @ApiProperty({
    type: String,
    description: "Address of the user",
  })
  public readonly address: string;

  @ApiProperty({
    type: String,
    description: "Name of the user",
  })
  public readonly username: string;

  @ApiProperty({
    type: Number,
    description: "Total points of the user",
  })
  public readonly totalPoints: number;
}

export class CategoryPointsListDto {
  @ApiProperty({
    type: String,
    description: "Name of the category",
  })
  public readonly category: string;

  @ApiProperty({
    type: Number,
    description: "Total points of the category",
  })
  public readonly totalPoints: number;
}

export class UserPointsItemDto {
  @ApiProperty({
    type: String,
    description: "Name of the category",
  })
  public readonly category: string;

  @ApiProperty({
    type: Number,
    description: "Point of the user under the category",
  })
  public readonly point: number;
}

export class UserPointsListDto {
  @ApiProperty({
    type: String,
    description: "Name of the user",
  })
  public readonly username: string;

  @ApiProperty({
    type: String,
    description: "Address of the user",
  })
  public readonly address: string;

  @ApiProperty({
    type: [UserPointsItemDto],
    description: "TotalPoint list of the user",
  })
  public readonly points: UserPointsItemDto[];
}
