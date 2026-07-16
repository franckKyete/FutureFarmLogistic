import { ReactNode, useEffect } from 'react';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string; // e.g. 'w-[400px]' or 'w-[800px]'
}

export function SidePanel({
  isOpen,
  onClose,
  title,
  children,
  width = 'w-[400px]',
}: SidePanelProps) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[90] transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Slide-out Panel */}
      <div
        className={`fixed right-0 top-[60px] h-[calc(100vh-60px)] ${width} bg-[var(--admin-surface-container-lowest)] border-l border-[var(--admin-outline-variant)]/40 z-[95] shadow-2xl transition-transform duration-300 ease-in-out overflow-y-auto flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 flex justify-between items-center border-b border-[var(--admin-outline-variant)]/40 sticky top-0 bg-[var(--admin-surface-container-lowest)] z-10">
          <h2 className="text-lg font-semibold text-[var(--admin-primary)]">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--admin-surface-container-low)] rounded-full text-[var(--admin-on-surface-variant)] transition-all"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
