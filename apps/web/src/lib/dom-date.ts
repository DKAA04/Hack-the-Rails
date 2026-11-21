/**
 * Native date inputs can show a date that never reached React state: browser
 * autofill, extensions and automation sometimes set the field without firing
 * input events, and a partly typed date shows segments while its value is "".
 * Read what the field really holds at submit time.
 */
export function readDateField(id: string): { value: string; incomplete: boolean } {
  if (typeof document === "undefined") return { value: "", incomplete: false };
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement)) return { value: "", incomplete: false };
  return { value: el.value, incomplete: el.validity.badInput };
}
