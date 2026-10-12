/** Only compare plain release versions; unknown/dev/prerelease values are ambiguous. */
export function isOlderRelease(installed?: string | null, available?: string | null): boolean {
  const parse = (value?: string | null) => {
    if (!value || !/^v?\d+\.\d+\.\d+$/.test(value)) return null;
    const parts = value.replace(/^v/, "").split(".").map(Number);
    return parts.every(Number.isSafeInteger) ? parts : null;
  };
  const left = parse(installed);
  const right = parse(available);
  if (!left || !right) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i] < right[i];
  }
  return false;
}
