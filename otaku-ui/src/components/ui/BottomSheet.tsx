import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Zona fixa no fundo (botões de ação) */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Folha inferior para mobile (em ecrãs largos aparece como diálogo centrado).
 * Fecha ao tocar fora, com Escape, no botão de fechar ou ao arrastar o topo para baixo.
 * É renderizada em document.body para ficar sempre acima da navegação inferior.
 */
const BottomSheet: React.FC<BottomSheetProps> = ({ open, onClose, title, subtitle, footer, children }) => {
  const dragControls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[130] flex items-end md:items-center justify-center md:p-6" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.div
            className="relative w-full md:max-w-lg max-h-[88dvh] flex flex-col bg-surface-container-low border border-border-glass border-b-0 md:border-b rounded-t-[28px] md:rounded-[28px] shadow-2xl overflow-hidden"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 380, mass: 0.9 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
          >
            {/* Pega + cabeçalho: zona de arrasto */}
            <div
              className="flex-shrink-0 touch-none cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1 rounded-full bg-on-surface-variant/30 mx-auto mt-2.5 md:hidden" />
              <div className="flex items-start justify-between gap-3 px-5 pt-3 md:pt-5 pb-3">
                <div className="min-w-0">
                  {title && <h2 className="text-base font-extrabold text-on-surface truncate">{title}</h2>}
                  {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Fechar"
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-5 space-y-5 no-scrollbar">
              {children}
            </div>

            {footer && (
              <div
                className="flex-shrink-0 px-5 pt-3 border-t border-border-glass bg-surface-container-low"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.875rem)' }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default BottomSheet;
