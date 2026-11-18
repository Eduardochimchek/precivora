import { Star } from 'lucide-react';
import { IconButton, cx, useFeedback } from '@/design-system';
import { setFavorite } from '@/repositories/places';
import type { Place } from '@/types';

export function FavoriteButton({ place }: { place: Place }) {
  const { toast } = useFeedback();
  const on = !!place.favorite;
  return (
    <IconButton
      label={on ? 'Tirar dos favoritos' : 'Marcar como favorito'}
      aria-pressed={on}
      onClick={async () => {
        await setFavorite(place.id, !on);
        toast(on ? 'Saiu dos favoritos' : 'Favorito: aparece primeiro nas listas');
      }}
    >
      <Star className={cx('h-5 w-5', on ? 'fill-[#F5B301] text-[#F5B301]' : '')} />
    </IconButton>
  );
}
