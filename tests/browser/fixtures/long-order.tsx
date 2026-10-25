// Test-only synthetic workspace. This HTML entry is not part of the production build.
import React from "react";
import { createRoot } from "react-dom/client";
import { AppContext } from "../../../src/lib/context";
import { sampleWorkspace } from "../../../src/lib/sample";
import { OrderDetail } from "../../../src/components/Orders";
import type { OrderLine } from "../../../src/lib/types";
import "../../../src/index.css";

const data = structuredClone(sampleWorkspace);
const order = data.orders[0];
order.id = "print-stress-order";
order.number = "PRINT-FIXTURE-100";
order.notes = "PRINT-END-MARKER — synthetic pagination check.";
order.customer_snapshot = {
  ...order.customer_snapshot,
  billing_address:
    "Synthetic long billing address for pagination verification only. No real customer information.",
  shipping_address:
    "Synthetic long shipping address for pagination verification only. No real customer information.",
};
const line: OrderLine = data.order_lines[0];
data.orders = [order];
data.order_lines = Array.from({ length: 100 }, (_, i) => ({
  ...line,
  id: "print-line-" + i,
  order_id: order.id,
  position: i + 1,
  product_id: "print-product-" + i,
  product_name:
    `ROW${String(i + 1).padStart(3, "0")} ` +
    "Long product name for legible wrapping in the size matrix. "
      .repeat(3)
      .slice(0, 150),
  sku: `PRINT-${i + 1}`,
  colour: "Synthetic rose colour with a descriptive name for printing",
  quantities: {
    "30": 1,
    "32": 1,
    "34": 1,
    "36": 1,
    "38": 1,
    "40": 1,
    "42": 1,
    "44": 1,
  },
  quantity: 8,
  mrp_paise: 2999,
  rate_paise: 1999,
  amount_paise: 15992,
}));
order.subtotal_paise = order.total_paise = 1599200;
order.discount_paise =
  order.tax_paise =
  order.paid_paise =
  order.credit_paise =
    0;
createRoot(document.getElementById("root")!).render(
  <AppContext.Provider
    value={{
      data,
      sample: true,
      reload: async () => {},
      notify: () => {},
      navigate: () => {},
      can: () => false,
    }}
  >
    <div className="app-shell">
      <aside className="sidebar">CONTROL-CHROME</aside>
      <div className="main-shell">
        <main className="page-content">
          <OrderDetail id={order.id} />
        </main>
      </div>
    </div>
  </AppContext.Provider>,
);
