import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyAddressesQuery,
  setDefaultAddressMutation,
  deleteAddressMutation,
} from '../api/addresses.queries';
import { AddressCard } from './AddressCard';
import { AddressFormModal } from './AddressFormModal';
import { addToast } from '@/features/shared/store/toast.store';
import type { AddressDto } from '@futurefarm/types';

interface AddressSelectorProps {
  selectedAddressId?: string | null | undefined;
  onSelectAddress: (address: AddressDto) => void;
  title?: string;
  showActions?: boolean;
}

export const AddressSelector: React.FC<AddressSelectorProps> = ({
  selectedAddressId,
  onSelectAddress,
  title = 'Adresse de livraison',
  showActions = false,
}) => {
  const queryClient = useQueryClient();
  const { data: addresses = [], isLoading } = useQuery(getMyAddressesQuery());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AddressDto | null>(null);

  // Set default address on load if none selected
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
      if (defaultAddr) {
        onSelectAddress(defaultAddr);
      }
    }
  }, [addresses, selectedAddressId, onSelectAddress]);

  const setDefaultMutation = useMutation({
    ...setDefaultAddressMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['addresses', 'me'] });
      addToast('Adresse par défaut mise à jour', 'success');
    },
  });

  const deleteMutation = useMutation({
    ...deleteAddressMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['addresses', 'me'] });
      addToast('Adresse supprimée', 'success');
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-[#004322] uppercase tracking-wider">
          {title}
        </h3>
        <button
          type="button"
          onClick={() => {
            setEditingAddress(null);
            setIsModalOpen(true);
          }}
          className="text-xs font-bold text-[#1a5c35] hover:text-[#004322] flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">add_location_alt</span>
          <span>+ Nouvelle adresse</span>
        </button>
      </div>

      {isLoading ? (
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 animate-pulse text-xs text-[#707970] text-center">
          Chargement de vos adresses...
        </div>
      ) : addresses.length === 0 ? (
        <div className="p-5 bg-white border border-dashed border-[#c0c9be] rounded-2xl text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-[#f1f5f9] text-[#707970] flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[20px]">location_off</span>
          </div>
          <p className="text-xs text-[#707970]">Aucune adresse enregistrée</p>
          <button
            type="button"
            onClick={() => {
              setEditingAddress(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-[#004322] hover:bg-[#1a5c35] text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Ajouter une adresse de livraison
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {addresses.map((addr) => (
            <AddressCard
              key={addr.id}
              address={addr}
              isSelected={selectedAddressId === addr.id}
              onSelect={onSelectAddress}
              onEdit={(a) => {
                setEditingAddress(a);
                setIsModalOpen(true);
              }}
              onDelete={(a) => {
                if (confirm('Voulez-vous supprimer cette adresse ?')) {
                  deleteMutation.mutate(a.id);
                }
              }}
              onSetDefault={(a) => setDefaultMutation.mutate(a.id)}
              showActions={showActions}
            />
          ))}
        </div>
      )}

      {/* Modal for adding/editing address */}
      <AddressFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAddress(null);
        }}
        addressToEdit={editingAddress}
        onSuccess={(saved) => {
          onSelectAddress(saved);
        }}
      />
    </div>
  );
};
