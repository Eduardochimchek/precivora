import { useState } from 'react';
import { ArrowRight, ScanLine, ShieldCheck, Scale } from 'lucide-react';
import { Button, LogoSymbol, TextField } from '@/design-system';
import { isNative } from '@/app/native';

const BENEFITS = [
  isNative
    ? { icon: ScanLine, title: 'Escaneie a nota fiscal', text: 'Lugar, produtos e preços entram sozinhos.' }
    : { icon: ScanLine, title: 'Anote os preços', text: 'Do mercado, da farmácia, do posto e do que mais quiser.' },
  { icon: Scale, title: 'Compare de verdade', text: 'Preço por quilo ou litro, histórico e suas avaliações.' },
  { icon: ShieldCheck, title: 'Seus dados são seus', text: 'Sem cadastro e sem servidor: o que você anota fica no aparelho. Veja em Mais → Privacidade o que consulta a internet.' },
];

/** Primeira abertura: apresenta o app e pergunta o nome uma única vez. */
export function Welcome({ onFinish, onRestore }: { onFinish: (name: string) => void; onRestore: () => void }) {
  const [step, setStep] = useState<'intro' | 'name'>('intro');
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 z-[75] overflow-y-auto bg-navy text-[#F1F5F9]" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="pt-safe mx-auto flex min-h-full max-w-md flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {step === 'intro' ? (
          <div key="intro" className="flex flex-1 animate-fade-in flex-col">
            <div className="flex flex-1 flex-col justify-center py-10">
              <LogoSymbol className="h-14 w-14 text-[#F7F9FC]" accentClass="text-lime" />
              <h1 id="welcome-title" className="mt-6 text-[32px] font-bold leading-[1.1]">
                Descubra onde comprar e quanto economizar.
              </h1>
              <ul className="mt-8 flex flex-col gap-5">
                {BENEFITS.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.07]">
                      <Icon className="h-5 w-5 text-lime" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="text-sm text-[#94A3B8]">{text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Button size="lg" variant="save" block onClick={() => setStep('name')} icon={<ArrowRight className="h-5 w-5" />}>
              Começar
            </Button>
            <button type="button" onClick={onRestore} className="mt-3 h-11 text-sm font-semibold text-[#CBD5E1] hover:text-white">
              Já tenho um backup
            </button>
          </div>
        ) : (
          <form
            key="name"
            className="flex flex-1 animate-fade-in flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              onFinish(name.trim());
            }}
          >
            <div className="flex flex-1 flex-col justify-center py-10 [&_input]:border-white/15 [&_input]:bg-white/10 [&_input]:text-white [&_label]:text-[#CBD5E1]">
              <h1 id="welcome-title" className="text-[28px] font-bold leading-tight">
                Como podemos te chamar?
              </h1>
              <p className="mb-6 mt-2 text-sm text-[#94A3B8]">Só para a saudação da tela inicial. Fica guardado neste aparelho.</p>
              <TextField label="Seu nome" optional value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus autoComplete="given-name" />
            </div>
            <Button type="submit" size="lg" variant="save" block>
              {name.trim() ? 'Continuar' : 'Pular'}
            </Button>
            <p className="mt-3 text-center text-xs text-[#94A3B8]">Em seguida, um tour rápido mostra onde fica cada coisa.</p>
          </form>
        )}
      </div>
    </div>
  );
}
