import { useUsersQuery } from '@/queries/users/useUsersQuery';

/** Recruiters (TA) eligible to be assigned to a Demand. */
export function useRecruiterProfilesQuery() {
  const taQuery = useUsersQuery({ role: 'ta', pageSize: 100 });

  return {
    data: taQuery.data?.data ?? [],
    isLoading: taQuery.isLoading,
  };
}
