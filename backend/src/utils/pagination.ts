// pagination.ts
// Shared helpers for paginated list endpoints.
// Standard: default limit 20, max 100 (SKILL_backend_development.md).

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export const toOffset = (page: number, limit: number): number => (page - 1) * limit;

export const buildPaginationMeta = (
  page: number,
  limit: number,
  total: number
): PaginationMeta => ({
  page,
  limit,
  total,
  total_pages: Math.max(1, Math.ceil(total / limit)),
});
