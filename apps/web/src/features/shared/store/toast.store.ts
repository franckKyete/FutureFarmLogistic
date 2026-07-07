import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ToastState {
  toasts: ToastMessage[];
}

export const toastStore = new Store<ToastState>({ toasts: [] });

export function addToast(message: string, type: ToastMessage['type'] = 'info') {
  const id = Math.random().toString(36).substring(2, 9);
  toastStore.setState((state) => ({
    toasts: [...state.toasts, { id, message, type }],
  }));
  setTimeout(() => {
    removeToast(id);
  }, 4000);
}

export function removeToast(id: string) {
  toastStore.setState((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  }));
}

export function useToasts() {
  return useStore(toastStore, (s) => s.toasts);
}
