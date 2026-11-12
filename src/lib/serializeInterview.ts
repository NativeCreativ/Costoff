/**
 * Prisma returns `scheduled_date` as a Date, and `scheduled_time`/`end_time` (DB `Time`
 * columns) as Date objects anchored to 1970-01-01 — the frontend's date/time inputs and
 * validation (timeOnlyField, HH:MM) expect plain 'YYYY-MM-DD'/'HH:MM' strings instead.
 * Every route returning an interview must serialize through this, including update
 * responses that feed straight back into an edit form's defaultValues — an unserialized
 * end_time (a full ISO datetime string) round-tripping into a save would otherwise fail
 * the 'Must be a valid time (HH:MM)' validation on the next edit.
 */
export function serializeInterview(iv: any) {
  const scheduled_date = iv.scheduled_date;
  const scheduled_time = iv.scheduled_time;
  const end_time = iv.end_time;
  return {
    ...iv,
    // The round name lives in the `level` column (denormalized from round_id). Alias it to
    // the explicit `round_name` the frontend reads, so every interview surface — detail
    // panel, calendar, list — names the round instead of rendering a blank heading.
    round_name: iv.round_name ?? iv.level ?? null,
    scheduled_date:
      scheduled_date instanceof Date ? scheduled_date.toISOString().split('T')[0] : scheduled_date,
    scheduled_time:
      scheduled_time instanceof Date ? scheduled_time.toISOString().split('T')[1]?.slice(0, 5) ?? null : scheduled_time,
    end_time:
      end_time instanceof Date ? end_time.toISOString().split('T')[1]?.slice(0, 5) ?? null : end_time,
  };
}
