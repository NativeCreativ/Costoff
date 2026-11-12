import { api } from '@/lib/axios';
import { Offer, Onboarding } from '@/components/types';

export async function getOffers(status?: string): Promise<Offer[]> {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  const { data } = await api.get('/offers', { params });
  return data.offers || [];
}

export async function deleteOffer(id: string): Promise<void> {
  await api.delete('/offers', { params: { id } });
}

export async function getOnboardings(bgv?: string): Promise<Onboarding[]> {
  const params: Record<string, string> = {};
  if (bgv) params.bgv = bgv;
  const { data } = await api.get('/onboardings', { params });
  return data.onboardings || [];
}
