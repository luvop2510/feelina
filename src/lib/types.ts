export const SIZES = ["30", "32", "34", "36", "38", "40", "42", "44"] as const;
export const ROLES = [
  "owner",
  "admin",
  "sales",
  "inventory",
  "accounts",
  "fulfilment",
  "retailer",
] as const;
export type Role = (typeof ROLES)[number];
export type Row = { id: string; [key: string]: any };
export type Profile = Row & {
  full_name: string;
  email: string;
  role: Role;
  status: string;
  customer_id?: string;
};
export type Product = Row & {
  sku: string;
  name: string;
  category: string;
  image_url?: string;
  mrp_paise: number;
  retail_paise: number;
  wholesale_paise: number;
  active: boolean;
};
export type Variant = Row & {
  product_id: string;
  colour: string;
  size: string;
  stock: number;
  reserved: number;
};
export type Customer = Row & {
  name: string;
  shop_name: string;
  email: string;
  phone: string;
  billing_address: string;
  shipping_address: string;
  gstin?: string;
  price_list_id?: string;
  credit_days: number;
};
export type OrderLine = Row & {
  order_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  colour: string;
  quantities: Record<string, number>;
  mrp_paise: number;
  rate_paise: number;
  quantity: number;
  amount_paise: number;
};
export type Order = Row & {
  number: string;
  customer_id: string;
  order_type: string;
  status: string;
  order_date: string;
  due_date: string;
  total_paise: number;
  subtotal_paise: number;
  discount_paise: number;
  tax_paise: number;
  paid_paise: number;
  customer_snapshot: Partial<Customer>;
  settings_snapshot: Record<string, any>;
};
export type Workspace = {
  profile: Profile | null;
  profiles: Profile[];
  customers: Customer[];
  products: Product[];
  variants: Variant[];
  orders: Order[];
  order_lines: OrderLine[];
  payments: Row[];
  stock_movements: Row[];
  audit_logs: Row[];
  price_lists: Row[];
  price_list_items: Row[];
  invoices: Row[];
  settings: Row | null;
  internal_order_notes: Row[];
  order_fulfilments: Row[];
  returns: Row[];
  return_items: Row[];
};
export const emptyWorkspace: Workspace = {
  profile: null,
  profiles: [],
  customers: [],
  products: [],
  variants: [],
  orders: [],
  order_lines: [],
  payments: [],
  stock_movements: [],
  audit_logs: [],
  price_lists: [],
  price_list_items: [],
  invoices: [],
  settings: null,
  internal_order_notes: [],
  order_fulfilments: [],
  returns: [],
  return_items: [],
};
export const money = (n: number | string = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n) / 100);
export const date = (s?: string) =>
  s
    ? new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(s))
    : "—";
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const title = (s: string) =>
  s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export function amountWords(paise: number): string {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const say = (n: number): string =>
    n < 20
      ? ones[n]
      : n < 100
        ? tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "")
        : n < 1000
          ? say(Math.floor(n / 100)) +
            " Hundred" +
            (n % 100 ? " " + say(n % 100) : "")
          : n < 100000
            ? say(Math.floor(n / 1000)) +
              " Thousand" +
              (n % 1000 ? " " + say(n % 1000) : "")
            : n < 10000000
              ? say(Math.floor(n / 100000)) +
                " Lakh" +
                (n % 100000 ? " " + say(n % 100000) : "")
              : say(Math.floor(n / 10000000)) +
                " Crore" +
                (n % 10000000 ? " " + say(n % 10000000) : "");
  const n = Math.round(Number(paise));
  return `${say(Math.floor(n / 100)) || "Zero"} Rupees${n % 100 ? " and " + say(n % 100) + " Paise" : ""} Only`;
}
export function exportCSV(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cell = (v: unknown) => {
    let s = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const keys = Object.keys(rows[0]);
  const content =
    "\uFEFF" +
    [
      keys.map(cell).join(","),
      ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
    ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8;" }),
  );
  a.download = name + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
