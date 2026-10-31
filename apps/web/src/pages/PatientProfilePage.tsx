import React, { useState } from 'react';
import { usePortalStore } from '../store/usePortalStore';
import { ReminderTimeline } from '../components/portal/ReminderTimeline';
import { TelegramSetupWizard } from '../components/portal/TelegramSetupWizard';
import {
  User,
  Phone,
  Calendar,
  Activity,
  Bell,
  Send,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Save,
  X,
  Radio,
  ExternalLink,
} from 'lucide-react';

export const PatientProfilePage: React.FC = () => {
  const {
    currentPatient,
    telegramStatus,
    updateProfile,
    updateConsent,
    savePreferences,
    unlinkTelegram,
    openWizard,
  } = usePortalStore();

  const [activeTab, setActiveTab] = useState<'personal' | 'health' | 'notifications' | 'history'>('notifications');
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [phoneInput, setPhoneInput] = useState(currentPatient?.contact_phone || '');
  const [workerInput, setWorkerInput] = useState(currentPatient?.assigned_worker || '');
  const [notesInput, setNotesInput] = useState(currentPatient?.condition_summary || '');
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  if (!currentPatient) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <p className="text-sm" style={{ color: 'var(--mut)' }}>No patient selected. Please register or select a synthetic profile.</p>
      </div>
    );
  }

  const handleSaveContact = async () => {
    try {
      await updateProfile({
        contact_phone: phoneInput,
        assigned_worker: workerInput,
        condition_summary: notesInput,
      });
      setIsEditingContact(false);
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleConfirmDisconnect = async () => {
    setIsUnlinking(true);
    try {
      await unlinkTelegram();
      setShowDisconnectModal(false);
    } catch (err: any) {
      alert(`Unlink failed: ${err.message}`);
    } finally {
      setIsUnlinking(false);
    }
  };

  const isConnected = Boolean(currentPatient.telegram_linked && currentPatient.telegram_chat_id);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Profile Header Banner */}
      <div
        className="rounded-lg p-5 sm:p-6 border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--bd)' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg"
            style={{ backgroundColor: 'var(--hov)', color: 'var(--acc)', border: '2px solid var(--bd)' }}
          >
            {currentPatient.full_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
                {currentPatient.full_name}
              </h2>
              <span
                className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold uppercase"
                style={{
                  backgroundColor: 'var(--hov)',
                  color:
                    currentPatient.risk_tier === 'High'
                      ? 'var(--high)'
                      : currentPatient.risk_tier === 'Moderate'
                      ? 'var(--mod)'
                      : 'var(--low)',
                  border: '1px solid var(--bd)',
                }}
              >
                {currentPatient.risk_tier} Risk
              </span>
            </div>
            <div className="text-xs flex items-center gap-3 mt-1 font-mono" style={{ color: 'var(--mut)' }}>
              <span>ID: {currentPatient.patient_id}</span>
              <span>•</span>
              <span>{currentPatient.age} yrs, {currentPatient.gender}</span>
              <span>•</span>
              <span>Worker: {currentPatient.assigned_worker || 'Unassigned'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isConnected ? (
            <button
              type="button"
              onClick={() => openWizard(1)}
              className="px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2 shadow-sm transition-transform active:scale-95"
              style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
            >
              <Send size={14} />
              <span>Connect Telegram</span>
            </button>
          ) : (
            <div
              className="px-3 py-1.5 rounded border text-xs font-medium flex items-center gap-2"
              style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--low)', color: 'var(--low)' }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--low)' }} />
              <span>Telegram Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Profile Navigation Tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--bd)' }}>
        {[
          { key: 'notifications', label: 'Notifications & Reminders', icon: Bell },
          { key: 'personal', label: 'Personal Information', icon: User },
          { key: 'health', label: 'Health & Follow-up', icon: Activity },
          { key: 'history', label: 'Reminder Audit History', icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className="px-3.5 py-2.5 text-xs font-medium border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap"
              style={{
                borderColor: isActive ? 'var(--acc)' : 'transparent',
                color: isActive ? 'var(--acc)' : 'var(--mut)',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Notifications & Telegram Reminders */}
      {activeTab === 'notifications' && (
        <div className="space-y-6 animate-fade-in">
          {/* Telegram Connection Status Card */}
          <div
            className="p-5 sm:p-6 rounded-lg border space-y-4"
            style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--bd)' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--bd)' }}>
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                  <Send size={16} style={{ color: 'var(--acc)' }} />
                  <span>Telegram Follow-Up Reminder Service</span>
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--mut)' }}>
                  Receive privacy-conscious appointment notifications directly on your smartphone.
                </p>
              </div>

              {isConnected && (
                <button
                  type="button"
                  onClick={() => setShowDisconnectModal(true)}
                  className="px-3 py-1.5 rounded text-xs border flex items-center gap-1.5 transition-colors text-muted hover:text-high"
                  style={{ borderColor: 'var(--bd)' }}
                >
                  <Trash2 size={13} />
                  <span>Disconnect Account</span>
                </button>
              )}
            </div>

            {/* Connection Banner */}
            {!isConnected ? (
              <div
                className="p-5 rounded-lg border space-y-3"
                style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--bd)', color: 'var(--acc)' }}
                  >
                    <Send size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
                      Connect Telegram for Timely Reminders
                    </h4>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--mut)' }}>
                      Never miss an important health follow-up. Connect your Telegram account to receive timely reminders directly on Telegram.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openWizard(1)}
                    className="px-5 py-2.5 rounded text-xs font-semibold flex items-center gap-2 shadow-sm transition-transform active:scale-95"
                    style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
                  >
                    <Send size={14} />
                    <span>Set Up Telegram Reminders</span>
                  </button>
                  <span className="text-[11px]" style={{ color: 'var(--mut)' }}>
                    Guided 7-step wizard • No bot token or chat ID required
                  </span>
                </div>
              </div>
            ) : (
              <div
                className="p-4 rounded-lg border space-y-3"
                style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--low)' }}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={18} style={{ color: 'var(--low)' }} />
                    <div>
                      <div className="text-xs font-bold" style={{ color: 'var(--low)' }}>
                        Telegram Account Active & Linked
                      </div>
                      <div className="text-[11px] font-mono" style={{ color: 'var(--mut)' }}>
                        {currentPatient.telegram_username ? (
                          <span>User: @{currentPatient.telegram_username}</span>
                        ) : (
                          <span>Chat ID: {currentPatient.telegram_chat_id}</span>
                        )}
                        {currentPatient.telegram_linked_at && (
                          <span> • Linked: {new Date(currentPatient.telegram_linked_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openWizard(6)}
                    className="px-3 py-1.5 rounded text-xs font-semibold border transition-colors"
                    style={{ borderColor: 'var(--acc)', color: 'var(--acc)', backgroundColor: 'var(--panel)' }}
                  >
                    Edit Preferences
                  </button>
                </div>
              </div>
            )}

            {/* Reminder Preferences & Consent Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div
                className="p-4 rounded border space-y-2 text-xs"
                style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
              >
                <div className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
                  <ShieldCheck size={15} style={{ color: 'var(--acc)' }} />
                  <span>Patient Consent & Opt-In</span>
                </div>
                <div className="space-y-1.5 text-[11px]" style={{ color: 'var(--mut)' }}>
                  <div className="flex justify-between">
                    <span>Consent Status:</span>
                    <strong style={{ color: currentPatient.consent_given ? 'var(--low)' : 'var(--high)' }}>
                      {currentPatient.consent_given ? 'Granted' : 'Revoked / Withheld'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Telegram Delivery:</span>
                    <strong style={{ color: currentPatient.telegram_opt_in ? 'var(--low)' : 'var(--mod)' }}>
                      {currentPatient.telegram_opt_in ? 'Opted In' : 'Suppressed'}
                    </strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateConsent(!currentPatient.consent_given)}
                  className="mt-2 text-[11px] underline font-medium"
                  style={{ color: 'var(--acc)' }}
                >
                  {currentPatient.consent_given ? 'Revoke Consent' : 'Grant Consent'}
                </button>
              </div>

              <div
                className="p-4 rounded border space-y-2 text-xs"
                style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
              >
                <div className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
                  <Clock size={15} style={{ color: 'var(--acc)' }} />
                  <span>Configured Preferences</span>
                </div>
                <div className="space-y-1.5 text-[11px]" style={{ color: 'var(--mut)' }}>
                  <div className="flex justify-between">
                    <span>Delivery Time Window:</span>
                    <strong className="font-mono">{currentPatient.reminder_window || '09:00 AM IST'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Upcoming Reminders:</span>
                    <strong>{currentPatient.notify_upcoming ? 'Enabled (2 days prior)' : 'Disabled'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Overdue Reminders:</span>
                    <strong>{currentPatient.notify_overdue ? 'Enabled' : 'Disabled'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Preview of Reminder History */}
          <div
            className="p-5 sm:p-6 rounded-lg border"
            style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--bd)' }}
          >
            <ReminderTimeline />
          </div>
        </div>
      )}

      {/* Tab 2: Personal Information */}
      {activeTab === 'personal' && (
        <div
          className="p-5 sm:p-6 rounded-lg border space-y-4 animate-fade-in"
          style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--bd)' }}
        >
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--bd)' }}>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                Demographic & Contact Information
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--mut)' }}>
                Patient registry identifiers and designated primary contact.
              </p>
            </div>
            {!isEditingContact ? (
              <button
                type="button"
                onClick={() => {
                  setPhoneInput(currentPatient.contact_phone || '');
                  setWorkerInput(currentPatient.assigned_worker || '');
                  setNotesInput(currentPatient.condition_summary || '');
                  setIsEditingContact(true);
                }}
                className="px-3 py-1.5 rounded text-xs border flex items-center gap-1.5 transition-colors"
                style={{ borderColor: 'var(--bd)', color: 'var(--ink)' }}
              >
                <Edit2 size={13} />
                <span>Edit Details</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingContact(false)}
                  className="px-3 py-1.5 rounded text-xs border text-muted"
                  style={{ borderColor: 'var(--bd)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveContact}
                  className="px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5"
                  style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
                >
                  <Save size={13} />
                  <span>Save Changes</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[11px] font-mono uppercase" style={{ color: 'var(--mut)' }}>
                Full Legal Name
              </label>
              <div className="mt-1 font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                {currentPatient.full_name}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase" style={{ color: 'var(--mut)' }}>
                Patient ID
              </label>
              <div className="mt-1 font-mono font-semibold" style={{ color: 'var(--ink)' }}>
                {currentPatient.patient_id}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase" style={{ color: 'var(--mut)' }}>
                Age & Gender
              </label>
              <div className="mt-1" style={{ color: 'var(--ink)' }}>
                {currentPatient.age} years old • {currentPatient.gender}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase" style={{ color: 'var(--mut)' }}>
                Contact Phone
              </label>
              {isEditingContact ? (
                <input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="mt-1 w-full p-2 rounded text-xs border"
                  style={{ borderColor: 'var(--bd)', backgroundColor: 'var(--hov)', color: 'var(--ink)' }}
                  placeholder="+91 98765 43210"
                />
              ) : (
                <div className="mt-1 font-mono" style={{ color: 'var(--ink)' }}>
                  {currentPatient.contact_phone || 'None provided'}
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-mono uppercase" style={{ color: 'var(--mut)' }}>
                Assigned Community Healthcare Worker
              </label>
              {isEditingContact ? (
                <input
                  type="text"
                  value={workerInput}
                  onChange={(e) => setWorkerInput(e.target.value)}
                  className="mt-1 w-full p-2 rounded text-xs border"
                  style={{ borderColor: 'var(--bd)', backgroundColor: 'var(--hov)', color: 'var(--ink)' }}
                />
              ) : (
                <div className="mt-1 font-semibold" style={{ color: 'var(--ink)' }}>
                  {currentPatient.assigned_worker || 'Unassigned'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Health & Follow-up */}
      {activeTab === 'health' && (
        <div
          className="p-5 sm:p-6 rounded-lg border space-y-4 animate-fade-in"
          style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--bd)' }}
        >
          <div className="pb-3 border-b" style={{ borderColor: 'var(--bd)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              Clinical Follow-Up Schedule & Chronic Condition
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--mut)' }}>
              Scheduled health checkpoint details managed by the primary care facility.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div
              className="p-4 rounded border space-y-1.5"
              style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
            >
              <div className="font-mono text-[11px] uppercase" style={{ color: 'var(--mut)' }}>
                Next Follow-Up Due Date
              </div>
              <div className="text-base font-bold font-mono" style={{ color: 'var(--ink)' }}>
                {currentPatient.follow_up_due_date}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--mut)' }}>
                Check-in Type: <strong>{currentPatient.follow_up_type}</strong>
              </div>
            </div>

            <div
              className="p-4 rounded border space-y-1.5"
              style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
            >
              <div className="font-mono text-[11px] uppercase" style={{ color: 'var(--mut)' }}>
                Stratified Risk Tier
              </div>
              <div
                className="text-base font-bold"
                style={{
                  color:
                    currentPatient.risk_tier === 'High'
                      ? 'var(--high)'
                      : currentPatient.risk_tier === 'Moderate'
                      ? 'var(--mod)'
                      : 'var(--low)',
                }}
              >
                {currentPatient.risk_tier} Priority Cohort
              </div>
              <div className="text-[11px]" style={{ color: 'var(--mut)' }}>
                Multi-target ML early-warning assessment
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-mono uppercase mb-1" style={{ color: 'var(--mut)' }}>
                Chronic Condition & Health History Summary
              </label>
              {isEditingContact ? (
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 rounded text-xs border"
                  style={{ borderColor: 'var(--bd)', backgroundColor: 'var(--hov)', color: 'var(--ink)' }}
                />
              ) : (
                <div
                  className="p-3.5 rounded border text-xs leading-relaxed"
                  style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)', color: 'var(--ink)' }}
                >
                  {currentPatient.condition_summary || 'No chronic condition summary on file.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Reminder History */}
      {activeTab === 'history' && (
        <div
          className="p-5 sm:p-6 rounded-lg border animate-fade-in"
          style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--bd)' }}
        >
          <ReminderTimeline />
        </div>
      )}

      {/* Disconnect Telegram Confirmation Modal */}
      {showDisconnectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-lg p-5 border space-y-4 shadow-xl"
            style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--bd)', color: 'var(--ink)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(200, 29, 58, 0.1)', color: 'var(--high)' }}
              >
                <Trash2 size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
                  Disconnect Telegram Account?
                </h4>
                <p className="text-xs mt-0.5" style={{ color: 'var(--mut)' }}>
                  This will unlink your Telegram chat ID and halt future automated reminders.
                </p>
              </div>
            </div>

            <p className="text-xs text-muted" style={{ color: 'var(--mut)' }}>
              Historical reminder delivery records will remain archived in accordance with healthcare audit requirements. You can reconnect anytime.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDisconnectModal(false)}
                className="px-3.5 py-2 rounded text-xs border"
                style={{ borderColor: 'var(--bd)', color: 'var(--ink)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUnlinking}
                onClick={handleConfirmDisconnect}
                className="px-4 py-2 rounded text-xs font-semibold text-white transition-opacity"
                style={{ backgroundColor: 'var(--high)' }}
              >
                {isUnlinking ? 'Disconnecting...' : 'Yes, Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Telegram Setup Wizard */}
      <TelegramSetupWizard />
    </div>
  );
};
