export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.error === 'string' && data.error
        ? data.error
        : `Permintaan gagal (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function formatDateId(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTimeId(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrencyId(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export function getDueCountdownLabel(dueAt: string, returnedAt: string | null): string {
  if (returnedAt) return 'Selesai dikembalikan';
  const nowMs = Date.now();
  const dueMs = new Date(dueAt).getTime();
  const diffDays = Math.ceil((dueMs - nowMs) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return `Terlambat ${Math.abs(diffDays)} hari`;
  }
  if (diffDays === 0) {
    return 'Jatuh tempo hari ini';
  }
  if (diffDays === 1) {
    return 'Jatuh tempo besok (H-1)';
  }
  return `${diffDays} hari lagi`;
}

export function getSafeCoverUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('/src/assets/')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return url;
    }
  } catch {
    return '';
  }
  return '';
}

export const GENERATED_COVER_PRESETS = [
  {
    label: 'Ilmu Komputer & Algoritma',
    url: '/src/assets/images/book_cover_algorithms_1795659561904.jpg',
  },
  {
    label: 'Arsitektur & Desain',
    url: '/src/assets/images/book_cover_architecture_1795659563934.jpg',
  },
  {
    label: 'Sastra & Sejarah Nusantara',
    url: '/src/assets/images/book_cover_nusantara_1795659563535.jpg',
  },
  {
    label: 'Ekonomi & Sains Data',
    url: '/src/assets/images/book_cover_economics_1795659564161.jpg',
  },
  {
    label: 'Psikologi & Kognitif',
    url: '/src/assets/images/book_cover_psychology_1795659564912.jpg',
  },
];
