import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { AlertCircle, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleLoginButtonProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onSuccess?: () => void;
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  label = 'Sign in with Google',
  size = 'md',
  className = '',
  onSuccess,
}) => {
  const { config, loadConfig, loginWithCredential, isLoading, error } = useAuthStore();
  const [scriptReady, setScriptReady] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);
  const hiddenBtnRef = useRef<HTMLDivElement>(null);

  // 1. Load Google OAuth config from backend
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 2. Initialize Google Identity Services (GIS)
  useEffect(() => {
    if (!config?.google_client_id) return;

    const checkGsi = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: config.google_client_id,
            callback: async (response: { credential: string }) => {
              if (response.credential) {
                setInternalLoading(true);
                try {
                  await loginWithCredential(response.credential);
                  onSuccess?.();
                } catch (err) {
                  console.error('Credential login error:', err);
                } finally {
                  setInternalLoading(false);
                }
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          // Also render hidden button if needed for programmatic click
          if (hiddenBtnRef.current) {
            window.google.accounts.id.renderButton(hiddenBtnRef.current, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
            });
          }

          setScriptReady(true);
        } catch (e) {
          console.warn('Google GSI init warning:', e);
        }
      } else {
        setTimeout(checkGsi, 300);
      }
    };

    checkGsi();
  }, [config, loginWithCredential, onSuccess]);

  const handleClick = () => {
    if (internalLoading || isLoading) return;

    // Option A: If GIS script is ready, trigger Google One Tap / prompt
    if (scriptReady && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback to OAuth redirect URL if One Tap was suppressed or dismissed
            redirectToGoogle();
          }
        });
        return;
      } catch (err) {
        console.warn('GIS prompt error, falling back to redirect:', err);
      }
    }

    // Option B: Direct OAuth URL redirect
    redirectToGoogle();
  };

  const redirectToGoogle = () => {
    const clientId =
      config?.google_client_id ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID) ||
      '666611753013-cp94eclg8ts7i1ddlqq9eijlnqbc9qgl.apps.googleusercontent.com';
    const redirectPath =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_REDIRECT_PATH) ||
      '/api/auth/callback/google';
    const redirectUri = encodeURIComponent(window.location.origin + redirectPath);
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=consent`;
    window.location.href = authUrl;
  };

  const isBusy = isLoading || internalLoading;

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-xs gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2.5',
  }[size];

  return (
    <div className="inline-flex flex-col items-center">
      <button
        id="google-login-button"
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        className={`group relative inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 cursor-pointer shadow-sm hover:shadow active:scale-[0.98] ${sizeStyles} ${className}`}
        style={{
          backgroundColor: 'var(--panel)',
          border: '1px solid var(--bd)',
          color: 'var(--ink)',
        }}
        title="Sign in with Google to access personalized patient records"
        aria-label={label}
      >
        {isBusy ? (
          <Loader2 size={16} className="animate-spin" style={{ color: 'var(--acc)' }} />
        ) : (
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span className="font-semibold tracking-tight">{isBusy ? 'Connecting...' : label}</span>
      </button>

      {/* Hidden element for Google GIS native button mount */}
      <div ref={hiddenBtnRef} className="hidden" aria-hidden="true" />

      {error && (
        <div className="flex items-center gap-1 mt-1 text-[11px] text-red-500 font-mono">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
