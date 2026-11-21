import { MoneySchema, type Money } from "@wayward/contracts";
export function decimalMoney(value: string, currency: string): Money {
  if (!Intl.supportedValuesOf("currency").includes(currency))
    throw new Error("Unsupported currency minor-unit definition");
  const digits = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits;
  if (digits === undefined || !/^\d+(\.\d+)?$/.test(value))
    throw new Error("Invalid supplier amount");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.slice(digits).replace(/0/g, ""))
    throw new Error("Supplier amount cannot be represented in minor units");
  const amount =
    BigInt(whole!) * 10n ** BigInt(digits) +
    BigInt(fraction.slice(0, digits).padEnd(digits, "0") || "0");
  return MoneySchema.parse({ amount: Number(amount), currency });
}
