import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalStore } from '../store/usePortalStore';
import { useAuthStore } from '../store/useAuthStore';
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton';
import type { PatientRegistrationPayload } from '../types/portal';
import {
  UserPlus,
  ShieldCheck,
  Calendar,
  Phone,
  User,
  Activity,
  Heart,
  Send,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Check,
} from 'lucide-react';

const PRESET_SYNTHETIC_PROFILES = [
  {
    label: 'Cardiology Post-PCI',
    desc: '56yo Male, recent drug-eluting stent, requires blood pressure & anti-platelet compliance follow-up',
    data: {
      full_name: 'Rajesh Verma',
      age: 56,
      gender: 'Male',
      contact_phone: '+91 98450 12345',
      condition_summary: 'Post-PCI with drug-eluting stent in LAD; stable, requires dual antiplatelet therapy compliance review',
      risk_tier: 'High',
      assigned_worker: 'Nurse Sunita Sharma',
      follow_up_due_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      follow_up_type: 'Cardiology Stent Follow-up',
      consent_given: true,
      telegram_opt_in: true,
    },
  },
  {
    label: 'High-Risk Antenatal Care',
    desc: '32yo Female, 30 weeks gestation, gestational hypertension monitoring',
    data: {
      full_name: 'Kavita Das',
      age: 32,
      gender: 'Female',
      contact_phone: '+91 97110 54321',
      condition_summary: 'High-Risk Pregnancy (Gestational HTN at 30 weeks); bi-weekly proteinuria and BP check',
      risk_tier: 'High',
      assigned_worker: 'ANM Anita Verma',
      follow_up_due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      follow_up_type: 'Antenatal High-Risk Check-up',
      consent_given: true,
      telegram_opt_in: true,
    },
  },
  {
    label: 'Chronic Heart Failure Review',
    desc: '65yo Male, ischemic cardiomyopathy, diuretic adjustment and weight monitoring',
    data: {
      full_name: 'Dinesh Sen',
      age: 65,
      gender: 'Male',
      contact_phone: '+91 96220 98765',
      condition_summary: 'Congestive Heart Failure (NYHA Class II) & Type 2 Diabetes; edema monitoring',
      risk_tier: 'Moderate',
      assigned_worker: 'Health Worker Rajesh',
      follow_up_due_date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      follow_up_type: 'Chronic Care Review',
      consent_given: true,
      telegram_opt_in: true,
    },
  },
];

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { registerPatient, openWizard, isLoading } = usePortalStore();
  const { user, patient, isAuthenticated } = useAuthStore();

  const [formData, setFormData] = useState<PatientRegistrationPayload>({
    full_name: user?.full_name || '',
    age: 45,
    gender: 'Male',
    contact_phone: '+91 ',
    condition_summary: '',
    risk_tier: 'Moderate',
    assigned_worker: 'Nurse Sunita Sharma',
    consent_given: true,
    follow_up_due_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    follow_up_type: 'Routine Check-in',
    telegram_opt_in: true,
    reminder_window: '09:00 AM',
    notify_upcoming: true,
    notify_overdue: true,
    user_id: user?.user_id,
    email: user?.email,
    profile_picture: user?.picture || undefined,
  });

  // Keep form in sync if user logs in on page
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        full_name: prev.full_name || user.full_name,
        user_id: user.user_id,
        email: user.email,
        profile_picture: user.picture || undefined,
      }));
    }
  }, [user]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTelegramPrompt, setShowTelegramPrompt] = useState(false);
  const [createdPatientId, setCreatedPatientId] = useState<string | null>(null);

  const applyPreset = (preset: typeof PRESET_SYNTHETIC_PROFILES[0]) => {
    setFormData((prev: PatientRegistrationPayload) => ({
      ...prev,
      ...preset.data,
      user_id: user?.user_id,
      email: user?.email,
      profile_picture: user?.picture || undefined,
    }));
    setErrors({});
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.full_name || formData.full_name.trim().length < 2) {
      errs.full_name = 'Please enter patient full legal name.';
    }
    if (!formData.age || formData.age < 1 || formData.age > 125) {
      errs.age = 'Age must be between 1 and 125.';
    }
    if (!formData.follow_up_due_date) {
      errs.follow_up_due_date = 'Scheduled follow-up date is required.';
    }
    if (!formData.consent_given) {
      errs.consent_given = 'Patient consent is required to create a follow-up profile.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const payload: PatientRegistrationPayload = {
        ...formData,
        user_id: user?.user_id,
        email: user?.email,
        profile_picture: user?.picture || undefined,
      };
      const created = await registerPatient(payload);
      setCreatedPatientId(created.patient_id);
      setShowTelegramPrompt(true);
    } catch (err: any) {
      setErrors({ form: err.message || 'Registration failed' });
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header Banner */}
      <div className="text-center space-y-2">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-mono uppercase tracking-wide"
          style={{ backgroundColor: 'var(--hov)', color: 'var(--acc)', border: '1px solid var(--bd)' }}
        >
          <UserPlus size={14} />
          <span>Patient Registration & Onboarding</span>
        </span>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          Welcome to SWASTHYA SENSE
        </h1>
        <p className="text-xs max-w-lg mx-auto" style={{ color: 'var(--mut)' }}>
          Register a new patient to initialize their follow-up schedule, multi-target risk tracking, and automated reminder channel.
        </p>
      </div>

      {/* Google Authentication Fast-Track Registration Card */}
      {!isAuthenticated ? (
        <div
          className="p-4 sm:p-5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
          style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(16, 185, 129, 0.05))',
            borderColor: 'var(--bd)',
          }}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles size={16} style={{ color: 'var(--acc)' }} />
              <span className="text-xs sm:text-sm font-bold" style={{ color: 'var(--ink)' }}>
                Fast-Track Registration with Google
              </span>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                style={{ backgroundColor: 'var(--hov)', color: 'var(--acc)' }}
              >
                Instant Unique ID
              </span>
            </div>
            <p className="text-xs max-w-md" style={{ color: 'var(--mut)' }}>
              Sign up with Google in 1 click. You will immediately be assigned a unique Patient ID, your record will be securely saved in the database, and your dashboard will be personalized.
            </p>
          </div>
          <GoogleLoginButton size="md" label="Register with Google" onSuccess={() => navigate('/dashboard')} />
        </div>
      ) : (
        <div
          className="p-4 rounded-lg border flex items-center justify-between gap-3 shadow-sm"
          style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--acc)' }}
        >
          <div className="flex items-center gap-3">
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.full_name}
                className="w-10 h-10 rounded-full object-cover border-2"
                style={{ borderColor: 'var(--acc)' }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
              >
                {user?.full_name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-xs font-bold" style={{ color: 'var(--ink)' }}>
                Registered via Google: {user?.full_name}
              </div>
              <div className="text-[11px] font-mono" style={{ color: 'var(--mut)' }}>
                Assigned Patient ID: <strong style={{ color: 'var(--acc)' }}>{user?.patient_id}</strong> • {user?.email}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all"
            style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
          >
            <span>Open Dashboard</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Synthetic Cohort Quick-Load Demo Selector */}
      <div
        className="p-4 rounded-lg border space-y-3"
        style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: 'var(--mod)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
              Hackathon Demo Assistant: Instant Synthetic Cohorts
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--panel)', color: 'var(--mut)' }}>
            1-Click Pre-fill
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {PRESET_SYNTHETIC_PROFILES.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className="text-left p-2.5 rounded border transition-all hover:border-acc"
              style={{
                backgroundColor: 'var(--panel)',
                borderColor: 'var(--bd)',
              }}
            >
              <div className="font-semibold text-xs" style={{ color: 'var(--acc)' }}>
                {preset.label}
              </div>
              <div className="text-[10px] mt-1 line-clamp-2" style={{ color: 'var(--mut)' }}>
                {preset.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Registration Form */}
      <form
        onSubmit={handleSubmit}
        className="p-6 rounded-lg border space-y-5"
        style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--bd)' }}
      >
        {errors.form && (
          <div
            className="p-3 rounded text-xs border flex items-center gap-2"
            style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--high)', color: 'var(--high)' }}
          >
            <AlertCircle size={15} />
            <span>{errors.form}</span>
          </div>
        )}

        {/* Section 1: Demographics */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wide font-semibold border-b pb-1.5 flex items-center gap-2" style={{ color: 'var(--mut)', borderColor: 'var(--bd)' }}>
            <User size={14} />
            <span>1. Basic Patient Demographics</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink)' }}>
                Full Legal Name <span className="text-high">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full p-2.5 rounded text-xs border"
                style={{ borderColor: errors.full_name ? 'var(--high)' : 'var(--bd)', backgroundColor: 'var(--hov)', color: 'var(--ink)' }}
                placeholder="e.g. Sunita Devi"
              />
              {errors.full_name && <p className="text-[10px] mt-1" style={{ color: 'var(--high)' }}>{errors.full_name}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink)' }}>
                Age (Years) <span className="text-high">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                max={125}
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                className="w-full p-2.5 rounded text-xs border"
                style={{ borderColor: errors.age ? 'var(--high)' : 'var(--bd)', backgroundColor: 'var(--hov)', color: 'var(--ink)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink)' }}>
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full p-2.5 rounded text-xs border"
                style={{ borderColor: 'var(--bd)', backgroundColor: 'var(--hov)', color: 'var(--ink)' }}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink)' }}>
                Contact Phone Number
              </label>
              <input
                type="text"
                value={formData.contact_phone || ''}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full p-2.5 rounded text-xs border"
                style={{ borderColor: 'var(--bd)', backgroundColor: 'var(--hov)', color: 'var(--ink)' }}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Clinical Details */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-mono uppercase tracking-wide font-semibold border-b pb-1.5 flex items-center gap-2" style={{ color: 'var(--mut)', borderColor: 'var(--bd)' }}>
            <Activity size={14} />
            <span>2. Chronic Condition & Assigned Worker</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink)' }}>
                Clinical Condition Summary & Relevant Health History
              </label>
              <textarea
                rows={2}
                value={formData.condition_summary || ''}
                onChange={(e) => setFormData({ ...formData, condition_summary: e.target.value })}
                className="w-full p-2.5 rounded text-xs border"
                style={{ borderColor: 'var(--bd)', backgroundColor: 'var(--hov)', color: 'var(--ink)' }}
                placeholder="e.g. Post-PCI (Stent Placement) recovery; needs BP and anti-platelet compliance check"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink)' }}>
                  Prioritization / Risk Tier
                </label>
                <select
                  value={formData.risk_tier}
                  onChange={(e) => setFormData({ ...formData, risk_tier: e.target.value })}
                  className="w-full p-2.5 rounded text-xs border font-medium"
                  style={{ borderColor: 'var(--bd)', backgroundColor: 'var(--hov)', color: 'var(--ink)' }}
                >
                  <option value="High">High Risk (Intensive Follow-up)</option>
                  <option value="Moderate">Moderate Risk (Standard Follow-up)</option>
                  <option value="Low">Low Risk (Quarterly Routine)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink)' }}>
                  Assigned Healthcare Worker
                </label>
                <input
                  type="text"
                  value={formData.assigned_worker || ''}
                  onChange={(e) => setFormData({ ...formData, assigned_worker: e.target.value })}
                  className="w-full p-2.5 rounded text-xs border"
                  style={{ borderColor: 'var(--bd)', backgroundColor: 'var(--hov)', color: 'var(--ink)' }}
                  placeholder="Nurse Sunita Sharma"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Follow-up Schedule */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-mono uppercase tracking-wide font-semibold border-b pb-1.5 flex items-center gap-2" style={{ color: 'var(--mut)', borderColor: 'var(--bd)' }}>
            <Calendar size={14} />
            <span>3. Follow-Up Schedule</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink)' }}>
                Scheduled Due Date <span className="text-high">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.follow_up_due_date}
                onChange={(e) => setFormData({ ...formData, follow_up_due_date: e.target.value })}
                className="w-full p-2.5 rounded text-xs border font-mono"
                style={{ borderColor: errors.follow_up_due_date ? 'var(--high)' : 'var(--bd)', backgroundColor: 'var(--hov)', color: 'var(--ink)' }}
              />
              {errors.follow_up_due_date && <p className="text-[10px] mt-1" style={{ color: 'var(--high)' }}>{errors.follow_up_due_date}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink)' }}>
                Follow-up Checkpoint Type
              </label>
              <select
                value={formData.follow_up_type}
                onChange={(e) => setFormData({ ...formData, follow_up_type: e.target.value })}
                className="w-full p-2.5 rounded text-xs border"
                style={{ borderColor: 'var(--bd)', backgroundColor: 'var(--hov)', color: 'var(--ink)' }}
              >
                <option value="Routine Check-in">Routine Check-in</option>
                <option value="Cardiology Stent Follow-up">Cardiology Stent Follow-up</option>
                <option value="Antenatal High-Risk Check-up">Antenatal High-Risk Check-up</option>
                <option value="Chronic Care Review">Chronic Care Review</option>
                <option value="Post-PCI Rehabilitation">Post-PCI Rehabilitation</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Patient Consent */}
        <div className="pt-2">
          <label
            className="flex items-start gap-3 p-3.5 rounded border cursor-pointer transition-colors"
            style={{
              borderColor: formData.consent_given ? 'var(--acc)' : 'var(--bd)',
              backgroundColor: formData.consent_given ? 'var(--hov)' : 'transparent',
            }}
          >
            <input
              type="checkbox"
              checked={formData.consent_given}
              onChange={(e) => setFormData({ ...formData, consent_given: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded cursor-pointer"
              style={{ accentColor: 'var(--acc)' }}
            />
            <span className="text-xs" style={{ color: 'var(--ink)' }}>
              <strong>Patient Consent for Follow-Up Reminders <span className="text-high">*</span></strong>
              <span className="block text-[11px] mt-0.5" style={{ color: 'var(--mut)' }}>
                I authorize SWASTHYA SENSE to maintain follow-up scheduling records and deliver administrative notifications via configured digital channels.
              </span>
            </span>
          </label>
          {errors.consent_given && <p className="text-[10px] mt-1" style={{ color: 'var(--high)' }}>{errors.consent_given}</p>}
        </div>

        {/* Submit Action */}
        <div className="pt-3 flex items-center justify-between gap-3 border-t" style={{ borderColor: 'var(--bd)' }}>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 rounded text-xs"
            style={{ color: 'var(--mut)' }}
          >
            Back to Dashboard
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2.5 rounded text-xs font-semibold flex items-center gap-2 shadow-sm transition-transform active:scale-95"
            style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
          >
            <span>Complete Registration</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </form>

      {/* Post-Registration Telegram Prompt Modal */}
      {showTelegramPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-lg p-6 border space-y-4 shadow-xl text-center"
            style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--bd)', color: 'var(--ink)' }}
          >
            <div
              className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
              style={{ backgroundColor: 'var(--hov)', color: 'var(--acc)', border: '1px solid var(--bd)' }}
            >
              <CheckCircle2 size={28} />
            </div>

            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--ink)' }}>
                Registration Complete!
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--mut)' }}>
                Patient ID: <strong className="font-mono">{createdPatientId}</strong>
              </p>
            </div>

            <div
              className="p-4 rounded border text-xs text-left space-y-2"
              style={{ backgroundColor: 'var(--hov)', borderColor: 'var(--bd)' }}
            >
              <div className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
                <Send size={14} style={{ color: 'var(--acc)' }} />
                <span>Next Step: Connect Telegram Reminders</span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--mut)' }}>
                Never miss an important health follow-up. Connect your Telegram account to receive timely reminders directly on Telegram.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowTelegramPrompt(false);
                  navigate('/dashboard');
                }}
                className="w-full sm:w-auto px-4 py-2 rounded text-xs border"
                style={{ borderColor: 'var(--bd)', color: 'var(--mut)' }}
              >
                Go to Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTelegramPrompt(false);
                  openWizard(1);
                  navigate('/profile');
                }}
                className="w-full sm:w-auto px-5 py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
              >
                <Send size={13} />
                <span>Set Up Telegram Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
