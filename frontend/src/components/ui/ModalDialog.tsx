import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

/**
 * Componente de diálogo modal reutilizable basado en el elemento nativo <dialog>.
 * Cumple las guías de modern-web-guidance (dialog):
 * - Usa showModal() para gestión nativa del top-layer, foco e inercia de la página.
 * - No añade role="dialog" ni aria-modal redundantes.
 * - Reinicia dialog.returnValue = '' al cerrarse para evitar fugas de estado.
 */
export const ModalDialog: React.FC<ModalDialogProps> = ({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-2xl',
  children,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      if (open) {
        onClose();
      }
    };

    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [open, onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={`w-[calc(100%-2rem)] ${maxWidthClass} rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl open:flex open:flex-col max-h-[90vh]`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
        <div>
          <h2 id={titleId} className="text-lg font-bold text-slate-900">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="overflow-y-auto px-6 py-5">{children}</div>
    </dialog>
  );
};
