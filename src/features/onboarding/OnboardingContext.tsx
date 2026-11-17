import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '@/app/SettingsContext';
import { Tour } from './Tour';
import { Welcome } from './Welcome';

const Ctx = createContext<{ startTour: () => void }>({ startTour: () => {} });

export const useOnboarding = () => useContext(Ctx);

/** Boas-vindas (uma vez) e apresentação guiada (ao terminar as boas-vindas ou quando pedida nos Ajustes). */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const [touring, setTouring] = useState(false);
  const startTour = useCallback(() => setTouring(true), []);
  const endTour = useCallback(() => {
    setTouring(false);
    navigate('/');
  }, [navigate]);
  const value = useMemo(() => ({ startTour }), [startTour]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {!settings.onboardingDone && (
        <Welcome
          onFinish={(name) => {
            void update({ userName: name, onboardingDone: true });
            setTouring(true);
          }}
          onRestore={() => {
            void update({ onboardingDone: true });
            navigate('/backup');
          }}
        />
      )}
      {touring && settings.onboardingDone && <Tour onDone={endTour} />}
    </Ctx.Provider>
  );
}
