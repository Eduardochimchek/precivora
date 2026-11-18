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
  /** Segmento a que a categoria pertence; vazio = vale para todos. */
  segmentId?: ID;
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
  /** Segmento onde costuma ser comprado (opcional; o item pode ter preço em qualquer lugar). */
  segmentId?: ID;
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

export type SegmentMode = 'items' | 'fuel';

/** Tipo de lugar (Mercado, Farmácia, Combustível, Pet shop...). "fuel" ativa as telas de combustível. */
export interface Segment extends Timestamps {
  id: ID;
  name: string;
  /** Chave do ícone (ver SEGMENT_ICONS). */
  icon: string;
  color: string;
  mode: SegmentMode;
  /** Segmentos que vêm com o app: podem ser renomeados, não excluídos. */
  builtin: boolean;
  order: number;
}

/** Lugar onde se compra ou abastece (mercado, farmácia, posto...). */
export type GeoPrecision = 'exact' | 'street' | 'area' | 'none';

export interface Place extends Timestamps {
  id: ID;
  segmentId: ID;
  name: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  /** Bandeira (só para postos). */
  flag?: string;
  /** CNPJ (só dígitos), usado para reconhecer o lugar ao importar nota fiscal. */
  cnpj?: string;
  /** Logo ou foto pequena (data URL). */
  logo?: string;
  favorite?: boolean;
  /** Coordenadas do endereço (busca automática no OpenStreetMap). */
  lat?: number;
  lng?: number;
  /** Precisão da localização: número da rua, só a rua, só o bairro/cidade, ou não encontrado. */
  geo?: GeoPrecision;
  geoAt?: ISODate;
  notes?: string;
  color: string;
  active: boolean;
}

/** Nomes antigos mantidos para legibilidade: mercados e postos são lugares. */
export type Store = Place;
export type Station = Place;

export type PriceSource = 'manual' | 'purchase';

export interface PriceRecord extends Timestamps {
  id: ID;
  productId: ID;
  /** Lugar (tabela `stores`). */
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
  /** Lugar de um segmento de combustível (tabela `stores`). */
  stationId: ID;
  fuel: FuelType;
  /** Preço por litro (ou por m³ no caso do GNV). */
  price: number;
  date: ISODate;
  promo: boolean;
  notes?: string;
  /** Chave da NFC-e de onde o preço foi importado. */
  receiptKey?: string;
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
  /** Chave de acesso da NFC-e quando a compra veio de uma nota fiscal (evita importar duas vezes). */
  receiptKey?: string;
}

/** Lembra a qual produto um item da nota de um lugar corresponde. */
export interface ReceiptLink extends Timestamps {
  id: ID;
  placeId: ID;
  /** "c:<código do item no lugar>" ou "d:<descrição normalizada>". */
  key: string;
  description: string;
  productId: ID;
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
  | 'segment'
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
  /** Esconde a lista de primeiros passos do início. */
  checklistHidden: boolean;
  /** Busca sozinho os preços do levantamento da ANP (app, no Wi-Fi). */
  anpAuto: boolean;
  /** Cópia automática em Documentos/Precivora/Automatico (app). */
  autoBackup: boolean;
  autoBackupDays: number;
  autoBackupKeep: number;
  lastBackupAt?: ISODate;
  lastAutoBackupAt?: ISODate;
  lastAutoBackupBytes?: number;
  /** Última busca no levantamento da ANP. */
  anpCheckedAt?: ISODate;
  /** Coleta mais recente encontrada na última busca. */
  anpLatest?: ISODate;
}

export interface SettingRow {
  key: keyof Settings;
  value: unknown;
}
