import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { forgotPasswordMutation } from '@/features/auth/api/auth.queries';

export const Route = createFileRoute('/auth/forgot-password')({
  component: ForgotPasswordPage,
});

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    mutate: sendResetEmail,
    isPending,
    isSuccess,
    error,
    reset,
  } = useMutation({
    ...forgotPasswordMutation(),
    onSuccess: () => {
      setSubmittedEmail(email);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) return;
    sendResetEmail({ email });
  };

  const handleResend = () => {
    reset();
    sendResetEmail({ email: submittedEmail });
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
            Récupération de compte sécurisée
          </p>
        </header>

        {/* Card */}
        <section className="bg-surface-container-lowest rounded-2xl border border-[#c0c9be] p-8 flex flex-col gap-6 shadow-sm transition-all">
          {isSuccess ? (
            <div className="flex flex-col items-center text-center gap-4 py-2">
              <div className="w-16 h-16 rounded-full bg-[#004322]/10 flex items-center justify-center text-[#004322]">
                <span
                  className="material-symbols-outlined text-4xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  mark_email_read
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-bold text-on-surface tracking-tight">
                  Email envoyé !
                </h2>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Si un compte est associé à{' '}
                  <strong className="text-on-surface">{submittedEmail}</strong>,
                  vous recevrez un lien de réinitialisation d'ici quelques instants.
                </p>
              </div>

              <div className="w-full flex flex-col gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isPending}
                  className="w-full border border-outline-variant bg-surface text-on-surface font-semibold text-xs py-3 rounded-lg hover:bg-surface-container-low transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPending ? 'Envoi en cours...' : 'Renvoyer le lien'}
                </button>

                <Link
                  to="/auth/login"
                  className="w-full bg-[#004322] text-on-primary font-semibold text-sm py-3 rounded-lg text-center hover:opacity-95 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  Retour à la connexion
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-on-surface tracking-tight">
                  Mot de passe oublié ?
                </h2>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Entrez votre adresse email ci-dessous. Nous vous enverrons un lien sécurisé pour créer un nouveau mot de passe.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* Email Field */}
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-semibold text-on-surface-variant px-1"
                    htmlFor="email"
                  >
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
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre-email@futurefarm.com"
                      type="email"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-error-container border border-error px-4 py-3 text-xs text-on-error-container flex flex-col gap-1">
                    <span className="font-semibold">
                      {error instanceof Error
                        ? error.message
                        : "Impossible d'envoyer l'email. Veuillez réessayer."}
                    </span>
                    <span className="text-[11px] opacity-85">
                      Veuillez vérifier votre saisie ou cliquer ci-dessous pour réessayer.
                    </span>
                  </div>
                )}

                {/* Primary Action */}
                <button
                  className="w-full bg-[#004322] text-on-primary font-semibold text-sm py-3.5 rounded-lg active:scale-[0.98] hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={isPending || !email}
                >
                  {isPending
                    ? 'Envoi en cours...'
                    : error
                    ? "Réessayer l'envoi"
                    : 'Envoyer le lien de réinitialisation'}
                  <span className="material-symbols-outlined text-[18px]">
                    {error ? 'refresh' : 'send'}
                  </span>
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
