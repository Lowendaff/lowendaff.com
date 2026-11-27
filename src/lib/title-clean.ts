/** Strip leading regional-indicator flag emoji pairs when a vector Flag badge is shown alongside. */
export function stripLeadingFlags(raw: string): string {
  return raw.replace(/^(?:\p{Regional_Indicator}{2}\s*)+/u, '');
}
