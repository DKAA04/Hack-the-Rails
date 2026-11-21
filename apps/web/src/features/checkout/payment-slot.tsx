import { Icon } from "../../components/icons";
import { buttonClass, cx } from "../../components/ui";
import type { ErrorView } from "../common/mappers/errors";

/**
 * Renders whatever the backend's checkout step provides. There are no card
 * fields in Wayward's code: payment happens on the provider's hosted page.
 */
export type PaymentSlotState =
  | { kind: "waiting" }
  | { kind: "unavailable"; error: ErrorView }
  | { kind: "redirect"; url: string };

export function PaymentSlot({ state }: { state: PaymentSlotState }) {
  if (state.kind === "redirect") {
    let host = "the payment provider";
    try {
      host = new URL(state.url).host;
    } catch {
      /* keep generic */
    }
    return (
      <div className="mt-4">
        <p className="text-body-sm text-text-muted">You&apos;ll pay on {host}&apos;s secure page, then come back here for your order status.</p>
        <a href={state.url} className={cx(buttonClass("primary"), "mt-4 no-underline")} rel="noopener">
          Continue to secure payment
          <Icon name="external" size={18} />
        </a>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-md border border-dashed border-line-strong bg-paper p-4">
      <p className="flex items-center gap-2 font-semibold">
        <Icon name="shield" size={18} className="text-text-muted" />
        {state.kind === "unavailable" ? "Payment isn't available yet" : "Payment opens after the seller confirms"}
      </p>
      <p className="mt-1 text-body-sm text-text-muted">
        {state.kind === "unavailable"
          ? "Wayward doesn't take payments yet. Nothing has been charged, and no card details were asked for or stored."
          : "Once the price is confirmed and the order is placed, you'll pay on the payment provider's secure page. Wayward never sees your card number."}
      </p>
      {state.kind === "unavailable" && state.error.requestId ? (
        <p className="mt-1 text-caption text-text-muted">Support code {state.error.requestId}</p>
      ) : null}
    </div>
  );
}
