import { useEffect, useRef } from 'react';
import styles from './drawer.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  variant?: 'side' | 'bottom';
}

export function Drawer({ open, onClose, title, children, variant = 'side' }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <div
        className={`${styles.scrim} ${open ? styles.scrimOpen : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        className={`${styles.panel} ${styles[variant]} ${open ? styles.open : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        inert={!open}
      >
        <header className={styles.head}>
          <strong>{title}</strong>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭面板"
            data-autofocus
          >×</button>
        </header>
        <div className={styles.body}>{children}</div>
      </aside>
    </>
  );
}
