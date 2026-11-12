import type { Metadata } from 'next';
import { QueryClient, dehydrate } from '@tanstack/react-query';
import './globals.css';
import { Providers } from './providers';
import { queryKeys } from '@/lib/queryKeys';
import { getCurrentUserProfile } from '@/lib/auth/getCurrentUserProfile';

export const metadata: Metadata = {
  title: 'Costaff North ATS - Org Overview',
  description: 'Applicant Tracking System Delivery Head Dashboard',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const serverQueryClient = new QueryClient();
  await serverQueryClient.prefetchQuery({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUserProfile,
  });
  const dehydratedState = dehydrate(serverQueryClient);

  return (
    <html lang="en">
      <body>
        <Providers dehydratedState={dehydratedState}>{children}</Providers>
      </body>
    </html>
  );
}
