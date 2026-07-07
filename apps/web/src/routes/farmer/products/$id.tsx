import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';

export const Route = createFileRoute('/farmer/products/$id')({
  component: ProductDetailPage,
});

const PHOTOS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuD05xBJ-cC-oQIPCGfi0xv1iBSAx0Zp4HIIfOXYbNptZrNerKVfzUp8yKiGDrssrn4n4ADie--apk-zwB5z58SjK138NytMSElb4pEw94QoY5lv5JMJ4xUEF0JeTGPJDviYJTbdtegqY9olOGagQ58dvukTMCD5HAeWCT7B2LvYl8BBGsZl0IP7YDCnIrsrm7ko2bbkWVODBN3UoQbIwtJcbvwMAMHUuLTtzzDeL5A4N00aO2g7PiEOsM9c2RKcCSx_lzIn0tzfwAc',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCgwjttNUQWYMhvVAoVo5P9oAtrDLgtcMBy_yTvuseOgmlnP1f0y79ytW9NA8wOgBq-MQoSrzzbqGpps_z_wu-nMLPZf4l9eolZfI5Kx235MZK8slgKmVGL70pxXLwMHb1TE-HJC8r97yo9oqXw91E41iC6paDb-He5SZmrKnszNAomkr0uhz-GZpHtZczHG1583588WJ9z3-suETNy7oRlNCzn1F4NjKI5aFiUe2go37PI-O_C15KGn_-8W_1SBFPu7qsJtMy9GqU',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAQuEG4g-eAZQy-DqPGe_O1-cMvf7sJ-nK3L_RKz3--GAxWDfmJzF8FG5f4RNqMADOTrz1WbE9b3ieOdfiQD9xF2vFjMwr-l_ICUa20_ueHpFGlugP71lISZlfvlaMX--Ai2d8Y7WhL7ISqPKIvgghpdLFalMlt4bc6o5BjAV3x2Pn6yOr2MTIHjXJfnX--W3x0VoBRGzpkb9O3cr2pe_BRaHFqBZmbBodwFclDsiF2FagtAj1pQF54EVdNw3wPZoN9tETAEDukkes',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB-Kofqhfn6ImgaUTptQqJSzm4oLwtMkHGr8hZzsGGYmVA-xL9RnvI8bJmuZuydmlZ_3UKCQDYSQdvvJAEnM1bRcUwXUaNY9BYK0iirndiM6K4nsXdt-YefVh_TNuf1rZXhNshnNlNPY7ZDsxOA_w5Ah6Ns8TSWvQozuieAZ3c8P6K85Ap7WNM40z8_0pZIVQ7Isp030ae7WyZuOS6TZDfUU9SEPqUzfPfJwZkjRKO7pdXpOoVlpECr9OQXJrhw2fmxLxEzokzP44g',
];

