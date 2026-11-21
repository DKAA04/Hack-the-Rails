"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "../../components/icons";
import { cx } from "../../components/ui";
import { api } from "../../lib/api-client";
import { isAbort, toErrorView, type ErrorView } from "../common/mappers/errors";
import type { ModeKey as Mode } from "../comparison/mappers/journey";
import {
  toPlaceLookupView,
  type PlaceKind,
  type PlaceLookupView,
  type PlaceOption,
  type PlaceSourceView,
} from "./mappers/places";

const KIND_ICON: Record<PlaceKind, IconName> = {
  city: "pin",
  airport: "flight",
  station: "rail",
  port: "ferry",
  local_stop: "local_transit",
};

type Status = "idle" | "loading" | "done" | "error";

export function PlaceCombobox({
  id,
  label,
  placeholder,
  value,
  onChange,
  modes,
  error,
  onSources,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: PlaceOption | null;
  onChange: (p: PlaceOption | null) => void;
  modes?: Mode[];
  error?: string;
  onSources?: (sources: PlaceSourceView[]) => void;
}) {
  const listId = useId();
  const statusId = useId();
  const errorId = `${id}-error`;
  const [text, setText] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<Status>("idle");
  const [view, setView] = useState<PlaceLookupView | null>(null);
  const [failure, setFailure] = useState<ErrorView | null>(null);
  const [sources, setSources] = useState<PlaceSourceView[]>([]);
  const seq = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const typed = useRef(false);
  const modesKey = modes?.join(",") ?? "";
  const onSourcesRef = useRef(onSources);
  onSourcesRef.current = onSources;

  // Keep the input in sync when the selection is set from outside (swap, restore).
  useEffect(() => {
    if (value && value.name !== text && !typed.current) setText(value.name);
    if (!value && !typed.current) setText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!typed.current) return;
    const q = text.trim();
    controller.current?.abort();
    if (q.length < 2) {
      setStatus("idle");
      setView(null);
      return;
    }
    const mySeq = ++seq.current;
    setStatus("loading");
    const timer = window.setTimeout(() => {
      const ac = new AbortController();
      controller.current = ac;
      api
        .places(q, { limit: 8, modes: modesKey ? (modesKey.split(",") as Mode[]) : undefined, signal: ac.signal })
        .then((r) => {
          if (mySeq !== seq.current) return; // stale response
          const v = toPlaceLookupView(r);
          setView(v);
          setSources(v.sources);
          onSourcesRef.current?.(v.sources);
          setFailure(null);
          setStatus("done");
          setActive(v.options.length ? 0 : -1);
        })
        .catch((e) => {
          if (isAbort(e) || mySeq !== seq.current) return;
          setFailure(toErrorView(e));
          setStatus("error");
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [text, modesKey]);

  useEffect(() => () => controller.current?.abort(), []);

  const options = view?.options ?? [];
  const showList = open && text.trim().length >= 2 && status !== "idle";

  function select(p: PlaceOption) {
    typed.current = false;
    setText(p.name);
    onChange(p);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => (options.length ? (i + 1) % options.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => (options.length ? (i <= 0 ? options.length - 1 : i - 1) : -1));
    } else if (e.key === "Enter") {
      if (showList && active >= 0 && options[active]) {
        e.preventDefault();
        select(options[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const announce =
    status === "loading"
      ? "Looking up places"
      : status === "error"
        ? "Place lookup failed"
        : status === "done" && open
          ? options.length
            ? `${options.length} ${options.length === 1 ? "place" : "places"} found. Use up and down arrows to choose.`
            : "No matching places"
          : "";

  const describedBy = [error ? errorId : null, `${id}-hint`].filter(Boolean).join(" ");

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-2 block text-label">
        {label}
      </label>
      <div className="relative">
        <Icon
          name={value ? KIND_ICON[value.kind] : "pin"}
          size={18}
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-muted"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-opt-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            typed.current = true;
            setText(e.target.value);
            setOpen(true);
            if (value) onChange(null); // edited text is no longer a resolved place
          }}
          onFocus={() => text.trim().length >= 2 && setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={cx(
            "h-12 w-full rounded-md border bg-surface pr-10 pl-11 text-body text-ink placeholder:text-text-subtle",
            "transition-colors focus:border-ink",
            error ? "border-danger" : "border-line-strong",
          )}
        />
        {status === "loading" ? (
          <span
            aria-hidden="true"
            className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-text-subtle border-r-transparent"
          />
        ) : value ? (
          <Icon name="check" size={18} className="absolute top-1/2 right-4 -translate-y-1/2 text-ok" title="Place selected" />
        ) : null}
      </div>

      <p id={`${id}-hint`} className="mt-1 min-h-[1.1rem] text-caption text-text-muted">
        {value
          ? `${value.kindLabel}${value.countryName ? `, ${value.countryName}` : ""} · ${value.timeZone}`
          : text.trim().length > 0 && !open
            ? "Pick a place from the list. Typed text alone can't be searched."
            : "Cities, airports, stations, ports or stops"}
      </p>
      {error ? (
        <p id={errorId} className="mt-1 flex items-center gap-1 text-caption font-semibold text-danger">
          <Icon name="alert" size={14} />
          {error}
        </p>
      ) : null}

      <span id={statusId} role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>

      <div
        className={cx(
          "absolute inset-x-0 top-[76px] z-30 overflow-hidden rounded-md border border-line bg-surface shadow-float",
          !showList && "hidden",
        )}
      >
        <ul id={listId} role="listbox" aria-label={`${label} suggestions`} className="max-h-80 overflow-y-auto py-1">
          {status === "loading" && !options.length
            ? [0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3" aria-hidden="true">
                  <span className="skeleton size-5" />
                  <span className="skeleton h-4 flex-1" />
                </li>
              ))
            : null}
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => select(o)}
              className={cx(
                "flex cursor-pointer items-center gap-3 px-4 py-2.5",
                i === active ? "bg-lime-wash" : "hover:bg-paper",
              )}
            >
              <Icon name={KIND_ICON[o.kind]} size={18} className="shrink-0 text-text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{o.name}</span>
                <span className="block truncate text-caption text-text-muted">
                  {o.kindLabel}
                  {o.countryName ? ` · ${o.countryName}` : ""}
                </span>
              </span>
            </li>
          ))}
          {status === "done" && !options.length ? (
            <li className="px-4 py-3 text-body-sm text-text-muted">
              No places match &ldquo;{text.trim()}&rdquo;. Try the city name, or check the spelling.
            </li>
          ) : null}
          {status === "error" && failure ? (
            <li className="px-4 py-3 text-body-sm">
              <span className="font-semibold text-danger">{failure.title}.</span>{" "}
              <span className="text-text-muted">
                {failure.kind === "unavailable"
                  ? "No place source answered. Try again in a moment."
                  : failure.message}
              </span>
            </li>
          ) : null}
        </ul>
        {sources.length ? (
          <div className="border-t border-line bg-paper px-4 py-2 text-caption text-text-muted">
            <SourceList sources={sources} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SourceList({ sources }: { sources: PlaceSourceView[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {sources.map((s) => (
        <li key={s.id} className="inline-flex items-center gap-1">
          <span
            aria-hidden="true"
            className={cx("size-1.5 rounded-full", s.status === "ok" ? "bg-ok" : s.status === "unavailable" ? "bg-danger" : "bg-line-strong")}
          />
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-line-strong hover:text-ink"
            onMouseDown={(e) => e.preventDefault()}
          >
            {s.attribution}
          </a>
          {s.status !== "ok" ? <span>({s.statusLabel.toLowerCase()})</span> : null}
        </li>
      ))}
    </ul>
  );
}
