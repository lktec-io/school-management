import { progress } from '../utils/progress.js';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Absolute URL for an API path, e.g. for <img src>. */
export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function buildUrl(path, params) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    }
  }
  return url;
}

/**
 * Low-level request. The session lives in an HttpOnly cookie, so every call uses
 * `credentials: 'include'` and no token is ever stored in JavaScript.
 * Every request drives the top progress bar unless `silent` is set (background polling).
 */
async function request(method, path, options = {}) {
  if (options.silent) return send(method, path, options);
  progress.start();
  try {
    return await send(method, path, options);
  } finally {
    progress.done();
  }
}

async function send(method, path, { body, formData, params, signal, responseType = 'json' } = {}) {
  let response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      credentials: 'include',
      // FormData sets its own multipart boundary header.
      headers: body !== undefined && !formData ? { 'Content-Type': 'application/json' } : undefined,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Unable to reach the server. Please check your connection.', { code: 'NETWORK_ERROR' });
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new ApiError(payload?.error?.message || `Request failed (${response.status})`, {
      status: response.status,
      code: payload?.error?.code,
      details: payload?.error?.details,
    });
    if (response.status === 401 && path !== '/auth/login') {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    if (error.code === 'PASSWORD_CHANGE_REQUIRED') {
      window.dispatchEvent(new CustomEvent('auth:password-change-required'));
    }
    throw error;
  }

  if (responseType === 'blob') return response.blob();
  const payload = await response.json();
  return payload.data;
}

export const api = {
  get: (path, params, options) => request('GET', path, { params, ...options }),
  post: (path, body, options) => request('POST', path, { body: body ?? {}, ...options }),
  put: (path, body, options) => request('PUT', path, { body, ...options }),
  delete: (path, options) => request('DELETE', path, options),
  blob: (path, params, options) => request('GET', path, { params, responseType: 'blob', ...options }),
  postBlob: (path, body, options) => request('POST', path, { body: body ?? {}, responseType: 'blob', ...options }),
  /** multipart/form-data upload (e.g. photos). */
  upload: (path, formData, method = 'POST', options) => request(method, path, { formData, ...options }),
};

/** Trigger a browser download for a Blob. */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
