'use client';

import { UserSelect } from '@/components/ui/UserSelect';
import { Loader } from '@/components/ui/Loader';
import { useSkillsLibraryQuery } from '@/queries/settings/useSkillsLibraryQueries';
import {
  useDemandTypeSkillGroupsQuery,
  useNamedMasterQuery,
  useSetDemandTypeSkillGroupsMutation,
} from '@/queries/masterData/useMasterData';

/**
 * Master Data → Demand Type → Skill groups. Links each Demand Type to the Skill Groups that fit
 * it; on the demand form, picking the type narrows the Skill Group picker to these (with a
 * "Show all" escape). A type with no groups linked does not narrow anything.
 *
 * Saves on every change, like every other settings list (docs/RULES.md §2) — there is no Save
 * button. Only active types and groups are offered; a linked group that was later deactivated
 * stays listed (tagged Inactive) so it is never silently dropped.
 */
export function DemandTypeSkillGroupsSection() {
  const typesQuery = useNamedMasterQuery('demand-types');
  const libraryQuery = useSkillsLibraryQuery();
  const linksQuery = useDemandTypeSkillGroupsQuery();
  const saveLinks = useSetDemandTypeSkillGroupsMutation();

  const groups = libraryQuery.data ?? [];
  const types = typesQuery.data ?? [];
  const linkedIds = (typeId: string) => linksQuery.data?.find((link) => link.demand_type_id === typeId)?.skill_category_ids ?? [];

  const isLoading = typesQuery.isLoading || libraryQuery.isLoading || linksQuery.isLoading;

  return (
    <div className="mt-6 rounded-[10px] border border-[#e2e8f0] bg-white p-4">
      <div className="mb-1 text-[0.85rem] font-bold text-[#0f172a]">Skill groups per demand type</div>
      <p className="mb-3 text-[0.78rem] text-[#64748b]">
        Pick the Skill Groups that fit each demand type. On the demand form, choosing the type shows these groups first
        when selecting Required Skills. Skill Groups are managed in Demand Fulfillment Settings → Skills Library.
      </p>
      {isLoading ? (
        <Loader message="Loading…" size="sm" />
      ) : types.length === 0 ? (
        <p className="text-[0.78rem] text-[#94a3b8]">Add a demand type above first.</p>
      ) : groups.length === 0 ? (
        <p className="text-[0.78rem] text-[#94a3b8]">No skill groups yet. Add them in the Skills Library first.</p>
      ) : (
        <div className="flex flex-col divide-y divide-[#f1f5f9]">
          {types.map((type) => {
            const selected = linkedIds(type.id);
            const options = [
              ...groups.map((group) => ({ id: group.id, name: group.name })),
              // A linked group missing from the active list was deactivated; keep it visible.
              ...selected
                .filter((id) => !groups.some((group) => group.id === id))
                .map((id) => ({ id, name: 'Inactive skill group', role: 'Inactive' })),
            ];
            return (
              <div key={type.id} className="grid grid-cols-1 items-center gap-2 py-2.5 sm:grid-cols-[200px_1fr]">
                <div className="text-[0.83rem] font-semibold text-[#334155]">{type.name}</div>
                <UserSelect
                  mode="multiple"
                  placeholder="No skill groups (shows all on the form)"
                  options={options}
                  value={selected}
                  disabled={saveLinks.isPending}
                  onChange={(ids) => saveLinks.mutate({ demandTypeId: type.id, skillCategoryIds: ids })}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
