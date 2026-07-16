import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalMode = 'center' | 'slide-over';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  mode?: ModalMode;
  className?: string;
}

const TRANSITION_DURATION = 300;

export function Modal({
  open,
  onClose,
  title,
  children,
  mode = 'center',
  className = '',
}: ModalProps) {
  const [state, setState] = useState<'closed' | 'entering' | 'open' | 'exiting'>('closed');

  useEffect(() => {
    if (open && state === 'closed') {
      setState('entering');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setState('open'));
      });
      return;
    }
    if (!open && state === 'open') {
      setState('exiting');
      const timer = setTimeout(() => setState('closed'), TRANSITION_DURATION);
      return () => clearTimeout(timer);
    }
    return;
  }, [open, state]);

  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (state !== 'open') return;

    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [state, handleEsc]);

  if (state === 'closed') return null;

  const isVisible = state === 'open';
  const baseTransition = `transition-all duration-${TRANSITION_DURATION} ease-in-out`;

  const panel = (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-40 ${baseTransition} ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      {mode === 'slide-over' ? (
        <div
          className={`fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-surface-container-lowest shadow-xl ${baseTransition} ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            {title && (
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ml-auto"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(100vh-5rem)]">
            {children}
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div
            className={`relative w-full max-w-lg mx-4 bg-surface-container-lowest rounded-xl shadow-xl border border-gray-200 pointer-events-auto ${baseTransition} ${
              isVisible
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-95'
            }`}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              {title && (
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ml-auto"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className={`px-6 py-4 ${className}`}>{children}</div>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(panel, document.body);
}
