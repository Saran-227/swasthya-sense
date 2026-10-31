/**
 * Zustand Global Store for SWASTHYA SENSE Patient Portal & Telegram Reminders
 */

import { create } from 'zustand';
import type {
  PatientRecord,
  ReminderRecord,
  TelegramStatus,
  PatientRegistrationPayload,
  TelegramPreferences,
} from '../types/portal';
import * as portalApi from '../api/portalApi';

interface PortalState {
  patients: PatientRecord[];
  currentPatient: PatientRecord | null;
  reminders: ReminderRecord[];
  telegramStatus: TelegramStatus | null;
  isLoading: boolean;
  error: string | null;

  // Telegram Wizard State
  isWizardOpen: boolean;
  wizardStep: number; // 1 to 7

  // Actions
  loadPatients: () => Promise<void>;
  selectPatient: (patientId: string) => Promise<void>;
  registerPatient: (payload: PatientRegistrationPayload) => Promise<PatientRecord>;
  updateProfile: (updates: Partial<PatientRecord>) => Promise<void>;
  updateConsent: (consentGiven: boolean) => Promise<void>;
  savePreferences: (prefs: Partial<TelegramPreferences>) => Promise<void>;
  refreshTelegramStatus: () => Promise<void>;
  refreshReminders: () => Promise<void>;
  unlinkTelegram: () => Promise<void>;
  triggerTestReminder: (reminderType?: string, dryRun?: boolean) => Promise<any>;
  resetCohort: () => Promise<void>;

  // Wizard Navigation
  openWizard: (step?: number) => void;
  closeWizard: () => void;
  setWizardStep: (step: number) => void;
}

const STORAGE_KEY = 'swasthya_sense_active_patient_id';

