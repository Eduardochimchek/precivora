import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ChangeBadge, StarInput, Stars } from '@/design-system';
import { priceChange } from '@/services/comparison';

describe('componentes', () => {
  it('Stars anuncia a nota', () => {
    render(<Stars value={4.5} />);
    expect(screen.getByRole('img', { name: '4,5 de 5 estrelas' })).toBeInTheDocument();
  });

  it('ChangeBadge mostra a variação e diz se ficou mais barato', () => {
    render(<ChangeBadge change={priceChange(25.9, 23.9)} />);
    expect(screen.getByText(/-7,72\s?%/)).toBeInTheDocument();
    expect(screen.getByText('mais barato')).toHaveClass('sr-only');
  });

  it('StarInput responde às setas do teclado', () => {
    function Wrapper() {
      const [v, setV] = useState(2);
      return <StarInput label="Nota geral" value={v} onChange={setV} />;
    }
    render(<Wrapper />);
    const group = screen.getByRole('radiogroup', { name: 'Nota geral' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: '3 estrelas' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: '1 estrela' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: '5 estrelas' }));
    expect(screen.getByRole('radio', { name: '5 estrelas' })).toHaveAttribute('aria-checked', 'true');
  });
});
