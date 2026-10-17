/** "6281234567890" (as Supabase keeps it) → "0812-3456-7890". */
export function localPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) digits = "0" + digits.slice(2);
  return [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8)].filter(Boolean).join("-");
}
