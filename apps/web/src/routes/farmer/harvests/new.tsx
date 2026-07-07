import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/farmer/harvests/new')({
  component: NewHarvestPage,
});

type Strategy = 'fixed' | 'dutch' | 'negotiable';

function NewHarvestPage() {
  const navigate = useNavigate();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<'Tomates Grappe' | null>(null);

  // Photos state
  const [photos, setPhotos] = useState<string[]>([
    'https://lh3.googleusercontent.com/aida-public/AB6AXuD0a9SPBto_eYwZOdslIaHrAvYcfkC9VktsWpmH1nLmz-SA7keGg5OQPgqekhHf8vXPsbK9_L4WvaGJlYLTN66UDnS-IoPBVs53hCu3PaZe8JWHwlepLtPvRSEy1oei6tZlybscTJBkBapVZ7TF4aRwUY5rxqsEG7AUbb1EXqGJK_iRspI-KMCAyqSjYizH4RiVVV_64yDN1GZ5MmXRyDKgAAZi1AQYWzRv6I_8w_TlGbJclUVOvj54r_XiZj6CrjjESt7mRr35cfU',
  ]);

  // Form inputs
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('1200');
  const [harvestMonth, setHarvestMonth] = useState('2024-05');
  const [strategy, setStrategy] = useState<Strategy>('fixed');
  const [volumeDiscount, setVolumeDiscount] = useState(false);
  const [location, setLocation] = useState('Ferme du Soleil, Secteur 4');

  const addPhoto = () => {
    setPhotos([...photos, 'https://images.unsplash.com/photo-1590779033100-9f60705a2f3b?auto=format&fit=crop&q=80&w=300']);
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Récolte publiée avec succès !');
    void navigate({ to: '/farmer/dashboard' });
  };

  return (
    <div className="font-sans text-on-surface antialiased bg-background min-h-screen pb-32">
      {/* Top AppBar */}
      <header className="fixed top-0 w-full z-50 bg-white border-b border-outline-variant flex justify-between items-center h-16 px-4 max-w-[480px] left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => void navigate({ to: '/farmer/dashboard' })}
            className="material-symbols-outlined text-on-surface p-2 hover:bg-surface-container-low transition-colors rounded-full cursor-pointer"
          >
            arrow_back
          </button>
          <h1 className="font-display text-sm font-bold text-primary">Ajouter une récolte</h1>
        </div>
        <div className="w-8 h-8 rounded-full bg-surface-variant overflow-hidden border border-outline-variant">
          <img
            className="w-full h-full object-cover"
            alt="Mamadou Kone"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD4nRn8xBQctGBQxBWXZESrpzJcRIGXx_RW4Aj5aCebn6dPhkGCCu80e2LpTJMVyyg-Cz94T2Zq5xubrMEHBJj6sFU2_5wSAi24MbWUmrubZ8fW6HJzs0O8_ExImp0xOxB-5GYhR0JwFApcfQPxdX3MHGBAIW_KRNucXosGI6efOtW2jvA-qmbQ1ZMx9_gLwJoUag77WM5CVo3XxAOgKSyljUp3Nw1xzTAtpoe8fZKCtndndsV362DMTCek01NJ76tN5jd3AIL1Fls"
          />
        </div>
      </header>

      <main className="pt-20 max-w-[480px] mx-auto px-4 space-y-6">
        {/* Intro Section */}
        <section>
          <h2 className="font-display text-lg font-bold text-on-surface">Nouvelle récolte</h2>
          <p className="text-xs text-on-surface-variant">Nouvelle récolte ou produit déjà existant dans votre catalogue.</p>
        </section>

        {/* Search & Quick Selection */}
        <section className="space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline">search</span>
            </div>
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-sm"
              placeholder="Entrez le nom du produit..."
              type="text"
            />
            {/* Dropdown State Visualisation */}
            {showDropdown && (
              <div className="absolute top-full left-0 w-full mt-2 bg-white border border-outline-variant rounded-xl shadow-lg z-40 overflow-hidden">
                <div
                  onClick={() => {
                    setSelectedProduct('Tomates Grappe');
                    setSearchQuery('Tomates Grappe');
                    setShowDropdown(false);
                  }}
                  className="p-3 flex items-center gap-3 bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer border-b border-outline-variant"
                >
                  <div className="w-12 h-12 rounded-lg bg-surface-variant overflow-hidden flex-shrink-0">
                    <img
                      className="w-full h-full object-cover"
                      alt="Tomates Grappe"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuARRJ5JuMGs3g3jE_Ahm4YJ6mUMNnLpkHteGa6NyvwCea6MEMiaWerDEoXOyODr4Z78Jf33WB5hjyCiiMyLBSVxQvDmMalj61EzHuLuZHA1M2EfdFMgBXJmFkZSbVsJ0VH_kI3yF86lRSZIBOD1n-ai3JhFHrG_uZip5cbZCcKqQrsRsMG6mTWXyaRAJCaMv8d5ufw0sEOnhGcbuiUFB5VJzT4LspjDmQbXjuz0UDSUfkCQY3qu05f2JIw_nI7YUTKqO8-ExkhbQZc"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-on-surface">Tomates Grappe</div>
                    <div className="text-xs text-outline">Légumes</div>
                  </div>
                  <span className="material-symbols-outlined ml-auto text-primary">
                    {selectedProduct === 'Tomates Grappe' ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    setSearchQuery('');
                    setShowDropdown(false);
                  }}
                  className="w-full p-3 text-left text-xs font-semibold text-primary flex items-center gap-2 hover:bg-surface-container-low transition-colors"
                >
                  <span className="material-symbols-outlined">add_circle</span>
                  Nouveau produit
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Recognition Banners */}
        {selectedProduct === 'Tomates Grappe' && (
          <>
            <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl flex gap-3 items-start animate-fadeIn">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                info
              </span>
              <p className="text-xs text-primary leading-tight font-semibold">
                Produit reconnu — certains champs ont été pré-remplis automatiquement pour gagner du temps.
              </p>
            </div>
            <div className="bg-surface-container border border-outline-variant p-4 rounded-xl flex gap-3 items-start mt-4 animate-fadeIn">
              <span className="material-symbols-outlined text-primary">info</span>
              <p className="text-xs text-on-surface leading-tight font-semibold">
                Vous avez déjà ajouté des récoltes de ce produit en Octobre 2023 — Stock actuel : 320kg, Score moyen : 87%. Cette nouvelle récolte sera ajoutée au stock du mois.
              </p>
            </div>
          </>
        )}

        {/* Photos & AI Analysis */}
        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-on-surface">Photos de la récolte</h3>
            <span className="text-xs text-outline">{photos.length} / 8</span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {photos.map((photo, index) => (
              <div key={index} className="relative w-32 h-32 flex-shrink-0 rounded-xl overflow-hidden border-2 border-primary">
                <img className="w-full h-full object-cover" alt={`Photo ${index + 1}`} src={photo} />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 bg-white/80 rounded-full p-1 cursor-pointer hover:bg-white"
                >
                  <span className="material-symbols-outlined text-xs text-error font-bold">close</span>
                </button>
              </div>
            ))}
            {photos.length < 8 && (
              <button
                type="button"
                onClick={addPhoto}
                className="w-32 h-32 flex-shrink-0 rounded-xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center bg-white hover:bg-surface-container-lowest transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary text-3xl">add_a_photo</span>
                <span className="text-xs text-outline mt-1 font-semibold">Ajouter</span>
              </button>
            )}
          </div>

          {/* AI Analysis Result Card */}
          <div className="bg-white border border-outline-variant rounded-xl p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1A5C35] to-[#ffa93d] flex items-center justify-center p-0.5">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">92%</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs font-bold">Analyse IA</span>
                  <div className="flex gap-1 mt-0.5">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[9px] font-bold">Frais</span>
                    <span className="bg-secondary-container/10 text-secondary px-2 py-0.5 rounded-full text-[9px] font-bold">Grade A</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-3 bg-surface-container-low rounded-lg">
              <ul className="text-xs space-y-2">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                  <span>Maturité optimale détectée.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-secondary text-[18px]">warning</span>
                  <span>Légère meurtrissure sur 2 spécimens (négligeable).</span>
                </li>
              </ul>
            </div>
            <div className="border-t border-outline-variant pt-3">
              <p className="text-[10px] text-outline uppercase tracking-wider font-bold">Recommandation IA</p>
              <p className="text-xs text-on-surface mt-1 italic leading-relaxed">
                "La qualité exceptionnelle permet de viser le segment Premium. Score moyen recalculé : 89%. Prix suggéré ajusté de +5%."
              </p>
            </div>
          </div>
        </section>

        {/* Main Form */}
        <form onSubmit={handlePublish} className="space-y-6">
          {/* Read-only Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-outline">Catégorie</label>
              <div className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-xs text-on-surface-variant flex items-center justify-between">
                Légumes <span className="material-symbols-outlined text-sm">lock</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-outline">Unité</label>
              <div className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-xs text-on-surface-variant flex items-center justify-between">
                Kilogramme (kg) <span className="material-symbols-outlined text-sm">lock</span>
              </div>
            </div>
          </div>

          {/* Mandatory Inputs */}
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface">
                Quantité à ajouter ce mois <span className="text-error">*</span>
              </label>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-sm"
                placeholder="0.00"
                type="number"
                required
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <label className="text-xs font-semibold text-on-surface">
                  Prix de vente <span className="text-error">*</span>
                </label>
                <span className="text-xs text-primary font-bold">Moyen suggéré : 1 200 FCFA/kg</span>
              </div>
              <div className="relative">
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-sm"
                  placeholder="1 200"
                  type="number"
                  required
                />
                <span className="absolute right-4 inset-y-0 flex items-center text-outline text-xs font-semibold">
                  FCFA / kg
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface">
                Mois de récolte <span className="text-error">*</span>
              </label>
              <div className="relative">
                <input
                  value={harvestMonth}
                  onChange={(e) => setHarvestMonth(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-sm"
                  type="month"
                  required
                />
              </div>
            </div>
          </div>

          {/* Selling Strategy Chips */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-on-surface uppercase">Stratégie de vente</label>
            <div className="flex flex-wrap gap-2">
              {(['fixed', 'dutch', 'negotiable'] as Strategy[]).map((strat) => {
                const isActive = strategy === strat;
                const label =
                  strat === 'fixed'
                    ? 'Prix fixe'
                    : strat === 'dutch'
                      ? 'Enchère hollandaise'
                      : 'Négociable';
                return (
                  <button
                    key={strat}
                    type="button"
                    onClick={() => setStrategy(strat)}
                    className={`px-4 py-2 rounded-full border text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                      isActive
                        ? 'border-primary bg-primary text-white'
                        : 'border-outline-variant bg-white text-on-surface-variant hover:border-primary'
                    }`}
                  >
                    {isActive && (
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    )}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Fields / Toggles */}
          <div className="space-y-4 pt-4 border-t border-outline-variant">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold">Prix dégressif</div>
                <div className="text-xs text-outline">Réduction selon le volume commandé</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={volumeDiscount}
                  onChange={(e) => setVolumeDiscount(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-outline-variant/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface">Lieu de disponibilité</label>
              <div className="relative">
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface-variant focus:outline-none"
                  type="text"
                />
                <span className="absolute right-4 inset-y-0 flex items-center text-outline">
                  <span className="material-symbols-outlined">location_on</span>
                </span>
              </div>
            </div>
          </div>

          {/* Fixed Footer Bar */}
          <footer className="fixed bottom-0 w-full z-50 bg-white border-t border-outline-variant max-w-[480px] left-1/2 -translate-x-1/2 px-4 py-4">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => alert('Brouillon enregistré !')}
                className="flex-1 px-4 py-3 border border-primary text-primary font-bold rounded-xl active:scale-95 transition-all duration-150 cursor-pointer text-center"
              >
                Enregistrer brouillon
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-primary text-white font-bold rounded-xl active:scale-95 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
              >
                Publier la récolte
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </div>
          </footer>
        </form>
      </main>
    </div>
  );
}
