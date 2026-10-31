/**
 * Global API Client Configuration
 * SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
 * Supports local development, Docker containers, and Vercel cloud deployments.
 */

export const API_BASE_URL: string = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) ||
  ''
).replace(/\/+$/, '');

export const API_PREFIX: string = `${API_BASE_URL}/api`;
