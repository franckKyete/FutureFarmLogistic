// =============================================================================
// API Response Wrappers
// =============================================================================

/** Standard success envelope for all API responses */
export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/** Standard error envelope returned by the HTTP exception filter */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}
