"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { CloseIcon, CollapseIcon } from "./icons";

type Variant = "default" | "secondary" | "accent" | "ghost" | "outline";
type Size = "default" | "sm" | "icon";

const variantClasses: Record<Variant, string> = {
  default: "bg-(--ml-primary) text-(--ml-primary-foreground) hover:bg-(--ml-primary)/80",
  secondary: "bg-(--ml-secondary) text-(--ml-secondary-foreground) shadow-sm hover:bg-(--ml-secondary)/80",
  accent: "bg-(--ml-accent) text-(--ml-accent-foreground) shadow-sm hover:bg-(--ml-accent)/80",
  ghost: "hover:bg-(--ml-primary) hover:text-(--ml-primary-foreground)",
  outline:
    "border border-(--ml-input) bg-(--ml-background) shadow-sm hover:bg-(--ml-accent) hover:text-(--ml-accent-foreground)",
};

const sizeClasses: Record<Size, string> = {
  default: "h-9 px-4 py-2",
  sm: "h-8 px-3 text-xs",
  icon: "size-8",
};

export function buttonClasses(variant: Variant = "default", size: Size = "default") {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--ml-ring) disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-6 [&_svg]:shrink-0",
    variantClasses[variant],
    sizeClasses[size],
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonClasses(variant, size), className)} {...props} />;
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size };

export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return <a className={cn(buttonClasses(variant, size), className)} {...props} />;
}

type ToggleProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
};

export function Toggle({ pressed, onPressedChange, className, ...props }: ToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-state={pressed ? "on" : "off"}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex h-8 min-w-8 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-2 text-sm font-medium transition-colors hover:bg-(--ml-muted) hover:text-(--ml-muted-foreground) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--ml-ring) data-[state=on]:bg-(--ml-primary) data-[state=on]:text-(--ml-primary-foreground) [&_svg]:size-6 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export function Separator({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className={cn("min-h-6 w-0 shrink-0 rounded border border-(--ml-border)", className)}
    />
  );
}

export function FloatingToolbar({ children }: { children: ReactNode }) {
  return <div className="flex h-12 items-center justify-between gap-2 rounded-2xl bg-(--ml-muted) p-3">{children}</div>;
}

type CardProps = {
  title?: string;
  icon?: ReactNode;
  isOpen: boolean;
  onToggle?: () => void;
  isStackable?: boolean;
  header?: ReactNode;
  actions?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
};

export function Card({ title, icon, isOpen, onToggle, isStackable, header, actions, bodyClassName, children }: CardProps) {
  const closable = Boolean(onToggle);
  return (
    <div
      className={cn(
        "flex h-fit flex-col overflow-hidden rounded-2xl border-2 border-(--ml-muted)",
        isOpen && "ml-card-open grow",
        isStackable ? "flex-1 group-has-[.ml-card-open]:w-full group-has-[.ml-card-open]:flex-none" : "w-full",
      )}
    >
      <div
        role="toolbar"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onToggle?.();
        }}
        className={cn(
          "flex h-11 flex-none cursor-pointer items-center justify-between whitespace-nowrap bg-(--ml-muted) p-2",
          header && isOpen && "pb-1",
        )}
      >
        {(icon || title) && (
          <span className="flex w-fit items-center gap-3">
            {icon}
            {title}
          </span>
        )}
        {isOpen && header}
        {actions}
        {isOpen && closable && <CollapseIcon />}
      </div>
      {isOpen && <div className={cn("grow overflow-x-auto", bodyClassName)}>{children}</div>}
    </div>
  );
}

function useDismiss(open: boolean, close: () => void, isInside: (target: Node) => boolean) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!isInside(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, isInside]);
}

type PopoverProps = {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  className?: string;
};

type PopoverPosition = { top?: number; bottom?: number; left?: number; right?: number; maxHeight: number };

const POPOVER_GAP = 4;
const VIEWPORT_MARGIN = 8;

/**
 * Renders the panel in a fixed layer at the editor root, so cards with overflow clipping
 * (Sample Diagrams, Actions) cannot cut it off. It opens upward when there is no room below.
 */
export function Popover({ trigger, children, align = "start", className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition>();
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const isInside = useCallback(
    (target: Node) => Boolean(anchor?.contains(target) || panelRef.current?.contains(target)),
    [anchor],
  );
  useDismiss(open, close, isInside);
  // Portal into the editor root so the panel keeps its theme variables and dark class.
  const layer = anchor ? (anchor.closest<HTMLElement>(".mermaid-live") ?? document.body) : null;

  const place = useCallback(() => {
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const rect = anchor.getBoundingClientRect();
    const height = panel.scrollHeight;
    const below = window.innerHeight - rect.bottom - POPOVER_GAP - VIEWPORT_MARGIN;
    const above = rect.top - POPOVER_GAP - VIEWPORT_MARGIN;
    const openUp = height > below && above > below;
    const horizontal =
      align === "start" ? { left: Math.max(VIEWPORT_MARGIN, rect.left) } : { right: Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right) };
    setPosition(
      openUp
        ? { bottom: window.innerHeight - rect.top + POPOVER_GAP, maxHeight: above, ...horizontal }
        : { top: rect.bottom + POPOVER_GAP, maxHeight: below, ...horizontal },
    );
  }, [align, anchor]);

  const toggle = useCallback(() => {
    setPosition(undefined);
    setOpen((value) => !value);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return (
    <div ref={setAnchor} className="relative flex">
      {trigger({ open, toggle })}
      {open &&
        layer &&
        createPortal(
          <div
            ref={panelRef}
            style={{ ...position, visibility: position ? "visible" : "hidden" }}
            className={cn(
              "fixed z-50 overflow-y-auto rounded-md border border-(--ml-border) bg-(--ml-background) text-(--ml-foreground) shadow-md",
              className,
            )}
          >
            {children(close)}
          </div>,
          layer,
        )}
    </div>
  );
}

type DialogProps = {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
};

export function Dialog({ open, onClose, className, children }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative grid w-full max-w-lg gap-4 border border-(--ml-border) bg-(--ml-background) p-6 shadow-lg sm:rounded-lg",
          className,
        )}
      >
        {children}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 cursor-pointer rounded-sm opacity-70 transition-opacity hover:opacity-100 [&_svg]:size-4"
        >
          <CloseIcon />
          <span className="sr-only">닫기</span>
        </button>
      </div>
    </div>
  );
}

export function CopyInput({ value, label = "복사", multiline = false }: { value: string; label?: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn("flex w-full gap-2", multiline ? "items-start" : "items-center")}>
      {multiline ? (
        <textarea
          readOnly
          value={value}
          rows={Math.min(6, value.split("\n").length)}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full min-w-0 resize-none rounded-md border border-(--ml-input) bg-transparent px-3 py-2 font-mono text-xs shadow-sm"
        />
      ) : (
        <input
          readOnly
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          className="h-9 w-full min-w-0 rounded-md border border-(--ml-input) bg-transparent px-3 py-1 text-sm shadow-sm"
        />
      )}
      <Button
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          });
        }}
      >
        {copied ? "복사됨!" : label}
      </Button>
    </div>
  );
}
