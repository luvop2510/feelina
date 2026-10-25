import { useMemo, useState, type FormEvent } from "react";
import {
  Plus,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Printer,
  Copy,
  Check,
  ChevronRight,
  Download,
  PackageCheck,
} from "lucide-react";
import { useApp } from "../lib/context";
import { saveOrder, transitionOrder, issueInvoice, rpc } from "../lib/api";
import {
  money,
  date,
  today,
  SIZES,
  amountWords,
  exportCSV,
  title,
  type OrderLine,
  type Order,
} from "../lib/types";
import {
  Badge,
  Empty,
  Field,
  SearchBox,
  Modal,
  Submit,
  ErrorMessage,
} from "./ui";
import { CustomerForm } from "./CustomerForm";
import { useUnsavedChanges } from "../lib/useUnsavedChanges";
export function Orders() {
  const { data, navigate, can } = useApp();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const rows = data.orders
    .filter(
      (o) =>
        (!status || o.status === status) &&
        (!kind || o.order_type === kind) &&
        (!from || o.order_date >= from) &&
        (!to || o.order_date <= to) &&
        `${o.number} ${o.customer_snapshot?.shop_name || ""} ${o.customer_snapshot?.name || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FROM FIRST QUANTITY TO FINAL DELIVERY</div>
          <h1 tabIndex={-1}>Orders</h1>
          <p>Every retailer’s order, with the details in the right place.</p>
        </div>
        {can(["owner", "admin", "sales", "retailer"]) && (
          <button
            className="button primary"
            onClick={() => navigate("orders/new")}
          >
            <Plus size={17} />
            Create order
          </button>
        )}
      </div>
      <div className="panel">
        <div className="toolbar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search order or customer"
          />
          <select
            aria-label="Filter order status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {[
              "draft",
              "submitted",
              "confirmed",
              "processing",
              "packed",
              "dispatched",
              "delivered",
              "cancelled",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Filter order type"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">All types</option>
            <option value="wholesale">Wholesale</option>
            <option value="retail">Retail</option>
          </select>
          <button
            className="button secondary"
            disabled={!rows.length}
            onClick={() =>
              exportCSV(
                "feelina-orders",
                rows.map((o) => ({
                  number: o.number,
                  date: o.order_date,
                  customer: o.customer_snapshot?.shop_name,
                  status: o.status,
                  total: money(o.total_paise),
                  credits: money(o.credit_paise || 0),
                  credit_refund_owed: money(
                    Math.max(
                      0,
                      Number(o.paid_paise) +
                        Number(o.credit_paise || 0) -
                        Number(o.total_paise),
                    ),
                  ),
                  outstanding: money(
                    Math.max(
                      0,
                      o.total_paise -
                        o.paid_paise -
                        Number(o.credit_paise || 0),
                    ),
                  ),
                })),
              )
            }
          >
            <Download size={16} />
            Export
          </button>
        </div>
        <div className="date-filters">
          <Field label="From">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <span>{rows.length} orders</span>
        </div>
        {rows.length ? (
          <div className="table-wrap" tabIndex={0} aria-label="Orders">
            <table>
              <thead>
                <tr>
                  <th>Order number</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th className="numeric">Amount</th>
                  <th>Payment</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <button
                        className="table-link"
                        onClick={() => navigate("orders/" + o.id)}
                      >
                        {o.number}
                      </button>
                    </td>
                    <td>
                      <strong>
                        {o.customer_snapshot?.shop_name ||
                          data.customers.find((c) => c.id === o.customer_id)
                            ?.shop_name ||
                          "Customer"}
                      </strong>
                      <small>{o.customer_snapshot?.name}</small>
                    </td>
                    <td>{date(o.order_date)}</td>
                    <td>{title(o.order_type)}</td>
                    <td>
                      <Badge status={o.status} />
                    </td>
                    <td className="numeric">{money(o.total_paise)}</td>
                    <td>
                      <Badge
                        status={
                          Number(o.paid_paise) + Number(o.credit_paise || 0) >=
                            Number(o.total_paise) && o.total_paise > 0
                            ? Number(o.credit_paise || 0) > 0
                              ? "settled"
                              : "paid"
                            : o.paid_paise > 0 ||
                                Number(o.credit_paise || 0) > 0
                              ? "partial"
                              : "pending"
                        }
                      />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={"Open " + o.number}
                        onClick={() => navigate("orders/" + o.id)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              search || status
                ? "No matching orders"
                : "Your order book is ready"
            }
          >
            {search || status
              ? "Try a different search or filter."
              : "Create your first size-wise order to get started."}
          </Empty>
        )}
      </div>
    </>
  );
}
type DraftLine = {
  key: string;
  product_id: string;
  colour: string;
  quantities: Record<string, number>;
};
export function OrderEditor({ orderId }: { orderId?: string }) {
  const { data, sample, can, reload, notify, navigate } = useApp();
  const original = data.orders.find((o) => o.id === orderId);
  const { markDirty, markSaved } = useUnsavedChanges();
  const [supplyState, setSupplyState] = useState(
    original?.place_of_supply_state || "",
  );
  const [customerId, setCustomerId] = useState(
    original?.customer_id || data.profile?.customer_id || "",
  );
  const [kind, setKind] = useState(original?.order_type || "wholesale");
  const [lines, setLines] = useState<DraftLine[]>(() =>
    data.order_lines
      .filter((l) => l.order_id === orderId)
      .map((l) => ({
        key: l.id,
        product_id: l.product_id,
        colour: l.colour,
        quantities: { ...l.quantities },
      })),
  );
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [customerModal, setCustomerModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [discount, setDiscount] = useState(
    (original?.discount_paise || 0) / 100,
  );
  const [savedId, setSavedId] = useState(() => orderId || crypto.randomUUID());
  const customer = data.customers.find((c) => c.id === customerId);
  const products = data.products.filter(
    (p) =>
      p.active &&
      `${p.name} ${p.sku} ${p.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const rate = (id: string) => {
    const p = data.products.find((p) => p.id === id);
    return Number(
      data.price_list_items.find(
        (i) =>
          i.product_id === id && i.price_list_id === customer?.price_list_id,
      )?.rate_paise ??
        (kind === "wholesale" ? p?.wholesale_paise : p?.retail_paise) ??
        0,
    );
  };
  const subtotal = lines.reduce(
    (sum, l) =>
      sum +
      Object.values(l.quantities).reduce((s, q) => s + q, 0) *
        rate(l.product_id),
    0,
  );
  const discountPaise = Math.round(discount * 100);
  const tax = data.settings?.tax_verified
    ? Math.round(
        (Math.max(0, subtotal - discountPaise) *
          Number(data.settings?.tax_rate_bps || 0)) /
          10000,
      )
    : 0;
  const destinationState = supplyState || customer?.supply_state_code || "";
  const taxLabel = !data.settings?.tax_verified
    ? "Tax not configured"
    : !destinationState
      ? "Tax · place of supply required"
      : String(data.settings?.gstin || "").slice(0, 2) === destinationState
        ? "CGST + SGST"
        : "IGST";
  const total = subtotal - discountPaise + tax;
  const qty = lines.reduce(
    (s, l) => s + Object.values(l.quantities).reduce((a, b) => a + b, 0),
    0,
  );
  if (!can(["owner", "admin", "sales", "retailer"]))
    return <Empty title="Order entry is not available for this role" />;
  if (original && original.status !== "draft")
    return (
      <Empty title="This order is no longer editable">
        Submitted orders preserve the original prices and quantities.
      </Empty>
    );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (sample) {
      setError("This is a sample workspace. Sign in to save real orders.");
      return;
    }
    if (!lines.length) {
      setError("Add at least one product and enter a quantity.");
      return;
    }
    if (lines.some((l) => !Object.values(l.quantities).some((q) => q > 0))) {
      setError(
        "Enter at least one unit for every product row, or remove the empty row.",
      );
      return;
    }
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
      "value",
    );
    try {
      const id = await saveOrder({
        ...Object.fromEntries(f),
        id: savedId,
        updated_at: original?.updated_at,
        customer_id: customerId,
        order_type: kind,
        place_of_supply_state:
          supplyState || customer?.supply_state_code || null,
        discount_paise: discountPaise,
        lines: lines.map(({ product_id, colour, quantities }) => ({
          product_id,
          colour,
          quantities,
        })),
      });
      setSavedId(id);
      if (action === "submit") {
        try {
          await transitionOrder(id, "submitted");
        } catch (error) {
          await reload();
          markSaved();
          notify(
            "Draft saved, but submission failed: " +
              (error as Error).message +
              ". Open the draft to review or retry submission.",
          );
          navigate("orders/" + id);
          return;
        }
      }
      await reload();
      markSaved();
      notify(
        action === "submit"
          ? "Order submitted for confirmation."
          : "Draft saved.",
      );
      navigate("orders/" + id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function add(productId: string) {
    markDirty();
    const colour = data.variants.find(
      (v) => v.product_id === productId,
    )?.colour;
    if (!colour) {
      setError(
        "This product has no inventory variants. Add them in the catalogue first.",
      );
      return;
    }
    setLines([
      ...lines,
      {
        key: crypto.randomUUID(),
        product_id: productId,
        colour,
        quantities: Object.fromEntries(SIZES.map((s) => [s, 0])),
      },
    ]);
    setPicker(false);
    setQuery("");
  }
  return (
    <>
      <button className="back-link" onClick={() => navigate("orders")}>
        <ArrowLeft size={16} />
        All orders
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A PLACE FOR EVERY SIZE</div>
          <h1 tabIndex={-1}>{original ? "Edit draft" : "Create an order"}</h1>
          <p>
            Select your retailer, choose products, and enter quantities by size.
          </p>
        </div>
        <Badge status="draft" />
      </div>
      <form onSubmit={submit} onChange={markDirty}>
        <section className="panel form-panel">
          <div className="panel-header">
            <h2>Customer & order details</h2>
            {can(["owner", "admin", "sales"]) && (
              <button
                type="button"
                className="text-button"
                onClick={() => setCustomerModal(true)}
              >
                <Plus size={16} />
                Add customer
              </button>
            )}
          </div>
          <div className="form-grid three">
            <Field label="Customer / retailer">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="">Select a customer</option>
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shop_name} · {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Order type">
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="wholesale">Wholesale</option>
                <option value="retail">Retail</option>
              </select>
            </Field>
            <Field label="Order date">
              <input
                name="order_date"
                type="date"
                defaultValue={original?.order_date || today()}
                required
              />
            </Field>
            <Field
              label="Place of supply · state code"
              hint="Two-digit Indian state code. Used to select CGST/SGST or IGST."
            >
              <input
                name="place_of_supply_state"
                inputMode="numeric"
                pattern="[0-9]{2}"
                maxLength={2}
                value={supplyState || customer?.supply_state_code || ""}
                onChange={(e) => setSupplyState(e.target.value)}
                readOnly={!can(["owner", "admin", "sales"])}
              />
            </Field>
            <Field label="Payment due date">
              <input
                name="due_date"
                type="date"
                defaultValue={original?.due_date || ""}
              />
            </Field>
            <Field label="Transporter">
              <input
                name="transporter"
                defaultValue={original?.transporter || ""}
                maxLength={200}
                placeholder="Add when known"
              />
            </Field>
            <Field label="LR number">
              <input
                name="lr_number"
                defaultValue={original?.lr_number || ""}
                maxLength={100}
              />
            </Field>
            <Field label="LR date">
              <input
                name="lr_date"
                type="date"
                defaultValue={original?.lr_date || ""}
              />
            </Field>
            <Field label="Dispatch details" className="span-2">
              <input
                name="dispatch_details"
                defaultValue={original?.dispatch_details || ""}
                maxLength={1000}
              />
            </Field>
          </div>
          {customer && (
            <div className="customer-summary">
              <div>
                <span>BILL TO</span>
                <strong>{customer.shop_name}</strong>
                <p>{customer.billing_address}</p>
              </div>
              <div>
                <span>SHIP TO</span>
                <p>{customer.shipping_address || customer.billing_address}</p>
              </div>
              <div>
                <span>CONTACT & TERMS</span>
                <p>{customer.phone || customer.email || "Not provided"}</p>
                <p>
                  {customer.credit_days} days credit ·{" "}
                  {customer.gstin || "No GSTIN provided"}
                </p>
              </div>
            </div>
          )}
        </section>
        <section className="panel matrix-panel">
          <div className="panel-header">
            <div>
              <h2>Products & quantities</h2>
              <p>
                One row per product and colour. Use Tab to move between sizes.
              </p>
            </div>
            <button
              type="button"
              className="button secondary"
              onClick={() => setPicker(true)}
            >
              <Plus size={16} />
              Add product
            </button>
          </div>
          {lines.length ? (
            <div
              className="table-wrap matrix-scroll"
              tabIndex={0}
              aria-label="Product size quantity entry, scroll horizontally to view all sizes"
            >
              <table className="matrix">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Particulars</th>
                    <th>MRP</th>
                    {SIZES.map((s) => (
                      <th key={s}>
                        {s}
                        <small>{data.settings?.size_labels?.[s] || "—"}</small>
                      </th>
                    ))}
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, index) => {
                    const p = data.products.find((p) => p.id === l.product_id)!;
                    const colours = [
                      ...new Set(
                        data.variants
                          .filter((v) => v.product_id === p.id)
                          .map((v) => v.colour),
                      ),
                    ];
                    const count = Object.values(l.quantities).reduce(
                      (s, q) => s + q,
                      0,
                    );
                    return (
                      <tr key={l.key}>
                        <td>{index + 1}</td>
                        <td className="particulars">
                          <strong>{p.name}</strong>
                          <small>{p.sku}</small>
                          <select
                            aria-label={"Colour for " + p.name}
                            value={l.colour}
                            onChange={(e) =>
                              setLines(
                                lines.map((row) =>
                                  row.key === l.key
                                    ? {
                                        ...row,
                                        colour: e.target.value,
                                        quantities: Object.fromEntries(
                                          SIZES.map((s) => [s, 0]),
                                        ),
                                      }
                                    : row,
                                ),
                              )
                            }
                          >
                            {colours.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="numeric">{money(p.mrp_paise)}</td>
                        {SIZES.map((s) => {
                          const variant = data.variants.find(
                            (v) =>
                              v.product_id === p.id &&
                              v.colour === l.colour &&
                              v.size === s,
                          );
                          return (
                            <td key={s}>
                              <input
                                type="number"
                                min={0}
                                max={99999}
                                step={1}
                                inputMode="numeric"
                                aria-label={`${p.name}, ${l.colour}, size ${s} quantity`}
                                disabled={!variant}
                                title={
                                  variant
                                    ? `${variant.stock - variant.reserved} available`
                                    : "Size unavailable"
                                }
                                value={l.quantities[s] || ""}
                                placeholder={variant ? "0" : "—"}
                                onChange={(e) =>
                                  setLines(
                                    lines.map((row) =>
                                      row.key === l.key
                                        ? {
                                            ...row,
                                            quantities: {
                                              ...row.quantities,
                                              [s]: Math.max(
                                                0,
                                                Math.floor(
                                                  Number(e.target.value),
                                                ),
                                              ),
                                            },
                                          }
                                        : row,
                                    ),
                                  )
                                }
                              />
                            </td>
                          );
                        })}
                        <td className="numeric">
                          <strong>{count}</strong>
                        </td>
                        <td className="numeric">{money(rate(p.id))}</td>
                        <td className="numeric">
                          <strong>{money(count * rate(p.id))}</strong>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="icon-button danger"
                            aria-label={"Remove " + p.name}
                            onClick={() => {
                              markDirty();
                              setLines(
                                lines.filter((row) => row.key !== l.key),
                              );
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={11}>Total quantity</td>
                    <td className="numeric">{qty}</td>
                    <td />
                    <td className="numeric">{money(subtotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <Empty
              title="Start with your collection"
              action={
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setPicker(true)}
                >
                  <Plus size={16} />
                  Select a product
                </button>
              }
            >
              Choose a catalogue product, then enter quantities across its
              sizes.
            </Empty>
          )}
          <div className="matrix-foot">
            <span>Size labels are configurable in Settings.</span>
            <span>Prices are validated on the server when saved.</span>
          </div>
        </section>
        <div className="order-bottom">
          <section className="panel form-panel">
            <h2>Notes & terms</h2>
            <Field label="Order notes (visible to customer)">
              <textarea
                name="notes"
                rows={4}
                defaultValue={original?.notes || ""}
                maxLength={2000}
                placeholder="Packing preferences or instructions for this order"
              />
            </Field>
            <p className="muted">
              {data.settings?.payment_terms ||
                "Payment terms will appear here once configured."}
            </p>
          </section>
          <section className="panel total-panel">
            <h2>Order summary</h2>
            <div>
              <span>Subtotal · {qty} units</span>
              <strong>{money(subtotal)}</strong>
            </div>
            {can(["owner", "admin"]) && (
              <Field label="Authorised discount (₹)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  max={subtotal / 100}
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </Field>
            )}
            <div>
              <span>Discount</span>
              <span>− {money(discountPaise)}</span>
            </div>
            <div>
              <span>{taxLabel}</span>
              <span>{money(tax)}</span>
            </div>
            <div className="grand-total">
              <span>Estimated total</span>
              <strong>{money(total)}</strong>
            </div>
            <p>{amountWords(Math.max(0, total))}</p>
          </section>
        </div>
        <ErrorMessage error={error} />
        <div className="form-footer">
          <span>Saving an order does not record a payment.</span>
          <div>
            <button
              className="button secondary"
              type="submit"
              value="draft"
              disabled={busy || sample}
            >
              {busy ? "Saving…" : "Save draft"}
            </button>
            <button
              className="button primary"
              type="submit"
              value="submit"
              disabled={busy || sample}
            >
              Submit order <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </form>
      {picker && (
        <Modal title="Select a product" onClose={() => setPicker(false)}>
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search product name or SKU"
          />
          <div className="product-picker">
            {products.length ? (
              products.map((p) => (
                <button key={p.id} onClick={() => add(p.id)}>
                  <span className="product-initial">{p.name.slice(0, 1)}</span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.sku} · {p.category}
                    </small>
                  </span>
                  <span>
                    {money(rate(p.id))}
                    <Plus size={17} />
                  </span>
                </button>
              ))
            ) : (
              <Empty title="No products found">
                Add active products in Catalogue before creating an order.
              </Empty>
            )}
          </div>
        </Modal>
      )}
      {customerModal && (
        <CustomerForm
          onClose={() => setCustomerModal(false)}
          onSaved={(id) => {
            setCustomerId(id);
            markDirty();
          }}
        />
      )}
    </>
  );
}
export function OrderDetail({ id }: { id: string }) {
  const { data, sample, can, reload, notify, navigate } = useApp();
  const order = data.orders.find((o) => o.id === id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cancel, setCancel] = useState(false);
  const [transport, setTransport] = useState(false);
  const [stockAction, setStockAction] = useState<"dispatch" | "return" | null>(
    null,
  );
  const [documentType, setDocumentType] = useState<"order" | "invoice">(
    "order",
  );
  if (!order)
    return (
      <Empty title="Order not found">
        It may have been removed, or your account may not have access.
      </Empty>
    );
  const invoice = data.invoices.find((i) => i.order_id === id);
  const lines: OrderLine[] =
    documentType === "invoice" && invoice
      ? [...invoice.snapshot.lines].sort(
          (a, b) => (a.position || 1) - (b.position || 1),
        )
      : data.order_lines
          .filter((l) => l.order_id === id)
          .sort((a, b) => (a.position || 1) - (b.position || 1));
  const next: Record<string, string> = {
    draft: "submitted",
    submitted: "confirmed",
    confirmed: "processing",
    processing: "packed",
    packed: "dispatched",
    dispatched: "delivered",
  };
  const nextStatus = next[order.status];
  const changeAllowed =
    order.status === "draft"
      ? can(["owner", "admin", "sales", "retailer"])
      : order.status === "submitted"
        ? can(["owner", "admin"])
        : can(["owner", "admin", "fulfilment"]);
  async function mutate(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      if (sample) throw new Error("Sample data is read-only.");
      await fn();
      await reload();
      notify(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
      setCancel(false);
    }
  }
  const documentOrder: Order =
    documentType === "invoice" && invoice ? invoice.snapshot.order : order;
  const customer = documentOrder.customer_snapshot || {};
  const settings =
    documentType === "invoice" && invoice
      ? invoice.snapshot.issuer
      : order.settings_snapshot || {};
  return (
    <>
      <div className="no-print">
        <button className="back-link" onClick={() => navigate("orders")}>
          <ArrowLeft size={16} />
          All orders
        </button>
        <div className="page-heading">
          <div>
            <div className="eyebrow">ORDER DETAILS</div>
            <h1 tabIndex={-1}>
              {order.number} <Badge status={order.status} />
            </h1>
            <p>
              {customer.shop_name} · Created {date(order.order_date)}
            </p>
          </div>
          <div className="heading-actions">
            <button className="button secondary" onClick={() => window.print()}>
              <Printer size={16} />
              Print / Save PDF
            </button>
            {order.status === "draft" &&
              can(["owner", "admin", "sales", "retailer"]) && (
                <button
                  className="button primary"
                  onClick={() => navigate("orders/" + id + "/edit")}
                >
                  Edit draft
                </button>
              )}
          </div>
        </div>
        <ErrorMessage error={error} />
        <div className="workflow-bar">
          {[
            "submitted",
            "confirmed",
            "processing",
            "packed",
            "dispatched",
            "delivered",
          ].map((s, i) => {
            const index = [
              "submitted",
              "confirmed",
              "processing",
              "packed",
              "dispatched",
              "delivered",
            ].indexOf(order.status);
            return (
              <div key={s} className={i <= index ? "complete" : ""}>
                <span>{i < index ? <Check size={13} /> : i + 1}</span>
                {title(s)}
                {i < 5 && <ChevronRight size={14} />}
              </div>
            );
          })}
        </div>
        {sample && (
          <p className="info-note">
            This is a fictional sample order. It cannot be saved, dispatched, or
            billed.
          </p>
        )}
      </div>
      <article className="panel order-document">
        <div className="document-header">
          <div>
            <div className="wordmark">feelina</div>
            <h2>
              {settings.company_verified ? settings.company_name : "Feelina"}
            </h2>
            {settings.company_verified ? (
              <p>
                {settings.business_address}
                <br />
                {settings.gstin && `GSTIN: ${settings.gstin}`}
              </p>
            ) : (
              <p className="muted">
                Company registration details await verification.
              </p>
            )}
          </div>
          <div className="document-title">
            <span>
              {documentType === "invoice" ? "TAX INVOICE" : "ORDER FORM"}
            </span>
            <strong>
              {documentType === "invoice"
                ? invoice?.number
                : documentOrder.number}
            </strong>
            <p>
              {date(
                documentType === "invoice" && invoice
                  ? invoice.snapshot.issued_at || invoice.created_at
                  : documentOrder.order_date,
              )}
            </p>
            {documentType === "order" && <small>Not a tax invoice</small>}
          </div>
        </div>
        {sample && (
          <div className="document-sample">
            SAMPLE — NOT A BUSINESS DOCUMENT
          </div>
        )}
        <div className="document-meta">
          <div>
            <span>BILL TO</span>
            <strong>{customer.shop_name}</strong>
            <p>
              {customer.name}
              <br />
              {customer.billing_address}
              <br />
              {customer.phone}
            </p>
            {customer.gstin && <p>GSTIN: {customer.gstin}</p>}
          </div>
          <div>
            <span>SHIP TO</span>
            <p>{customer.shipping_address || customer.billing_address}</p>
          </div>
          <div>
            <span>ORDER INFORMATION</span>
            <p>
              Type: {title(documentOrder.order_type)}
              <br />
              Due: {date(documentOrder.due_date)}
              <br />
              Transporter: {documentOrder.transporter || "—"}
              <br />
              LR: {documentOrder.lr_number || "—"} ·{" "}
              {date(documentOrder.lr_date)}
            </p>
          </div>
        </div>
        <div className="table-wrap" tabIndex={0} aria-label="Order size matrix">
          <DocumentMatrix
            lines={lines}
            labels={
              documentOrder.settings_snapshot?.size_labels ||
              settings.size_labels ||
              {}
            }
          />
        </div>
        <div className="document-closing">
          <div className="document-totals">
            <div>
              <span>AMOUNT IN WORDS</span>
              <p>{amountWords(documentOrder.total_paise)}</p>
              {documentOrder.notes && (
                <>
                  <span>NOTES</span>
                  <p>{documentOrder.notes}</p>
                </>
              )}
              <span>PAYMENT & DELIVERY TERMS</span>
              <p>{settings.payment_terms || "As agreed with the customer."}</p>
              {documentOrder.dispatch_details && (
                <p>Dispatch: {documentOrder.dispatch_details}</p>
              )}
            </div>
            <dl>
              {Number(documentOrder.paid_paise) +
                Number(documentOrder.credit_paise || 0) >
                Number(documentOrder.total_paise) && (
                <div>
                  <dt>Credit / refund owed</dt>
                  <dd>
                    {money(
                      Number(documentOrder.paid_paise) +
                        Number(documentOrder.credit_paise || 0) -
                        Number(documentOrder.total_paise),
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt>Subtotal</dt>
                <dd>{money(documentOrder.subtotal_paise)}</dd>
              </div>
              <div>
                <dt>Discount</dt>
                <dd>− {money(documentOrder.discount_paise)}</dd>
              </div>
              {settings.tax_mode === "cgst_sgst" ? (
                <>
                  <div>
                    <dt>CGST</dt>
                    <dd>{money(Math.floor(documentOrder.tax_paise / 2))}</dd>
                  </div>
                  <div>
                    <dt>SGST</dt>
                    <dd>
                      {money(
                        documentOrder.tax_paise -
                          Math.floor(documentOrder.tax_paise / 2),
                      )}
                    </dd>
                  </div>
                </>
              ) : (
                <div>
                  <dt>{settings.tax_mode === "igst" ? "IGST" : "Tax"}</dt>
                  <dd>{money(documentOrder.tax_paise)}</dd>
                </div>
              )}
              <div className="grand-total">
                <dt>Total</dt>
                <dd>{money(documentOrder.total_paise)}</dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd>{money(documentOrder.paid_paise)}</dd>
              </div>
              <div>
                <dt>Return credits</dt>
                <dd>{money(documentOrder.credit_paise || 0)}</dd>
              </div>
              <div>
                <dt>Outstanding</dt>
                <dd>
                  {money(
                    Math.max(
                      0,
                      documentOrder.total_paise -
                        documentOrder.paid_paise -
                        Number(documentOrder.credit_paise || 0),
                    ),
                  )}
                </dd>
              </div>
            </dl>
          </div>
          <div className="document-signature">
            <span>Thank you for choosing Feelina.</span>
            <div>Authorised signatory</div>
          </div>
        </div>
      </article>
      <div className="no-print detail-actions">
        {order.status === "submitted" && can(["owner", "admin", "sales"]) && (
          <button
            className="button secondary"
            disabled={busy || sample}
            onClick={() =>
              void mutate(
                () => transitionOrder(id, "draft"),
                "Order returned to draft. Review details and submit again.",
              )
            }
          >
            Return to draft
          </button>
        )}
        {nextStatus && changeAllowed && (
          <button
            className="button primary"
            disabled={busy || sample}
            onClick={() =>
              nextStatus === "dispatched"
                ? setStockAction("dispatch")
                : void mutate(
                    () => transitionOrder(id, nextStatus),
                    "Order " + nextStatus + ".",
                  )
            }
          >
            <PackageCheck size={16} />
            {nextStatus === "confirmed"
              ? "Confirm & reserve stock"
              : nextStatus === "dispatched"
                ? "Dispatch quantities"
                : "Mark " + nextStatus}
          </button>
        )}
        {["packed", "dispatched", "delivered"].includes(order.status) &&
          data.order_fulfilments.some((f) => f.order_id === id) &&
          can(["owner", "admin", "inventory"]) && (
            <button
              className="button secondary"
              disabled={sample}
              onClick={() => setStockAction("return")}
            >
              Record return
            </button>
          )}
        {order.status === "packed" &&
          can(["owner", "admin", "fulfilment"]) &&
          nextStatus !== "dispatched" && (
            <button
              className="button secondary"
              disabled={sample}
              onClick={() => setStockAction("dispatch")}
            >
              Dispatch remaining quantities
            </button>
          )}
        {can(["owner", "admin", "sales", "retailer"]) && (
          <button
            className="button secondary"
            disabled={busy || sample}
            onClick={() =>
              void mutate(async () => {
                const newId = await saveOrder({
                  id: crypto.randomUUID(),
                  customer_id: order.customer_id,
                  order_type: order.order_type,
                  order_date: today(),
                  notes: "Duplicated from " + order.number,
                  lines: lines.map((l) => ({
                    product_id: l.product_id,
                    colour: l.colour,
                    quantities: l.quantities,
                  })),
                });
                await reload();
                navigate("orders/" + newId + "/edit");
              }, "Order duplicated as a new draft.")
            }
          >
            <Copy size={16} />
            Duplicate
          </button>
        )}
        {can(["owner", "admin", "accounts"]) && !invoice && (
          <button
            className="button secondary"
            disabled={
              busy ||
              sample ||
              !data.settings?.company_verified ||
              !data.settings?.tax_verified
            }
            title="Verified company and tax settings are required"
            onClick={() =>
              void mutate(
                () => issueInvoice(id),
                "Separate tax invoice issued.",
              )
            }
          >
            Issue tax invoice
          </button>
        )}
        {invoice && (
          <button
            className="button secondary"
            onClick={() =>
              setDocumentType(documentType === "order" ? "invoice" : "order")
            }
          >
            {documentType === "order" ? "View tax invoice" : "View order form"}
          </button>
        )}
        {["draft", "submitted", "confirmed", "processing", "packed"].includes(
          order.status,
        ) &&
          can(["owner", "admin", "sales", "retailer"]) && (
            <button
              className="button danger-text"
              disabled={busy || sample}
              onClick={() => setCancel(true)}
            >
              Cancel order
            </button>
          )}
      </div>
      {can(["owner", "admin", "fulfilment"]) &&
        ["confirmed", "processing", "packed", "dispatched"].includes(
          order.status,
        ) && (
          <div className="no-print detail-actions">
            <button
              className="button secondary"
              onClick={() => setTransport(true)}
            >
              Update transporter / LR
            </button>
          </div>
        )}
      {transport && (
        <Modal
          title="Update transport details"
          onClose={() => setTransport(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const details = Object.fromEntries(new FormData(e.currentTarget));
              const saved = await mutate(
                () =>
                  rpc("update_dispatch_details", {
                    p_order_id: id,
                    p_details: details,
                  }),
                "Transport details updated.",
              );
              if (saved) setTransport(false);
            }}
          >
            <Field label="Transporter">
              <input
                name="transporter"
                maxLength={200}
                defaultValue={order.transporter}
              />
            </Field>
            <Field label="LR number">
              <input
                name="lr_number"
                maxLength={100}
                defaultValue={order.lr_number}
              />
            </Field>
            <Field label="LR date">
              <input
                type="date"
                name="lr_date"
                min={order.order_date}
                defaultValue={order.lr_date || ""}
              />
            </Field>
            <Field label="Dispatch details">
              <textarea
                name="dispatch_details"
                maxLength={2000}
                defaultValue={order.dispatch_details}
              />
            </Field>
            <ErrorMessage error={error} />
            <div className="modal-actions">
              <Submit busy={busy}>Save transport details</Submit>
            </div>
          </form>
        </Modal>
      )}
      {order.exchange_return_id && (
        <p className="info-note no-print">
          Exchange replacement linked to return {order.exchange_return_id}.
        </p>
      )}
      <FulfilmentHistory order={order} />
      {can(["owner", "admin", "sales", "accounts", "fulfilment"]) && (
        <InternalNotes orderId={id} />
      )}
      {cancel && (
        <Modal title="Cancel this order?" onClose={() => setCancel(false)}>
          <p>
            Eligible stock reservations will be released. The order and its
            audit history will remain on record.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setCancel(false)}
            >
              Keep order
            </button>
            <button
              className="button danger-button"
              disabled={busy}
              onClick={() =>
                void mutate(
                  () => transitionOrder(id, "cancelled"),
                  "Order cancelled.",
                )
              }
            >
              Cancel order
            </button>
          </div>
        </Modal>
      )}
      {stockAction && (
        <StockAction
          order={order}
          lines={lines}
          action={stockAction}
          onClose={() => setStockAction(null)}
        />
      )}
    </>
  );
}
function DocumentMatrix({
  lines,
  labels,
}: {
  lines: OrderLine[];
  labels: Record<string, string>;
}) {
  return (
    <table className="matrix print-matrix">
      <thead>
        <tr>
          <th>No.</th>
          <th>Particulars</th>
          <th>MRP</th>
          {SIZES.map((s) => (
            <th key={s}>
              {s}
              <small>{labels[s] || ""}</small>
            </th>
          ))}
          <th>Qty</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={l.id}>
            <td>{i + 1}</td>
            <td>
              <strong>{l.product_name}</strong>
              <small>
                {l.colour} · {l.sku}
              </small>
            </td>
            <td>{money(l.mrp_paise)}</td>
            {SIZES.map((s) => (
              <td key={s}>{l.quantities[s] || "—"}</td>
            ))}
            <td>
              <strong>{l.quantity}</strong>
            </td>
            <td>{money(l.rate_paise)}</td>
            <td>{money(l.amount_paise)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={11}>Total quantity</td>
          <td>{lines.reduce((s, l) => s + l.quantity, 0)}</td>
          <td colSpan={2}>
            {money(lines.reduce((s, l) => s + l.amount_paise, 0))}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
function StockAction({
  order,
  lines,
  action,
  onClose,
}: {
  order: Order;
  lines: OrderLine[];
  action: "dispatch" | "return";
  onClose: () => void;
}) {
  const { data, reload, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, number>>({});
  const [requestId] = useState(() => crypto.randomUUID());
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(
    null,
  );
  const variants = useMemo(
    () =>
      lines
        .flatMap((l) =>
          SIZES.filter((s) => l.quantities[s] > 0).map((s) => ({
            variant: data.variants.find(
              (v) =>
                v.product_id === l.product_id &&
                v.colour === l.colour &&
                v.size === s,
            ),
            line: l,
            size: s,
          })),
        )
        .filter((v) => v.variant),
    [data, lines],
  );
  const remaining = (variantId: string, ordered: number) => {
    const dispatched = data.order_fulfilments
      .filter((f) => f.order_id === order.id && f.variant_id === variantId)
      .reduce((sum, f) => sum + Number(f.quantity), 0);
    const returnIds = new Set(
      data.returns.filter((r) => r.order_id === order.id).map((r) => r.id),
    );
    const returned = data.return_items
      .filter((r) => returnIds.has(r.return_id) && r.variant_id === variantId)
      .reduce((sum, r) => sum + Number(r.quantity), 0);
    return Math.max(
      0,
      action === "dispatch" ? ordered - dispatched : dispatched - returned,
    );
  };
  return (
    <Modal
      title={
        action === "dispatch"
          ? "Dispatch order quantities"
          : "Record returned stock"
      }
      onClose={onClose}
    >
      <p className="muted">
        Enter only the quantities{" "}
        {action === "dispatch"
          ? "leaving the warehouse now"
          : "received back and checked"}
        . The server validates remaining quantities.
      </p>
      <form
        onSubmit={async (e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const items = Object.entries(values)
              .filter(([, quantity]) => quantity > 0)
              .map(([variant_id, quantity]) => ({ variant_id, quantity }));
            if (!items.length) throw new Error("Enter at least one quantity.");
            const payload = submitted || {
              p_order_id: order.id,
              p_items: items,
              p_request_id: requestId,
              [action === "dispatch" ? "p_details" : "p_note"]: String(
                f.get("note"),
              ),
            };
            setSubmitted(payload);
            await rpc(
              action === "dispatch" ? "dispatch_order" : "record_return",
              payload,
            );
            await reload();
            notify(
              action === "dispatch" ? "Dispatch recorded." : "Return recorded.",
            );
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {submitted && (
          <p className="info-note">
            This request has been sent. Retry keeps the same quantities to
            prevent duplicate stock movements. Close and reopen only after
            checking the order history if you need a different action.
          </p>
        )}
        <div className="form-grid">
          {variants.map(({ variant, line, size }) => (
            <Field
              key={variant!.id}
              label={`${line.product_name} · ${line.colour} · ${size}`}
              hint={`${remaining(variant!.id, line.quantities[size])} units available to ${action}`}
            >
              <input
                type="number"
                min={0}
                max={remaining(variant!.id, line.quantities[size])}
                disabled={busy || Boolean(submitted)}
                step={1}
                value={values[variant!.id] || ""}
                onChange={(e) =>
                  setValues({
                    ...values,
                    [variant!.id]: Number(e.target.value),
                  })
                }
              />
            </Field>
          ))}
        </div>
        <Field label="Reference / reason">
          <textarea
            name="note"
            required
            maxLength={1000}
            disabled={busy || Boolean(submitted)}
          />
        </Field>
        <ErrorMessage error={error} />
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <Submit busy={busy}>
            {action === "dispatch" ? "Record dispatch" : "Record return"}
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

function InternalNotes({ orderId }: { orderId: string }) {
  const { data, sample, reload, notify } = useApp();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const notes = data.internal_order_notes
    .filter((n) => n.order_id === orderId)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return (
    <section className="panel form-panel no-print">
      <div className="panel-header">
        <div>
          <h2>Internal team notes</h2>
          <p>
            Visible to authorised staff only. Never included in customer
            documents.
          </p>
        </div>
      </div>
      {notes.map((n) => (
        <div className="info-note" key={n.id}>
          <p>{n.note}</p>
          <small>
            {date(n.created_at)} ·{" "}
            {data.profiles.find((p) => p.id === n.created_by)?.full_name ||
              "Staff member"}
          </small>
        </div>
      ))}
      {!notes.length && <p className="muted">No internal notes yet.</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (sample) throw new Error("Sample workspace is read-only.");
            await rpc("add_internal_note", {
              p_order_id: orderId,
              p_note: note,
            });
            setNote("");
            await reload();
            notify("Internal note added.");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Add a team note">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            minLength={1}
            maxLength={5000}
          />
        </Field>
        <ErrorMessage error={error} />
        <div className="modal-actions">
          <button
            className="button primary"
            disabled={busy || sample || !note.trim()}
          >
            {busy ? "Adding…" : "Add internal note"}
          </button>
        </div>
      </form>
    </section>
  );
}

function FulfilmentHistory({ order }: { order: Order }) {
  const { data, sample, can, reload, navigate } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shipments = data.order_fulfilments.filter(
    (f) => f.order_id === order.id,
  );
  const returns = data.returns.filter((r) => r.order_id === order.id);
  const returnIds = new Set(returns.map((r) => r.id));
  const returned = data.return_items.filter((r) => returnIds.has(r.return_id));
  const lines = data.order_lines.filter((l) => l.order_id === order.id);
  if (!shipments.length && !returns.length) return null;
  const rows = lines.flatMap((line) =>
    SIZES.filter((s) => line.quantities[s] > 0).map((size) => {
      const variant = data.variants.find(
        (v) =>
          v.product_id === line.product_id &&
          v.colour === line.colour &&
          v.size === size,
      );
      const dispatched = shipments
        .filter((f) => f.variant_id === variant?.id)
        .reduce((n, f) => n + Number(f.quantity), 0);
      const returnQty = returned
        .filter((f) => f.variant_id === variant?.id)
        .reduce((n, f) => n + Number(f.quantity), 0);
      return {
        key: line.id + "-" + size,
        name: line.product_name,
        colour: line.colour,
        size,
        ordered: line.quantities[size],
        dispatched,
        returned: returnQty,
      };
    }),
  );
  return (
    <section className="panel form-panel no-print">
      <div className="panel-header">
        <div>
          <h2>Dispatch & return history</h2>
          <p>
            Returns restore stock and record a credit; replacement items need a
            separate order.
          </p>
        </div>
      </div>
      <div
        className="table-wrap"
        tabIndex={0}
        aria-label="Dispatch and return quantities"
      >
        <table>
          <thead>
            <tr>
              <th>Product / colour</th>
              <th>Size</th>
              <th>Ordered</th>
              <th>Dispatched</th>
              <th>To dispatch</th>
              <th>Returned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>
                  {r.name}
                  <small>{r.colour}</small>
                </td>
                <td>{r.size}</td>
                <td>{r.ordered}</td>
                <td>{r.dispatched}</td>
                <td>{Math.max(0, r.ordered - r.dispatched)}</td>
                <td>{r.returned}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shipments.map((s) => (
        <p key={s.id}>
          <strong>{date(s.created_at)}</strong> · {s.quantity} units dispatched
          · {s.details || "No dispatch reference"}
        </p>
      ))}
      <ErrorMessage error={error} />
      {returns.map((r) => (
        <p key={r.id}>
          <strong>{date(r.created_at)}</strong> · Return credit{" "}
          {money(r.credit_paise)} · {r.note}
          {data.orders.find((o) => o.exchange_return_id === r.id) ? (
            <button
              className="text-button"
              onClick={() =>
                navigate(
                  "orders/" +
                    data.orders.find((o) => o.exchange_return_id === r.id)!.id,
                )
              }
            >
              View exchange order
            </button>
          ) : (
            can(["owner", "admin", "sales"]) && (
              <button
                className="text-button"
                disabled={sample || busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const newId = await rpc("create_exchange_order", {
                      p_return_id: r.id,
                    });
                    await reload();
                    navigate("orders/" + newId + "/edit");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Create exchange order
              </button>
            )
          )}
        </p>
      ))}
    </section>
  );
}
