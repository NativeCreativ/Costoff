import type { CompanyFormValues } from '@/components/companies/CompanyForm';
import type { CompanyFormPayload, CompanyRoundWrite } from '@/services/company.service';
import type { ConfiguredRound } from '@/services/interviewRound.service';

/**
 * THE single mapping from `CompanyForm`'s values to the API's create/update payload shape.
 * Shared by the Clients Master modal and the Add Demand "Add Client" drawer, so the two can
 * never drift into validating or saving a company differently.
 */
export function companyFormValuesToPayload(values: CompanyFormValues): CompanyFormPayload {
  const name = values.name.trim();
  return {
    name,
    // One visible Client Name. Both columns stay aligned so demand mirrors and
    // older readers of client_name keep showing the same label.
    client_name: name,
    email: values.email,
    phone: values.phone,
    website: values.website,
    address: values.address,
    city: values.city,
    state: values.state,
    country: values.country,
    other_details: values.other_details,
    status: values.status,
    spocs: values.spocs.filter((spoc) => spoc.name.trim()),
  };
}

/**
 * THE single mapping from `InterviewRoundConfigurator`'s rounds to the API's round-write shape.
 * Rounds are sent by NAME as well as master id — the name is the stored identity and the server
 * re-resolves the master row, so a round added here can never persist a bad id. Order is
 * rewritten to a dense 1..n from the on-screen (drag) order.
 */
export function companyRoundsToPayload(rounds: ConfiguredRound[]): CompanyRoundWrite[] {
  return rounds.map((r, i) => ({
    round_id: r.round_id ?? null,
    name: r.name.trim(),
    mode: r.mode?.trim() || null,
    order: i + 1,
    mandatory: !!r.mandatory,
    isActive: r.isActive !== false,
  }));
}

/** Case- and whitespace-insensitive fingerprint of a round list, for "did anything actually
 *  change" comparisons — used to decide whether to confirm a destructive clear, or (in the Add
 *  Demand drawer) to de-duplicate rounds the user already typed into the Demand form. */
export function companyRoundsFingerprint(list: { name?: string | null; mode?: string | null; mandatory?: boolean; isActive?: boolean }[]): string {
  return list
    .map((r) => `${(r.name ?? '').trim().toLowerCase()}:${r.mode?.trim().toLowerCase() || ''}:${!!r.mandatory}:${r.isActive !== false}`)
    .join('|');
}
