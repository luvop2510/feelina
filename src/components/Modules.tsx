import { useState, type FormEvent, type ReactNode } from "react";
import {
  Plus,
  Download,
  Pencil,
  Search,
  Package,
  ArrowUpRight,
} from "lucide-react";
import { useApp } from "../lib/context";
import {
  saveProduct,
  uploadProductImage,
  adjustStock,
  recordPayment,
  saveSettings,
  updateProfile,
  rpc,
} from "../lib/api";
import {
  SIZES,
  ROLES,
  money,
  date,
  today,
  title,
  exportCSV,
  type Product,
  type Customer,
  type Row,
} from "../lib/types";
import {
  Modal,
  Field,
  Submit,
  ErrorMessage,
  Empty,
  SearchBox,
  Badge,
} from "./ui";
import { CustomerForm } from "./CustomerForm";
const formValues = (e: FormEvent<HTMLFormElement>) =>
  Object.fromEntries(new FormData(e.currentTarget));
const creditOwed = (o: Row) =>
  Math.max(
    0,
    Number(o.paid_paise) + Number(o.credit_paise || 0) - Number(o.total_paise),
  );
const balance = (o: Row) =>
  Math.max(
    0,
    Number(o.total_paise) - Number(o.paid_paise) - Number(o.credit_paise || 0),
  );
