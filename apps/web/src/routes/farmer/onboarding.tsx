import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/farmer/onboarding')({
  component: OnboardingPage,
});

type ProductType = 'Céréales' | 'Fruits' | 'Légumes' | 'Lait' | 'Viande';
type Certification = 'Bio' | 'Équitable' | 'Label local';
type PaymentMethod = 'bank' | 'mobile_money';

function OnboardingPage() {
  const navigate = useNavigate();

  // Form states
  const [farmName, setFarmName] = useState('');
  const [description, setDescription] = useState('');
  const [yearCreated, setYearCreated] = useState('Choisir');
  const [surfaceArea, setSurfaceArea] = useState('');
  const [surfaceUnit, setSurfaceUnit] = useState('ha');
  const [address, setAddress] = useState('');
  const [deliveryRadius, setDeliveryRadius] = useState(50);
  const [altCollectPoint, setAltCollectPoint] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<ProductType[]>(['Fruits']);
  const [selectedCertifications, setSelectedCertifications] = useState<Certification[]>(['Bio']);
  const [startHarvest, setStartHarvest] = useState('Janvier');
  const [endHarvest, setEndHarvest] = useState('Décembre');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank');
  const [bankIban, setBankIban] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  const toggleProduct = (product: ProductType) => {
    if (selectedProducts.includes(product)) {
      setSelectedProducts(selectedProducts.filter((p) => p !== product));
    } else {
      setSelectedProducts([...selectedProducts, product]);
    }
  };

  const toggleCertification = (cert: Certification) => {
    if (selectedCertifications.includes(cert)) {
      setSelectedCertifications(selectedCertifications.filter((c) => c !== cert));
    } else {
      setSelectedCertifications([...selectedCertifications, cert]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate submission
    alert('Profil soumis avec succès !');
    void navigate({ to: '/farmer/welcome' });
  };

  return (
    <div className="bg-background text-on-surface min-h-screen pb-32">
      {/* Top Navigation Bar */}
      <header className="bg-surface-container-lowest w-full top-0 sticky border-b border-outline-variant flex items-center justify-between px-4 py-3 max-w-[480px] mx-auto z-50">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">agriculture</span>
          <span className="font-display text-lg font-bold text-primary">AgriTrade</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-on-surface-variant cursor-pointer active:scale-95">help_outline</span>
        </div>
      </header>

      {/* Progress & Header Title */}
      <div className="max-w-[480px] mx-auto px-4 pt-6 pb-2">
        <div className="mb-4">
          <div className="flex justify-between items-end mb-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Étape 2 sur 3</p>
            <p className="text-xs font-semibold text-on-surface-variant">66%</p>
          </div>
          <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-primary-container w-[66%] transition-all duration-700"></div>
          </div>
        </div>
        <h1 className="font-display text-xl font-bold text-on-surface mb-1">Profil de votre ferme</h1>
        <p className="text-xs text-on-surface-variant">Ces informations seront visibles par les acheteurs lors des enchères.</p>
      </div>

      {/* Main Content */}
      <main className="max-w-[480px] mx-auto px-4 flex flex-col gap-4 mt-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Section 1: Identité de la ferme */}
          <section className="bg-white rounded-xl border border-outline-variant p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-[20px]">id_card</span>
              <h2 className="font-display text-base font-semibold">Identité de la ferme</h2>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface-variant">Nom de la ferme *</label>
              <input
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="ex: Ferme des Horizons"
                type="text"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-on-surface-variant">Logo (Optionnel)</label>
                <div className="aspect-square w-full rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container hover:border-primary-container transition-colors group">
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">add_a_photo</span>
                  <p className="text-[10px] text-on-surface-variant mt-1 text-center">Format 1:1</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-on-surface-variant">Bannière (Optionnel)</label>
                <div className="aspect-video w-full rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container hover:border-primary-container transition-colors group">
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">image</span>
                  <p className="text-[10px] text-on-surface-variant mt-1 text-center">Format 16:9</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between">
                <label className="text-xs font-semibold text-on-surface-variant">Description</label>
                <span className="text-xs text-outline">{description.length} / 500</span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-sm resize-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Parlez-nous de votre histoire, de vos valeurs et de vos produits..."
                rows={3}
              ></textarea>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface-variant">Année de création</label>
                <select
                  value={yearCreated}
                  onChange={(e) => setYearCreated(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option>Choisir</option>
                  <option>2024</option>
                  <option>2023</option>
                  <option>2022</option>
                  <option>2021</option>
                  <option>2020</option>
                  <option>Avant 2020</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface-variant">Surface cultivée</label>
                <div className="flex overflow-hidden border border-outline-variant rounded-lg focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                  <input
                    value={surfaceArea}
                    onChange={(e) => setSurfaceArea(e.target.value)}
                    className="w-full border-none p-3 text-sm focus:ring-0 focus:outline-none"
                    placeholder="0"
                    type="number"
                  />
                  <select
                    value={surfaceUnit}
                    onChange={(e) => setSurfaceUnit(e.target.value)}
                    className="bg-surface-container border-none text-sm px-2 focus:ring-0 focus:outline-none"
                  >
                    <option>ha</option>
                    <option>m²</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Localisation */}
          <section className="bg-white rounded-xl border border-outline-variant p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-[20px]">distance</span>
              <h2 className="font-display text-base font-semibold">Localisation</h2>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface-variant">Adresse complète *</label>
              <div className="relative">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 pr-10 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Entrez votre adresse..."
                  type="text"
                  required
                />
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline cursor-pointer hover:text-primary">my_location</span>
              </div>
            </div>

            <div className="relative w-full h-40 rounded-xl overflow-hidden border border-outline-variant">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDxA49_957dICiZNw4eJpa9WFxImkvkhAJl_dKfOOgSRuKirDZvrhDIErCiVkiUOsTTQQlVoPBCAE0BsAzu4zehCBbA7Hj-Qs6sOhQdxPN5zKOPMCWux-2qg0cJBEYE-PjB3egt6PMyBeMZ9mpqohzd7lQjOx_GyWrgqmXO1Ajm4C7o23rZbyAU8Rd3ILneI8TNjl-5vEoabxnEtN3tYad2ghJHtkq58ZBCnQo1gJv3cAXYSQP4Jz8MO6AtUaBOzq-Q0HS1GzLfgAc')`,
                }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                <div className="bg-white px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm border border-outline-variant">
                  <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                  <span className="text-xs font-semibold text-on-surface">Coordonnées GPS activées</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-on-surface-variant">Zone de livraison</label>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {deliveryRadius} km
                </span>
              </div>
              <input
                className="w-full h-1.5 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary"
                max="300"
                min="5"
                type="range"
                value={deliveryRadius}
                onChange={(e) => setDeliveryRadius(Number(e.target.value))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface-variant">Point de collecte alternatif (Optionnel)</label>
              <input
                value={altCollectPoint}
                onChange={(e) => setAltCollectPoint(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="ex: Coopérative de l'Est"
                type="text"
              />
            </div>
          </section>

          {/* Section 3: Productions & Certifications */}
          <section className="bg-white rounded-xl border border-outline-variant p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-[20px]">potted_plant</span>
              <h2 className="font-display text-base font-semibold">Productions &amp; Certifications</h2>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-on-surface-variant">Types de produits *</label>
              <div className="flex flex-wrap gap-2">
                {(['Céréales', 'Fruits', 'Légumes', 'Lait', 'Viande'] as ProductType[]).map((product) => {
                  const isSelected = selectedProducts.includes(product);
                  return (
                    <button
                      key={product}
                      type="button"
                      onClick={() => toggleProduct(product)}
                      className={`px-4 py-2 rounded-full border text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary'
                      }`}
                    >
                      {product}
                      {isSelected && <span className="material-symbols-outlined text-sm">check</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-on-surface-variant">Certifications</label>
              <div className="flex flex-wrap gap-2">
                {(['Bio', 'Équitable', 'Label local'] as Certification[]).map((cert) => {
                  const isSelected = selectedCertifications.includes(cert);
                  return (
                    <button
                      key={cert}
                      type="button"
                      onClick={() => toggleCertification(cert)}
                      className={`px-4 py-2 rounded-full border text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary'
                      }`}
                    >
                      {cert}
                      {isSelected && <span className="material-symbols-outlined text-sm">check</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface-variant">Début récolte</label>
                <select
                  value={startHarvest}
                  onChange={(e) => setStartHarvest(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option>Janvier</option>
                  <option>Février</option>
                  <option>Mars</option>
                  <option>Avril</option>
                  <option>Mai</option>
                  <option>Juin</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface-variant">Fin récolte</label>
                <select
                  value={endHarvest}
                  onChange={(e) => setEndHarvest(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option>Octobre</option>
                  <option>Novembre</option>
                  <option>Décembre</option>
                </select>
              </div>
            </div>
          </section>

          {/* Section 4: Documents de vérification */}
          <section className="bg-white rounded-xl border border-outline-variant p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-[20px]">verified_user</span>
              <h2 className="font-display text-base font-semibold">Documents de vérification</h2>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-on-surface-variant">Pièce d'identité * (Recto-verso)</label>
              <div className="w-full py-6 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container transition-all">
                <span className="material-symbols-outlined text-on-surface-variant">upload_file</span>
                <p className="text-xs font-semibold text-on-surface-variant mt-1">Glisser un fichier PDF/JPG</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-on-surface-variant">Justificatif activité agricole</label>
                <span className="bg-secondary-fixed text-on-secondary-fixed-variant text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-tighter">Recommandé</span>
              </div>
              <div className="w-full py-4 rounded-xl border border-outline-variant bg-surface-container-lowest flex items-center px-4 gap-3 cursor-pointer hover:bg-surface-container-low transition-colors">
                <span className="material-symbols-outlined text-secondary">cloud_upload</span>
                <p className="text-xs font-semibold text-on-surface-variant">Télécharger le justificatif</p>
              </div>
            </div>

            <div className="flex flex-col gap-1 mt-2">
              <label className="text-xs font-semibold text-on-surface-variant">Coordonnées bancaires / Mobile Money *</label>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank')}
                    className={`flex-1 border p-3 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'bank'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-outline-variant text-on-surface-variant opacity-60'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">account_balance</span>
                    Banque / IBAN
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('mobile_money')}
                    className={`flex-1 border p-3 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'mobile_money'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-outline-variant text-on-surface-variant opacity-60'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">phone_iphone</span>
                    Mobile Money
                  </button>
                </div>
                {paymentMethod === 'bank' ? (
                  <input
                    value={bankIban}
                    onChange={(e) => setBankIban(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="Saisir votre IBAN complet"
                    type="text"
                    required={paymentMethod === 'bank'}
                  />
                ) : (
                  <input
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="Saisir votre numéro Mobile Money"
                    type="tel"
                    required={paymentMethod === 'mobile_money'}
                  />
                )}
              </div>
            </div>
          </section>

          {/* Footer: Bottom Navigation Shell */}
          <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-outline-variant px-4 py-4 z-50 flex items-center justify-between gap-3 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
            <Link
              to="/farmer/welcome"
              className="text-on-surface-variant font-semibold text-xs hover:bg-surface-container-high px-2 py-2 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
            >
              Plus tard
            </Link>
            <button
              type="button"
              onClick={() => alert('Brouillon sauvegardé !')}
              className="flex-1 border border-outline-variant text-on-surface font-semibold text-xs hover:bg-surface-container-high px-3 py-3 rounded-xl transition-all active:scale-95 text-center cursor-pointer"
            >
              Brouillon
            </button>
            <button
              type="submit"
              className="flex-[1.5] bg-primary text-white font-semibold text-xs px-3 py-3 rounded-xl transition-all active:scale-95 shadow-sm flex items-center justify-center gap-1 cursor-pointer"
            >
              Soumettre <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </footer>
        </form>
      </main>
    </div>
  );
}
