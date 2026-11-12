export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** Query-param names shared by every module that supports pagination. */
export const PAGE_PARAM = 'page';
export const PAGE_SIZE_PARAM = 'pageSize';

export interface PaginationParams {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Parses/validates raw page/pageSize query params into bounded integers plus skip/take. */
export function parsePagination(
  rawPage: string | null,
  rawPageSize: string | null,
  defaultPageSize: number = DEFAULT_PAGE_SIZE
): PaginationParams {
  let page = parseInt(rawPage ?? '', 10);
  if (!Number.isFinite(page) || page < 1) page = DEFAULT_PAGE;

  let pageSize = parseInt(rawPageSize ?? '', 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaultPageSize;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

/** Builds the pagination metadata returned alongside a page of results. */
export function buildPaginationMeta(total: number, page: number, pageSize: number): PaginationMeta {
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  return { page, pageSize, total, totalPages };
}
