import { Store } from '@tanstack/store';
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
    farmerLayoutStore.setState((prev) => {
      // Avoid state updates if primitive options haven't changed
      if (
        prev.hideTopBar === options.hideTopBar &&
        prev.hideBottomNav === options.hideBottomNav &&
        prev.title === options.title &&
        prev.subtitle === options.subtitle &&
        prev.showBack === options.showBack &&
        prev.backTo === options.backTo &&
        prev.rightAction === options.rightAction
      ) {
        return prev;
      }
      return { ...prev, ...options };
    });
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
    options?.rightAction,
  ]);
}
