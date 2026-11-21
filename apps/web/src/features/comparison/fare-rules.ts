import { formatMoney } from "../../lib/format";
import type { SellerRuleView, SellerRulesView } from "./mappers/journey";

const fee = (r: SellerRuleView) => (r.fee ? formatMoney(r.fee) : null);

export function refundText(r: SellerRuleView | null) {
  if (!r || r.allowed === null) return "Refund rules unknown";
  if (!r.allowed) return "Non-refundable";
  return fee(r) ? `Refundable, ${fee(r)} fee` : "Refundable, fee unknown";
}
export function changeText(r: SellerRuleView | null) {
  if (!r || r.allowed === null) return "Change rules unknown";
  if (!r.allowed) return "No changes";
  return fee(r) ? `Changes ${fee(r)}` : "Changes allowed, fee unknown";
}
/** One short line for cards, e.g. "Non-refundable · changes €10.00". */
export function sellerRulesLine(rules: SellerRulesView | null) {
  if (!rules) return null;
  const c = changeText(rules.changeBeforeDeparture);
  return `${refundText(rules.refundBeforeDeparture)} · ${c.charAt(0).toLowerCase()}${c.slice(1)}`;
}
