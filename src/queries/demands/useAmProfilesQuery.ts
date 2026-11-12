import { useUsersQuery } from '@/queries/users/useUsersQuery';

/** Account Manager profiles eligible as a Demand's contact_profile_id (AM-only). */
export function useAmProfilesQuery() {
  const amQuery = useUsersQuery({ role: 'account_manager', pageSize: 100 });

  return {
    data: amQuery.data?.data ?? [],
    isLoading: amQuery.isLoading,
  };
}
