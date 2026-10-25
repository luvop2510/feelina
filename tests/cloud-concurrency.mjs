// Manual release check against exact, disposable fixtures prepared by the operator.
// Never run with business identities. Remove fixtures using their exact IDs afterwards.
import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const meta = JSON.parse(fs.readFileSync(".e2e-concurrency.json", "utf8"));
assert.match(meta.tag, /^feelina-qa-/);
const url = "https://ttmrywjzmdfjsvuxgmpr.supabase.co";
const key = "sb_publishable_H4kyO085uXlYX3HBvGQCsA_sO2-LDxr";
const clients = meta.actors.map(() =>
  createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }),
);
const checks = [];
async function read(client, table, columns, id) {
  const result = await client.from(table).select(columns).eq("id", id).single();
  if (result.error) throw result.error;
  return result.data;
}
try {
  const logins = await Promise.all(
    clients.map((client, i) =>
      client.auth.signInWithPassword({
        email: meta.emails[i],
        password: meta.password,
      }),
    ),
  );
  for (const login of logins) if (login.error) throw login.error;
  assert.notEqual(
    logins[0].data.session.access_token,
    logins[1].data.session.access_token,
  );
  for (const pair of meta.rounds) {
    // Separate authenticated clients initiate competing reservations together.
    const outcomes = await Promise.all(
      clients.map((client, i) =>
        client.rpc("transition_order", {
          p_order_id: pair[i],
          p_status: "confirmed",
        }),
      ),
    );
    assert.equal(outcomes.filter((x) => !x.error).length, 1);
    assert.match(
      outcomes.find((x) => x.error).error.message,
      /Insufficient stock/,
    );
    const winner = outcomes.findIndex((x) => !x.error);
    const orderStates = await Promise.all(
      pair.map((id) => read(clients[0], "orders", "status", id)),
    );
    assert.equal(orderStates[winner].status, "confirmed");
    assert.equal(orderStates[1 - winner].status, "submitted");
    for (const id of meta.variants) {
      const stock = await read(clients[0], "variants", "stock,reserved", id);
      assert.deepEqual(stock, { stock: 10, reserved: 7 });
    }
    const cancelled = await clients[winner].rpc("transition_order", {
      p_order_id: pair[winner],
      p_status: "cancelled",
    });
    if (cancelled.error) throw cancelled.error;
    for (const id of meta.variants) {
      assert.deepEqual(
        await read(clients[0], "variants", "stock,reserved", id),
        { stock: 10, reserved: 0 },
      );
    }
  }
  checks.push(
    "three competing multi-variant confirmation rounds: exactly one success and no oversell",
    "losing transactions preserve submitted status and stock invariants",
    "each cancellation releases reservations exactly once",
  );

  const amountArgs = {
    p_order_id: meta.paymentOrder,
    p_amount_paise: 7000,
    p_method: "other",
    p_reference: meta.tag,
    p_paid_at: new Date().toISOString().slice(0, 10),
  };
  const payments = await Promise.all(
    clients.map((client) =>
      client.rpc("record_payment", {
        ...amountArgs,
        p_request_id: randomUUID(),
      }),
    ),
  );
  assert.equal(payments.filter((x) => !x.error).length, 1);
  assert.match(payments.find((x) => x.error).error.message, /outstanding/);
  assert.equal(
    (await read(clients[0], "orders", "paid_paise", meta.paymentOrder))
      .paid_paise,
    7000,
  );
  const retryArgs = {
    ...amountArgs,
    p_amount_paise: 3000,
    p_request_id: randomUUID(),
  };
  const retries = await Promise.all(
    clients.map((client) => client.rpc("record_payment", retryArgs)),
  );
  for (const retry of retries) if (retry.error) throw retry.error;
  assert.equal(retries[0].data, retries[1].data);
  assert.equal(
    (await read(clients[0], "orders", "paid_paise", meta.paymentOrder))
      .paid_paise,
    10000,
  );
  const ledger = await clients[0]
    .from("payments")
    .select("amount_paise")
    .eq("order_id", meta.paymentOrder);
  if (ledger.error) throw ledger.error;
  assert.equal(ledger.data.length, 2);
  assert.equal(
    ledger.data.reduce((sum, x) => sum + x.amount_paise, 0),
    10000,
  );
  checks.push(
    "competing payments cannot overpay",
    "simultaneous same-request retries return one payment ID and one ledger entry",
  );
  console.log(
    JSON.stringify({
      passed: true,
      independentAuthenticatedSessions: 2,
      confirmationRounds: 3,
      checks,
    }),
  );
} finally {
  await Promise.allSettled(clients.map((client) => client.auth.signOut()));
}
