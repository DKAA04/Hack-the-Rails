"use client";
import { useId } from "react";
import { Icon } from "../../components/icons";
import { Button, cx } from "../../components/ui";
import { newKey, newPassenger, type FieldErrors, type PassengerDraft } from "./mappers/intent";

const DISCOUNT_SUGGESTIONS = [
  "BahnCard 25",
  "BahnCard 50",
  "Carte Avantage",
  "16-25 Railcard",
  "Senior Railcard",
  "Interrail Pass",
  "Eurail Pass",
  "Student card",
];

export function passengerSummary(ps: PassengerDraft[]) {
  const bags = ps.reduce((n, p) => n + p.cabinBags + p.checkedBags, 0);
  const cards = ps.reduce((n, p) => n + p.discounts.length, 0);
  return [
    `${ps.length} ${ps.length === 1 ? "traveller" : "travellers"}`,
    `${bags} ${bags === 1 ? "bag" : "bags"}`,
    cards ? `${cards} ${cards === 1 ? "card" : "cards"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function Stepper({
  label,
  value,
  min = 0,
  max = 9,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex items-center justify-between gap-3">
      <span id={id} className="text-body-sm">
        {label}
      </span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Fewer: ${label}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="flex size-9 items-center justify-center rounded-md border border-line-strong bg-surface hover:border-ink disabled:opacity-40"
        >
          <Icon name="minus" size={16} />
        </button>
        <output aria-live="polite" className="tnum w-8 text-center font-semibold">
          {value}
        </output>
        <button
          type="button"
          aria-label={`More: ${label}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="flex size-9 items-center justify-center rounded-md border border-line-strong bg-surface hover:border-ink disabled:opacity-40"
        >
          <Icon name="plus" size={16} />
        </button>
      </span>
    </div>
  );
}

export function PassengerEditor({
  passengers,
  onChange,
  errors,
}: {
  passengers: PassengerDraft[];
  onChange: (ps: PassengerDraft[]) => void;
  errors: FieldErrors;
}) {
  const listId = useId();
  const update = (i: number, patch: Partial<PassengerDraft>) =>
    onChange(passengers.map((p, k) => (k === i ? { ...p, ...patch } : p)));

  return (
    <div className="space-y-4">
      <datalist id={listId}>
        {DISCOUNT_SUGGESTIONS.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
      <ol className="grid gap-4 md:grid-cols-2">
        {passengers.map((p, i) => {
          const ageId = `passenger-${i}-age`;
          const ageErr = errors[ageId];
          return (
            <li key={p.key} className="rounded-md border border-line bg-paper p-4">
              <fieldset>
                <legend className="flex w-full items-center justify-between">
                  <span className="text-title font-semibold">Traveller {i + 1}</span>
                </legend>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <label htmlFor={ageId} className="mb-1 block text-label">
                      Age on travel date
                    </label>
                    <input
                      id={ageId}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      value={p.age}
                      onChange={(e) => update(i, { age: e.target.value.replace(/\D/g, "") })}
                      aria-invalid={ageErr ? true : undefined}
                      aria-describedby={ageErr ? `${ageId}-error` : undefined}
                      className={cx(
                        "tnum h-10 w-24 rounded-md border bg-surface px-3",
                        ageErr ? "border-danger" : "border-line-strong",
                      )}
                    />
                  </div>
                  {passengers.length > 1 ? (
                    <Button
                      variant="quiet"
                      size="sm"
                      icon="trash"
                      onClick={() => onChange(passengers.filter((_, k) => k !== i))}
                      aria-label={`Remove traveller ${i + 1}`}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                {ageErr ? (
                  <p id={`${ageId}-error`} className="mt-1 flex items-center gap-1 text-caption font-semibold text-danger">
                    <Icon name="alert" size={14} />
                    {ageErr}
                  </p>
                ) : null}
                <div className="mt-4 space-y-2">
                  <Stepper label="Cabin bags" value={p.cabinBags} onChange={(n) => update(i, { cabinBags: n })} />
                  <Stepper label="Checked bags" value={p.checkedBags} onChange={(n) => update(i, { checkedBags: n })} />
                  <Stepper label="Bicycles" value={p.bicycles} max={2} onChange={(n) => update(i, { bicycles: n })} />
                </div>
                <div className="mt-4 space-y-2">
                  {p.discounts.map((d, j) => {
                    const did = `passenger-${i}-discount-${j}`;
                    const derr = errors[did];
                    return (
                      <div key={d.key} className="rounded-md border border-line bg-surface p-3">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label htmlFor={did} className="mb-1 block text-label">
                              Discount or rail card
                            </label>
                            <input
                              id={did}
                              list={listId}
                              value={d.scheme}
                              placeholder="e.g. BahnCard 50"
                              aria-invalid={derr ? true : undefined}
                              aria-describedby={derr ? `${did}-error` : undefined}
                              onChange={(e) =>
                                update(i, {
                                  discounts: p.discounts.map((x, k) => (k === j ? { ...x, scheme: e.target.value } : x)),
                                })
                              }
                              className={cx("h-10 w-full rounded-md border bg-surface px-3", derr ? "border-danger" : "border-line-strong")}
                            />
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove discount card ${j + 1} for traveller ${i + 1}`}
                            onClick={() => update(i, { discounts: p.discounts.filter((_, k) => k !== j) })}
                            className="flex size-10 items-center justify-center rounded-md text-text-muted hover:bg-paper hover:text-ink"
                          >
                            <Icon name="close" size={18} />
                          </button>
                        </div>
                        {derr ? (
                          <p id={`${did}-error`} className="mt-1 flex items-center gap-1 text-caption font-semibold text-danger">
                            <Icon name="alert" size={14} />
                            {derr}
                          </p>
                        ) : null}
                        <label htmlFor={`${did}-ref`} className="mt-2 mb-1 block text-label">
                          Card number <span className="font-normal text-text-muted">(optional)</span>
                        </label>
                        <input
                          id={`${did}-ref`}
                          value={d.cardReference}
                          autoComplete="off"
                          onChange={(e) =>
                            update(i, {
                              discounts: p.discounts.map((x, k) => (k === j ? { ...x, cardReference: e.target.value } : x)),
                            })
                          }
                          aria-describedby={`${did}-ref-hint`}
                          className="h-10 w-full rounded-md border border-line-strong bg-surface px-3"
                        />
                        <p id={`${did}-ref-hint`} className="mt-1 text-caption text-text-muted">
                          Never stored with your search history. Sellers check cards themselves.
                        </p>
                      </div>
                    );
                  })}
                  <Button
                    variant="quiet"
                    size="sm"
                    icon="plus"
                    onClick={() =>
                      update(i, { discounts: [...p.discounts, { key: newKey(), scheme: "", cardReference: "" }] })
                    }
                  >
                    Add discount card
                  </Button>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          icon="plus"
          disabled={passengers.length >= 20}
          onClick={() => onChange([...passengers, newPassenger("")])}
        >
          Add traveller
        </Button>
        <p className="text-caption text-text-muted">
          Bags go to sellers as a trip total. Each seller decides what&apos;s included.
        </p>
      </div>
      {errors.passengers ? <p className="text-caption font-semibold text-danger">{errors.passengers}</p> : null}
    </div>
  );
}
