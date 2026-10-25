import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("size-chart migration updates current settings/default and preserves historical snapshots", async () => {
  const db = new PGlite();
  const old = {
    30: "30 / S",
    32: "32 / M",
    34: "34 / L",
    36: "36 / XL",
    38: "38",
    40: "40",
    42: "42",
    44: "44",
  };
  const approved = {
    30: "S",
    32: "M",
    34: "L",
    36: "XL",
    38: "XXL",
    40: "XXXL",
    42: "4XL",
    44: "5XL",
  };
  await db.exec(
    "create table public.settings(id integer primary key, size_labels jsonb not null, updated_at timestamptz default now()); create table public.invoices(id integer primary key, snapshot jsonb);",
  );
  await db.query("insert into public.settings(id,size_labels) values (1,$1)", [
    old,
  ]);
  await db.query("insert into public.invoices values(1,$1)", [
    { issuer: { size_labels: old }, total_paise: 12345 },
  ]);
  const migration = await readFile(
    "supabase/migrations/20261025130000_correct_size_chart.sql",
    "utf8",
  );
  await db.exec(migration);
  assert.deepEqual(
    (await db.query("select size_labels from public.settings where id=1"))
      .rows[0].size_labels,
    approved,
  );
  await db.exec("insert into public.settings(id) values (2)");
  assert.deepEqual(
    (await db.query("select size_labels from public.settings where id=2"))
      .rows[0].size_labels,
    approved,
  );
  assert.deepEqual(
    (await db.query("select snapshot from public.invoices")).rows[0].snapshot,
    { issuer: { size_labels: old }, total_paise: 12345 },
  );
  await db.exec(migration);
  assert.deepEqual(
    (await db.query("select size_labels from public.settings where id=1"))
      .rows[0].size_labels,
    approved,
  );
  await db.close();
});
