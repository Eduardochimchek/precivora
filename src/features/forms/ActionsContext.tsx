import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { FuelType, ID, ReviewTarget } from '@/types';
import { ProductForm } from './ProductForm';
import { PlaceForm } from './PlaceForm';
import { PriceForm } from './PriceForm';
import { FuelPriceForm } from './FuelPriceForm';
import { ReviewForm } from './ReviewForm';

interface ProductOpts { productId?: ID; initialName?: string; onSaved?: (id: ID) => void }
interface PlaceOpts { kind: 'store' | 'station'; placeId?: ID; onSaved?: (id: ID) => void }
interface PriceOpts { productId?: ID; storeId?: ID; priceId?: ID }
interface FuelOpts { stationId?: ID; fuel?: FuelType; recordId?: ID }
interface ReviewOpts { targetType: ReviewTarget; targetId: ID }

interface ActionsApi {
  openProduct: (o?: ProductOpts) => void;
  openPlace: (o: PlaceOpts) => void;
  openPrice: (o?: PriceOpts) => void;
  openFuel: (o?: FuelOpts) => void;
  openReview: (o: ReviewOpts) => void;
}

const Ctx = createContext<ActionsApi | null>(null);

/** Formulários de cadastro rápido disponíveis em qualquer tela (e empilháveis: preço → novo produto). */
export function ActionsProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<ProductOpts | null>(null);
  const [place, setPlace] = useState<PlaceOpts | null>(null);
  const [price, setPrice] = useState<PriceOpts | null>(null);
  const [fuel, setFuel] = useState<FuelOpts | null>(null);
  const [review, setReview] = useState<ReviewOpts | null>(null);

  const api = useMemo<ActionsApi>(
    () => ({
      openProduct: (o = {}) => setProduct(o),
      openPlace: (o) => setPlace(o),
      openPrice: (o = {}) => setPrice(o),
      openFuel: (o = {}) => setFuel(o),
      openReview: (o) => setReview(o),
    }),
    [],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <PriceForm open={!!price} onClose={() => setPrice(null)} {...(price ?? {})} />
      <FuelPriceForm open={!!fuel} onClose={() => setFuel(null)} {...(fuel ?? {})} />
      {review && <ReviewForm open onClose={() => setReview(null)} {...review} />}
      <ProductForm open={!!product} onClose={() => setProduct(null)} {...(product ?? {})} />
      <PlaceForm open={!!place} onClose={() => setPlace(null)} kind={place?.kind ?? 'store'} placeId={place?.placeId} onSaved={place?.onSaved} />
    </Ctx.Provider>
  );
}

export function useActions(): ActionsApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useActions fora do ActionsProvider');
  return v;
}
