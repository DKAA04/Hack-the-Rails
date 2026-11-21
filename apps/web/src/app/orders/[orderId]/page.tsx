import type { Metadata } from "next";
import { OrderPage } from "../../../features/account/order-page";

export const metadata: Metadata = { title: "Order" };

export default async function OrderRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ sample?: string; checkout?: string }>;
}) {
  const [{ orderId }, { sample, checkout }] = await Promise.all([params, searchParams]);
  return (
    <OrderPage
      orderId={decodeURIComponent(orderId)}
      sample={orderId === "sample" ? (sample ?? "confirmed") : null}
      checkoutReturn={checkout === "returned" || checkout === "cancelled" ? checkout : null}
    />
  );
}
