import { apiRequest } from './client';

type Envelope<T> = { data: T };

export async function uploadMedia(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiRequest<Envelope<{ id: string; url: string }>>('/api/media', {
    method: 'POST',
    body: formData,
  });
  return response.data;
}
