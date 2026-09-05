// ── Video API Service ─────────────────────────────────────────────

import { apiRequest } from './api';
import type { Product, PaginatedResponse } from '../types';

/** GET /api/v1/products/?has_video=true — fetch products with videos */
export async function fetchProductVideos(page = 1): Promise<PaginatedResponse<Product>> {
  return apiRequest<PaginatedResponse<Product>>({
    method: 'GET',
    url: '/products/',
    params: { has_video: 'true', page },
  });
}

/** Extract YouTube video ID from various URL formats */
export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Get YouTube thumbnail URL from video ID */
export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
