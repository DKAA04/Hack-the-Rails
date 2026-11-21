"use client";
import { Icon } from "../../components/icons";
import { Badge, Button, cx } from "../../components/ui";

/**
 * What a future parsing service returns, already mapped to view terms.
 * Nothing in the frontend produces this: there is no client-side guessing.
 */
export interface ParsedField {
  key: string;
  label: string;
  /** What the parser read from the sentence. */
  heard: string;
  /** Structured value it proposes, shown for the traveller to accept or edit. */
  proposed: string;
  confidence: "high" | "low";
  /** Places must come back resolved via place lookup, never as raw text. */
  needsPlaceLookup?: boolean;
}
export type ParseState =
  | { status: "not_connected"; reason: string }
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "parsed"; fields: ParsedField[] }
  | { status: "error"; message: string };

export function NaturalLanguageField({
  value,
  onChange,
  parse,
  onParse,
  onApply,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  parse: ParseState;
  onParse: () => void;
  onApply: (f: ParsedField) => void;
  error?: string;
}) {
  const disabled = parse.status === "not_connected";
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="naturalLanguage" className="text-label">
          Or describe the trip
        </label>
        {disabled ? (
          <Badge tone="neutral" icon="info">
            Not connected
          </Badge>
        ) : null}
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <textarea
          id="naturalLanguage"
          rows={2}
          maxLength={4000}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Brussels to Porto under 150 euros, avoid night buses"
          aria-describedby="nl-preview"
          aria-invalid={error ? true : undefined}
          className={cx(
            "min-h-12 w-full flex-1 resize-y rounded-md border bg-surface px-4 py-3 text-body placeholder:text-text-subtle focus:border-ink",
            error ? "border-danger" : "border-line-strong",
          )}
        />
        <Button
          variant="ghost"
          icon="sparkle"
          onClick={onParse}
          disabled={disabled || !value.trim() || parse.status === "parsing"}
          loading={parse.status === "parsing"}
          className="sm:self-start"
        >
          Read it
        </Button>
      </div>
      <div id="nl-preview" aria-live="polite" className="mt-3">
        <ParsePreview parse={parse} onApply={onApply} hasText={!!value.trim()} />
      </div>
    </div>
  );
}

export function ParsePreview({
  parse,
  onApply,
  hasText,
}: {
  parse: ParseState;
  onApply: (f: ParsedField) => void;
  hasText: boolean;
}) {
  if (parse.status === "not_connected")
    return (
      <p className="flex gap-2 text-caption text-text-muted">
        <Icon name="info" size={16} className="mt-px shrink-0" />
        <span>
          {parse.reason} We won&apos;t guess what you meant, so use the fields above.
          {hasText ? " Your sentence is saved with the search as a note." : ""}
        </span>
      </p>
    );
  if (parse.status === "idle" || parse.status === "parsing") return null;
  if (parse.status === "error")
    return <p className="text-caption font-semibold text-danger">{parse.message}</p>;
  return (
    <div className="rounded-md border border-line bg-paper p-3">
      <p className="text-label">Here&apos;s how we read it. Check each one before using it.</p>
      <ul className="mt-2 divide-y divide-line">
        {parse.fields.map((f) => (
          <li key={f.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-body-sm">
            <span className="w-28 shrink-0 text-text-muted">{f.label}</span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{f.proposed}</span>
              <span className="text-text-muted"> from &ldquo;{f.heard}&rdquo;</span>
              {f.confidence === "low" ? (
                <Badge tone="warn" className="ml-2">
                  Unsure
                </Badge>
              ) : null}
            </span>
            <Button size="sm" variant="ghost" onClick={() => onApply(f)}>
              {f.needsPlaceLookup ? "Find place" : "Use"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
