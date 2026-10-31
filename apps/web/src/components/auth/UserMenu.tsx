import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { GoogleLoginButton } from './GoogleLoginButton';
import {
  User,
  LogOut,
  ChevronDown,
  Copy,
  Check,
  ShieldCheck,
  Send,
  Calendar,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

export const UserMenu: React.FC = () => {
  const navigate = useNavigate();
  const { user, patient, isAuthenticated, logout, initAuth } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Initialize session on mount
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (user?.patient_id) {
      navigator.clipboard.writeText(user.patient_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/dashboard');
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center gap-2">
        <GoogleLoginButton size="sm" label="Sign in with Google" />
      </div>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        id="user-profile-menu-button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1 rounded text-xs font-medium transition-all"
        style={{
          backgroundColor: 'var(--hov)',
          border: '1px solid var(--bd)',
          color: 'var(--ink)',
        }}
        title={`Logged in as ${user.full_name} (${user.email})`}
        aria-label="User profile menu"
      >
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.full_name}
            className="w-5 h-5 rounded-full object-cover border border-slate-300 dark:border-slate-700"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]"
            style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
          >
            {user.full_name.charAt(0).toUpperCase()}
          </div>
        )}

        <span className="font-semibold max-w-[110px] truncate hidden sm:inline-block">
          {user.full_name}
        </span>

        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-mono tracking-tight"
          style={{
            backgroundColor: 'var(--panel)',
            border: '1px solid var(--bd)',
            color: 'var(--acc)',
          }}
          title={`Assigned Patient ID: ${user.patient_id}`}
        >
          {user.patient_id.replace('PT-SENSE-', '#')}
        </span>

        <ChevronDown size={12} style={{ color: 'var(--mut)' }} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1 w-72 rounded-lg shadow-xl z-50 p-2.5 space-y-2"
          style={{
            backgroundColor: 'var(--panel)',
            border: '1px solid var(--bd)',
            boxShadow: 'var(--nav-shadow)',
          }}
        >
          {/* User & Patient ID Header */}
          <div className="pb-2 border-b" style={{ borderColor: 'var(--bd)' }}>
            <div className="flex items-center gap-2.5">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.full_name}
                  className="w-10 h-10 rounded-full object-cover border"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
                >
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate" style={{ color: 'var(--ink)' }}>
                  {user.full_name}
                </div>
                <div className="text-[11px] truncate font-mono" style={{ color: 'var(--mut)' }}>
                  {user.email}
                </div>
              </div>
            </div>

            {/* Assigned Unique Patient ID Pill */}
            <div
              className="mt-2.5 p-2 rounded flex items-center justify-between"
              style={{
                backgroundColor: 'var(--hov)',
                border: '1px solid var(--bd)',
              }}
            >
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--mut)' }}>
                  Assigned Patient ID
                </div>
                <div className="text-xs font-mono font-bold" style={{ color: 'var(--ink)' }}>
                  {user.patient_id}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyId}
                className="p-1.5 rounded hover:bg-hover transition-colors flex items-center gap-1 text-[11px] font-mono"
                style={{ color: 'var(--acc)' }}
                title="Copy Patient ID"
              >
                {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Patient Health & Status Badges */}
          {patient && (
            <div className="text-[11px] space-y-1.5 py-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase" style={{ color: 'var(--mut)' }}>
                  Risk Classification
                </span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                  style={{
                    backgroundColor:
                      patient.risk_tier === 'High'
                        ? 'var(--high-bg, #FEF2F2)'
                        : patient.risk_tier === 'Moderate'
                        ? 'var(--mod-bg, #FFFBEB)'
                        : 'var(--low-bg, #ECFDF5)',
                    color:
                      patient.risk_tier === 'High'
                        ? 'var(--high)'
                        : patient.risk_tier === 'Moderate'
                        ? 'var(--mod)'
                        : 'var(--low)',
                  }}
                >
                  {patient.risk_tier} Risk
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase" style={{ color: 'var(--mut)' }}>
                  Telegram Follow-up
                </span>
                <span
                  className="flex items-center gap-1 font-mono text-[10px]"
                  style={{ color: patient.telegram_linked ? 'var(--low)' : 'var(--mut)' }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: patient.telegram_linked ? 'var(--low)' : 'var(--mut)' }}
                  />
                  {patient.telegram_linked ? 'Connected' : 'Not Connected'}
                </span>
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="pt-1.5 border-t space-y-1" style={{ borderColor: 'var(--bd)' }}>
            <Link
              to="/dashboard"
              onClick={() => setIsOpen(false)}
              className="w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between hover:bg-hover transition-colors"
              style={{ color: 'var(--ink)' }}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={13} style={{ color: 'var(--acc)' }} />
                <span>My Health Dashboard</span>
              </div>
            </Link>

            <Link
              to="/profile"
              onClick={() => setIsOpen(false)}
              className="w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between hover:bg-hover transition-colors"
              style={{ color: 'var(--ink)' }}
            >
              <div className="flex items-center gap-2">
                <User size={13} style={{ color: 'var(--acc)' }} />
                <span>Profile & Telegram Setup</span>
              </div>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors text-red-600 dark:text-red-400 hover:bg-red-500/10 mt-1"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
