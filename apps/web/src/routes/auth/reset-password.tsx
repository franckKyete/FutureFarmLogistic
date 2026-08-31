import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { resetPasswordMutation } from '@/features/auth/api/auth.queries';

export const Route = createFileRoute('/auth/reset-password')({
  validateSearch: (search: Record<string, unknown>): { token?: string } => {
    const res: { token?: string } = {};
    if (typeof search['token'] === 'string' && search['token']) {
      res.token = search['token'];
    }
    return res;
  },
  component: ResetPasswordPage,
});

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');

  const {
    mutate: resetPassword,
    isPending,
    isSuccess,
    error,
  } = useMutation({
    ...resetPasswordMutation(),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError('');

    if (!token) {
      setValidationError('Jeton de réinitialisation manquant.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setValidationError('Le mot de passe doit comporter au moins 8 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError('Les mots de passe ne correspondent pas.');
      return;
    }

    resetPassword({ token, newPassword });
  };

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
            Définition du nouveau mot de passe
          </p>
        </header>

        {/* Card */}
        <section className="bg-surface-container-lowest rounded-2xl border border-[#c0c9be] p-8 flex flex-col gap-6 shadow-sm transition-all">
          {!token ? (
            <div className="flex flex-col items-center text-center gap-4 py-2">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                <span className="material-symbols-outlined text-4xl">link_off</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-bold text-on-surface tracking-tight">
                  Lien invalide ou expiré
                </h2>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Le lien de réinitialisation est incomplet ou ne contient pas de jeton de sécurité valide.
                </p>
              </div>

              <div className="w-full flex flex-col gap-3 mt-2">
                <Link
                  to="/auth/forgot-password"
                  className="w-full bg-[#004322] text-on-primary font-semibold text-sm py-3 rounded-lg text-center hover:opacity-95 transition-all flex items-center justify-center gap-2"
                >
                  Demander un nouveau lien
                </Link>
                <Link
                  to="/auth/login"
                  className="w-full border border-outline-variant bg-surface text-on-surface font-semibold text-xs py-3 rounded-lg text-center hover:bg-surface-container-low transition-all"
                >
                  Retour à la connexion
                </Link>
              </div>
            </div>
          ) : isSuccess ? (
            <div className="flex flex-col items-center text-center gap-4 py-2">
              <div className="w-16 h-16 rounded-full bg-[#004322]/10 flex items-center justify-center text-[#004322]">
                <span
                  className="material-symbols-outlined text-4xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-bold text-on-surface tracking-tight">
                  Mot de passe mis à jour !
                </h2>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter avec vos nouveaux identifiants.
                </p>
              </div>

              <div className="w-full flex flex-col gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => void navigate({ to: '/auth/login' })}
                  className="w-full bg-[#004322] text-on-primary font-semibold text-sm py-3.5 rounded-lg text-center hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Se connecter
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-on-surface tracking-tight">
                  Nouveau mot de passe
                </h2>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Veuillez saisir votre nouveau mot de passe sécurisé (8 caractères minimum).
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* New Password Field */}
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-semibold text-on-surface-variant px-1"
                    htmlFor="newPassword"
                  >
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                      lock
                    </span>
                    <input
                      className="w-full bg-surface-bright border border-outline-variant rounded-lg py-3 pl-10 pr-12 text-sm focus:outline-none focus:border-[#004322] focus:ring-2 focus:ring-[#eae2de]/80 transition-all placeholder:text-outline/40"
                      id="newPassword"
                      name="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      type={showPassword ? 'text' : 'password'}
                      minLength={8}
                      required
                      autoFocus
                    />
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-[#004322] transition-colors cursor-pointer"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-semibold text-on-surface-variant px-1"
                    htmlFor="confirmPassword"
                  >
                    Confirmer le nouveau mot de passe
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                      lock_reset
                    </span>
                    <input
                      className="w-full bg-surface-bright border border-outline-variant rounded-lg py-3 pl-10 pr-12 text-sm focus:outline-none focus:border-[#004322] focus:ring-2 focus:ring-[#eae2de]/80 transition-all placeholder:text-outline/40"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      type={showPassword ? 'text' : 'password'}
                      minLength={8}
                      required
                    />
                  </div>
                </div>

                {validationError && (
                  <div className="rounded-lg bg-error-container border border-error px-4 py-3 text-xs text-on-error-container">
                    {validationError}
                  </div>
                )}

                {error && (
                  <div className="rounded-lg bg-error-container border border-error px-4 py-3 text-xs text-on-error-container">
                    {error instanceof Error ? error.message : 'Une erreur est survenue lors de la réinitialisation.'}
                  </div>
                )}

                {/* Primary Action */}
                <button
                  className="w-full bg-[#004322] text-on-primary font-semibold text-sm py-3.5 rounded-lg active:scale-[0.98] hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={isPending || !newPassword || !confirmPassword}
                >
                  {isPending ? 'Mise à jour en cours...' : 'Changer le mot de passe'}
                  <span className="material-symbols-outlined text-[18px]">check</span>
                </button>
              </form>
            </>
          )}
        </section>

        {/* Footer Link */}
        <footer className="text-center flex flex-col gap-2">
          <Link
            to="/auth/login"
            className="text-xs text-[#004322] font-semibold hover:underline inline-flex items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Retour à la page de connexion
          </Link>
        </footer>
      </main>
    </div>
  );
}
