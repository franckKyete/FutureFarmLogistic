import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Modal } from './Modal';

describe('Modal Component', () => {
  it('renders children when open is true', async () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="Test Modal">
        <div>Modal Content</div>
      </Modal>,
    );

    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('unmounts cleanly from DOM after closing without leaving blocking backdrop', async () => {
    vi.useFakeTimers();

    function TestWrapper() {
      const [isOpen, setIsOpen] = useState(true);
      return (
        <div>
          <button onClick={() => setIsOpen(false)}>Close It</button>
          <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Test Modal">
            <div>Inner Content</div>
          </Modal>
        </div>
      );
    }

    render(<TestWrapper />);

    expect(screen.getByText('Test Modal')).toBeInTheDocument();

    // Trigger close
    act(() => {
      fireEvent.click(screen.getByText('Close It'));
    });

    // Advance past transition duration
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Modal should be completely unmounted from the DOM
    expect(screen.queryByText('Test Modal')).toBeNull();
    expect(screen.queryByText('Inner Content')).toBeNull();
    expect(document.body.style.overflow).toBe('');

    vi.useRealTimers();
  });

  it('calls onClose when clicking close button or pressing Escape', () => {
    const handleClose = vi.fn();
    render(
      <Modal open={true} onClose={handleClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>,
    );

    const closeBtn = screen.getByRole('button');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
