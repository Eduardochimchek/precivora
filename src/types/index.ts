export type ID = string;
/** Data/hora em ISO 8601 (UTC). */
export type ISODate = string;

export const UNITS = ['kg', 'g', 'L', 'ml', 'un', 'pct', 'cx', 'dz'] as const;
export type Unit = (typeof UNITS)[number];

export const FUEL_TYPES = [
  'gasolina_comum',
  'gasolina_aditivada',
  'gasolina_premium',
  'etanol',
  'diesel',
  'diesel_s10',
  'gnv',
] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

interface Timestamps {
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Category extends Timestamps {
  id: ID;
  name: string;
  color: string;
}

export interface Brand extends Timestamps {
  id: ID;
  name: string;
  nameKey: string;
}

export interface Product extends Timestamps {
  id: ID;
  name: string;
  nameKey: string;
  brandId?: ID;
  categoryId?: ID;
  subcategory?: string;
  barcode?: string;
  unit: Unit;
  /** Quantidade de conteúdo da embalagem na unidade `unit` (ex.: 5 para 5 kg). */
  packageSize: number;
  /** Imagem reduzida (data URL JPEG/WebP). */
  image?: string;
  description?: string;
  notes?: string;
  archived: boolean;
}

export interface Store extends Timestamps {
  id: ID;
  name: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  notes?: string;
  color: string;
  active: boolean;
}

export interface Station extends Timestamps {
  id: ID;
  name: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  /** Bandeira (Ipiranga, Shell, bandeira branca...) */
  flag?: string;
  notes?: string;
  color: string;
  active: boolean;
}

export type PriceSource = 'manual' | 'purchase';

export interface PriceRecord extends Timestamps {
  id: ID;
  productId: ID;
  storeId: ID;
  /** Valor total pago/anunciado para `quantity` embalagens. */
  price: number;
  /** Número de embalagens a que o preço se refere (ex.: "leve 3 por R$ 10"). */
  quantity: number;
  date: ISODate;
  promo: boolean;
  notes?: string;
  source: PriceSource;
  purchaseId?: ID;
}

export interface FuelPrice extends Timestamps {
  id: ID;
  stationId: ID;
  fuel: FuelType;
  /** Preço por litro (ou por m³ no caso do GNV). */
  price: number;
  date: ISODate;
  promo: boolean;
  notes?: string;
}

export type ReviewTarget = 'product' | 'brand';

/** Avaliação pessoal. Uma por produto/marca; avaliações coletivas futuras ficarão em outra tabela. */
export interface Review extends Timestamps {
  id: ID;
  targetType: ReviewTarget;
  targetId: ID;
  overall: number;
  quality?: number;
  value?: number;
  comment?: string;
  favorite: boolean;
  avoid: boolean;
  date: ISODate;
}

export interface Purchase extends Timestamps {
  id: ID;
  storeId: ID;
  date: ISODate;
  total: number;
  notes?: string;
}

export interface PurchaseItem {
  id: ID;
  purchaseId: ID;
  productId: ID;
  quantity: number;
  /** Preço de uma embalagem. */
  unitPrice: number;
}

export type Priority = 'alta' | 'media' | 'baixa';

export interface ShoppingList extends Timestamps {
  id: ID;
  name: string;
  archived: boolean;
}

export interface ListItem extends Timestamps {
  id: ID;
  listId: ID;
  productId: ID;
  quantity: number;
  priority: Priority;
  checked: boolean;
  notes?: string;
}

export interface CategoryBudget {
  id: ID;
  categoryId: ID;
  limit: number;
}

export type ActivityKind =
  | 'price'
  | 'fuel'
  | 'purchase'
  | 'product'
  | 'store'
  | 'station'
  | 'review'
  | 'list'
  | 'backup';

export interface Activity {
  id: ID;
  kind: ActivityKind;
  label: string;
  refId?: ID;
  createdAt: ISODate;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  userName: string;
  theme: ThemePreference;
  /** Razão etanol/gasolina a partir da qual o etanol compensa (0.70 = 70%). */
  flexRatio: number;
  tankSizes: number[];
  /** Custo estimado de cada deslocamento extra para dividir compras (R$). */
  tripCost: number;
  preferSingleStore: boolean;
  /** Economia mínima (R$) para sugerir dividir compras quando prefere um mercado. */
  minSplitSavings: number;
  /** Dias após os quais um preço é considerado desatualizado. */
  staleDays: number;
  monthlyBudget: number;
  savingsGoal: number;
  onboardingDone: boolean;
  lastBackupAt?: ISODate;
}

export interface SettingRow {
  key: keyof Settings;
  value: unknown;
}
