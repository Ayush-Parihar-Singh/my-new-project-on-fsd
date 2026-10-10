"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "block w-full rounded-xl border border-input bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70 shadow-sm transition-colors focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/25 disabled:bg-neutral-100 disabled:text-muted aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/15";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-semibold text-deep", className)} {...props} />;
}

export function FieldError({ id, messages }: { id?: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p id={id} className="text-xs font-medium text-destructive">
      {messages[0]}
    </p>
  );
}

export function FieldHint({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-xs text-muted">
      {children}
    </p>
  );
}

/** The ids a control should reference in aria-describedby, given its hint and error. */
export function describedBy(id: string, hint?: string, error?: string[]): string | undefined {
  // Mirrors Field: the hint is hidden when an error is shown, so it is not referenced then.
  const ids = [hint && !error?.length ? `${id}-hint` : null, error?.length ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string[];
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Label + control + hint + error. Pair with `describedBy(id, hint, error)` on the control. */
export function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-0.5 text-coral-ink" aria-hidden>*</span> : null}
      </Label>
      {children}
      {hint && !error?.length ? <FieldHint id={`${id}-hint`}>{hint}</FieldHint> : null}
      <FieldError id={`${id}-error`} messages={error} />
    </div>
  );
}

type ControlProps = { invalid?: boolean; describedBy?: string };

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & ControlProps>(function Input(
  { className, invalid, describedBy, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn(fieldBase, "h-11", className)}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & ControlProps>(function Textarea(
  { className, invalid, describedBy, ...props },
  ref,
) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} aria-describedby={describedBy} className={cn(fieldBase, "min-h-24")} {...props} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & ControlProps>(function Select(
  { className, invalid, describedBy, children, ...props },
  ref,
) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} aria-describedby={describedBy} className={cn(fieldBase, "h-11 pr-9", className)} {...props}>
      {children}
    </select>
  );
});

export function Checkbox({ id, label, description, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" className="mt-1 size-4 rounded border-input text-forest focus:ring-forest/30" {...props} />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {description ? <p className="text-xs text-muted">{description}</p> : null}
      </div>
    </div>
  );
}
