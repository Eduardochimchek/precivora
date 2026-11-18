import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Volta para a tela anterior do app. Se a tela foi a primeira aberta (link direto), vai para `fallback` sem empilhar. */
export function useGoBack() {
  const navigate = useNavigate();
  const { key } = useLocation();
  return useCallback((fallback = '/') => (key !== 'default' ? navigate(-1) : navigate(fallback, { replace: true })), [navigate, key]);
}