export const usePortalStore = create<PortalState>((set, get) => ({
  patients: [],
  currentPatient: null,
  reminders: [],
  telegramStatus: null,
  isLoading: false,
  error: null,
  isWizardOpen: false,
  wizardStep: 1,

  loadPatients: async () => {
    set({ isLoading: true, error: null });
    try {
      const patients = await portalApi.fetchPatients();
      const savedId = localStorage.getItem(STORAGE_KEY);
      let active = patients.find((p) => p.patient_id === savedId);
      if (!active && savedId) {
        try {
          const fetched = await portalApi.fetchPatientById(savedId);
          if (fetched) {
            active = fetched;
            patients.unshift(fetched);
          }
        } catch (e) {
          // Fall back to first patient
        }
      }
      if (!active) {
        active = patients[0] || null;
      }

      set({ patients, currentPatient: active, isLoading: false });

      if (active) {
        get().refreshTelegramStatus();
        get().refreshReminders();
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to load patients', isLoading: false });
    }
  },

  selectPatient: async (patientId: string) => {
    const existing = get().patients.find((p) => p.patient_id === patientId);
    if (existing) {
      localStorage.setItem(STORAGE_KEY, patientId);
      set({ currentPatient: existing, error: null });
      await Promise.all([get().refreshTelegramStatus(), get().refreshReminders()]);
      return;
    }

    set({ isLoading: true });
    try {
      const patient = await portalApi.fetchPatientById(patientId);
      localStorage.setItem(STORAGE_KEY, patientId);
      set({ currentPatient: patient, isLoading: false, error: null });
      await Promise.all([get().refreshTelegramStatus(), get().refreshReminders()]);
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  registerPatient: async (payload: PatientRegistrationPayload) => {
    set({ isLoading: true, error: null });
    try {
      const created = await portalApi.createPatientRecord(payload);
      localStorage.setItem(STORAGE_KEY, created.patient_id);
      set((state) => ({
        patients: [created, ...state.patients],
        currentPatient: created,
        isLoading: false,
      }));
      await Promise.all([get().refreshTelegramStatus(), get().refreshReminders()]);
      return created;
    } catch (err: any) {
      set({ error: err.message || 'Registration failed', isLoading: false });
      throw err;
    }
  },

  updateProfile: async (updates: Partial<PatientRecord>) => {
    const active = get().currentPatient;
    if (!active) return;
    set({ isLoading: true, error: null });
    try {
      const updated = await portalApi.updatePatientRecord(active.patient_id, updates);
      set((state) => ({
        currentPatient: updated,
        patients: state.patients.map((p) =>
          p.patient_id === updated.patient_id ? updated : p
        ),
        isLoading: false,
      }));
      await get().refreshTelegramStatus();
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  updateConsent: async (consentGiven: boolean) => {
    const active = get().currentPatient;
    if (!active) return;
    try {
      const updated = await portalApi.updatePatientRecord(active.patient_id, {
        consent_given: consentGiven,
      });
      set((state) => ({
        currentPatient: updated,
        patients: state.patients.map((p) =>
          p.patient_id === updated.patient_id ? updated : p
        ),
      }));
      await get().refreshTelegramStatus();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  savePreferences: async (prefs: Partial<TelegramPreferences>) => {
    const active = get().currentPatient;
    if (!active) return;
    try {
      await portalApi.saveReminderPreferences({
        patient_id: active.patient_id,
        telegram_opt_in: prefs.telegram_opt_in ?? active.telegram_opt_in,
        reminder_window: prefs.reminder_window ?? active.reminder_window ?? '09:00 AM',
        notify_upcoming: prefs.notify_upcoming ?? active.notify_upcoming ?? true,
        notify_overdue: prefs.notify_overdue ?? active.notify_overdue ?? true,
      });
      const refreshed = await portalApi.fetchPatientById(active.patient_id);
      set((state) => ({
        currentPatient: refreshed,
        patients: state.patients.map((p) =>
          p.patient_id === refreshed.patient_id ? refreshed : p
        ),
      }));
      await get().refreshTelegramStatus();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  refreshTelegramStatus: async () => {
    const active = get().currentPatient;
    if (!active) return;
    try {
      const status = await portalApi.fetchTelegramStatus(active.patient_id);
      set({ telegramStatus: status });
      // Sync patient fields if changed
      if (
        status.is_linked !== active.telegram_linked ||
        status.telegram_username !== active.telegram_username
      ) {
        set((state) => {
          if (!state.currentPatient) return state;
          const updated = {
            ...state.currentPatient,
            telegram_linked: status.is_linked,
            telegram_username: status.telegram_username,
            telegram_chat_id: status.telegram_chat_id,
          };
          return {
            currentPatient: updated,
            patients: state.patients.map((p) =>
              p.patient_id === updated.patient_id ? updated : p
            ),
          };
        });
      }
    } catch (err: any) {
      // Non-blocking status check error
      console.warn('Status poll warning:', err);
    }
  },

  refreshReminders: async () => {
    const active = get().currentPatient;
    if (!active) return;
    try {
      const reminders = await portalApi.fetchPatientReminders(active.patient_id);
      set({ reminders });
    } catch (err: any) {
      console.warn('Reminders fetch error:', err);
    }
  },

  unlinkTelegram: async () => {
    const active = get().currentPatient;
    if (!active) return;
    set({ isLoading: true });
    try {
      await portalApi.unlinkTelegramAccount(active.patient_id);
      const refreshed = await portalApi.fetchPatientById(active.patient_id);
      set((state) => ({
        currentPatient: refreshed,
        patients: state.patients.map((p) =>
          p.patient_id === refreshed.patient_id ? refreshed : p
        ),
        isLoading: false,
      }));
      await Promise.all([get().refreshTelegramStatus(), get().refreshReminders()]);
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  triggerTestReminder: async (reminderType = 'Upcoming', dryRun = true) => {
    const active = get().currentPatient;
    if (!active) return;
    try {
      const result = await portalApi.triggerDemoReminder(active.patient_id, reminderType, dryRun);
      await get().refreshReminders();
      return result;
    } catch (err: any) {
      throw err;
    }
  },

  resetCohort: async () => {
    set({ isLoading: true });
    try {
      await portalApi.resetDemoCohort();
      await get().loadPatients();
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  openWizard: (step = 1) => {
    set({ isWizardOpen: true, wizardStep: step });
  },

  closeWizard: () => {
    set({ isWizardOpen: false, wizardStep: 1 });
  },

  setWizardStep: (step: number) => {
    set({ wizardStep: Math.min(Math.max(step, 1), 7) });
  },
}));
