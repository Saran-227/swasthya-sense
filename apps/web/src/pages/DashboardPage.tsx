import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalStore } from '../store/usePortalStore';
import { TelegramSetupWizard } from '../components/portal/TelegramSetupWizard';
import type { ReminderRecord } from '../types/portal';
import {
  Calendar,
  Clock,
  Send,
  ShieldCheck,
  Activity,
  Heart,
  AlertCircle,
  CheckCircle2,
  Bell,
  ArrowRight,
  ExternalLink,
  User,
  Info,
  Radio,
  Sparkles,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentPatient,
    reminders,
    loadPatients,
    openWizard,
    isLoading,
  } = usePortalStore();

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  if (isLoading && !currentPatient) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-acc border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-mono" style={{ color: 'var(--mut)' }}>
          Loading SWASTHYA SENSE Patient Dashboard...
        </p>
      </div>
    );
  }

  if (!currentPatient) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle size={36} className="mx-auto" style={{ color: 'var(--mut)' }} />
        <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>No Patient Record Active</h2>
        <p className="text-xs" style={{ color: 'var(--mut)' }}>
          Please initialize a patient profile to access the personalized dashboard.
        </p>
        <button
          type="button"
          onClick={() => navigate('/onboarding')}
          className="px-5 py-2.5 rounded text-xs font-semibold"
          style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
        >
          Start Patient Onboarding
        </button>
      </div>
    );
  }

  // Calculate Profile Completion Score
  const computeCompletion = () => {
    let score = 0;
    if (currentPatient.full_name) score += 20;
    if (currentPatient.contact_phone) score += 20;
    if (currentPatient.condition_summary) score += 20;
    if (currentPatient.consent_given) score += 20;
    if (currentPatient.telegram_linked) score += 20;
    return score;
  };
  const completionScore = computeCompletion();

  // Follow-up Days Calculation
  const calculateDaysUntilFollowUp = () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(currentPatient.follow_up_due_date);
      due.setHours(0, 0, 0, 0);
      const diffTime = due.getTime() - today.getTime();
      return Math.round(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  };
  const daysDiff = calculateDaysUntilFollowUp();
  const isOverdue = daysDiff < 0;
  const isDueToday = daysDiff === 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Patient Greeting & Status Banner */}
      <div
        className="rounded-lg p-5 sm:p-6 border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--bd)' }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded"
              style={{ backgroundColor: 'var(--hov)', color: 'var(--acc)' }}
            >
              Patient Portal • SWASTHYA SENSE
            </span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold"
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
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
            Welcome back, {currentPatient.full_name}
          </h1>
          <p className="text-xs" style={{ color: 'var(--mut)' }}>
            Assigned Care Worker: <strong>{currentPatient.assigned_worker || 'Nurse Sunita Sharma'}</strong>
          </p>
        </div>

        {/* Profile Completion Indicator */}
        <div
          className="p-3.5 rounded border sm:w-64 space-y-2"
          style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium" style={{ color: 'var(--ink)' }}>Profile Completion</span>
            <span className="font-mono font-bold" style={{ color: 'var(--acc)' }}>{completionScore}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bd)' }}>
            <div
              className="h-full transition-all duration-500 rounded-full"
              style={{
                width: `${completionScore}%`,
                backgroundColor: completionScore === 100 ? 'var(--low)' : 'var(--acc)',
              }}
            />
          </div>
          <div className="text-[10px] flex items-center justify-between" style={{ color: 'var(--mut)' }}>
            <span>{currentPatient.telegram_linked ? 'Telegram Connected' : 'Telegram Missing'}</span>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="underline font-medium hover:text-ink"
            >
              View Profile
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Follow-Up Action Card & Telegram Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Next Scheduled Follow-up */}
        <div
          className="p-5 sm:p-6 rounded-lg border flex flex-col justify-between space-y-4"
          style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--bd)' }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--mut)' }}>
                <Calendar size={14} style={{ color: 'var(--acc)' }} />
                <span>Next Scheduled Follow-Up</span>
              </span>
              <span
                className="px-2 py-0.5 rounded text-[11px] font-semibold"
                style={{
                  backgroundColor: isOverdue
                    ? 'rgba(200, 29, 58, 0.1)'
                    : isDueToday
                    ? 'rgba(184, 119, 0, 0.1)'
                    : 'var(--hov)',
                  color: isOverdue ? 'var(--high)' : isDueToday ? 'var(--mod)' : 'var(--low)',
                  border: isOverdue ? '1px solid var(--high)' : '1px solid var(--bd)',
                }}
              >
                {isOverdue
                  ? `Overdue by ${Math.abs(daysDiff)} day${Math.abs(daysDiff) > 1 ? 's' : ''}`
                  : isDueToday
                  ? 'Due Today!'
                  : `Due in ${daysDiff} days`}
              </span>
            </div>

            <div>
              <div className="text-2xl font-bold font-mono" style={{ color: 'var(--ink)' }}>
                {currentPatient.follow_up_due_date}
              </div>
              <div className="text-xs mt-1 font-semibold" style={{ color: 'var(--ink)' }}>
                {currentPatient.follow_up_type}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--mut)' }}>
                {currentPatient.condition_summary || 'Regular maintenance check-in'}
              </div>
            </div>

            {/* Non-alarmist administrative clarification */}
            {isOverdue && (
              <div
                className="p-2.5 rounded border text-[11px] flex items-start gap-2"
                style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)', color: 'var(--mut)' }}
              >
                <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--mod)' }} />
                <span>
                  <strong>Notice:</strong> An overdue appointment is an administrative follow-up reminder, not an acute emergency. If experiencing new symptoms, seek immediate emergency care.
                </span>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 border-t" style={{ borderColor: 'var(--bd)' }}>
            <span className="text-xs" style={{ color: 'var(--mut)' }}>
              Assigned: {currentPatient.assigned_worker || 'Care Team'}
            </span>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: 'var(--acc)' }}
            >
              <span>Schedule Details</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Card 2: Telegram Reminders Status */}
        <div
          className="p-5 sm:p-6 rounded-lg border flex flex-col justify-between space-y-4"
          style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--bd)' }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--mut)' }}>
                <Send size={14} style={{ color: 'var(--acc)' }} />
                <span>Telegram Reminder Engine</span>
              </span>
              <span
                className="px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1.5"
                style={{
                  backgroundColor: currentPatient.telegram_linked
                    ? 'rgba(46, 139, 87, 0.1)'
                    : 'var(--hov)',
                  color: currentPatient.telegram_linked ? 'var(--low)' : 'var(--high)',
                  border: '1px solid var(--bd)',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: currentPatient.telegram_linked ? 'var(--low)' : 'var(--high)' }}
                />
                <span>{currentPatient.telegram_linked ? 'Connected' : 'Not Connected'}</span>
              </span>
            </div>

            {!currentPatient.telegram_linked ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  Connect Your Telegram Account
                </h4>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--mut)' }}>
                  Never miss an important health follow-up. Connect your Telegram account to receive timely reminders directly on Telegram.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => openWizard(1)}
                    className="px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2 shadow-sm transition-transform active:scale-95"
                    style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
                  >
                    <Send size={13} />
                    <span>Set Up Telegram Reminders</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} style={{ color: 'var(--low)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--ink)' }}>
                    Active & Delivery Ready
                  </span>
                </div>
                <div className="p-3 rounded border text-xs space-y-1 font-mono text-[11px]" style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}>
                  <div>Account: {currentPatient.telegram_username ? `@${currentPatient.telegram_username}` : 'Chat ID Attached'}</div>
                  <div>Delivery Window: {currentPatient.reminder_window || '09:00 AM IST'}</div>
                  <div>Status: {currentPatient.telegram_opt_in ? 'Opted In' : 'Paused'}</div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 border-t" style={{ borderColor: 'var(--bd)' }}>
            <span className="text-xs" style={{ color: 'var(--mut)' }}>
              Channel: Official @swasthya_sense_bot
            </span>
            <button
              type="button"
              onClick={() => {
                if (currentPatient.telegram_linked) {
                  openWizard(6);
                } else {
                  openWizard(1);
                }
              }}
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: 'var(--acc)' }}
            >
              <span>{currentPatient.telegram_linked ? 'Preferences' : 'Launch Setup'}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Clinical Assessment & Digital Twin Bridge */}
      <div
        className="p-5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{
          backgroundColor: 'var(--hov)',
          borderColor: 'var(--bd)',
        }}
      >
        <div className="flex items-start gap-3.5">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--bd)', color: 'var(--acc)' }}
          >
            <Activity size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
              Interactive 3D Digital Twin & Clinical Assessment
            </h4>
            <p className="text-xs mt-0.5" style={{ color: 'var(--mut)' }}>
              Analyze patient hemodynamics, multi-vessel ischemia probabilities (LAD, LCx, RCA), and physiological explanations.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/welcome')}
          className="px-4 py-2.5 rounded text-xs font-semibold whitespace-nowrap flex items-center gap-2 border transition-colors shadow-sm"
          style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--acc)', color: 'var(--acc)' }}
        >
          <span>Launch 3D Assessment</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Recent Reminder Activity Feed */}
      <div
        className="p-5 sm:p-6 rounded-lg border space-y-4"
        style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--bd)' }}
      >
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--bd)' }}>
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--ink)' }}>
            <Clock size={16} style={{ color: 'var(--acc)' }} />
            <span>Recent Follow-up Activity</span>
          </h3>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="text-xs font-semibold flex items-center gap-1"
            style={{ color: 'var(--acc)' }}
          >
            <span>View All Reminders</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {reminders.length === 0 ? (
          <div className="py-6 text-center text-xs" style={{ color: 'var(--mut)' }}>
            No recent delivery records for {currentPatient.full_name}.
          </div>
        ) : (
          <div className="space-y-2">
            {reminders.slice(0, 3).map((r: ReminderRecord) => (
              <div
                key={r.reminder_id}
                className="p-3 rounded border text-xs flex items-center justify-between gap-3"
                style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    {r.reminder_type} Reminder ({r.channel})
                  </div>
                  <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--mut)' }}>
                    {r.message_summary}
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{
                      backgroundColor: r.delivery_status === 'Sent' ? 'rgba(46, 139, 87, 0.12)' : 'var(--panel)',
                      color: r.delivery_status === 'Sent' ? 'var(--low)' : 'var(--mut)',
                      border: '1px solid var(--bd)',
                    }}
                  >
                    {r.delivery_status}
                  </span>
                  <div className="text-[10px] font-mono mt-1" style={{ color: 'var(--mut)' }}>
                    {new Date(r.sent_at || r.scheduled_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Embedded Telegram Setup Wizard */}
      <TelegramSetupWizard />
    </div>
  );
};
