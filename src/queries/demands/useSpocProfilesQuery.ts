import { useUsersQuery } from '@/queries/users/useUsersQuery';

/** SPOC profiles eligible as a Demand's spoc_profile_id. */
export function useSpocProfilesQuery() {
  const spocQuery = useUsersQuery({ role: 'spoc', pageSize: 100 });

  return {
    data: spocQuery.data?.data ?? [],
    isLoading: spocQuery.isLoading,
  };
}
