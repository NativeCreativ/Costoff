'use client';

import { QueryClientProvider, HydrationBoundary, type DehydratedState } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { getQueryClient } from '@/lib/queryClient';
import { store } from '@/redux/store';
import { ToastProvider } from '@/components/ui/Toast';

export function Providers({ children, dehydratedState }: { children: React.ReactNode; dehydratedState?: DehydratedState }) {
  // Per request on the server, one per tab in the browser — see getQueryClient.
  const queryClient = getQueryClient();
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <HydrationBoundary state={dehydratedState}>
            {children}
          </HydrationBoundary>
        </ToastProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
}
