export function normalizeApiBase(value) {
  if (!value?.trim()) return '';
  try {
    const url = new URL(value.trim());
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    return url.origin;
  } catch {
    throw new Error('VITE_API_URL must be the public HTTPS origin of your backend, or a local HTTP origin.');
  }
}

export const apiBaseUrl = normalizeApiBase(import.meta.env?.VITE_API_URL);

export function apiUrl(path, base = apiBaseUrl) {
  if (typeof path !== 'string' || !/^\/(?:graphql(?:[/?]|$)|api(?:\/|$)|images(?:\/|$))/.test(path)) return path;
  return base + path;
}
