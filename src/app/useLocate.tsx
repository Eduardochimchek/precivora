import { useCallback } from 'react';
import { MapPin } from 'lucide-react';
import { useFeedback } from '@/design-system';
import type { LatLng } from '@/services/geo';
import { currentPosition, enableLocation, lastKnownPosition, locationState } from './location';

/** Pega a posição do celular. Se a localização estiver desligada ou sem permissão, explica antes e pede. null = a pessoa desistiu ou falhou (já avisado). */
export function useLocate() {
  const { confirm, toast } = useFeedback();
  return useCallback(async (): Promise<LatLng | null> => {
    const cached = lastKnownPosition();
    if (cached) return cached;
    const state = await locationState();
    if (state !== 'ready') {
      const ok = await confirm({
        title: state === 'off' ? 'Ligar a localização?' : 'Usar a sua localização?',
        message: (
          <div className="flex flex-col gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
              <MapPin className="h-6 w-6" aria-hidden />
            </span>
            <p>Para mostrar o que está perto de você e a distância até cada lugar, o Precivora precisa saber onde o celular está.</p>
            <p>A localização é usada só aqui no celular para calcular as distâncias. Ela não é enviada a ninguém.</p>
          </div>
        ),
        confirmLabel: state === 'off' ? 'Ligar localização' : 'Permitir',
        cancelLabel: 'Agora não',
      });
      if (!ok) return null;
      if (state === 'off' && !(await enableLocation())) return null;
    }
    try {
      return await currentPosition();
    } catch (err) {
      toast((err as Error).message || 'Não consegui pegar a localização.', 'error');
      return null;
    }
  }, [confirm, toast]);
}
