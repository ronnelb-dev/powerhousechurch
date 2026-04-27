import { useEffect } from "react";

import { cn } from "~/lib/utils";

export type FieldErrors = Record<string, string[] | undefined> | undefined;

export function getFieldErrorEntries(errors: FieldErrors) {
  return Object.entries(errors ?? {}).filter(([, messages]) => Boolean(messages?.length));
}

export function describedBy(...ids: Array<string | false | null | undefined>) {
  const value = ids.filter(Boolean).join(" ");
  return value || undefined;
}

export function ValidationSummary({
  errors,
  globalError,
  id,
  className,
}: {
  errors?: FieldErrors;
  globalError?: string | null;
  id?: string;
  className?: string;
}) {
  const fieldEntries = getFieldErrorEntries(errors);
  const fieldCount = fieldEntries.length;

  if (!globalError && fieldCount === 0) {
    return null;
  }

  return (
    <div
      id={id}
      role="alert"
      aria-live="assertive"
      className={cn(
        "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
        className,
      )}
      tabIndex={-1}
    >
      {globalError ? <p>{globalError}</p> : null}
      {fieldCount > 0 ? (
        <p>
          {fieldCount === 1
            ? "Please correct the highlighted field."
            : `Please correct the ${fieldCount} highlighted fields.`}
        </p>
      ) : null}
    </div>
  );
}

export function useFocusFirstInvalidField({
  formRef,
  errors,
  globalError,
  fieldOrder,
}: {
  formRef: React.RefObject<HTMLFormElement | null>;
  errors?: FieldErrors;
  globalError?: string | null;
  fieldOrder?: string[];
}) {
  const fieldEntries = getFieldErrorEntries(errors);

  useEffect(() => {
    if (!globalError && fieldEntries.length === 0) {
      return;
    }

    const form = formRef.current;
    if (!form) {
      return;
    }

    const orderedFields =
      fieldOrder?.filter((field) => fieldEntries.some(([name]) => name === field)) ??
      fieldEntries.map(([name]) => name);
    const firstField = orderedFields[0];

    if (!firstField) {
      return;
    }

    const element = form.elements.namedItem(firstField);

    if (element instanceof HTMLElement) {
      window.requestAnimationFrame(() => {
        element.focus();
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          element.select?.();
        }
      });
    }
  }, [fieldEntries, fieldOrder, formRef, globalError]);
}
