import { Baby, BookOpen, Coffee, Croissant, Fuel, Gift, HeartPulse, Hammer, Package, PawPrint, Pill, Shirt, ShoppingCart, Sparkles, Sprout, Store, Utensils, Wrench, type LucideIcon } from 'lucide-react';
import { cx } from './cx';

/** Ícones disponíveis para tipos de lugar (a chave é o que fica salvo no banco). */
export const SEGMENT_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  cart: { icon: ShoppingCart, label: 'Carrinho' },
  pill: { icon: Pill, label: 'Remédio' },
  fuel: { icon: Fuel, label: 'Combustível' },
  store: { icon: Store, label: 'Loja' },
  paw: { icon: PawPrint, label: 'Pet' },
  bread: { icon: Croissant, label: 'Padaria' },
  coffee: { icon: Coffee, label: 'Café' },
  food: { icon: Utensils, label: 'Restaurante' },
  hammer: { icon: Hammer, label: 'Construção' },
  wrench: { icon: Wrench, label: 'Oficina' },
  shirt: { icon: Shirt, label: 'Roupas' },
  beauty: { icon: Sparkles, label: 'Beleza' },
  health: { icon: HeartPulse, label: 'Saúde' },
  baby: { icon: Baby, label: 'Bebê' },
  garden: { icon: Sprout, label: 'Jardim' },
  book: { icon: BookOpen, label: 'Papelaria' },
  gift: { icon: Gift, label: 'Presentes' },
  box: { icon: Package, label: 'Outros' },
};

export function SegmentIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = SEGMENT_ICONS[icon]?.icon ?? Store;
  return <Icon className={cx('h-4 w-4', className)} aria-hidden />;
}