function Heading({
  title: heading,
  children,
  action,
}: {
  title: string;
  children: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">FEELINA WORKSPACE</div>
        <h1 tabIndex={-1}>{heading}</h1>
        <p>{children}</p>
      </div>
      {action}
    </div>
  );
}
function useMutation() {
  const { sample, reload, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return {
    busy,
    error,
    run: async (
      fn: () => Promise<unknown>,
      message: string,
      done?: () => void,
    ) => {
      setBusy(true);
      setError("");
      try {
        if (sample)
          throw new Error(
            "Sample data is read-only. Sign in to manage live records.",
          );
        await fn();
        await reload();
        notify(message);
        done?.();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
  };
}
export function Catalogue() {
  const { data, can } = useApp();
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState<Product | null | undefined>();
  const rows = data.products.filter((p) =>
    `${p.name} ${p.sku} ${p.category}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="The collection"
        action={
          can(["owner", "admin"]) && (
            <button className="button primary" onClick={() => setEdit(null)}>
              <Plus size={17} />
              Add product
            </button>
          )
        }
      >
        Every product, colour and size, in one place.
      </Heading>
      <div className="toolbar">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search by product, SKU or category"
        />
        <span className="muted">{rows.length} products</span>
      </div>
      <div className="catalogue-grid">
        {rows.map((p, i) => (
          <article className="panel product-card" key={p.id}>
            <div className={"product-art tone-" + (i % 3)}>
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} loading="lazy" />
              ) : (
                <Package size={48} strokeWidth={1} />
              )}
              <span>{p.category || "Essentials"}</span>
            </div>
            <div className="product-info">
              <small>
                {p.sku} · {p.active ? "Active" : "Inactive"}
              </small>
              <h2>{p.name}</h2>
              <div className="product-prices">
                <span>
                  MRP <strong>{money(p.mrp_paise)}</strong>
                </span>
                <span>
                  Wholesale{" "}
                  <strong>
                    {money(
                      data.price_list_items.find(
                        (x) =>
                          x.product_id === p.id &&
                          x.price_list_id ===
                            data.customers.find(
                              (c) => c.id === data.profile?.customer_id,
                            )?.price_list_id,
                      )?.rate_paise ?? p.wholesale_paise,
                    )}
                  </strong>
                </span>
              </div>
              <p className="muted">
                {[
                  ...new Set(
                    data.variants
                      .filter((v) => v.product_id === p.id)
                      .map((v) => v.colour),
                  ),
                ].join(" · ") || "No variants yet"}
              </p>
              {can(["owner", "admin"]) && (
                <button className="text-button" onClick={() => setEdit(p)}>
                  <Pencil size={15} />
                  Edit product
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!rows.length && (
        <Empty title="Build your collection">
          Add the first product with its colours, sizes and opening stock.
        </Empty>
      )}
      {edit !== undefined && (
        <ProductForm
          product={edit || undefined}
          onClose={() => setEdit(undefined)}
        />
      )}
    </>
  );
}
function ProductForm({
  product,
  onClose,
}: {
  product?: Product;
  onClose: () => void;
}) {
  const { data } = useApp();
  const m = useMutation();
  const [productId] = useState(() => product?.id || crypto.randomUUID());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadedImage, setUploadedImage] = useState("");
  const [variants, setVariants] = useState<
    { colour: string; size: string; stock: number }[]
  >(product ? [] : SIZES.map((size) => ({ colour: "", size, stock: 0 })));
  return (
    <Modal
      wide
      title={product ? "Edit product" : "Add product"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = formValues(e);
          void m.run(
            async () => {
              const image = imageFile
                ? uploadedImage ||
                  (await uploadProductImage(imageFile, productId))
                : String(f.image_url || "");
              if (imageFile) setUploadedImage(image);
              return saveProduct({
                ...f,
                id: productId,
                image_url: image,
                active: f.active === "on",
                mrp_paise: Math.round(Number(f.mrp) * 100),
                retail_paise: Math.round(Number(f.retail) * 100),
                wholesale_paise: Math.round(Number(f.wholesale) * 100),
                variants,
              });
            },
            "Product saved.",
            onClose,
          );
        }}
      >
        <div className="form-grid">
          <Field label="Product name">
            <input name="name" required defaultValue={product?.name} />
          </Field>
          <Field label="Unique SKU">
            <input name="sku" required defaultValue={product?.sku} />
          </Field>
          <Field label="Category">
            <input name="category" defaultValue={product?.category} />
          </Field>
          <Field
            label="Product image URL"
            hint="Use a company-controlled HTTPS image."
          >
            <input
              type="url"
              name="image_url"
              defaultValue={product?.image_url}
            />
          </Field>
          <Field
            label="Upload catalogue image"
            hint="JPEG, PNG or WebP, up to 5 MB. Catalogue photos are public."
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                setImageFile(e.target.files?.[0] || null);
                setUploadedImage("");
              }}
            />
          </Field>
          <Field label="MRP (₹)">
            <input
              type="number"
              step="0.01"
              min={0}
              name="mrp"
              required
              defaultValue={product ? product.mrp_paise / 100 : undefined}
            />
          </Field>
          <Field label="Retail rate (₹)">
            <input
              type="number"
              step="0.01"
              min={0}
              name="retail"
              required
              defaultValue={product ? product.retail_paise / 100 : undefined}
            />
          </Field>
          <Field label="Wholesale rate (₹)">
            <input
              type="number"
              step="0.01"
              min={0}
              name="wholesale"
              required
              defaultValue={product ? product.wholesale_paise / 100 : undefined}
            />
          </Field>
          <label className="check-field">
            <input
              type="checkbox"
              name="active"
              defaultChecked={product?.active ?? true}
            />
            Active in catalogue
          </label>
        </div>
        {product && (
          <p>
            Existing stock is managed in Inventory. Add new colours below;
            existing variants keep their stock.
          </p>
        )}
        <h3>Colour and size variants</h3>
        {variants.length > 0 && (
          <div className="variant-grid">
            {variants.map((v, i) => (
              <div key={i}>
                <Field label={`Colour · size ${v.size}`}>
                  <input
                    required
                    value={v.colour}
                    onChange={(e) =>
                      setVariants(
                        variants.map((x, j) =>
                          j === i ? { ...x, colour: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Opening units">
                  <input
                    type="number"
                    min={0}
                    required
                    value={v.stock}
                    onChange={(e) =>
                      setVariants(
                        variants.map((x, j) =>
                          j === i ? { ...x, stock: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className="text-button"
          onClick={() =>
            setVariants([
              ...variants,
              ...SIZES.map((size) => ({ colour: "", size, stock: 0 })),
            ])
          }
        >
          <Plus size={16} />
          Add colour size run
        </button>
        <ErrorMessage error={m.error} />
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <Submit busy={m.busy}>Save product</Submit>
        </div>
      </form>
    </Modal>
  );
}
export function Customers() {
  const { data, can, navigate } = useApp();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Customer | null | undefined>();
  const [ledger, setLedger] = useState<Customer | null>(null);
  const rows = data.customers.filter((c) =>
    `${c.name} ${c.shop_name} ${c.phone}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="Your retail partners"
        action={
          can(["owner", "admin", "sales"]) && (
            <button className="button primary" onClick={() => setEdit(null)}>
              <Plus size={17} />
              Add customer
            </button>
          )
        }
      >
        Contact details, agreed terms and a clear account history.
      </Heading>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search customers" />
      </div>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Business / contact</th>
              <th>Phone / email</th>
              <th>Credit terms</th>
              <th>Outstanding</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.shop_name}</strong>
                  <small>{c.name}</small>
                </td>
                <td>
                  {c.phone}
                  <small>{c.email}</small>
                </td>
                <td>
                  {c.credit_days} days
                  <small>
                    {data.price_lists.find((p) => p.id === c.price_list_id)
                      ?.name || "Standard rates"}
                  </small>
                </td>
                <td>
                  {money(
                    data.orders
                      .filter(
                        (o) =>
                          o.customer_id === c.id &&
                          !["draft", "cancelled"].includes(o.status),
                      )
                      .reduce((s, o) => s + balance(o), 0),
                  )}
                </td>
                <td>
                  <button className="text-button" onClick={() => setLedger(c)}>
                    Ledger
                  </button>
                  {can(["owner", "admin", "sales"]) && (
                    <button
                      className="icon-button"
                      aria-label={"Edit " + c.shop_name}
                      onClick={() => setEdit(c)}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <Empty title="No customers yet">
            Add a retailer to start their first order.
          </Empty>
        )}
      </section>
      {edit !== undefined && (
        <CustomerForm
          customer={edit || undefined}
          onClose={() => setEdit(undefined)}
        />
      )}
      {ledger && (
        <Modal
          wide
          title={ledger.shop_name + " · account ledger"}
          onClose={() => setLedger(null)}
        >
          <p>{ledger.billing_address}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Credits</th>
                  <th>Balance</th>
                  <th>Credit / refund owed</th>
                </tr>
              </thead>
              <tbody>
                {data.orders
                  .filter(
                    (o) =>
                      o.customer_id === ledger.id &&
                      !["draft", "cancelled"].includes(o.status),
                  )
                  .map((o) => (
                    <tr key={o.id}>
                      <td>
                        <button
                          className="table-link"
                          onClick={() => {
                            setLedger(null);
                            navigate("orders/" + o.id);
                          }}
                        >
                          {o.number}
                        </button>
                      </td>
                      <td>{date(o.order_date)}</td>
                      <td>{money(o.total_paise)}</td>
                      <td>{money(o.paid_paise)}</td>
                      <td>{money(o.credit_paise || 0)}</td>
                      <td>{money(balance(o))}</td>
                      <td>{money(creditOwed(o))}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </>
  );
}
export function Inventory() {
  const { data, can } = useApp();
  const [q, setQ] = useState("");
  const [low, setLow] = useState(false);
  const [edit, setEdit] = useState<Row | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [submitted, setSubmitted] = useState<{
    quantity: number;
    note: string;
  } | null>(null);
  const m = useMutation();
  const rows = data.variants
    .map((v) => ({
      ...v,
      product: data.products.find((p) => p.id === v.product_id),
    }))
    .filter(
      (v) =>
        `${v.product?.name} ${v.product?.sku} ${v.colour} ${v.size}`
          .toLowerCase()
          .includes(q.toLowerCase()) &&
        (!low || v.stock - v.reserved < 10),
    );
  return (
    <>
      <Heading
        title="Inventory, size by size"
        action={
          <button
            className="button secondary"
            onClick={() =>
              exportCSV(
                "feelina-inventory",
                rows.map((v) => ({
                  SKU: v.product?.sku,
                  Product: v.product?.name,
                  Colour: v.colour,
                  Size: v.size,
                  Stock: v.stock,
                  Reserved: v.reserved,
                  Available: v.stock - v.reserved,
                })),
              )
            }
          >
            <Download size={16} />
            Export CSV
          </button>
        }
      >
        See what is available, reserved and ready to move.
      </Heading>
      <div className="toolbar">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Search product, colour or size"
        />
        <label className="check-field">
          <input
            type="checkbox"
            checked={low}
            onChange={(e) => setLow(e.target.checked)}
          />
          Low stock only
        </label>
      </div>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Colour</th>
              <th>Size</th>
              <th>On hand</th>
              <th>Reserved</th>
              <th>Available</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id}>
                <td>
                  <strong>{v.product?.name}</strong>
                  <small>{v.product?.sku}</small>
                </td>
                <td>{v.colour}</td>
                <td>{v.size}</td>
                <td>{v.stock}</td>
                <td>{v.reserved}</td>
                <td>
                  {v.stock - v.reserved}
                  {v.stock - v.reserved < 10 && (
                    <small className="warning-text">Low stock</small>
                  )}
                </td>
                <td>
                  {can(["owner", "admin", "inventory"]) && (
                    <button
                      className="text-button"
                      onClick={() => {
                        setRequestId(crypto.randomUUID());
                        setSubmitted(null);
                        setEdit(v);
                      }}
                    >
                      Adjust stock
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <Empty title="No matching variants">
            Add product variants in the catalogue or change your filters.
          </Empty>
        )}
      </section>
      <h2 className="section-heading">Movement history</h2>
      <div
        className="panel table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Report records"
      >
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Variant</th>
              <th>Movement</th>
              <th>Units</th>
              <th>Reference / note</th>
            </tr>
          </thead>
          <tbody>
            {[...data.stock_movements].reverse().map((x) => {
              const v = data.variants.find((v) => v.id === x.variant_id);
              return (
                <tr key={x.id}>
                  <td>{date(x.created_at)}</td>
                  <td>
                    {data.products.find((p) => p.id === v?.product_id)?.sku} ·{" "}
                    {v?.colour} · {v?.size}
                  </td>
                  <td>{title(x.kind)}</td>
                  <td>{x.quantity}</td>
                  <td>
                    {data.orders.find((o) => o.id === x.order_id)?.number ||
                      x.note ||
                      "Stock adjustment"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title="Adjust stock" onClose={() => setEdit(null)}>
          <p>
            Use a positive number for stock in, a negative number for stock out.
            Reserved units stay protected.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = formValues(e);
              const payload = submitted || {
                quantity: Number(f.quantity),
                note: String(f.note),
              };
              setSubmitted(payload);
              void m.run(
                () =>
                  adjustStock(
                    edit.id,
                    payload.quantity,
                    payload.note,
                    requestId,
                  ),
                "Stock adjustment recorded.",
                () => setEdit(null),
              );
            }}
          >
            {submitted && (
              <p className="info-note">
                Retry sends the same adjustment without applying it twice. Check
                movement history before closing this request and starting
                another.
              </p>
            )}
            <Field label="Change in units">
              <input
                name="quantity"
                type="number"
                step={1}
                required
                disabled={m.busy || Boolean(submitted)}
              />
            </Field>
            <Field label="Reason / source reference">
              <textarea
                name="note"
                required
                minLength={3}
                disabled={m.busy || Boolean(submitted)}
              />
            </Field>
            <ErrorMessage error={m.error} />
            <div className="modal-actions">
              <Submit busy={m.busy}>Record adjustment</Submit>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Payments() {
  const { data, can } = useApp();
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState<Row | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const m = useMutation();
  const eligible = data.orders.filter(
    (o) => !["draft", "cancelled"].includes(o.status) && balance(o) > 0,
  );
  return (
    <>
      <div className="no-print">
        <Heading
          title="Payments & receivables"
          action={
            can(["owner", "admin", "accounts"]) && (
              <button
                className="button primary"
                onClick={() => {
                  setRequestId(crypto.randomUUID());
                  setOpen(true);
                }}
              >
                <Plus size={17} />
                Record payment
              </button>
            )
          }
        >
          Orders first. Payments recorded when money is received.
        </Heading>
        <div className="stats-grid">
          <div className="stat-card">
            <span>Outstanding</span>
            <strong className="stat-value">
              {money(eligible.reduce((s, o) => s + balance(o), 0))}
            </strong>
          </div>
          <div className="stat-card">
            <span>Overdue</span>
            <strong className="stat-value">
              {money(
                eligible
                  .filter((o) => o.due_date && o.due_date < today())
                  .reduce((s, o) => s + balance(o), 0),
              )}
            </strong>
          </div>
          <div className="stat-card">
            <span>Received</span>
            <strong className="stat-value">
              {money(
                data.payments.reduce((s, p) => s + Number(p.amount_paise), 0),
              )}
            </strong>
          </div>
          <div className="stat-card">
            <span>Credit / refund owed</span>
            <strong className="stat-value">
              {money(data.orders.reduce((sum, o) => sum + creditOwed(o), 0))}
            </strong>
            <small>Review returns with accounts before refunding.</small>
          </div>
        </div>
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Order</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td>{date(p.paid_at)}</td>
                  <td>
                    {data.orders.find((o) => o.id === p.order_id)?.number}
                  </td>
                  <td>{money(p.amount_paise)}</td>
                  <td>{title(p.method)}</td>
                  <td>{p.reference || "—"}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setReceipt(p)}
                    >
                      View receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.payments.length && (
            <Empty title="No payments recorded">
              An order is never marked paid until a payment is recorded.
            </Empty>
          )}
        </section>
        {data.orders.some((o) => creditOwed(o) > 0) && (
          <section className="panel form-panel">
            <h2>Credits to review</h2>
            {data.orders
              .filter((o) => creditOwed(o) > 0)
              .map((o) => (
                <p key={o.id}>
                  {o.number} · {o.customer_snapshot.shop_name} ·{" "}
                  <strong>{money(creditOwed(o))} credit / refund owed</strong>
                </p>
              ))}
            <p className="muted">
              This records the amount owed. A refund must be completed and
              reconciled by accounts.
            </p>
          </section>
        )}
      </div>
      {receipt && (
        <section className="panel receipt-document">
          <div className="wordmark">feelina</div>
          <h2>Payment receipt</h2>
          <p>Receipt reference: {receipt.id}</p>
          <p>
            Order: {data.orders.find((o) => o.id === receipt.order_id)?.number}
          </p>
          <p>
            Received {money(receipt.amount_paise)} by {title(receipt.method)} on{" "}
            {date(receipt.paid_at)}.
          </p>
          <p>Payment reference: {receipt.reference || "Not provided"}</p>
          <div className="no-print heading-actions">
            <button className="button primary" onClick={() => window.print()}>
              Print / Save PDF
            </button>
            <button
              className="button secondary"
              onClick={() => setReceipt(null)}
            >
              Close receipt
            </button>
          </div>
        </section>
      )}
      {open && (
        <Modal title="Record a received payment" onClose={() => setOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = formValues(e);
              void m.run(
                () =>
                  recordPayment(
                    String(f.order_id),
                    Math.round(Number(f.amount) * 100),
                    String(f.method),
                    String(f.reference),
                    String(f.paid_at),
                    requestId,
                  ),
                "Payment recorded.",
                () => setOpen(false),
              );
            }}
          >
            <Field label="Order">
              <select name="order_id" required>
                <option value="">Choose an outstanding order</option>
                {eligible.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.number} · {o.customer_snapshot.shop_name} ·{" "}
                    {money(balance(o))} due
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Amount received (₹)">
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </Field>
              <Field label="Payment date">
                <input
                  name="paid_at"
                  type="date"
                  max={today()}
                  defaultValue={today()}
                  required
                />
              </Field>
              <Field label="Method">
                <select name="method">
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Reference number">
                <input name="reference" maxLength={200} />
              </Field>
            </div>
            <ErrorMessage error={m.error} />
            <p className="muted">
              Record only verified money received. This does not initiate a
              transfer.
            </p>
            <div className="modal-actions">
              <Submit busy={m.busy}>Record payment</Submit>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Reports() {
  const { data } = useApp();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customer, setCustomer] = useState("");
  const [mode, setMode] = useState("orders");
  const orders = data.orders.filter(
    (o) =>
      !["draft", "cancelled"].includes(o.status) &&
      (!from || o.order_date >= from) &&
      (!to || o.order_date <= to) &&
      (!customer || o.customer_id === customer),
  );
  const lines = data.order_lines.filter((l) =>
    orders.some((o) => o.id === l.order_id),
  );
  const rows: Record<string, unknown>[] =
    mode === "orders"
      ? orders.map((o) => ({
          Order: o.number,
          Date: o.order_date,
          Customer: o.customer_snapshot.shop_name,
          Type: o.order_type,
          Status: o.status,
          Total: money(o.total_paise),
          Paid: money(o.paid_paise),
          Credits: money(o.credit_paise || 0),
          Outstanding: money(balance(o)),
          "Credit / refund owed": money(creditOwed(o)),
        }))
      : mode === "sizes"
        ? lines.flatMap((l) =>
            SIZES.filter((s) => l.quantities[s] > 0).map((s) => ({
              Product: l.product_name,
              SKU: l.sku,
              Colour: l.colour,
              Size: s,
              Quantity: l.quantities[s],
              Value: money(l.quantities[s] * l.rate_paise),
            })),
          )
        : data.stock_movements
            .filter(
              (x) =>
                (!from || x.created_at.slice(0, 10) >= from) &&
                (!to || x.created_at.slice(0, 10) <= to) &&
                (!customer ||
                  data.orders.some(
                    (o) => o.id === x.order_id && o.customer_id === customer,
                  )),
            )
            .map((x) => ({
              Date: date(x.created_at),
              Variant: x.variant_id,
              Kind: x.kind,
              Quantity: x.quantity,
              Note: x.note,
            }));
  return (
    <>
      <Heading
        title="Business reports"
        action={
          <div className="heading-actions no-print">
            <button
              className="button secondary"
              disabled={!rows.length}
              onClick={() => exportCSV("feelina-" + mode, rows)}
            >
              <Download size={16} />
              Export CSV
            </button>
            <button className="button secondary" onClick={() => window.print()}>
              Print / Save PDF
            </button>
          </div>
        }
      >
        Filter the records behind your order, size and inventory summaries.
      </Heading>
      <div className="toolbar no-print">
        <Field label="Report">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="orders">Orders and customers</option>
            <option value="sizes">Product and size sales</option>
            <option value="movements">Stock movements</option>
          </select>
        </Field>
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
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Field label="Customer">
          <select
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          >
            <option value="">All customers</option>
            {data.customers.map((c) => (
              <option value={c.id} key={c.id}>
                {c.shop_name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p>
        {rows.length} records · {from || "All dates"} to {to || "today"}. Values
        reflect orders, not accounting revenue recognition.
      </p>
      <div
        className="panel table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Report records"
      >
        {rows.length ? (
          <table>
            <thead>
              <tr>
                {Object.keys(rows[0]).map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {Object.values(r).map((v, j) => (
                    <td key={j}>{String(v ?? "—")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="No records in this period">
            Change your filters or record your first transaction.
          </Empty>
        )}
      </div>
    </>
  );
}
export function SettingsPage() {
  const { data, can } = useApp();
  const [tab, setTab] = useState("business");
  const [account, setAccount] = useState<Row | null>(null);
  const [price, setPrice] = useState(false);
  const [priceEdit, setPriceEdit] = useState<Row | null>(null);
  const m = useMutation();
  const cfg = data.settings;
  return (
    <>
      <Heading title="Workspace settings">
        Verified business details, approved accounts and agreed prices.
      </Heading>
      <div className="tabs">
        {["business", "accounts", "prices", "audit"].map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {title(t)}
          </button>
        ))}
      </div>
      {tab === "business" && (
        <form
          className="panel form-panel"
          onSubmit={(e) => {
            e.preventDefault();
            const f = formValues(e);
            void m.run(
              () =>
                saveSettings({
                  ...f,
                  company_verified: f.company_verified === "on",
                  tax_verified: f.tax_verified === "on",
                  tax_rate_bps: Math.round(Number(f.tax_percent) * 100),
                  size_labels: Object.fromEntries(
                    SIZES.map((s) => [s, f["size_" + s]]),
                  ),
                }),
              "Business settings saved.",
            );
          }}
        >
          <h2>Business & tax configuration</h2>
          <p className="info-note">
            Use verified company information only. The reference invoice and
            size labels still need business review before launch.
          </p>
          <div className="form-grid">
            <Field label="Registered company name">
              <input name="company_name" defaultValue={cfg?.company_name} />
            </Field>
            <Field label="GSTIN">
              <input name="gstin" maxLength={15} defaultValue={cfg?.gstin} />
            </Field>
            <Field label="Business address" className="span-2">
              <textarea
                name="business_address"
                defaultValue={cfg?.business_address}
              />
            </Field>
            <Field label="Tax treatment">
              <select name="tax_mode" defaultValue={cfg?.tax_mode || "none"}>
                <option value="none">Not configured / no GST</option>
                <option value="cgst_sgst">
                  GST enabled · derive CGST/SGST or IGST by supply state
                </option>
                <option value="igst">
                  GST enabled · existing IGST setting (derived per order)
                </option>
              </select>
            </Field>
            <Field label="Total GST rate (%)">
              <input
                name="tax_percent"
                type="number"
                min={0}
                max={100}
                step="0.01"
                defaultValue={(cfg?.tax_rate_bps || 0) / 100}
              />
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                name="company_verified"
                defaultChecked={cfg?.company_verified}
              />
              Company details verified by business
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                name="tax_verified"
                defaultChecked={cfg?.tax_verified}
              />
              Tax treatment verified by accountant
            </label>
            <Field label="Payment & delivery terms" className="span-2">
              <textarea
                name="payment_terms"
                defaultValue={cfg?.payment_terms}
              />
            </Field>
            <Field label="Bank / UPI details" className="span-2">
              <textarea name="bank_details" defaultValue={cfg?.bank_details} />
            </Field>
          </div>
          <h3>Order matrix size labels</h3>
          <div className="size-label-grid">
            {SIZES.map((s) => (
              <Field key={s} label={"Size " + s}>
                <input
                  name={"size_" + s}
                  required
                  maxLength={24}
                  defaultValue={cfg?.size_labels?.[s] || s}
                />
              </Field>
            ))}
          </div>
          <ErrorMessage error={m.error} />
          <div className="modal-actions">
            <Submit busy={m.busy}>Save verified settings</Submit>
          </div>
        </form>
      )}
      {tab === "accounts" && (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Role</th>
                <th>Status</th>
                <th>Customer</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.profiles.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.full_name}</strong>
                    <small>{p.email}</small>
                  </td>
                  <td>{title(p.role)}</td>
                  <td>
                    <Badge status={p.status} />
                  </td>
                  <td>
                    {data.customers.find((c) => c.id === p.customer_id)
                      ?.shop_name || "—"}
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setAccount(p)}
                    >
                      Manage access
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {tab === "prices" && (
        <section className="panel form-panel">
          <div className="panel-header">
            <h2>Customer price lists</h2>
            <button
              className="button secondary"
              onClick={() => {
                setPriceEdit(null);
                setPrice(true);
              }}
            >
              <Plus size={16} />
              New price list
            </button>
          </div>
          {data.price_lists.map((p) => (
            <div className="price-list" key={p.id}>
              <h3>{p.name}</h3>
              <button
                className="text-button"
                onClick={() => {
                  setPriceEdit(p);
                  setPrice(true);
                }}
              >
                Edit price list
              </button>
              {data.price_list_items
                .filter((i) => i.price_list_id === p.id)
                .map((i) => (
                  <p key={i.product_id}>
                    {data.products.find((x) => x.id === i.product_id)?.name}{" "}
                    <strong>{money(i.rate_paise)}</strong>
                  </p>
                ))}
            </div>
          ))}
          {!data.price_lists.length && (
            <p>
              Standard retail and wholesale rates apply. Add a customer price
              list for agreed rates.
            </p>
          )}
        </section>
      )}
      {tab === "audit" && (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {[...data.audit_logs].reverse().map((a) => (
                <tr key={a.id}>
                  <td>{date(a.created_at)}</td>
                  <td>{a.action}</td>
                  <td>
                    {data.profiles.find((p) => p.id === a.actor_id)
                      ?.full_name || a.actor_id}
                  </td>
                  <td className="wrap-token">{a.entity_id || "Workspace"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {account && (
        <Modal title="Manage account access" onClose={() => setAccount(null)}>
          <p>{account.email}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = formValues(e);
              void m.run(
                () =>
                  updateProfile(
                    account.id,
                    String(f.role),
                    String(f.status),
                    String(f.customer_id) || null,
                  ),
                "Account access updated.",
                () => setAccount(null),
              );
            }}
          >
            <Field label="Role">
              <select name="role" defaultValue={account.role}>
                {ROLES.filter(
                  (r) => can(["owner"]) || !["owner", "admin"].includes(r),
                ).map((r) => (
                  <option key={r} value={r}>
                    {title(r)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Account status">
              <select name="status" defaultValue={account.status}>
                {["pending", "active", "suspended", "deactivated"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Retailer customer profile">
              <select
                name="customer_id"
                defaultValue={account.customer_id || ""}
              >
                <option value="">Not linked (staff)</option>
                {data.customers.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.shop_name}
                  </option>
                ))}
              </select>
            </Field>
            <ErrorMessage error={m.error} />
            <div className="modal-actions">
              <Submit busy={m.busy}>Update access</Submit>
            </div>
          </form>
        </Modal>
      )}
      {price && (
        <Modal
          title={priceEdit ? "Edit price list" : "Create price list"}
          onClose={() => setPrice(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = formValues(e);
              void m.run(
                () =>
                  rpc("save_price_list", {
                    payload: {
                      id: priceEdit?.id,
                      name: f.name,
                      items: data.products
                        .filter((p) => f[p.id] !== "")
                        .map((p) => ({
                          product_id: p.id,
                          rate_paise: Math.round(Number(f[p.id]) * 100),
                        })),
                    },
                  }),
                "Price list saved.",
                () => setPrice(false),
              );
            }}
          >
            <Field label="Price list name">
              <input name="name" required defaultValue={priceEdit?.name} />
            </Field>
            <p>Leave a product rate blank to use its standard selling rate.</p>
            {data.products.map((p) => (
              <Field key={p.id} label={p.name + " (₹)"}>
                <input
                  name={p.id}
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={
                    priceEdit
                      ? (data.price_list_items.find(
                          (i) =>
                            i.price_list_id === priceEdit.id &&
                            i.product_id === p.id,
                        )?.rate_paise ?? "") === ""
                        ? ""
                        : data.price_list_items.find(
                            (i) =>
                              i.price_list_id === priceEdit.id &&
                              i.product_id === p.id,
                          )!.rate_paise / 100
                      : ""
                  }
                />
              </Field>
            ))}
            <ErrorMessage error={m.error} />
            <div className="modal-actions">
              <Submit busy={m.busy}>Save price list</Submit>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
