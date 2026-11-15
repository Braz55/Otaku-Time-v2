import React from 'react';
import { X } from 'lucide-react';

export type ChipTone = 'primary' | 'secondary' | 'amber' | 'sky';

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tone?: ChipTone;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  /** Contador mostrado como bolinha à direita (escondido quando 0) */
  count?: number;
}

/** Botão em forma de pílula para filtros, separadores e opções. */
export const Chip: React.FC<ChipProps> = ({
  active = false,
  tone = 'primary',
  size = 'md',
  icon,
  count,
  children,
  className = '',
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={`ot-chip ${className}`}
    data-active={active}
    data-tone={tone}
    data-size={size}
    aria-pressed={active}
    {...props}
  >
    {icon}
    {children}
    {!!count && <span className="ot-chip-badge">{count}</span>}
  </button>
);

interface RemovableChipProps {
  label: string;
  tone?: ChipTone;
  onRemove: () => void;
}

/** Filtro ativo com botão para o remover. */
export const RemovableChip: React.FC<RemovableChipProps> = ({ label, tone = 'primary', onRemove }) => (
  <span className="ot-chip !cursor-default !pr-1.5" data-active="true" data-tone={tone} data-size="sm">
    <span>{label}</span>
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remover ${label}`}
      className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/15 cursor-pointer"
    >
      <X size={11} />
    </button>
  </span>
);

/** Linha de chips com scroll horizontal que sangra até às margens do ecrã. */
export const ChipScroller: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`ot-scroller ${className}`}>{children}</div>
);

interface OptionGroupProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  tone?: ChipTone;
}

/** Escolha única apresentada como chips (substitui um <select> dentro de uma folha). */
export function OptionGroup<T extends string>({ label, options, value, onChange, tone = 'primary' }: OptionGroupProps<T>) {
  return (
    <div className="space-y-2.5">
      <h3 className="ot-eyebrow">{label}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <Chip key={opt.value} tone={tone} active={value === opt.value} onClick={() => onChange(opt.value)}>
            {opt.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Linha com etiqueta e interruptor. */
export const ToggleRow: React.FC<ToggleRowProps> = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between gap-4 min-h-11 cursor-pointer select-none">
    <span className="text-sm font-semibold text-on-surface">{label}</span>
    <span className="relative flex-shrink-0">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="block w-11 h-6 rounded-full bg-white/10 border border-border-glass transition-colors peer-checked:bg-primary peer-checked:border-primary" />
      <span className="absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
    </span>
  </label>
);
