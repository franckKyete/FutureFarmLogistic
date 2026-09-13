import { Icon } from '@/features/shared/components/Icon';
import React from 'react';
import type { AddressDto } from '@futurefarm/types';

interface AddressCardProps {
  address: AddressDto;
  isSelected?: boolean;
  onSelect?: (address: AddressDto) => void;
  onEdit?: (address: AddressDto) => void;
  onDelete?: (address: AddressDto) => void;
  onSetDefault?: (address: AddressDto) => void;
  selectable?: boolean;
  showActions?: boolean;
}

export const AddressCard: React.FC<AddressCardProps> = ({
  address,
  isSelected = false,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  selectable = true,
  showActions = false,
}) => {
  const hasExtraContact = Boolean(address.recipientName || address.phoneNumber);

  return (
    <div
      onClick={() => selectable && onSelect?.(address)}
      className={`p-4 rounded-2xl border transition-all ${
        selectable ? 'cursor-pointer' : ''
      } ${
        isSelected
          ? 'border-[#004322] bg-[#f2f9f5] ring-2 ring-[#004322]/20 shadow-sm'
          : 'border-[#e2e8f0] bg-white hover:border-[#c0c9be]'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {selectable && (
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                isSelected ? 'border-[#004322] bg-white' : 'border-[#cbd5e1]'
              }`}
            >
              {isSelected && <div className="w-2 h-2 rounded-full bg-[#004322]" />}
            </div>
          )}
          <span className="font-bold text-sm text-[#0b1c30]">
            {address.label || address.streetAddress}
          </span>
          {address.isDefault && (
            <span className="bg-[#e6f4ea] text-[#137333] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#bbf7d0]">
              Par défaut
            </span>
          )}
        </div>

        {showActions && (
          <div className="flex items-center gap-1 -mt-1 -mr-1">
            {onSetDefault && !address.isDefault && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetDefault(address);
                }}
                className="text-[11px] font-semibold text-[#1a5c35] hover:underline px-2 py-1 cursor-pointer"
              >
                Définir par défaut
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(address);
                }}
                className="text-[#475569] hover:text-[#0b1c30] p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                title="Modifier"
              >
                <Icon name="edit" className="text-[18px]" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(address);
                }}
                className="text-[#dc2626] hover:text-[#b91c1c] p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                title="Supprimer"
              >
                <Icon name="delete" className="text-[18px]" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1 text-xs text-[#404941]">
        {address.label && address.streetAddress && (
          <p className="font-medium text-[#0b1c30]">
            {address.streetAddress}
          </p>
        )}
        {address.streetAddress2 && (
          <p className="text-[#707970] text-[11px] pl-0.5">
            {address.streetAddress2}
          </p>
        )}
        <p className="flex items-start gap-1.5 text-[#707970]">
          <Icon name="location_on" className="text-[15px] text-[#707970] shrink-0 mt-0.5" />
          <span className="leading-relaxed font-medium text-[#0b1c30]">
            {[address.city, address.stateOrProvince, address.country].filter(Boolean).join(', ')}
          </span>
        </p>
        {hasExtraContact && (
          <p className="text-[11px] text-[#707970] flex items-center gap-1.5 pt-0.5">
            <Icon name="person" className="text-[14px]" />
            <span>{[address.recipientName, address.phoneNumber].filter(Boolean).join(' • ')}</span>
          </p>
        )}
      </div>
    </div>
  );
};
