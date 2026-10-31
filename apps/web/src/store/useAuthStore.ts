/**
 * Zustand Global Authentication Store
 * SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
 */

import { create } from 'zustand';
import type { AuthUser, AuthConfig } from '../types/auth';
import type { PatientRecord } from '../types/portal';
import * as authApi from '../api/authApi';
import { usePortalStore } from './usePortalStore';

const TOKEN_KEY = 'swasthya_sense_jwt_token';
const USER_KEY = 'swasthya_sense_auth_user';

interface AuthState {
  user: AuthUser | null;
  patient: PatientRecord | null;
  token: string | null;
  config: AuthConfig | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadConfig: () => Promise<AuthConfig | null>;
  initAuth: () => Promise<void>;
  loginWithCredential: (credential: string) => Promise<AuthUser>;
  loginWithCode: (code: string, redirectUri?: string) => Promise<AuthUser>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  patient: null,
  token: localStorage.getItem(TOKEN_KEY),
  config: null,
  isAuthenticated: Boolean(localStorage.getItem(TOKEN_KEY)),
  isLoading: false,
  error: null,

  loadConfig: async () => {
    if (get().config) return get().config;
    try {
      const cfg = await authApi.fetchAuthConfig();
      set({ config: cfg });
      return cfg;
    } catch (err: any) {
      console.warn('Could not load auth config:', err);
      return null;
    }
  },

  initAuth: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ user: null, patient: null, isAuthenticated: false, isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const data = await authApi.fetchCurrentUser(token);
      set({
        user: data.user,
        patient: data.patient,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      // Synchronize active patient in portal store to logged-in user's patient
      if (data.patient) {
        localStorage.setItem('swasthya_sense_active_patient_id', data.patient.patient_id);
        usePortalStore.setState({ currentPatient: data.patient });
        usePortalStore.getState().refreshTelegramStatus();
        usePortalStore.getState().refreshReminders();
      }
    } catch (err: any) {
      console.warn('Session verification failed:', err);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      set({ user: null, patient: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  loginWithCredential: async (credential: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.loginWithGoogleCredential(credential);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      set({
        user: data.user,
        patient: data.patient,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      // Bind patient to portal store
      if (data.patient) {
        localStorage.setItem('swasthya_sense_active_patient_id', data.patient.patient_id);
        usePortalStore.setState({ currentPatient: data.patient });
        usePortalStore.getState().refreshTelegramStatus();
        usePortalStore.getState().refreshReminders();
      }

      return data.user;
    } catch (err: any) {
      set({ error: err.message || 'Login failed', isLoading: false });
      throw err;
    }
  },

  loginWithCode: async (code: string, redirectUri?: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.loginWithGoogleCode(code, redirectUri);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      set({
        user: data.user,
        patient: data.patient,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      // Bind patient to portal store
      if (data.patient) {
        localStorage.setItem('swasthya_sense_active_patient_id', data.patient.patient_id);
        usePortalStore.setState({ currentPatient: data.patient });
        usePortalStore.getState().refreshTelegramStatus();
        usePortalStore.getState().refreshReminders();
      }

      return data.user;
    } catch (err: any) {
      set({ error: err.message || 'OAuth exchange failed', isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({
      user: null,
      patient: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
    // Reload initial synthetic cohort
    usePortalStore.getState().loadPatients();
  },

  clearError: () => set({ error: null }),
}));
