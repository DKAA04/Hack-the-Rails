import type { RecordTransaction } from "../db/records";
import { transaction } from "../db/records";
import { ServiceError } from "../errors";
import { StoredOrderSchema, type StoredOrder } from "./index";
export async function mutateOrder<T>(
  id: string,
  run: (stored: StoredOrder, records: RecordTransaction) => Promise<T> | T,
): Promise<T> {
  return transaction(async (records) => {
    await records.lock(`wayward-order:${id}`);
    const raw = await records.get("order", id, true);
    if (!raw) throw new ServiceError("NOT_FOUND", "Order not found.", 404);
    const stored = StoredOrderSchema.parse(raw);
    stored.order.updatedAt = new Date().toISOString();
    const result = await run(stored, records);
    await records.put("order", id, stored);
    return result;
  });
}
