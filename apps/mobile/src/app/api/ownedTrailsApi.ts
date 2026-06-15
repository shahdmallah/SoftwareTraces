import { apiRequest } from './client';
import { normalizeTrail, type Trail } from './trailsApi';

type Envelope<T> = {
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export async function getMyCreatedTrails(params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<Trail[]>>('/api/trails/mine', {}, {
    page: params.page,
    limit: params.limit,
  });

  return {
    items: response.data.map(normalizeTrail),
    pagination: response.pagination,
  };
}
