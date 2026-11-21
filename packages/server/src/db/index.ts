import type { Order } from "@wayward/contracts";
export interface OrderRepository {
  find(id: string): Promise<Order | null>;
  save(order: Order, idempotencyKey: string): Promise<void>;
}
// PostgreSQL is the durable target. No in-memory success fallback for customer orders.
export interface DatabaseAdapter {
  orders: OrderRepository;
  ping(): Promise<boolean>;
}
export const database: DatabaseAdapter | null = null;
