import { PagingMetaDto, PagingDto } from "src/common/paging.dto";

export class PaginationUtil {
  static paginate<T>(items: T[], page: number, limit: number): PagingDto {
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedItems = items.slice(startIndex, endIndex);
    const pagingMeta = {
      currentPage: Number(page),
      itemCount: paginatedItems.length,
      itemsPerPage: Number(limit),
      totalItems: items.length,
      totalPages: Math.ceil(items.length / limit),
    } as PagingMetaDto;

    return {
      meta: pagingMeta,
      items: paginatedItems,
    } as PagingDto;
  }

  static genPaginateMetaByTotalCount(
    total: number,
    page: number,
    limit: number,
  ): PagingMetaDto {
    const itemCount =
      page * limit > total ? Math.max(total - (page - 1) * limit, 0) : limit;
    const pagingMeta = {
      currentPage: Number(page),
      itemCount: itemCount,
      itemsPerPage: Number(limit),
      totalItems: total,
      totalPages: Math.ceil(total / limit),
    };

    return pagingMeta;
  }
}
