"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "../../components/icons";
import { Badge, Button, PageHeader } from "../../components/ui";
import { formatDateTime, plural } from "../../lib/format";
import { tripTotal } from "../trip/conflicts";
import { useTrip } from "../trip/store";

export function AccountView() {
  const trip = useTrip();
  const router = useRouter();
  return (
    <>
      <PageHeader title="Account" />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <section aria-labelledby="profile-title" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 id="profile-title" className="text-title">
              Profile
            </h2>
            <Badge>Not available yet</Badge>
          </div>
          <p className="mt-3 text-body-sm text-text-muted">
            Sign-in isn&apos;t connected yet, so there&apos;s no profile to show. Your trip and saved trips live in
            this browser only, and nothing about you is stored on our side.
          </p>
          <ul className="mt-4 space-y-2 text-body-sm">
            <li className="flex items-center gap-2">
              <Icon name="route" size={16} className="text-text-muted" />
              Current trip: {trip.ready ? plural(trip.items.length, "journey") : "…"}
            </li>
            <li className="flex items-center gap-2">
              <Icon name="ticket" size={16} className="text-text-muted" />
              <Link href="/orders" className="underline">
                Orders and tickets
              </Link>
            </li>
          </ul>
        </section>

        <section id="saved" aria-labelledby="saved-title" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
          <h2 id="saved-title" className="text-title">
            Saved trips
          </h2>
          {!trip.ready ? null : trip.saved.length ? (
            <ul className="mt-3 divide-y divide-line">
              {trip.saved.map((s) => {
                const first = s.items[0];
                const last = s.items[s.items.length - 1];
                const total = tripTotal(s.items);
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{s.name}</p>
                      <p className="truncate text-body-sm text-text-muted">
                        {first && last ? `${first.origin.name} → ${last.destination.name} · ` : ""}
                        {plural(s.items.length, "journey")} · {total.knownDisplay}
                        {total.unknownCount ? ` + ${total.unknownCount} unknown` : ""} · saved {formatDateTime(s.savedAt)}
                      </p>
                      <p className="text-caption text-text-muted">Prices were checked when saved and may have changed.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          trip.restore(s.id);
                          router.push("/trip");
                        }}
                      >
                        Open
                      </Button>
                      <Button size="sm" variant="danger" icon="trash" aria-label={`Delete ${s.name}`} onClick={() => trip.deleteSaved(s.id)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-body text-text-muted">
              No saved trips. Build a trip, then use <strong>Save this trip</strong> in the summary to keep it here.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
