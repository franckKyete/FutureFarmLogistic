import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/auth/unauthorized')({
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  return (
    <div className="min-h-[75vh] w-full flex flex-col items-center justify-center px-4 text-center">
      {/* Background Dots */}
      <div className="fixed inset-0 z-[-1] opacity-10 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(#707970 0.5px, transparent 0.5px)',
            backgroundSize: '24px 24px',
          }}
        ></div>
      </div>

      <div className="max-w-md bg-white border border-outline-variant/40 rounded-2xl p-8 shadow-sm flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center text-error">
          <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 0" }}>
            gpp_bad
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Accès Non Autorisé</h1>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Vous n'avez pas les autorisations nécessaires pour accéder à cette page. 
            Si vous pensez qu'il s'agit d'une erreur, veuillez contacter l'administrateur de votre système.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
          <Link
            to="/"
            className="flex-1 bg-primary text-on-primary font-semibold text-sm py-3 rounded-lg hover:opacity-95 transition-all text-center flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">home</span>
            Retour à l'accueil
          </Link>
          <Link
            to="/auth/login"
            className="flex-1 border border-outline-variant text-on-surface-variant font-semibold text-sm py-3 rounded-lg hover:bg-surface-container-low transition-all text-center flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            Se déconnecter / Login
          </Link>
        </div>
      </div>
    </div>
  );
}
