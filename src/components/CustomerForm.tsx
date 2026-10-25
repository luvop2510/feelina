import { useState, type FormEvent } from "react";
import { useApp } from "../lib/context";
import { saveCustomer } from "../lib/api";
import { type Customer } from "../lib/types";
import { Modal, Field, Submit, ErrorMessage } from "./ui";
export function CustomerForm({
  customer,
  onClose,
  onSaved,
}: {
  customer?: Customer;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const { data, sample, reload, notify, can } = useApp();
  const [recordId] = useState(() => customer?.id || crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      if (sample)
        throw new Error(
          "Sample data is read-only. Sign in to create a real customer.",
        );
      const id = await saveCustomer({
        ...Object.fromEntries(f),
        id: recordId,
        ...(can(["owner", "admin"])
          ? {
              credit_days: Number(f.get("credit_days")),
              price_list_id: f.get("price_list_id") || null,
            }
          : {}),
      });
      await reload();
      notify("Customer saved.");
      onSaved?.(id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={customer ? "Edit customer" : "Add customer"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Contact name">
            <input
              name="name"
              required
              defaultValue={customer?.name}
              maxLength={120}
            />
          </Field>
          <Field label="Shop / business name">
            <input
              name="shop_name"
              required
              defaultValue={customer?.shop_name}
              maxLength={160}
            />
          </Field>
          <Field label="Email address">
            <input name="email" type="email" defaultValue={customer?.email} />
          </Field>
          <Field label="Mobile number">
            <input
              name="phone"
              type="tel"
              defaultValue={customer?.phone}
              maxLength={20}
            />
          </Field>
          <Field label="Billing address" className="span-2">
            <textarea
              name="billing_address"
              required
              defaultValue={customer?.billing_address}
              maxLength={1000}
            />
          </Field>
          <Field
            label="Shipping address"
            className="span-2"
            hint="Leave blank to use the billing address."
          >
            <textarea
              name="shipping_address"
              defaultValue={customer?.shipping_address}
              maxLength={1000}
            />
          </Field>
          <Field label="GSTIN (if applicable)">
            <input
              name="gstin"
              defaultValue={customer?.gstin}
              pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]"
              maxLength={15}
            />
          </Field>
          <Field
            label="Place of supply state code"
            hint="Enter the verified two-digit GST state code for delivery, for example 24 for Gujarat."
          >
            <input
              name="supply_state_code"
              inputMode="numeric"
              pattern="[0-9]{2}"
              maxLength={2}
              defaultValue={
                customer?.supply_state_code ||
                customer?.gstin?.slice(0, 2) ||
                ""
              }
            />
          </Field>
          {can(["owner", "admin"]) && (
            <>
              <Field label="Credit terms (days)">
                <input
                  type="number"
                  name="credit_days"
                  min={0}
                  max={365}
                  defaultValue={customer?.credit_days || 0}
                  required
                />
              </Field>
              <Field label="Assigned price list" className="span-2">
                <select
                  name="price_list_id"
                  defaultValue={customer?.price_list_id || ""}
                >
                  <option value="">Standard retail / wholesale rates</option>
                  {data.price_lists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </div>
        <ErrorMessage error={error} />
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <Submit busy={busy}>Save customer</Submit>
        </div>
      </form>
    </Modal>
  );
}
