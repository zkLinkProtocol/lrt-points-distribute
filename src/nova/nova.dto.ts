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

export class CategoryTotalPointsListDto {
  @ApiProperty({
    type: String,
    description: "Name of the category",
  })
  public readonly category: string;

  @ApiProperty({
    type: Number,
    description: "Total eco points of the category",
  })
  public readonly ecoPoints: number;

  @ApiProperty({
    type: Number,
    description: "Total referral points of the category",
  })
  public readonly referralPoints: number;

  @ApiProperty({
    type: Number,
    description: "Total other points of the category",
  })
  public readonly otherPoints: number;
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

export class CategoryPointsUserWithIndexDto {
  @ApiProperty({
    type: Number,
    description: "Index of the user",
  })
  public readonly userIndex: number;

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

export class CategoryPointsUserListWithCurrentDto {
  @ApiProperty({
    type: CategoryPointsUserWithIndexDto,
    description: "Points info of the current user",
  })
  public readonly current: CategoryPointsUserWithIndexDto;

  @ApiProperty({
    type: [CategoryPointsUserListDto],
    description: "Points info of the users",
  })
  public readonly list: CategoryPointsUserListDto[];
}

export class CategoryPointsListDto {
  @ApiProperty({
    type: String,
    description: "Name of the category",
  })
  public readonly category: string;

  @ApiProperty({
    type: Number,
    description: "Referral points of the category",
  })
  public readonly referralPoints: number;

  @ApiProperty({
    type: Number,
    description: "Eco points of the category",
  })
  public readonly ecoPoints: number;

  @ApiProperty({
    type: Number,
    description: "Total other points of the category",
  })
  public readonly otherPoints: number;
}

export class ProjectPointsListDto {
  @ApiProperty({
    type: String,
    description: "Name of the project",
  })
  public readonly project: string;

  @ApiProperty({
    type: Number,
    description: "Referral points of the category",
  })
  public readonly referralPoints: number;

  @ApiProperty({
    type: Number,
    description: "Eco points of the category",
  })
  public readonly ecoPoints: number;
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

export class ZklDto {
  @ApiProperty({
    type: String,
    description: "User's address",
  })
  public readonly userAddress: string;

  @ApiProperty({
    type: String,
    description: "Category name",
  })
  public readonly categoryName: string;

  @ApiProperty({
    type: Number,
    description: "Total points of the category",
  })
  public readonly categoryPoints: number;

  @ApiProperty({
    type: Number,
    description: "Total zkl of the category",
  })
  public readonly categoryZkl: number;

  @ApiProperty({
    type: Number,
    description: "Points of user in the category",
  })
  public readonly userPoints: number;

  @ApiProperty({
    type: Number,
    description: "Percentage of user in the category",
  })
  public readonly percentage: number;

  @ApiProperty({
    type: Number,
    description: "Zkl of user in the category",
  })
  public readonly zkl: number;
}

export class AllCategoryPointsUserListDto {
  @ApiProperty({
    type: String,
    description: "Address of the user",
  })
  public readonly address: string;

  @ApiProperty({
    type: [UserPointsItemDto],
    description: "Total points of the user under the categories",
  })
  public readonly totalPoints: UserPointsItemDto[];
}
