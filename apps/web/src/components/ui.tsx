import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { Icon, type IconName } from "./icons";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "quiet" | "danger";
type Size = "md" | "sm";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-lime text-ink hover:bg-lime-press active:bg-lime-press border border-transparent",
  secondary:
    "bg-ink text-white hover:bg-ink-raised border border-transparent on-ink",
  ghost:
    "bg-surface text-ink border border-line-strong hover:border-ink hover:bg-paper",
  quiet:
    "bg-transparent text-ink border border-transparent hover:bg-ink/5 underline-offset-4",
  danger:
    "bg-surface text-danger border border-line-strong hover:border-danger hover:bg-danger-wash",
};
const sizeClass: Record<Size, string> = {
  md: "h-12 px-6 text-body gap-2",
  sm: "h-10 px-4 text-label gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md") {
  return cx(
    "inline-flex items-center justify-center rounded-md font-semibold whitespace-nowrap",
    "transition-colors duration-150 ease-out",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variantClass[variant],
    sizeClass[size],
  );
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconAfter,
  loading,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconAfter?: IconName;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      {...rest}
      aria-busy={loading || undefined}
      className={cx(buttonClass(variant, size), className)}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : icon ? (
        <Icon name={icon} size={size === "sm" ? 16 : 18} />
      ) : null}
      {children}
      {iconAfter ? (
        <Icon name={iconAfter} size={size === "sm" ? 16 : 18} />
      ) : null}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon,
  iconAfter,
  children,
  className,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconAfter?: IconName;
}) {
  return (
    <Link
      href={href}
      {...rest}
      className={cx(buttonClass(variant, size), "no-underline", className)}
    >
      {icon ? <Icon name={icon} size={size === "sm" ? 16 : 18} /> : null}
      {children}
      {iconAfter ? (
        <Icon name={iconAfter} size={size === "sm" ? 16 : 18} />
      ) : null}
    </Link>
  );
}

export type Tone = "neutral" | "lime" | "ok" | "warn" | "danger" | "info";
const badgeTone: Record<Tone, string> = {
  neutral: "bg-paper text-text-muted border-line",
  lime: "bg-lime-wash text-ink border-transparent",
  ok: "bg-ok-wash text-ok border-transparent",
  warn: "bg-warn-wash text-warn border-transparent",
  danger: "bg-danger-wash text-danger border-transparent",
  info: "bg-info-wash text-focus border-transparent",
};

export function Badge({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-caption font-semibold whitespace-nowrap",
        badgeTone[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}

const noticeTone: Record<Tone, { box: string; icon: IconName }> = {
  neutral: { box: "bg-surface border-line text-ink", icon: "info" },
  lime: { box: "bg-lime-wash border-transparent text-ink", icon: "sparkle" },
  ok: { box: "bg-ok-wash border-transparent text-ink", icon: "check" },
  warn: { box: "bg-warn-wash border-transparent text-ink", icon: "alert" },
  danger: { box: "bg-danger-wash border-transparent text-ink", icon: "alert" },
  info: { box: "bg-info-wash border-transparent text-ink", icon: "info" },
};
const noticeIconColor: Record<Tone, string> = {
  neutral: "text-text-muted",
  lime: "text-lime-deep",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  info: "text-focus",
};

export function Notice({
  tone = "neutral",
  title,
  children,
  action,
  icon,
  role,
  className,
}: {
  tone?: Tone;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
  role?: "status" | "alert";
  className?: string;
}) {
  const t = noticeTone[tone];
  return (
    <div
      role={role}
      className={cx(
        "flex gap-3 rounded-md border p-4 text-body-sm",
        t.box,
        className,
      )}
    >
      <Icon
        name={icon ?? t.icon}
        size={20}
        className={cx("mt-0.5 shrink-0", noticeIconColor[tone])}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children ? (
          <div className="mt-1 text-text-muted">{children}</div>
        ) : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx("skeleton block", className)} />;
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

export function SampleDataBadge() {
  return (
    <Badge tone="warn" icon="info">
      Sample data
    </Badge>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 pt-8 pb-6 md:flex-row md:items-end md:justify-between md:pt-12">
      <div className="max-w-[70ch]">
        <h1 className="font-display text-headline md:text-[2.5rem]">{title}</h1>
        {description ? (
          <p className="mt-2 text-body text-text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </header>
  );
}
