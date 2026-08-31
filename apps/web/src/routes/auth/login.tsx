import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { loginMutation, authenticate2faMutation } from '@/features/auth/api/auth.queries';
import { setAuth } from '@/features/auth/store/auth.store';

export const Route = createFileRoute('/auth/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const res: { redirect?: string } = {};
    if (typeof search['redirect'] === 'string' && search['redirect']) {
      res.redirect = search['redirect'];
    }
    return res;
  },
  component: LoginPage,
});

export function LoginPage() {
  const navigate = useNavigate();
  const { redirect: redirectPath } = Route.useSearch();
  const [showPassword, setShowPassword] = useState(false);

  // 2FA state
  const [twoFactorTempToken, setTwoFactorTempToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  // Primary login mutation
  const {
    mutate: login,
    isPending: isLoginPending,
    error: loginError,
  } = useMutation({
    ...loginMutation(),
    onSuccess: (data) => {
      if (data.require2fa) {
        setTwoFactorTempToken(data.tempToken);
        setTwoFactorCode('');
      } else {
        setAuth(data.user, data.tokens);
        void navigate({ to: redirectPath || '/' });
      }
    },
  });

  // 2FA verification mutation
  const {
    mutate: verify2fa,
    isPending: is2faPending,
    error: twoFactorError,
  } = useMutation({
    ...authenticate2faMutation(),
    onSuccess: (data) => {
      setAuth(data.user, data.tokens);
      void navigate({ to: redirectPath || '/' });
    },
  });

  const handleLoginSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    login({
      email: form.get('email') as string,
      password: form.get('password') as string,
    });
  };

  const handle2faSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!twoFactorTempToken || !twoFactorCode) return;
    verify2fa({
      tempToken: twoFactorTempToken,
      code: twoFactorCode.trim(),
    });
  };

  const isPending = isLoginPending || is2faPending;
  const activeError = twoFactorTempToken ? twoFactorError : loginError;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative px-4 py-8 bg-[#f8f9ff]">
      {/* Background Pattern */}
      <div className="fixed inset-0 z-[-1] opacity-20 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(#707970 0.5px, transparent 0.5px)',
            backgroundSize: '24px 24px',
          }}
        ></div>
      </div>

      {/* Main Container */}
      <main className="w-full max-w-[480px] flex flex-col gap-6">
        {/* Header / Logo */}
        <header className="text-center">
          <Link to="/" className="inline-block">
            <h1 className="font-display text-4xl font-semibold text-[#004322] mb-2 tracking-tight">
              Future Farm
            </h1>
          </Link>
          <p className="font-body-md text-on-surface-variant text-sm">
            Plateforme agricole &amp; logistique de précision.
          </p>
        </header>

        {/* Login Card */}
        <section className="bg-surface-container-lowest rounded-2xl border border-[#c0c9be] p-8 flex flex-col gap-6 shadow-sm transition-all">
          {twoFactorTempToken ? (
            /* 2FA Challenge View */
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <div className="w-12 h-12 rounded-full bg-[#004322]/10 flex items-center justify-center text-[#004322] mb-1">
                  <span className="material-symbols-outlined text-2xl">verified_user</span>
                </div>
                <h2 className="text-2xl font-bold text-on-surface tracking-tight">
                  Authentification à deux facteurs
                </h2>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Entrez le code à 6 chiffres généré par votre application d'authentification.
                </p>
              </div>

              <form onSubmit={handle2faSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-semibold text-on-surface-variant px-1"
                    htmlFor="twoFactorCode"
                  >
                    Code de sécurité (6 chiffres)
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                      pin
                    </span>
                    <input
                      className="w-full bg-surface-bright border border-outline-variant rounded-lg py-3 pl-10 pr-4 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-[#004322] focus:ring-2 focus:ring-[#eae2de]/80 transition-all placeholder:text-outline/40"
                      id="twoFactorCode"
                      name="twoFactorCode"
                      placeholder="123456"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {activeError && (
                  <div className="rounded-lg bg-error-container border border-error px-4 py-3 text-xs text-on-error-container">
                    {activeError instanceof Error ? activeError.message : 'Code invalide.'}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    className="w-full bg-[#004322] text-on-primary font-semibold text-sm py-3.5 rounded-lg active:scale-[0.98] hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    type="submit"
                    disabled={isPending || twoFactorCode.trim().length !== 6}
                  >
                    {is2faPending ? 'Vérification...' : 'Valider le code'}
                    <span className="material-symbols-outlined text-[18px]">check</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorTempToken(null);
                      setTwoFactorCode('');
                    }}
                    className="w-full border border-outline-variant bg-surface text-on-surface font-semibold text-xs py-2.5 rounded-lg hover:bg-surface-container-low transition-all cursor-pointer"
                  >
                    Annuler et revenir à la connexion
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Standard Login Form */
            <>
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-on-surface tracking-tight">Bienvenue</h2>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-tertiary-fixed text-on-tertiary-fixed rounded-full text-[10px] font-bold tracking-wider uppercase">
                    <span className="material-symbols-outlined text-[14px]">agriculture</span>
                    Agri-Fintech
                  </span>
                  <p className="text-[10px] text-on-surface-variant">Accédez à votre espace sécurisé</p>
                </div>
              </div>

              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-5">
                {/* Email Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant px-1" htmlFor="email">
                    Adresse Email
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                      mail
                    </span>
                    <input
                      className="w-full bg-surface-bright border border-outline-variant rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-[#004322] focus:ring-2 focus:ring-[#eae2de]/80 transition-all placeholder:text-outline/40"
                      id="email"
                      name="email"
                      placeholder="agriculteur@futurefarm.com"
                      type="email"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-xs font-semibold text-on-surface-variant" htmlFor="password">
                      Mot de passe
                    </label>
                    <Link
                      to="/auth/forgot-password"
                      className="text-xs font-semibold text-[#004322] hover:underline"
                    >
                      Mot de passe oublié ?
                    </Link>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                      lock
                    </span>
                    <input
                      className="w-full bg-surface-bright border border-outline-variant rounded-lg py-3 pl-10 pr-12 text-sm focus:outline-none focus:border-[#004322] focus:ring-2 focus:ring-[#eae2de]/80 transition-all placeholder:text-outline/40"
                      id="password"
                      name="password"
                      placeholder="••••••••"
                      type={showPassword ? 'text' : 'password'}
                      required
                    />
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-[#004322] transition-colors cursor-pointer"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {activeError && (
                  <div className="rounded-lg bg-error-container border border-error px-4 py-3 text-xs text-on-error-container">
                    {activeError instanceof Error ? activeError.message : 'Identifiants invalides.'}
                  </div>
                )}

                {/* Primary Action */}
                <button
                  className="w-full bg-[#004322] text-on-primary font-semibold text-sm py-3.5 rounded-lg active:scale-[0.98] hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={isPending}
                >
                  {isLoginPending ? 'Connexion en cours...' : 'Se connecter'}
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </form>
            </>
          )}
        </section>

        {/* Footer Links */}
        <footer className="text-center flex flex-col gap-4">
          <p className="text-xs text-on-surface-variant">
            Pas encore de compte ?{' '}
            <Link className="text-[#004322] font-bold hover:underline" to="/auth/register">
              Créer un compte
            </Link>
          </p>
          <div className="flex justify-center gap-6 text-[10px] text-outline">
            <span>FutureFarm Platform © 2026</span>
            <span>·</span>
            <span>Sécurité &amp; Confidentialité</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
