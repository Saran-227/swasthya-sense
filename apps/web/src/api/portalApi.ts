/**
 * API Client for SWASTHYA SENSE Patient Portal & Telegram Reminders
 * Interacts with FastAPI backend endpoints:
 * - /api/patients
 * - /api/integrations/telegram/link-token
 * - /api/integrations/telegram/status
 * - /api/integrations/telegram/preferences
 * - /api/integrations/telegram/unlink
 * - /api/patients/{id}/reminders
 */

import type {
  PatientRecord,
  ReminderRecord,
  TelegramStatus,
  LinkingTokenResponse,
  TelegramPreferences,
  PatientRegistrationPayload,
} from '../types/portal';

const API_BASE = '/api';

export async function fetchPatients(): Promise<PatientRecord[]> {
  const resp = await fetch(`${API_BASE}/patients`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch patients: ${resp.statusText}`);
  }
  return resp.json();
}

export async function fetchPatientById(patientId: string): Promise<PatientRecord> {
  const resp = await fetch(`${API_BASE}/patients/${encodeURIComponent(patientId)}`);
  if (!resp.ok) {
    throw new Error(`Patient '${patientId}' not found: ${resp.statusText}`);
  }
  return resp.json();
}

export async function createPatientRecord(
  payload: PatientRegistrationPayload
): Promise<PatientRecord> {
  const resp = await fetch(`${API_BASE}/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Registration failed: ${resp.statusText}`);
  }
  return resp.json();
}

export async function updatePatientRecord(
  patientId: string,
  payload: Partial<PatientRecord>
): Promise<PatientRecord> {
  const resp = await fetch(`${API_BASE}/patients/${encodeURIComponent(patientId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Update failed: ${resp.statusText}`);
  }
  return resp.json();
}

export async function fetchPatientReminders(
  patientId: string
): Promise<ReminderRecord[]> {
  const resp = await fetch(`${API_BASE}/patients/${encodeURIComponent(patientId)}/reminders`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch reminders: ${resp.statusText}`);
  }
  return resp.json();
}

export async function fetchTelegramStatus(
  patientId: string
): Promise<TelegramStatus> {
  const resp = await fetch(
    `${API_BASE}/integrations/telegram/status?patient_id=${encodeURIComponent(patientId)}`
  );
  if (!resp.ok) {
    throw new Error(`Failed to fetch Telegram status: ${resp.statusText}`);
  }
  return resp.json();
}

export async function createTelegramLinkToken(
  patientId: string
): Promise<LinkingTokenResponse> {
  const resp = await fetch(`${API_BASE}/integrations/telegram/link-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: patientId }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create link token: ${resp.statusText}`);
  }
  return resp.json();
}

export async function redeemLinkingToken(
  token: string,
  chatId: number,
  username?: string
): Promise<{ success: boolean; message?: string }> {
  const resp = await fetch(`${API_BASE}/integrations/telegram/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, chat_id: chatId, username: username || null }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to redeem token: ${resp.statusText}`);
  }
  return resp.json();
}

export async function unlinkTelegramAccount(
  patientId: string
): Promise<{ success: boolean; message?: string }> {
  const resp = await fetch(`${API_BASE}/integrations/telegram/unlink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: patientId }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to unlink Telegram: ${resp.statusText}`);
  }
  return resp.json();
}

export async function saveReminderPreferences(
  prefs: TelegramPreferences
): Promise<{ success: boolean }> {
  const resp = await fetch(`${API_BASE}/integrations/telegram/preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to save preferences: ${resp.statusText}`);
  }
  return resp.json();
}

export async function triggerDemoReminder(
  patientId: string,
  reminderType: string = 'Upcoming',
  dryRun: boolean = true
): Promise<any> {
  const resp = await fetch(`${API_BASE}/internal/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patient_id: patientId,
      reminder_type: reminderType,
      dry_run: dryRun,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Reminder dispatch failed: ${resp.statusText}`);
  }
  return resp.json();
}

export async function resetDemoCohort(): Promise<{ success: boolean; message: string }> {
  const resp = await fetch(`${API_BASE}/patients/reset-demo`, {
    method: 'POST',
  });
  if (!resp.ok) {
    throw new Error(`Failed to reset cohort: ${resp.statusText}`);
  }
  return resp.json();
}
