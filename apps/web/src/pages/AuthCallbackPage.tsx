import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithCode, initAuth, error } = useAuthStore();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const token = searchParams.get('token');
    const authError = searchParams.get('error') || searchParams.get('error_description');

    if (authError) {
      setStatus('error');
      setErrorMessage(authError);
      return;
    }

    if (!code && !token) {
      setStatus('error');
      setErrorMessage('No authorization code or authentication token provided in Google callback.');
      return;
    }

    let isMounted = true;

    async function handleAuth() {
      try {
        if (token) {
          // Direct backend callback redirect flow with pre-issued JWT
          localStorage.setItem('swasthya_sense_jwt_token', token);
          await initAuth();
        } else if (code) {
          // Frontend authorization code exchange flow
          // Accurately matches whichever callback path Google redirected to:
          // e.g. https://swasthya-sense-peach.vercel.app/api/auth/callback/google
          // or http://localhost:5173/api/auth/callback/google
          const redirectUri = window.location.origin + window.location.pathname;
          await loginWithCode(code, redirectUri);
        }

        if (isMounted) {
          setStatus('success');
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 1200);
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(err.message || 'Failed to complete Google authentication.');
        }
      }
    }

    handleAuth();

    return () => {
      isMounted = false;
    };
  }, [searchParams, loginWithCode, initAuth, navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div
        className="max-w-md w-full p-8 rounded-xl text-center space-y-4 shadow-lg"
        style={{
          backgroundColor: 'var(--panel)',
          border: '1px solid var(--bd)',
        }}
      >
        {status === 'processing' && (
          <div className="space-y-4">
            <Loader2 size={40} className="animate-spin mx-auto" style={{ color: 'var(--acc)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--ink)' }}>
              Verifying Google Authentication...
            </h2>
            <p className="text-xs font-mono" style={{ color: 'var(--mut)' }}>
              Assigning unique Patient ID and synchronizing medical profile...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 animate-fade-in">
            <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
            <h2 className="text-base font-bold" style={{ color: 'var(--ink)' }}>
              Welcome to SWASTHYA SENSE!
            </h2>
            <p className="text-xs" style={{ color: 'var(--mut)' }}>
              Google account verified and unique Patient ID assigned. Redirecting to your dashboard...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <AlertCircle size={44} className="mx-auto text-red-500" />
            <h2 className="text-base font-bold" style={{ color: 'var(--ink)' }}>
              Authentication Failed
            </h2>
            <p className="text-xs font-mono text-red-400 bg-red-500/10 p-2 rounded">
              {errorMessage || error || 'Could not verify credentials with Google.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold"
              style={{ backgroundColor: 'var(--acc)', color: 'var(--onacc)' }}
            >
              <span>Return to Dashboard</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
