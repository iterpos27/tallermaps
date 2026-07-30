import { API_BASE_URL } from '../api/api';

const placeholderSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">
    <rect width="800" height="500" fill="#e8eef6"/>
    <g fill="none" stroke="#6b83a4" stroke-linecap="round" stroke-linejoin="round" stroke-width="18">
      <path d="M292 272h216l-25-74c-5-15-19-25-35-25h-96c-16 0-30 10-35 25l-25 74Z"/>
      <path d="M257 272h286c22 0 40 18 40 40v66H217v-66c0-22 18-40 40-40Z"/>
      <circle cx="289" cy="378" r="32" fill="#e8eef6"/>
      <circle cx="511" cy="378" r="32" fill="#e8eef6"/>
      <path d="M245 320h62m186 0h62"/>
    </g>
    <text x="400" y="455" fill="#486482" font-family="Arial, sans-serif" font-size="28" font-weight="700" text-anchor="middle">Foto no disponible</text>
  </svg>`;

export const PHOTO_PLACEHOLDER = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(placeholderSvg)}`;

export const getPhotoUrl = (photoUrl) => {
  if (!photoUrl) return PHOTO_PLACEHOLDER;
  if (/^(?:data:|blob:)/i.test(photoUrl)) return photoUrl;

  // Older rows may point to a previous deployment domain. Uploads belong to
  // this API, so keep their path while using the current server origin.
  if (/^https?:/i.test(photoUrl)) {
    try {
      const parsedUrl = new URL(photoUrl);
      if (parsedUrl.pathname.startsWith('/uploads/')) {
        return `${API_BASE_URL.replace(/\/$/, '')}${parsedUrl.pathname}`;
      }
    } catch {
      return PHOTO_PLACEHOLDER;
    }
    return photoUrl;
  }

  return `${API_BASE_URL.replace(/\/$/, '')}${photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`}`;
};

export const handlePhotoError = (event) => {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === 'true') return;
  image.dataset.fallbackApplied = 'true';
  image.src = PHOTO_PLACEHOLDER;
  image.classList.add('is-placeholder');
};
