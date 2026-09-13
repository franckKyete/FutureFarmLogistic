import { Store } from '@tanstack/react-store';
import type { ReactNode } from 'react';

export interface BuyerLayoutState {
  title?: string | undefined;
  subtitle?: string | undefined;
  showBack?: boolean | undefined;
  backTo?: string | undefined;
  rightAction?: ReactNode | undefined;
  hideTopBar: boolean;
  hideCart: boolean;
}

const DEFAULT_STATE: BuyerLayoutState = {
  title: undefined,
  subtitle: undefined,
  showBack: false,
  backTo: undefined,
  rightAction: undefined,
  hideTopBar: false,
  hideCart: false,
};

export const buyerLayoutStore = new Store<BuyerLayoutState>(DEFAULT_STATE);

export const setBuyerLayout = (state: Partial<BuyerLayoutState>) => {
  buyerLayoutStore.setState((prev) => ({ ...prev, ...state }));
};

export const resetBuyerLayout = () => {
  buyerLayoutStore.setState(() => DEFAULT_STATE);
};
