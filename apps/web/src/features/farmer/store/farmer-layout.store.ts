import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';
import { useEffect, type ReactNode } from 'react';

export interface FarmerLayoutOptions {
  hideTopBar?: boolean;
  hideBottomNav?: boolean;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  rightAction?: ReactNode;
}

export const farmerLayoutStore = new Store<FarmerLayoutOptions>({});

export function setFarmerLayout(options: FarmerLayoutOptions) {
  farmerLayoutStore.setState((prev) => ({ ...prev, ...options }));
}

export function resetFarmerLayout() {
  farmerLayoutStore.setState(() => ({}));
}

export function useFarmerLayout(options?: FarmerLayoutOptions) {
  useEffect(() => {
    if (!options) return;
    farmerLayoutStore.setState((prev) => ({ ...prev, ...options }));
    return () => {
      farmerLayoutStore.setState(() => ({}));
    };
  }, [
    options?.hideTopBar,
    options?.hideBottomNav,
    options?.title,
    options?.subtitle,
    options?.showBack,
    options?.backTo,
  ]);

  return useStore(farmerLayoutStore);
}
