/**
 * Google Authentication API Client
 * SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
 */

import type { AuthConfig, AuthResponse } from '../types/auth';
import { API_PREFIX } from './clientConfig';

const API_BASE = API_PREFIX;

export async function fetchAuthConfig(): Promise<AuthConfig> {
  const resp = await fetch(`${API_BASE}/auth/config`);
  if (!resp.ok) {
    throw new Error('Failed to load Google Auth configuration');
  }
  return resp.json();
}

export async function loginWithGoogleCredential(credential: string): Promise<AuthResponse> {
  const resp = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Authentication failed' }));
    throw new Error(err.detail || 'Google authentication failed');
  }

  return resp.json();
}

export async function loginWithGoogleCode(code: string, redirectUri?: string): Promise<AuthResponse> {
  const resp = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Authentication failed' }));
    throw new Error(err.detail || 'Google code exchange failed');
  }

  return resp.json();
}

export async function fetchCurrentUser(token: string): Promise<AuthResponse> {
  const resp = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    throw new Error('Session invalid or expired');
  }

  return resp.json();
}
