/**
 * Type Definitions for Patient Portal, Profiles, and Telegram Reminder Wizard
 * SWASTHYA SENSE - Smart Follow-up. Timely Attention. Better Care.
 */

export interface PatientRecord {
  patient_id: string;
  full_name: string;
  age: number;
  gender: string;
  contact_phone?: string | null;
  condition_summary?: string | null;
  risk_tier: string;
  assigned_worker?: string | null;
  consent_given: boolean;
  consent_updated_at?: string | null;
  follow_up_due_date: string;
  follow_up_type: string;
  telegram_username?: string | null;
  telegram_chat_id?: number | null;
  telegram_linked: boolean;
  telegram_opt_in: boolean;
  telegram_linked_at?: string | null;
  reminder_window?: string | null;
  notify_upcoming?: boolean;
  notify_overdue?: boolean;
  user_id?: string | null;
  email?: string | null;
  profile_picture?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ReminderRecord {
  reminder_id: string;
  patient_id: string;
  channel: string;
  reminder_type: string;
  message_summary: string;
  scheduled_at: string;
  sent_at?: string | null;
  delivery_status: 'Pending' | 'Sent' | 'Failed' | 'Simulated';
  telegram_message_id?: string | null;
  error_message?: string | null;
  created_at: string;
}

export interface TelegramStatus {
  is_linked: boolean;
  patient_id?: string | null;
  patient_name?: string | null;
  telegram_username?: string | null;
  telegram_chat_id?: number | null;
  telegram_linked_at?: string | null;
  telegram_opt_in: boolean;
  bot_configured: boolean;
  bot_username: string;
}

export interface LinkingTokenResponse {
  patient_id: string;
  patient_name: string;
  token: string;
  expires_at: string;
  deep_link: string;
  bot_username: string;
}

export interface TelegramPreferences {
  patient_id: string;
  telegram_opt_in: boolean;
  reminder_window?: string;
  notify_upcoming?: boolean;
  notify_overdue?: boolean;
}

export interface PatientRegistrationPayload {
  full_name: string;
  age: number;
  gender: string;
  contact_phone?: string;
  condition_summary?: string;
  risk_tier?: string;
  assigned_worker?: string;
  consent_given: boolean;
  follow_up_due_date: string;
  follow_up_type?: string;
  telegram_opt_in?: boolean;
  reminder_window?: string;
  notify_upcoming?: boolean;
  notify_overdue?: boolean;
  user_id?: string;
  email?: string;
  profile_picture?: string;
}
