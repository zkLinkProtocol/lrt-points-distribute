import { ApiProperty } from "@nestjs/swagger";
import { any } from "jest-mock-extended";

export class PagingMetaDto {
  @ApiProperty({
    type: Number,
    description: "current page",
    example: "1",
  })
  public readonly currentPage: number;

  @ApiProperty({
    type: Number,
    description: "item count",
    example: "1",
  })
  public readonly itemCount: number;

  @ApiProperty({
    type: Number,
    description: "items per page",
    example: "1",
  })
  public readonly itemsPerPage: number;

  @ApiProperty({
    type: Number,
    description: "totalI items",
    example: "1",
  })
  public readonly totalItems: number;

  @ApiProperty({
    type: Number,
    description: "total pages",
    example: "1",
  })
  public readonly totalPages: number;
}

export class PagingDto {
  @ApiProperty({
    type: PagingMetaDto,
    description: "pagination info",
    example: {
      currentPage: 1,
      itemCount: 1,
      itemsPerPage: 1,
      totalItems: 1,
      totalPages: 1,
    },
  })
  public readonly meta: PagingMetaDto;

  @ApiProperty({
    type: [any],
    description: "items",
    example: "",
  })
  public readonly items: any[];
}
