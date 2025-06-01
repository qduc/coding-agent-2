import { PaginatedResponse } from '../types/api';

/**
 * Pagination utilities for API responses
 */

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
}

export function parsePaginationParams(query: any): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || parseInt(query.limit) || 20));
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
}

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
  total?: number
): PaginatedResponse<T> {
  const actualTotal = total ?? items.length;
  const hasNext = page * pageSize < actualTotal;

  return {
    success: true,
    data: items,
    timestamp: new Date(),
    metadata: {
      page,
      pageSize,
      total: actualTotal,
      hasNext
    }
  };
}

export function paginateArray<T>(
  array: T[],
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  const offset = (page - 1) * pageSize;
  const paginatedItems = array.slice(offset, offset + pageSize);

  return paginate(paginatedItems, page, pageSize, array.length);
}
