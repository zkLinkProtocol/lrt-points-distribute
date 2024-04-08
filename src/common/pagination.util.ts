import { PagingMetaDto, PagingDto } from 'src/common/paging.dto';

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
            items: paginatedItems
        } as PagingDto;
    }
}
  