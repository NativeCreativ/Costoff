import { useUsersQuery } from '@/queries/users/useUsersQuery';

const CONTACT_ROLES = ['account_manager', 'spoc'] as const;

/** AMs and SPOCs eligible as the Demand's contact profile. */
export function useContactProfilesQuery() {
  const amQuery = useUsersQuery({ role: 'account_manager', pageSize: 100 });
  const spocQuery = useUsersQuery({ role: 'spoc', pageSize: 100 });

  const profiles = [...(amQuery.data?.data ?? []), ...(spocQuery.data?.data ?? [])];

  return {
    data: profiles,
    isLoading: amQuery.isLoading || spocQuery.isLoading,
  };
}

export { CONTACT_ROLES };
