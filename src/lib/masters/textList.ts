/**
 * Case-insensitive membership for master values stored as plain text.
 * `firstDisallowedText` treats an empty active list as "master not seeded yet"
 * and allows the value, so a database that has not been migrated does not
 * reject every demand save.
 */
export function isKnownOrCurrent(
  value: string,
  currentValues: string[],
  activeValues: string[]
): boolean {
  const incoming = value.trim().toLowerCase();
  if (!incoming) return true;
  if (activeValues.some((v) => v.trim().toLowerCase() === incoming)) return true;
  return currentValues.some((v) => v.trim().toLowerCase() === incoming);
}

/** First value that is neither an active master name nor already saved on the record. */
export function firstDisallowedText(
  values: string[],
  currentValues: string[],
  activeValues: string[]
): string | null {
  if (activeValues.length === 0) return null;
  for (const value of values) {
    if (!isKnownOrCurrent(value, currentValues, activeValues)) return value;
  }
  return null;
}
