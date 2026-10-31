import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalStore } from '../../store/usePortalStore';
import { User, Users, ChevronDown, Check, RefreshCw, UserPlus, ShieldCheck } from 'lucide-react';

export const PatientSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const { patients, currentPatient, selectPatient, resetCohort, isLoading } = usePortalStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentPatient && patients.length === 0) return null;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all"
        style={{
          backgroundColor: 'var(--hov)',
          border: '1px solid var(--bd)',
          color: 'var(--ink)',
        }}
        title="Active Patient Switcher (Hackathon Demo Selector)"
        aria-label="Active patient selector"
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: currentPatient?.telegram_linked
              ? 'var(--low)'
              : 'var(--high)',
          }}
        />
        <User size={14} className="text-muted" style={{ color: 'var(--mut)' }} />
        <span className="font-semibold max-w-[130px] truncate">
          {currentPatient ? currentPatient.full_name : 'Select Patient'}
        </span>
        <span
          className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-mono"
          style={{
            backgroundColor: 'var(--panel)',
            border: '1px solid var(--bd)',
            color: 'var(--mut)',
          }}
        >
          {currentPatient?.patient_id.replace('PT-SENSE-', '#')}
        </span>
        <ChevronDown size={13} style={{ color: 'var(--mut)' }} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1 w-72 rounded shadow-lg z-50 p-2"
          style={{
            backgroundColor: 'var(--panel)',
            border: '1px solid var(--bd)',
            boxShadow: 'var(--nav-shadow)',
          }}
        >
          <div className="px-2 py-1.5 border-b mb-1.5" style={{ borderColor: 'var(--bd)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'var(--mut)' }}>
                Active Patient Profile
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--hov)', color: 'var(--acc)' }}>
                Demo Switcher
              </span>
            </div>
            {currentPatient && (
              <div className="mt-1">
                <div className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                  {currentPatient.full_name} ({currentPatient.age}y, {currentPatient.gender})
                </div>
                <div className="text-[11px] truncate" style={{ color: 'var(--mut)' }}>
                  {currentPatient.condition_summary || 'No condition notes'}
                </div>
              </div>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1 py-1">
            <div className="px-2 py-1 text-[10px] font-mono uppercase" style={{ color: 'var(--mut)' }}>
              Synthetic Cohort ({patients.length})
            </div>
            {patients.map((p) => {
              const isSelected = p.patient_id === currentPatient?.patient_id;
              return (
                <button
                  key={p.patient_id}
                  type="button"
                  onClick={() => {
                    selectPatient(p.patient_id);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors"
                  style={{
                    backgroundColor: isSelected ? 'var(--hov)' : 'transparent',
                    color: 'var(--ink)',
                  }}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-medium flex items-center gap-1.5 truncate">
                      <span>{p.full_name}</span>
                      {p.telegram_linked && (
                        <span
                          className="w-1.5 h-1.5 rounded-full inline-block"
                          style={{ backgroundColor: 'var(--low)' }}
                          title="Telegram Connected"
                        />
                      )}
                    </div>
                    <div className="text-[10px] font-mono flex items-center gap-2" style={{ color: 'var(--mut)' }}>
                      <span>{p.patient_id}</span>
                      <span>•</span>
                      <span
                        style={{
                          color:
                            p.risk_tier === 'High'
                              ? 'var(--high)'
                              : p.risk_tier === 'Moderate'
                              ? 'var(--mod)'
                              : 'var(--low)',
                        }}
                      >
                        {p.risk_tier} Risk
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check size={14} style={{ color: 'var(--acc)' }} />}
                </button>
              );
            })}
          </div>

          <div className="border-t mt-1.5 pt-1.5 space-y-1" style={{ borderColor: 'var(--bd)' }}>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/onboarding');
              }}
              className="w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-hover transition-colors"
              style={{ color: 'var(--acc)' }}
            >
              <UserPlus size={13} />
              <span>+ Register New Patient</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm('Reset patient cohort to original hackathon demonstration state?')) {
                  await resetCohort();
                  setIsOpen(false);
                }
              }}
              disabled={isLoading}
              className="w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors opacity-80 hover:opacity-100"
              style={{ color: 'var(--mut)' }}
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>Reset Synthetic Cohort</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
