import React from 'react';
import { Link } from 'react-router-dom';

export const MANDATORY_DISCLAIMER =
  'DECISION SUPPORT ONLY: SWASTHYA SENSE is an early-warning and follow-up decision support platform for high-risk patients. Predictions, reminders, and 3D visualizations do NOT constitute formal medical diagnoses and must remain under qualified clinician supervision.';

export const FooterDisclaimer: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <footer
      className={`app-chrome no-print w-full ${className}`}
      style={{
        backgroundColor: 'var(--panel)',
        borderTop: '1px solid var(--bd)',
        padding: '8px 16px',
        fontFamily: 'var(--fs)',
        fontSize: '11px',
        color: 'var(--mut)',
        lineHeight: '1.4',
        textAlign: 'center',
        marginTop: 'auto',
      }}
    >
      <div className="max-w-[1200px] mx-auto">
        <span>{MANDATORY_DISCLAIMER}</span>{' '}
        <Link
          to="/model-info"
          style={{
            color: 'var(--acc)',
            textDecoration: 'underline',
          }}
        >
          Model information
        </Link>
      </div>
    </footer>
  );
};
