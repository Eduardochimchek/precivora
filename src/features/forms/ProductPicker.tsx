import { useId, useMemo, useRef, useState } from 'react';
import { Check, PackagePlus, Search } from 'lucide-react';
import type { Brand, ID, Product } from '@/types';
import { cx } from '@/design-system';
import { matches } from '@/utils/text';
import { packageLabel } from '@/services/units';

interface Props {
  products: Product[];
  brands: Map<ID, Brand>;
  value?: ID;
  onChange: (id: ID) => void;
  onCreate?: (name: string) => void;
  label?: string;
  error?: string;
  autoFocus?: boolean;
}

export const productLabel = (p: Product, brands: Map<ID, Brand>) =>
  [p.name, p.brandId ? brands.get(p.brandId)?.name : undefined].filter(Boolean).join(' · ');

/** Combobox acessível para escolher um produto, com atalho para cadastrar um novo. */
export function ProductPicker({ products, brands, value, onChange, onCreate, label = 'Produto', error, autoFocus }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const selected = products.find((p) => p.id === value);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const visible = products.filter((p) => !p.archived);
    const q = query.trim();
    const r = q ? visible.filter((p) => matches(`${p.name} ${brands.get(p.brandId ?? '')?.name ?? ''} ${p.barcode ?? ''}`, q)) : visible;
    return r.slice(0, 40);
  }, [products, brands, query]);

  const options = [...results.map((p) => ({ kind: 'p' as const, p })), ...(onCreate ? [{ kind: 'new' as const }] : [])];

  const choose = (i: number) => {
    const o = options[i];
    if (!o) return;
    if (o.kind === 'p') {
      onChange(o.p.id);
      setQuery('');
      setOpen(false);
    } else {
      setOpen(false);
      onCreate?.(query.trim());
    }
  };

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
          aria-invalid={!!error || undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          data-autofocus={autoFocus || undefined}
          placeholder={selected ? productLabel(selected, brands) : 'Buscar por nome, marca ou código'}
          value={open ? query : selected ? productLabel(selected, brands) : query}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(options.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter' && open) {
              e.preventDefault();
              choose(active);
            } else if (e.key === 'Escape' && open) {
              e.stopPropagation();
              setOpen(false);
            }
          }}
          className={cx(
            'h-12 w-full rounded-md border border-line bg-surface pl-10 pr-3.5 text-[15px] placeholder:text-muted/80 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25',
            selected && !open && 'font-semibold',
            error && 'border-danger',
          )}
        />
      </div>
      {error && (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-[76px] z-10 max-h-72 overflow-y-auto rounded-lg border border-line bg-raised p-1 shadow-float"
        >
          {options.map((o, i) =>
            o.kind === 'p' ? (
              <li
                key={o.p.id}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={o.p.id === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                className={cx('flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5', i === active && 'bg-sunken')}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{o.p.name}</div>
                  <div className="truncate text-xs text-muted">
                    {[o.p.brandId ? brands.get(o.p.brandId)?.name : null, packageLabel(o.p)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {o.p.id === value && <Check className="h-4 w-4 text-success" aria-hidden />}
              </li>
            ) : (
              <li
                key="new"
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                className={cx('flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 font-semibold text-accent', i === active && 'bg-sunken')}
              >
                <PackagePlus className="h-4 w-4" aria-hidden />
                {query.trim() ? `Cadastrar "${query.trim()}"` : 'Cadastrar novo produto'}
              </li>
            ),
          )}
          {!results.length && !onCreate && <li className="px-3 py-3 text-sm text-muted">Nenhum produto encontrado</li>}
        </ul>
      )}
    </div>
  );
}
