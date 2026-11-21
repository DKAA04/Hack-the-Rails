import type { CreateOrderRequest, Order } from "@wayward/contracts";
import { unfinished } from "../errors";
export async function createOrder(
  _request: CreateOrderRequest,
): Promise<Order> {
  return unfinished("Durable trip ordering");
}
export async function getOrder(_id: string): Promise<Order> {
  return unfinished("Order retrieval");
}
