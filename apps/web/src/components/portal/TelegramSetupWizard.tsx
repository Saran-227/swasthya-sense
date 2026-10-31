import React, { useState, useEffect, useRef } from 'react';
import { usePortalStore } from '../../store/usePortalStore';
import * as portalApi from '../../api/portalApi';
import type { LinkingTokenResponse } from '../../types/portal';
import {
  Send,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Clock,
  Bell,
  ArrowRight,
  ArrowLeft,
  X,
  Smartphone,
  Copy,
  Check,
  Zap,
} from 'lucide-react';

export const TelegramSetupWizard: React.FC = () => {
  const {
    currentPatient,
    isWizardOpen,
    wizardStep,
    closeWizard,
    setWizardStep,
    updateConsent,
    savePreferences,
    refreshTelegramStatus,
    refreshReminders,
  } = usePortalStore();

  // Wizard state
  const [consentChecked, setConsentChecked] = useState(false);
  const [linkingData, setLinkingData] = useState<LinkingTokenResponse | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Polling verification state
  const [pollStatus, setPollStatus] = useState<'waiting' | 'connected' | 'expired'>('waiting');
  const [pollSecondsElapsed, setPollSecondsElapsed] = useState(0);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_POLL_SECONDS = 60;

  // Preferences form state (Step 6)
  const [optIn, setOptIn] = useState(true);
  const [preferredTime, setPreferredTime] = useState('09:00 AM');
  const [notifyUpcoming, setNotifyUpcoming] = useState(true);
  const [notifyOverdue, setNotifyOverdue] = useState(true);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Initialize consent state from patient if already consented
  useEffect(() => {
    if (currentPatient) {
      setConsentChecked(Boolean(currentPatient.consent_given));
      setOptIn(currentPatient.telegram_opt_in ?? true);
      setPreferredTime(currentPatient.reminder_window || '09:00 AM');
      setNotifyUpcoming(currentPatient.notify_upcoming ?? true);
      setNotifyOverdue(currentPatient.notify_overdue ?? true);
    }
  }, [currentPatient, isWizardOpen]);

  // Request linking token when entering Step 3
  useEffect(() => {
    if (isWizardOpen && wizardStep === 3 && currentPatient) {
      generateToken();
    }
  }, [wizardStep, isWizardOpen, currentPatient?.patient_id]);

  // Start polling when entering Step 5
  useEffect(() => {
    if (isWizardOpen && wizardStep === 5 && currentPatient) {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [wizardStep, isWizardOpen, currentPatient?.patient_id]);

  const generateToken = async () => {
    if (!currentPatient) return;
    setIsGeneratingToken(true);
    setTokenError(null);
    try {
      const data = await portalApi.createTelegramLinkToken(currentPatient.patient_id);
      setLinkingData(data);
    } catch (err: any) {
      setTokenError(err.message || 'Unable to generate linking token');
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const startPolling = () => {
    stopPolling();
    setPollStatus('waiting');
    setPollSecondsElapsed(0);

    const startTime = Date.now();
    pollTimerRef.current = setInterval(async () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setPollSecondsElapsed(elapsed);

      if (!currentPatient) return;

      try {
        const status = await portalApi.fetchTelegramStatus(currentPatient.patient_id);
        if (status.is_linked) {
          stopPolling();
          setPollStatus('connected');
          await refreshTelegramStatus();
          await refreshReminders();
          return;
        }
      } catch (err) {
        console.warn('Poll error:', err);
      }

      if (elapsed >= MAX_POLL_SECONDS) {
        stopPolling();
        setPollStatus('expired');
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const handleCopyLink = () => {
    if (linkingData?.deep_link) {
      navigator.clipboard.writeText(linkingData.deep_link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Instant simulator for hackathon test/evaluation mode
  const handleSimulateBotStart = async () => {
    if (!linkingData?.token) return;
    try {
      await portalApi.redeemLinkingToken(
        linkingData.token,
        88291034,
        `${currentPatient?.full_name.toLowerCase().replace(/\s+/g, '_')}_tg`
      );
      // Advance to step 5 to trigger status verification
      setWizardStep(5);
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    }
  };

  const handleConsentSubmit = async () => {
    if (!consentChecked) return;
    await updateConsent(true);
    setWizardStep(3);
  };

  const handleSavePreferences = async () => {
    if (!currentPatient) return;
    setIsSavingPrefs(true);
    try {
      await savePreferences({
        telegram_opt_in: optIn,
        reminder_window: preferredTime,
        notify_upcoming: notifyUpcoming,
        notify_overdue: notifyOverdue,
      });
      setWizardStep(7);
    } catch (err: any) {
      alert(`Failed to save preferences: ${err.message}`);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  if (!isWizardOpen || !currentPatient) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
    >
      <div
        className="w-full max-w-xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: 'var(--panel)',
          border: '1px solid var(--bd)',
          color: 'var(--ink)',
        }}
      >
        {/* Wizard Top Bar */}
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--bd)', backgroundColor: 'var(--hov)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded flex items-center justify-center"
              style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
            >
              <Send size={15} />
            </div>
            <div>
              <div id="wizard-title" className="text-xs font-semibold tracking-wide uppercase font-mono" style={{ color: 'var(--ink)' }}>
                Telegram Reminder Setup
              </div>
              <div className="text-[11px]" style={{ color: 'var(--mut)' }}>
                Step {wizardStep} of 7 • Patient {currentPatient.full_name}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={closeWizard}
            className="p-1 rounded text-muted hover:text-ink transition-colors"
            style={{ color: 'var(--mut)' }}
            aria-label="Close setup wizard"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-bd relative" style={{ backgroundColor: 'var(--bd)' }}>
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${(wizardStep / 7) * 100}%`,
              backgroundColor: 'var(--acc)',
            }}
          />
        </div>

        {/* Wizard Body (Scrollable) */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {/* ============================================================== */}
          {/* STEP 1: Introduction                                           */}
          {/* ============================================================== */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <div
                  className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3"
                  style={{ backgroundColor: 'var(--hov)', color: 'var(--acc)', border: '1px solid var(--bd)' }}
                >
                  <Bell size={24} />
                </div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
                  Never Miss An Important Health Follow-Up
                </h3>
                <p className="text-xs mt-1.5 max-w-md mx-auto" style={{ color: 'var(--mut)' }}>
                  Connect your Telegram account to receive timely reminders directly on Telegram.
                </p>
              </div>

              <div
                className="rounded p-4 space-y-3 text-xs"
                style={{ backgroundColor: 'var(--hov)', border: '1px solid var(--bd)' }}
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--low)' }} />
                  <div>
                    <span className="font-semibold" style={{ color: 'var(--ink)' }}>Simple and convenient: </span>
                    <span style={{ color: 'var(--mut)' }}>
                      Telegram is an instant messaging app where SWASTHYA SENSE sends administrative appointment alerts.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ShieldCheck size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--acc)' }} />
                  <div>
                    <span className="font-semibold" style={{ color: 'var(--ink)' }}>Privacy-first architecture: </span>
                    <span style={{ color: 'var(--mut)' }}>
                      The platform will <strong>never</strong> send detailed health records, diagnoses, or lab results through Telegram.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--mod)' }} />
                  <div>
                    <span className="font-semibold" style={{ color: 'var(--ink)' }}>100% Optional & In Your Control: </span>
                    <span style={{ color: 'var(--mut)' }}>
                      Connecting Telegram is optional. You can disconnect or opt out at any time by typing /stop or clicking disconnect.
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={closeWizard}
                  className="px-4 py-2 rounded text-xs font-medium"
                  style={{ color: 'var(--mut)' }}
                >
                  Maybe Later
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="px-5 py-2.5 rounded text-xs font-semibold flex items-center gap-2 transition-transform active:scale-95"
                  style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 2: Explicit Consent                                       */}
          {/* ============================================================== */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <div className="border-b pb-3" style={{ borderColor: 'var(--bd)' }}>
                <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--hov)', color: 'var(--acc)' }}>
                  Mandatory Consent Step
                </span>
                <h3 className="text-base font-semibold mt-2" style={{ color: 'var(--ink)' }}>
                  Patient Follow-up Consent
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--mut)' }}>
                  Please review and provide your explicit consent before establishing an external notification channel.
                </p>
              </div>

              <div
                className="p-4 rounded text-xs space-y-2.5 leading-relaxed"
                style={{ backgroundColor: 'var(--hov)', border: '1px solid var(--bd)' }}
              >
                <div className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
                  <Shield size={14} style={{ color: 'var(--acc)' }} />
                  What will my Telegram messages contain?
                </div>
                <ul className="list-disc pl-5 space-y-1 text-muted" style={{ color: 'var(--mut)' }}>
                  <li>Follow-up date and appointment reminder countdowns.</li>
                  <li>Name of your assigned community healthcare worker.</li>
                  <li>Instructions on how to confirm, reschedule, or contact the clinic.</li>
                  <li>No diagnostic telemetry, clinical risk percentages, or medication lists.</li>
                </ul>
              </div>

              <label
                className="flex items-start gap-3 p-3.5 rounded border cursor-pointer transition-colors"
                style={{
                  borderColor: consentChecked ? 'var(--acc)' : 'var(--bd)',
                  backgroundColor: consentChecked ? 'var(--hov)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: 'var(--acc)' }}
                />
                <span className="text-xs" style={{ color: 'var(--ink)' }}>
                  <strong>Do you agree to receive follow-up reminders from SWASTHYA SENSE through Telegram?</strong>
                  <span className="block text-[11px] mt-0.5" style={{ color: 'var(--mut)' }}>
                    I understand reminders can be stopped at any time with no impact on my clinical care.
                  </span>
                </span>
              </label>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2 rounded text-xs flex items-center gap-1.5"
                  style={{ color: 'var(--mut)' }}
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  disabled={!consentChecked}
                  onClick={handleConsentSubmit}
                  className="px-5 py-2.5 rounded text-xs font-semibold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
                >
                  <span>I Agree & Continue</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 3: Open Telegram                                          */}
          {/* ============================================================== */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <div className="border-b pb-3" style={{ borderColor: 'var(--bd)' }}>
                <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--hov)', color: 'var(--acc)' }}>
                  Secure Linking Link
                </span>
                <h3 className="text-base font-semibold mt-2" style={{ color: 'var(--ink)' }}>
                  Open SWASTHYA SENSE on Telegram
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--mut)' }}>
                  A single-use, patient-specific linking token has been securely created by the backend.
                </p>
              </div>

              {isGeneratingToken ? (
                <div className="py-8 text-center space-y-2">
                  <RefreshCw size={24} className="animate-spin mx-auto" style={{ color: 'var(--acc)' }} />
                  <div className="text-xs" style={{ color: 'var(--mut)' }}>
                    Generating secure linking token...
                  </div>
                </div>
              ) : tokenError ? (
                <div
                  className="p-4 rounded border text-xs flex items-center gap-3"
                  style={{ borderColor: 'var(--high)', color: 'var(--high)', backgroundColor: 'var(--hov)' }}
                >
                  <AlertCircle size={18} className="shrink-0" />
                  <div>
                    <div className="font-semibold">Unable to generate deep link</div>
                    <div>{tokenError}</div>
                    <button
                      type="button"
                      onClick={generateToken}
                      className="mt-2 text-[11px] underline font-semibold"
                    >
                      Retry Generation
                    </button>
                  </div>
                </div>
              ) : linkingData ? (
                <div className="space-y-4">
                  <div
                    className="p-4 rounded text-center border space-y-3"
                    style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
                  >
                    <div className="text-xs font-mono" style={{ color: 'var(--mut)' }}>
                      Official Bot: <strong style={{ color: 'var(--ink)' }}>@{linkingData.bot_username}</strong>
                    </div>

                    <a
                      href={linkingData.deep_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded font-semibold text-xs transition-transform active:scale-95 shadow-sm"
                      style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
                    >
                      <Send size={15} />
                      <span>Open SWASTHYA SENSE on Telegram</span>
                      <ExternalLink size={13} />
                    </a>

                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="text-[11px] flex items-center gap-1.5 px-3 py-1 rounded border transition-colors"
                        style={{ borderColor: 'var(--bd)', color: 'var(--mut)', backgroundColor: 'var(--panel)' }}
                      >
                        {copiedLink ? <Check size={12} style={{ color: 'var(--low)' }} /> : <Copy size={12} />}
                        <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
                      </button>
                    </div>

                    <div className="text-[10px] font-mono" style={{ color: 'var(--mut)' }}>
                      Token expires in 15 minutes • Single-use cryptographic payload
                    </div>
                  </div>

                  {/* Evaluation quick simulate banner for hackathon judges */}
                  <div
                    className="p-3 rounded border text-xs flex items-center justify-between gap-3"
                    style={{ borderColor: 'var(--bd)', backgroundColor: 'var(--panel)' }}
                  >
                    <div className="flex items-center gap-2">
                      <Zap size={15} style={{ color: 'var(--mod)' }} />
                      <span className="text-[11px]" style={{ color: 'var(--mut)' }}>
                        Evaluating on desktop without Telegram app?
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSimulateBotStart}
                      className="px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors whitespace-nowrap"
                      style={{ borderColor: 'var(--acc)', color: 'var(--acc)', backgroundColor: 'var(--hov)' }}
                    >
                      ⚡ 1-Click Simulation
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="px-4 py-2 rounded text-xs flex items-center gap-1.5"
                  style={{ color: 'var(--mut)' }}
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(4)}
                  className="px-5 py-2.5 rounded text-xs font-semibold flex items-center gap-2"
                  style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
                >
                  <span>Next: View Instructions</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 4: Guided Instructions                                    */}
          {/* ============================================================== */}
          {wizardStep === 4 && (
            <div className="space-y-4">
              <div className="border-b pb-3" style={{ borderColor: 'var(--bd)' }}>
                <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--hov)', color: 'var(--acc)' }}>
                  Guided Instructions
                </span>
                <h3 className="text-base font-semibold mt-2" style={{ color: 'var(--ink)' }}>
                  Follow These Simple Steps In Telegram
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--mut)' }}>
                  No technical knowledge required. No chat IDs or API tokens to copy.
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    num: '1',
                    title: 'Open Telegram',
                    desc: 'On your mobile phone or desktop where Telegram is installed.',
                  },
                  {
                    num: '2',
                    title: 'Find the SWASTHYA SENSE Bot',
                    desc: `Open the chat for @${linkingData?.bot_username || 'swasthya_sense_bot'}.`,
                  },
                  {
                    num: '3',
                    title: 'Press the Start button',
                    desc: 'Tap "START" at the bottom of the Telegram chat screen.',
                  },
                  {
                    num: '4',
                    title: 'Allow the bot to establish connection',
                    desc: 'The bot will confirm your account is securely linked.',
                  },
                  {
                    num: '5',
                    title: 'Return to this website',
                    desc: 'We will automatically verify your connection in real time.',
                  },
                ].map((st) => (
                  <div
                    key={st.num}
                    className="flex items-start gap-3 p-3 rounded border text-xs"
                    style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold shrink-0 text-[11px]"
                      style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
                    >
                      {st.num}
                    </div>
                    <div>
                      <div className="font-semibold" style={{ color: 'var(--ink)' }}>
                        {st.title}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--mut)' }}>
                        {st.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Evaluation mode simulate button */}
              <div
                className="p-3 rounded border text-xs flex items-center justify-between gap-3"
                style={{ borderColor: 'var(--bd)', backgroundColor: 'var(--panel)' }}
              >
                <div className="text-[11px]" style={{ color: 'var(--mut)' }}>
                  Want to simulate the bot /start press right now?
                </div>
                <button
                  type="button"
                  onClick={handleSimulateBotStart}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors whitespace-nowrap"
                  style={{ borderColor: 'var(--acc)', color: 'var(--acc)', backgroundColor: 'var(--hov)' }}
                >
                  ⚡ Simulate /start Action
                </button>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className="px-4 py-2 rounded text-xs flex items-center gap-1.5"
                  style={{ color: 'var(--mut)' }}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(5)}
                  className="px-5 py-2.5 rounded text-xs font-semibold flex items-center gap-2"
                  style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
                >
                  <span>I've Pressed Start → Verify</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 5: Verify Connection                                      */}
          {/* ============================================================== */}
          {wizardStep === 5 && (
            <div className="space-y-4">
              <div className="border-b pb-3" style={{ borderColor: 'var(--bd)' }}>
                <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--hov)', color: 'var(--acc)' }}>
                  Real-time Status Check
                </span>
                <h3 className="text-base font-semibold mt-2" style={{ color: 'var(--ink)' }}>
                  Verifying Telegram Connection
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--mut)' }}>
                  We are automatically listening for your Telegram account connection.
                </p>
              </div>

              {pollStatus === 'waiting' && (
                <div
                  className="py-10 text-center space-y-3 rounded border"
                  style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
                >
                  <div className="relative w-12 h-12 mx-auto flex items-center justify-center">
                    <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--acc)' }} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                      Waiting for Telegram connection...
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--mut)' }}>
                      Checking every 2 seconds ({pollSecondsElapsed}s elapsed)
                    </div>
                  </div>
                  <div className="max-w-xs mx-auto text-[11px]" style={{ color: 'var(--mut)' }}>
                    Press <strong>Start</strong> in Telegram, or click simulate below to test immediately.
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSimulateBotStart}
                      className="px-3 py-1.5 rounded text-xs font-medium border"
                      style={{ borderColor: 'var(--acc)', color: 'var(--acc)', backgroundColor: 'var(--panel)' }}
                    >
                      ⚡ Instant Simulation for Demo
                    </button>
                  </div>
                </div>
              )}

              {pollStatus === 'connected' && (
                <div
                  className="py-8 px-4 text-center space-y-3 rounded border"
                  style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--low)' }}
                >
                  <div
                    className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
                    style={{ backgroundColor: 'var(--low)', color: '#FFFFFF' }}
                  >
                    <CheckCircle2 size={26} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold" style={{ color: 'var(--low)' }}>
                      Telegram Successfully Connected!
                    </h4>
                    {currentPatient.telegram_username ? (
                      <p className="text-xs mt-1" style={{ color: 'var(--ink)' }}>
                        Linked to Telegram account: <strong>@{currentPatient.telegram_username}</strong>
                      </p>
                    ) : (
                      <p className="text-xs mt-1" style={{ color: 'var(--ink)' }}>
                        Telegram Chat ID successfully associated with your patient profile.
                      </p>
                    )}
                  </div>
                  <p className="text-[11px] max-w-sm mx-auto" style={{ color: 'var(--mut)' }}>
                    Your account is now securely authorized to receive follow-up notifications.
                  </p>
                </div>
              )}

              {pollStatus === 'expired' && (
                <div
                  className="py-8 px-4 text-center space-y-3 rounded border"
                  style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--high)' }}
                >
                  <div
                    className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
                    style={{ backgroundColor: 'var(--high)', color: '#FFFFFF' }}
                  >
                    <AlertCircle size={26} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold" style={{ color: 'var(--high)' }}>
                      Connection Timed Out
                    </h4>
                    <p className="text-xs mt-1" style={{ color: 'var(--mut)' }}>
                      We did not detect a /start message from your Telegram account within the 60s window.
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setWizardStep(3)}
                      className="px-4 py-2 rounded text-xs border"
                      style={{ borderColor: 'var(--bd)', color: 'var(--ink)' }}
                    >
                      Regenerate Link
                    </button>
                    <button
                      type="button"
                      onClick={startPolling}
                      className="px-4 py-2 rounded text-xs font-semibold flex items-center gap-1.5"
                      style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
                    >
                      <RefreshCw size={13} />
                      <span>Retry Verification</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setWizardStep(4)}
                  className="px-4 py-2 rounded text-xs flex items-center gap-1.5"
                  style={{ color: 'var(--mut)' }}
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  disabled={pollStatus !== 'connected'}
                  onClick={() => setWizardStep(6)}
                  className="px-5 py-2.5 rounded text-xs font-semibold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
                >
                  <span>Configure Preferences</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 6: Reminder Preferences                                   */}
          {/* ============================================================== */}
          {wizardStep === 6 && (
            <div className="space-y-4">
              <div className="border-b pb-3" style={{ borderColor: 'var(--bd)' }}>
                <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--hov)', color: 'var(--acc)' }}>
                  Personalization
                </span>
                <h3 className="text-base font-semibold mt-2" style={{ color: 'var(--ink)' }}>
                  Customize Reminder Preferences
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--mut)' }}>
                  Configure how and when SWASTHYA SENSE should notify you.
                </p>
              </div>

              <div className="space-y-3">
                {/* Master Opt-in */}
                <div
                  className="p-3.5 rounded border flex items-center justify-between"
                  style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
                >
                  <div>
                    <div className="font-semibold text-xs" style={{ color: 'var(--ink)' }}>
                      Telegram Reminders Active
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--mut)' }}>
                      Temporarily pause or enable all automated reminders
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optIn}
                      onChange={(e) => setOptIn(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-bd peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-low"></div>
                  </label>
                </div>

                {/* Preferred Delivery Time Window */}
                <div
                  className="p-3.5 rounded border space-y-2"
                  style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
                >
                  <label className="block text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                    Preferred Reminder Time
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Morning', time: '09:00 AM' },
                      { label: 'Afternoon', time: '02:00 PM' },
                      { label: 'Evening', time: '07:00 PM' },
                    ].map((slot) => {
                      const isSelected = preferredTime === slot.time;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => setPreferredTime(slot.time)}
                          className="px-2.5 py-2 rounded text-xs font-medium border text-center transition-all"
                          style={{
                            borderColor: isSelected ? 'var(--acc)' : 'var(--bd)',
                            backgroundColor: isSelected ? 'var(--panel)' : 'transparent',
                            color: isSelected ? 'var(--acc)' : 'var(--ink)',
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          <div>{slot.label}</div>
                          <div className="text-[10px] font-mono opacity-80">{slot.time}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Specific Notification Toggles */}
                <div
                  className="p-3.5 rounded border space-y-3"
                  style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
                >
                  <div className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                    Notification Triggers
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyUpcoming}
                      onChange={(e) => setNotifyUpcoming(e.target.checked)}
                      className="w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: 'var(--acc)' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--ink)' }}>
                      <strong>Upcoming Follow-up: </strong>
                      <span style={{ color: 'var(--mut)' }}>Notify me 2 days before scheduled visit</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOverdue}
                      onChange={(e) => setNotifyOverdue(e.target.checked)}
                      className="w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: 'var(--acc)' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--ink)' }}>
                      <strong>Missed / Overdue Alert: </strong>
                      <span style={{ color: 'var(--mut)' }}>Non-alarmist reminder if appointment passes</span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setWizardStep(5)}
                  className="px-4 py-2 rounded text-xs flex items-center gap-1.5"
                  style={{ color: 'var(--mut)' }}
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  disabled={isSavingPrefs}
                  onClick={handleSavePreferences}
                  className="px-5 py-2.5 rounded text-xs font-semibold flex items-center gap-2 transition-transform active:scale-95"
                  style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
                >
                  {isSavingPrefs ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  <span>Save Preferences & Complete</span>
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 7: Completion Screen                                      */}
          {/* ============================================================== */}
          {wizardStep === 7 && (
            <div className="space-y-4">
              <div className="text-center py-4 space-y-3">
                <div
                  className="w-14 h-14 rounded-full mx-auto flex items-center justify-center animate-bounce-short"
                  style={{ backgroundColor: 'var(--low)', color: '#FFFFFF' }}
                >
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>
                  You're All Set!
                </h3>
                <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--mut)' }}>
                  SWASTHYA SENSE will help you stay on track with your follow-up reminders.
                </p>
              </div>

              <div
                className="p-4 rounded border text-xs space-y-3"
                style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
              >
                <div className="text-[11px] font-mono uppercase font-semibold border-b pb-1.5" style={{ color: 'var(--mut)', borderColor: 'var(--bd)' }}>
                  Summary of Active Configuration
                </div>

                <div className="flex items-center justify-between py-1">
                  <span style={{ color: 'var(--mut)' }}>Telegram Status</span>
                  <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--low)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--low)' }} />
                    Connected ({currentPatient.telegram_username ? `@${currentPatient.telegram_username}` : 'Chat ID Linked'})
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span style={{ color: 'var(--mut)' }}>Reminder Delivery</span>
                  <span className="font-semibold" style={{ color: optIn ? 'var(--low)' : 'var(--mod)' }}>
                    {optIn ? 'Enabled' : 'Paused'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span style={{ color: 'var(--mut)' }}>Preferred Time Window</span>
                  <span className="font-mono font-semibold" style={{ color: 'var(--ink)' }}>
                    {preferredTime}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span style={{ color: 'var(--mut)' }}>Next Follow-up Due</span>
                  <span className="font-mono font-semibold" style={{ color: 'var(--ink)' }}>
                    {currentPatient.follow_up_due_date} ({currentPatient.follow_up_type})
                  </span>
                </div>
              </div>

              <div className="text-center text-[11px]" style={{ color: 'var(--mut)' }}>
                You can change these preferences or disconnect Telegram anytime from your profile.
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={closeWizard}
                  className="w-full sm:w-auto px-8 py-2.5 rounded text-xs font-semibold transition-transform active:scale-95 shadow-sm"
                  style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
                >
                  Return to Patient Profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
