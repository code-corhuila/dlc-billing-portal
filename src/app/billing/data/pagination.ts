export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function readPageMeta(value: unknown): PageMeta {
  if (!value || typeof value !== 'object') throw new Error('Invalid pagination');
  const meta = value as Record<string, unknown>;
  for (const key of ['page', 'limit', 'total', 'totalPages']) {
    if (!Number.isSafeInteger(meta[key]) || (meta[key] as number) < (key === 'page' || key === 'limit' ? 1 : 0)) {
      throw new Error('Invalid pagination');
    }
  }
  if ((meta['limit'] as number) > 100) throw new Error('Invalid pagination');
  return { page: meta['page'] as number, limit: meta['limit'] as number,
    total: meta['total'] as number, totalPages: meta['totalPages'] as number };
}

export function pageQuery(page: number, limit = 20): string {
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Invalid pagination request');
  }
  return `?page=${page}&limit=${limit}`;
}
