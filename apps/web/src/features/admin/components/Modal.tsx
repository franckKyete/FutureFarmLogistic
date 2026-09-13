import { Icon } from '@/features/shared/components/Icon';
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
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const timer = setTimeout(() => {
        setMounted(false);
      }, TRANSITION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;

    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, handleEsc]);

  if (!mounted) return null;

  const baseTransition = 'transition-all duration-300 ease-in-out';

  const panel = (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-40 ${baseTransition} ${
          visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      {mode === 'slide-over' ? (
        <div
          className={`fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-surface-container-lowest shadow-xl ${baseTransition} ${
            visible ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
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
              <Icon name="close" className="text-xl" />
            </button>
          </div>
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(100vh-5rem)]">
            {children}
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div
            className={`relative w-full max-w-lg mx-4 bg-surface-container-lowest rounded-xl shadow-xl border border-gray-200 ${
              visible ? 'pointer-events-auto' : 'pointer-events-none'
            } ${baseTransition} ${
              visible
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
                <Icon name="close" className="text-xl" />
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
