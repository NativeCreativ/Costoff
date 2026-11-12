/**
 * Shared list-value validation for settings-backed fields.
 *
 * Rule: on create, a value must be in the ACTIVE list. On update it may also
 * stay on the record's existing (possibly inactive) value — the grandfather
 * clause — so legacy records keep being saveable. Empty/missing means "not
 * provided" for optional fields and is always allowed.
 */
export function isAllowedListValue(
  newValue: string | null | undefined,
  currentValue: string | null | undefined,
  activeValues: string[]
): boolean {
  if (newValue === undefined || newValue === null || newValue === '') return true;
  const incoming = newValue.trim().toLowerCase();
  if (incoming === '') return true;
  if (activeValues.map((v) => v.trim().toLowerCase()).includes(incoming)) return true;
  const current = currentValue === undefined || currentValue === null ? '' : String(currentValue);
  return current.trim().toLowerCase() === incoming;
}

/** ID flavour of {@link isAllowedListValue}: exact equality, no case folding. */
export function isAllowedListId(
  newValue: string | null | undefined,
  currentValue: string | null | undefined,
  activeIds: string[]
): boolean {
  if (newValue === undefined || newValue === null || newValue === '') return true;
  if (activeIds.includes(newValue)) return true;
  return currentValue === newValue;
}
