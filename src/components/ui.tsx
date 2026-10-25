import { useEffect, useId, useRef, type ReactNode } from "react";
import { X, Search, PackageOpen, LoaderCircle } from "lucide-react";
import { title } from "../lib/types";
export function Badge({ status }: { status: string }) {
  return (
    <span className={"badge badge-" + status}>
      <span aria-hidden="true" className="status-dot" />
      {title(status)}
    </span>
  );
}
export function Empty({
  title: heading = "Nothing here yet",
  children,
  action,
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <PackageOpen size={32} strokeWidth={1.3} aria-hidden="true" />
      <h3>{heading}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-box">
      <Search size={17} aria-hidden="true" />
      <span className="sr-only">{placeholder}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={"field " + className}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <div className="error-message" role="alert">
      {error}
    </div>
  ) : null;
}
export function Busy({ label = "Loading workspace" }: { label?: string }) {
  return (
    <div className="busy" role="status">
      <LoaderCircle className="spinner" size={22} aria-hidden="true" />
      {label}…
    </div>
  );
}
export function Modal({
  title: heading,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className={wide ? "modal modal-wide" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={id}>{heading}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Submit({
  busy,
  children = "Save changes",
}: {
  busy: boolean;
  children?: ReactNode;
}) {
  return (
    <button className="button primary" disabled={busy} type="submit">
      {busy ? (
        <>
          <LoaderCircle size={16} className="spinner" />
          Saving…
        </>
      ) : (
        children
      )}
    </button>
  );
}
