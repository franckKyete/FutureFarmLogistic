// =============================================================================
// Pagination
// =============================================================================

/** Query parameters for paginated endpoints */
export interface PaginationQuery {
  /** Page number, 1-indexed */
  page?: number;
  /** Number of items per page */
  limit?: number;
}

/** Paginated result envelope */
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
