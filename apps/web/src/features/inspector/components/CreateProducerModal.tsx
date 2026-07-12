import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateProducer } from '../api/accounts.queries';
import { addToast } from '@/features/shared/store/toast.store';

interface CreateProducerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Parcel {
  surface: string;
  location: string;
  culture: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreateProducerModal({ isOpen, onClose }: CreateProducerModalProps) {
  const queryClient = useQueryClient();
  const createProducer = useCreateProducer();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [farmName, setFarmName] = useState('');
  const [address, setAddress] = useState('');
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) newErrors.firstName = 'Le prénom est requis';
    if (!lastName.trim()) newErrors.lastName = 'Le nom est requis';
    if (!email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!EMAIL_REGEX.test(email.trim())) {
      newErrors.email = "Format d'email invalide";
    }
    if (!farmName.trim()) newErrors.farmName = "L'exploitation est requise";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const password = Math.random().toString(36).slice(2, 10) + 'A1!';

    const basePayload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
      farmName: farmName.trim(),
    };
    const payload = phone.trim()
      ? { ...basePayload, phone: phone.trim() }
      : basePayload;

    createProducer.mutate(payload, {
      onSuccess: () => {
        addToast('Compte producteur créé avec succès', 'success');
        void queryClient.invalidateQueries({ queryKey: ['inspector', 'producers'] });
        handleClose();
      },
      onError: () => {
        addToast('Erreur lors de la création du compte', 'error');
      },
    });
  }

  function handleClose() {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setFarmName('');
    setAddress('');
    setParcels([]);
    setErrors({});
    onClose();
  }

  function addParcel() {
    setParcels((prev) => [...prev, { surface: '', location: '', culture: '' }]);
  }

  function removeParcel(index: number) {
    setParcels((prev) => prev.filter((_, i) => i !== index));
  }

  function updateParcel(index: number, field: keyof Parcel, value: string) {
    setParcels((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index]!, [field]: value } as Parcel;
      return updated;
    });
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full mx-auto shadow-xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white flex items-center justify-between p-6 pb-2 z-10 rounded-2xl rounded-b-none">
          <h2 className="text-lg font-bold text-[#1a5c35]">Nouveau producteur</h2>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <span className="material-symbols-outlined text-gray-500">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-4">
          {/* Prénom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prénom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: '' }));
              }}
              className={`w-full px-4 py-2.5 border rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35] transition-all ${
                errors.firstName ? 'border-red-400' : 'border-gray-200'
              }`}
              placeholder="Jean"
            />
            {errors.firstName && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">error</span>
                {errors.firstName}
              </p>
            )}
          </div>

          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: '' }));
              }}
              className={`w-full px-4 py-2.5 border rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35] transition-all ${
                errors.lastName ? 'border-red-400' : 'border-gray-200'
              }`}
              placeholder="Dupont"
            />
            {errors.lastName && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">error</span>
                {errors.lastName}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
              }}
              className={`w-full px-4 py-2.5 border rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35] transition-all ${
                errors.email ? 'border-red-400' : 'border-gray-200'
              }`}
              placeholder="jean.dupont@email.com"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">error</span>
                {errors.email}
              </p>
            )}
          </div>

          {/* Téléphone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35] transition-all"
              placeholder="+33 6 12 34 56 78"
            />
          </div>

          {/* Exploitation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Exploitation <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={farmName}
              onChange={(e) => {
                setFarmName(e.target.value);
                if (errors.farmName) setErrors((prev) => ({ ...prev, farmName: '' }));
              }}
              className={`w-full px-4 py-2.5 border rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35] transition-all ${
                errors.farmName ? 'border-red-400' : 'border-gray-200'
              }`}
              placeholder="Ferme de la Vallée"
            />
            {errors.farmName && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">error</span>
                {errors.farmName}
              </p>
            )}
          </div>

          {/* Adresse */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35] transition-all"
              placeholder="12 rue des Champs, 75000 Paris"
            />
          </div>

          {/* Parcelle(s) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Parcelle(s)</span>
              <button
                type="button"
                onClick={addParcel}
                className="text-sm text-[#1a5c35] font-medium flex items-center gap-1 hover:text-[#145029] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Ajouter une parcelle
              </button>
            </div>

            {parcels.length === 0 && (
              <p className="text-xs text-gray-400 italic">Aucune parcelle renseignée</p>
            )}

            {parcels.map((parcel, index) => (
              <div
                key={index}
                className="border border-gray-100 bg-gray-50 rounded-xl p-3 mb-2"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500">
                    Parcelle {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeParcel(index)}
                    className="text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                    aria-label={`Supprimer la parcelle ${index + 1}`}
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">
                      Surface <span className="font-mono">(ha)</span>
                    </label>
                    <input
                      type="number"
                      value={parcel.surface}
                      onChange={(e) => updateParcel(index, 'surface', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35] transition-all"
                      placeholder="2.5"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Localisation</label>
                    <input
                      type="text"
                      value={parcel.location}
                      onChange={(e) => updateParcel(index, 'location', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35] transition-all"
                      placeholder="Lieu-dit"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Culture</label>
                    <input
                      type="text"
                      value={parcel.culture}
                      onChange={(e) => updateParcel(index, 'culture', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35] transition-all"
                      placeholder="Blé"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={createProducer.isPending}
            className="w-full py-3 bg-[#1a5c35] text-white rounded-xl font-semibold text-sm hover:bg-[#145029] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-6"
          >
            {createProducer.isPending ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Création en cours...
              </>
            ) : (
              'Créer le producteur'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
