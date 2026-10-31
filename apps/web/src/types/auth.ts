/**
 * Authentication Type Definitions
 * SWASTHYA SENSE - Patient Follow-Up & Early Warning Platform
 */

import type { PatientRecord } from './portal';

export interface AuthUser {
  user_id: string;
  email: string;
  full_name: string;
  picture?: string | null;
  patient_id: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  patient: PatientRecord;
  is_new_registration: boolean;
}

export interface AuthConfig {
  google_client_id: string;
  google_redirect_uri: string;
  auth_url: string;
}