function ProductDetailPage() {
  const navigate = useNavigate();
  const { id } = Route.useParams();

  // Interactive gallery state
  const [activePhoto, setActivePhoto] = useState(PHOTOS[0]);

  // Product status state
  const [isActive, setIsActive] = useState(true);

  // IA Score Gauge animation state
  const [gaugeScore, setGaugeScore] = useState(0);
  const targetScore = 94;

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      if (current >= targetScore) {
        clearInterval(interval);
      } else {
        current += 2;
        if (current > targetScore) current = targetScore;
        setGaugeScore(current);
      }
    }, 15);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshScore = () => {
    setGaugeScore(0);
    let current = 0;
    const interval = setInterval(() => {
      if (current >= targetScore) {
        clearInterval(interval);
      } else {
        current += 2;
        if (current > targetScore) current = targetScore;
        setGaugeScore(current);
      }
    }, 15);
  };

  return (
    <div className="bg-surface font-sans text-on-surface min-h-screen pb-24 relative">
      {/* TopNavBar */}
      <header className="h-[56px] fixed top-0 left-0 right-0 bg-white border-b border-outline-variant flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => void navigate({ to: '/farmer/stock' })}
            className="text-on-surface-variant cursor-pointer p-1 hover:bg-surface-container-low rounded-full"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-display text-base font-bold text-on-surface">Détails Produit</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => alert(`Product ID: ${id}`)}
            className="text-on-surface-variant cursor-pointer p-1 hover:bg-surface-container-low rounded-full"
          >
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="mt-[56px] p-4 flex flex-col gap-4 max-w-[480px] mx-auto">
        {/* Header Section */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-on-surface">Tomates Grappe Bio</h2>
            <span
              className={`px-3 py-1 font-bold text-xs rounded-full flex items-center gap-1 transition-all ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'bg-outline-variant/30 text-on-surface-variant'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-primary animate-pulse' : 'bg-outline'}`}></span>
              {isActive ? 'Actif' : 'Archivé'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => alert('Modification du produit')}
              className="flex-1 py-2.5 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm cursor-pointer hover:opacity-95"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
              Modifier
            </button>
            <button
              onClick={() => setIsActive(!isActive)}
              className="flex-1 py-2.5 border border-error text-error font-bold rounded-xl flex items-center justify-center gap-2 text-sm cursor-pointer hover:bg-error-container/10"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isActive ? 'archive' : 'unarchive'}
              </span>
              {isActive ? 'Archiver' : 'Activer'}
            </button>
          </div>
        </div>

        {/* Photos Section */}
        <section className="bg-white rounded-xl border border-outline-variant p-4 overflow-hidden shadow-sm">
          <div className="relative h-[240px] w-full rounded-lg overflow-hidden mb-4 border border-outline-variant/30">
            <img className="w-full h-full object-cover" alt="Hero product" src={activePhoto} />
            <div className="absolute bottom-4 left-4 flex gap-2">
              <span className="bg-white/95 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-primary flex items-center gap-1 shadow-sm">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                Certifié Bio
              </span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {PHOTOS.map((photoUrl, idx) => {
              const isSelected = photoUrl === activePhoto;
              return (
                <button
                  key={idx}
                  onClick={() => setActivePhoto(photoUrl)}
                  className={`h-16 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                    isSelected ? 'border-primary border-2 scale-105 shadow-sm' : 'border-outline-variant/50 opacity-80 hover:opacity-100'
                  }`}
                >
                  <img className="w-full h-full object-cover" alt={`Miniature ${idx + 1}`} src={photoUrl} />
                </button>
              );
            })}
            <button
              onClick={() => alert('Ajouter une photo')}
              className="h-16 rounded-lg border-2 border-dashed border-outline-variant/60 flex items-center justify-center bg-surface-container-low cursor-pointer hover:bg-surface-container transition-all text-primary"
            >
              <span className="material-symbols-outlined">add_a_photo</span>
            </button>
          </div>
        </section>

        {/* Quality Score IA Section */}
        <section className="bg-primary text-white rounded-xl p-4 relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold mb-1">Analyse IA de Qualité</h3>
              <p className="text-primary-fixed/80 text-xs font-semibold">Diagnostic temps réel</p>
            </div>
            <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-xs font-semibold">Frais</span>
          </div>

          <div className="flex items-center gap-6 mb-4">
            {/* Custom Circular Gauge in React */}
            <div
              className="relative w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: `conic-gradient(#aef2be ${gaugeScore * 3.6}deg, rgba(255, 255, 255, 0.15) 0)`,
              }}
            >
              <div className="w-[68px] h-[68px] rounded-full bg-primary flex items-center justify-center">
                <span className="text-lg font-black text-white">{gaugeScore}%</span>
              </div>
            </div>
            <div className="flex-1">
              <ul className="flex flex-col gap-1.5">
                <li className="flex items-center gap-2 text-xs font-semibold">
                  <span className="material-symbols-outlined text-[18px] text-[#aef2be]">check_circle</span>
                  Aucun défaut
                </li>
                <li className="flex items-center gap-2 text-xs font-semibold">
                  <span className="material-symbols-outlined text-[18px] text-white/70">schedule</span>
                  Mise à jour : 08:42
                </li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleRefreshScore}
            className="w-full py-2 bg-white/10 hover:bg-white/20 active:scale-95 transition-all rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border border-white/15"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Relancer le scan
          </button>
        </section>

        {/* Product Info Section */}
        <section className="bg-white rounded-xl border border-outline-variant p-4 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-surface-variant text-primary rounded-full text-xs font-semibold">Maraîchage</span>
            <span className="px-3 py-1 bg-surface-container text-tertiary rounded-full text-xs font-semibold">Grappe</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Description du produit</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Nos tomates grappes Bio sont cultivées selon des méthodes traditionnelles respectueuses de l'environnement au cœur de la vallée. Récoltées à pleine maturité, elles offrent un goût sucré et une texture ferme idéale pour vos étals. Aucun pesticide de synthèse utilisé, traitement naturel uniquement.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-outline-variant/30 pt-4">
            <div>
              <h4 className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-2">Méthodes &amp; Certifications</h4>
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#E6F3EA] text-[#1A5C35] rounded-lg border border-[#1A5C35]/20 text-xs font-bold">
                  <span className="material-symbols-outlined text-[16px]">eco</span>
                  Bio
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FFF9E6] text-[#885200] rounded-lg border border-[#885200]/20 text-xs font-bold">
                  <span className="material-symbols-outlined text-[16px]">verified_user</span>
                  HVE
                </span>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-2">Dates clés</h4>
              <div className="flex flex-col gap-1 text-xs">
                <p className="text-on-surface-variant">Récolte : <span className="font-bold text-on-surface">12 Mai 2024</span></p>
                <p className="text-on-surface-variant">Expiration : <span className="font-bold text-on-surface">26 Mai 2024</span></p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-surface-container-low rounded-lg border border-outline-variant/40">
            <span className="material-symbols-outlined text-secondary">location_on</span>
            <p className="text-xs font-medium text-on-surface">
              Disponible à : <span className="font-bold text-primary">Silo Nord - Plateforme de Distribution 4</span>
            </p>
          </div>
        </section>

        {/* Stock & Price Section */}
        <section className="bg-white rounded-xl border border-outline-variant p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Stock &amp; Historique</h3>
            <span className="px-3 py-1 bg-secondary-fixed text-on-secondary-fixed font-bold text-[10px] rounded-full">Prix fixe</span>
          </div>

          {/* Cumulative Stock Header */}
          <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40">
            <span className="text-[10px] text-on-surface-variant uppercase font-bold">Stock total cumulé disponible</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-primary">840 kg</span>
              <span className="text-xs text-on-surface-variant">/ 1200 kg total</span>
            </div>
            <div className="w-full h-2.5 bg-surface-variant rounded-full overflow-hidden mt-3">
              <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: '70%' }}></div>
            </div>
          </div>

          {/* Quality Score Evolution Chart */}
          <div>
            <h4 className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-4">Évolution Qualité (Score IA)</h4>
            <div className="h-24 w-full flex items-end gap-2 px-2 border-b border-outline-variant/30">
              <div className="flex-1 bg-primary/20 rounded-t-lg relative group h-[85%] cursor-pointer hover:bg-primary/30 transition-colors">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">85%</div>
              </div>
              <div className="flex-1 bg-primary/30 rounded-t-lg relative group h-[88%] cursor-pointer hover:bg-primary/45 transition-colors">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">88%</div>
              </div>
              <div className="flex-1 bg-primary/50 rounded-t-lg relative group h-[92%] cursor-pointer hover:bg-primary/70 transition-colors">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">92%</div>
              </div>
              <div className="flex-1 bg-primary rounded-t-lg relative group h-[94%] cursor-pointer hover:bg-primary/90 transition-colors">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary">94%</div>
              </div>
            </div>
            <div className="flex justify-between mt-2 px-2 text-[10px] text-on-surface-variant font-bold">
              <span>Fév</span>
              <span>Mar</span>
              <span>Avr</span>
              <span>Mai</span>
            </div>
          </div>

          {/* Vertical Monthly Timeline */}
          <div className="space-y-6 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant/50 pt-2">
            {/* Current Month */}
            <div className="relative pl-10">
              <div className="absolute left-0 top-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center z-10 border-4 border-white">
                <span className="material-symbols-outlined text-white text-[16px]">calendar_today</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-bold text-on-surface text-xs">Mai 2024</h4>
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-bold rounded-full">Ce mois</span>
              </div>
              <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-3 rounded-lg border border-primary/20 text-xs">
                <div>
                  <p className="text-[9px] text-on-surface-variant uppercase font-semibold">Stock ajouté</p>
                  <p className="font-bold text-primary">+450 kg</p>
                </div>
                <div>
                  <p className="text-[9px] text-on-surface-variant uppercase font-semibold">Score moyen</p>
                  <p className="font-bold text-primary">94%</p>
                </div>
                <div>
                  <p className="text-[9px] text-on-surface-variant uppercase font-semibold">Prix moyen</p>
                  <p className="font-bold text-primary">3,45€/kg</p>
                </div>
                <div>
                  <p className="text-[9px] text-on-surface-variant uppercase font-semibold">Récoltes</p>
                  <p className="font-bold text-primary">12</p>
                </div>
              </div>
            </div>

            {/* Previous Month */}
            <div className="relative pl-10">
              <div className="absolute left-0 top-1 w-8 h-8 bg-outline-variant rounded-full flex items-center justify-center z-10 border-4 border-white">
                <span className="material-symbols-outlined text-on-surface-variant text-[16px]">history</span>
              </div>
              <h4 className="font-bold text-on-surface-variant text-xs mb-2">Avril 2024</h4>
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-outline-variant/40 opacity-70 text-xs">
                <div>
                  <p className="text-[9px] text-on-surface-variant uppercase font-semibold">Stock ajouté</p>
                  <p className="font-bold">+380 kg</p>
                </div>
                <div>
                  <p className="text-[9px] text-on-surface-variant uppercase font-semibold">Score moyen</p>
                  <p className="font-bold">92%</p>
                </div>
                <div>
                  <p className="text-[9px] text-on-surface-variant uppercase font-semibold">Prix moyen</p>
                  <p className="font-bold">3,20€/kg</p>
                </div>
                <div>
                  <p className="text-[9px] text-on-surface-variant uppercase font-semibold">Récoltes</p>
                  <p className="font-bold">10</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-outline-variant h-[64px] flex items-center justify-around px-4 z-50">
        <Link
          to="/farmer/stock"
          className="flex flex-col items-center gap-1 text-primary cursor-pointer"
        >
          <span className="material-symbols-outlined">agriculture</span>
          <span className="text-[10px] font-bold">Récoltes</span>
        </Link>
        <Link
          to="/farmer/harvests/analyze"
          className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary cursor-pointer"
        >
          <span className="material-symbols-outlined">gavel</span>
          <span className="text-[10px]">Enchères</span>
        </Link>
        <Link
          to="/farmer/orders"
          className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary cursor-pointer"
        >
          <span className="material-symbols-outlined">shopping_cart</span>
          <span className="text-[10px]">Commandes</span>
        </Link>
        <Link
          to="/farmer/onboarding"
          className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary cursor-pointer"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px]">Profil</span>
        </Link>
      </nav>
    </div>
  );
}
