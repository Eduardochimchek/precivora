import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { isNative } from '@/app/native';
import { OnboardingProvider } from '@/features/onboarding/OnboardingContext';
import { FeedbackProvider, ListSkeleton, Skeleton } from '@/design-system';
import { ActionsProvider, useActions } from '@/features/forms/ActionsContext';
import { SettingsProvider } from '@/app/SettingsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import type { Settings } from '@/types';

const ComparePage = lazy(() => import('@/features/compare/ComparePage'));
const ImportReceiptPage = lazy(() => import('@/features/receipts/ImportReceiptPage'));
const ProductDetailPage = lazy(() => import('@/features/products/ProductDetailPage'));
const ProductsPage = lazy(() => import('@/features/products/ProductsPage'));
const FuelPage = lazy(() => import('@/features/fuel/FuelPage'));
const PlacesPage = lazy(() => import('@/features/places/PlacesPage'));
const PlaceDetailPage = lazy(() => import('@/features/places/PlaceDetailPage'));
const SegmentsPage = lazy(() => import('@/features/places/SegmentsPage'));
const ListsPage = lazy(() => import('@/features/lists/ListsPage'));
const ListDetailPage = lazy(() => import('@/features/lists/ListDetailPage'));
const HistoryPage = lazy(() => import('@/features/history/HistoryPage'));
const PurchaseFormPage = lazy(() => import('@/features/history/PurchaseFormPage'));
const BrandsPage = lazy(() => import('@/features/brands/BrandsPage'));
const ReviewsPage = lazy(() => import('@/features/reviews/ReviewsPage'));
const BudgetPage = lazy(() => import('@/features/budget/BudgetPage'));
const BackupPage = lazy(() => import('@/features/backup/BackupPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const MorePage = lazy(() => import('@/features/more/MorePage'));

function PageFallback() {
  return (
    <div className="pt-9" aria-busy="true">
      <Skeleton className="mb-6 h-8 w-48" />
      <ListSkeleton />
    </div>
  );
}

/** Atalho do manifest: abre o formulário de preço e volta para o início. */
function QuickPrice() {
  const { openPrice } = useActions();
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/', { replace: true });
    openPrice();
  }, [navigate, openPrice]);
  return null;
}

export default function App({ settings }: { settings: Settings }) {
  return (
    <ErrorBoundary>
      <SettingsProvider initial={settings}>
        <FeedbackProvider>
          <HashRouter>
            <ActionsProvider>
              <OnboardingProvider>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route element={<AppShell />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="comparar" element={<ComparePage />} />
                    <Route path="produtos" element={<ProductsPage />} />
                    <Route path="produtos/:id" element={<ProductDetailPage />} />
                    <Route path="precos/novo" element={<QuickPrice />} />
                    <Route path="combustiveis" element={<FuelPage />} />
                    <Route path="lugares" element={<PlacesPage />} />
                    <Route path="lugares/:id" element={<PlaceDetailPage />} />
                    <Route path="tipos" element={<SegmentsPage />} />
                    <Route path="mercados" element={<Navigate to="/lugares?tipo=seg-mercado" replace />} />
                    <Route path="postos" element={<Navigate to="/lugares?tipo=seg-combustivel" replace />} />
                    <Route path="mercados/:id" element={<PlaceDetailPage />} />
                    <Route path="postos/:id" element={<PlaceDetailPage />} />
                    <Route path="listas" element={<ListsPage />} />
                    <Route path="listas/:id" element={<ListDetailPage />} />
                    <Route path="historico" element={<HistoryPage />} />
                    <Route path="compras/nova" element={<PurchaseFormPage />} />
                    <Route path="notas/importar" element={<ImportReceiptPage />} />
                    <Route path="compras/:id" element={<PurchaseFormPage />} />
                    <Route path="marcas" element={<BrandsPage />} />
                    <Route path="avaliacoes" element={<ReviewsPage />} />
                    <Route path="orcamento" element={<BudgetPage />} />
                    <Route path="backup" element={<BackupPage />} />
                    <Route path="ajustes" element={<SettingsPage />} />
                    <Route path="mais" element={<MorePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </Suspense>
              </OnboardingProvider>
              {!isNative && <UpdatePrompt />}
            </ActionsProvider>
          </HashRouter>
        </FeedbackProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
