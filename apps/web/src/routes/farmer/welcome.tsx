import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/farmer/welcome')({
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
      <main className="w-full max-w-[580px] space-y-6">
        {/* Main Confirmation Card */}
        <div className="bg-surface-container-lowest rounded-xl p-8 flex flex-col items-center border border-outline-variant/30 shadow-sm">
          {/* Success Header */}
          <div className="w-16 h-16 bg-[#EAF3DE] rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[#2a6a42] text-[32px]">check</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-on-surface text-center mb-2">
            Bienvenue, Amadou ! 🌱
          </h1>
          <p className="font-sans text-sm text-on-surface-variant text-center mb-8">
            Votre compte a bien été créé. Voici où vous en êtes.
          </p>

          {/* Checklist Section */}
          <div className="w-full space-y-3 mb-8">
            {/* Item 1: Compte créé */}
            <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-outline-variant/30">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="font-sans text-sm text-on-surface">Compte créé</span>
              </div>
              <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">Complété</span>
            </div>

            {/* Item 2: Email vérifié */}
            <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-outline-variant/30">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                <span className="font-sans text-sm text-on-surface">Email vérifié</span>
              </div>
              <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">Complété</span>
            </div>

            {/* Item 3: Profil de la ferme */}
            <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-outline-variant/30">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary">pending</span>
                <span className="font-sans text-sm text-on-surface">Profil de la ferme soumis</span>
              </div>
              <span className="px-3 py-1 bg-secondary/10 text-secondary text-xs font-semibold rounded-full">En attente de validation</span>
            </div>

            {/* Item 4: Premier produit */}
            <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-outline-variant/30 opacity-60">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-outline">radio_button_unchecked</span>
                <span className="font-sans text-sm text-on-surface">Premier produit publié</span>
              </div>
              <span className="px-3 py-1 bg-outline-variant/20 text-on-surface-variant text-xs font-semibold rounded-full">Non commencé</span>
            </div>

            {/* Item 5: Coordonnées bancaires */}
            <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-outline-variant/30 opacity-60">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-outline">radio_button_unchecked</span>
                <span className="font-sans text-sm text-on-surface">Coordonnées bancaires</span>
              </div>
              <span className="px-3 py-1 bg-outline-variant/20 text-on-surface-variant text-xs font-semibold rounded-full">Non commencé</span>
            </div>
          </div>

          {/* Progress Bar Section */}
          <div className="w-full space-y-2 mb-8">
            <div className="flex justify-between items-end">
              <span className="text-xs font-semibold text-on-surface-variant">Progression du profil</span>
              <span className="text-xs font-bold text-primary">40% complété</span>
            </div>
            <div className="w-full h-2.5 bg-outline-variant/20 rounded-full overflow-hidden relative">
              <div className="h-full bg-primary-container w-[40%] rounded-full relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent bg-[length:200%_100%] animate-[shimmer_2s_infinite_linear]"></div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex flex-col gap-3">
            <Link
              to="/farmer/harvests/new"
              className="w-full py-4 bg-primary text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer text-center"
            >
              Publier mon premier produit
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
            <Link
              to="/farmer/onboarding"
              className="w-full py-4 border border-primary text-primary bg-transparent rounded-xl font-semibold hover:bg-primary/5 active:scale-[0.98] transition-all cursor-pointer text-center"
            >
              Compléter mon profil
            </Link>
            <Link
              to="/farmer/dashboard"
              className="w-full py-3 text-on-surface-variant font-semibold text-xs underline decoration-on-surface-variant/30 hover:text-on-surface transition-colors cursor-pointer text-center"
            >
              Accéder au tableau de bord
            </Link>
          </div>
        </div>

        {/* Validation Note Card */}
        <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-4 flex items-start gap-4">
          <span className="material-symbols-outlined text-secondary shrink-0">info</span>
          <p className="font-sans text-xs text-on-secondary-container leading-relaxed">
            Votre profil est en cours de validation par notre équipe. Vous recevrez une notification par email et SMS dès que vous pourrez commencer à vendre vos produits.
          </p>
        </div>

        {/* Atmospheric Image Decoration */}
        <div className="relative w-full h-32 overflow-hidden rounded-2xl opacity-40 grayscale border border-outline-variant/20">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10"></div>
          <div
            className="w-full h-full bg-cover bg-center"
            style={{
              backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuAytMp7TD-dtTkU3wlmcGTOKfL7q9pPCjFAlxu8-BcwV33MV8z6XmHtdn1Db_CHNwA3X1EJF8W6aPCvtWUBOWHoiFwz49yP5Dk0zESqYgU_x6C64MsZPLg6E6FMntD_rTi3lRVMULGj7WnKJq-tyWb4JTwFp-YNv8HmJhuiT5PMYxPZHKUgJ00nuqQcruaxgimIkvNTZKe-SHzjmLxAFMJgSIjxNQAZwINKZTLOpOCUp8Uqw9soZjmihK-X4irovIAm0dfEAUsDL00')`,
            }}
          ></div>
        </div>
      </main>
    </div>
  );
}
