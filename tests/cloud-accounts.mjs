// Manual, opt-in hosted Auth/Edge/RLS test. Creates only uniquely marked fixtures,
// then removes their identities and customer rows. Never use real account passwords.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
export async function runCloudAccounts({ url, serviceKey, publicKey }) {
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, serviceKey, options);
  const ids = [];
  const customerIds = [];
  const initial = "Synthetic-" + randomUUID();
  const replacement = "Replacement-" + randomUUID();
  const call = async (client, body) => {
    const {
      data: { session },
    } = await client.auth.getSession();
    const response = await fetch(url + "/functions/v1/manage-users", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + session.access_token,
        apikey: publicKey,
        "Content-Type": "application/json",
        Origin: "https://feelina.vercel.app",
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const login = async (email, password) => {
    const client = createClient(url, publicKey, options);
    const { error } = await client.auth.signInWithPassword({ email, password });
    assert.ifError(error);
    return client;
  };
  const ok = async (query) => {
    const result = await query;
    assert.ifError(result.error);
    return result.data;
  };
  try {
    const email = "feelina-owner-test+" + randomUUID() + "@example.test";
    const created = await admin.auth.admin.createUser({
      email,
      password: initial,
      email_confirm: true,
      app_metadata: {
        feelina_password_issued: true,
        feelina_test_fixture: true,
      },
    });
    assert.ifError(created.error);
    const ownerId = created.data.user.id;
    ids.push(ownerId);
    await ok(
      admin
        .from("profiles")
        .update({
          role: "owner",
          status: "active",
          must_change_password: true,
          partner_type: "staff",
        })
        .eq("id", ownerId),
    );
    const owner = await login(email, initial);
    assert(
      (await owner.rpc("save_customer", { payload: { name: "Must fail" } }))
        .error,
    );
    assert.equal(
      (
        await call(owner, {
          action: "change-initial-password",
          password: replacement,
        })
      ).status,
      200,
    );
    const profile = await ok(
      owner
        .from("profiles")
        .select("must_change_password")
        .eq("id", ownerId)
        .single(),
    );
    assert.equal(profile.must_change_password, false);
    const customerId = await ok(
      owner.rpc("save_customer", {
        payload: {
          name: "Isolated account test",
          shop_name: "Disposable test fixture",
        },
      }),
    );
    customerIds.push(customerId);
    const spec = {
      action: "create",
      request_id: randomUUID(),
      email: "feelina-staff-test+" + randomUUID() + "@example.test",
      username: "test." + randomUUID().slice(0, 8),
      full_name: "Disposable staff fixture",
      password: initial,
      role: "sales",
      partner_type: "staff",
      customer_id: null,
    };
    const staffCreated = await call(owner, spec);
    assert.equal(staffCreated.status, 201, JSON.stringify(staffCreated.body));
    ids.push(staffCreated.body.id);
    assert.equal(staffCreated.body.must_change_password, true);
    const staff = await login(spec.email, initial);
    assert(
      (await staff.rpc("save_customer", { payload: { name: "Must fail" } }))
        .error,
    );
    assert.equal(
      (
        await call(staff, {
          action: "change-initial-password",
          password: replacement,
        })
      ).status,
      200,
    );
    await ok(
      owner.rpc("manage_team_user", {
        p_user_id: staffCreated.body.id,
        p_username: spec.username,
        p_partner_type: "staff",
        p_full_name: spec.full_name,
        p_role: "admin",
        p_status: "active",
        p_customer_id: null,
      }),
    );
    const escalation = await call(staff, {
      ...spec,
      request_id: randomUUID(),
      role: "owner",
      email: "uncreated@example.test",
    });
    assert.equal(escalation.status, 403);
    await ok(
      owner.rpc("update_profile", {
        p_user_id: staffCreated.body.id,
        p_role: "admin",
        p_status: "suspended",
        p_customer_id: null,
      }),
    );
    const retry = await call(owner, spec);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.status, "suspended");
    assert(
      (await staff.rpc("save_customer", { payload: { name: "Must fail" } }))
        .error,
    );
    const partnerSpec = {
      ...spec,
      request_id: randomUUID(),
      email: "feelina-partner-test+" + randomUUID() + "@example.test",
      username: "test." + randomUUID().slice(0, 8),
      role: "retailer",
      partner_type: "distributor",
      customer_id: customerId,
    };
    const partnerCreated = await call(owner, partnerSpec);
    assert.equal(
      partnerCreated.status,
      201,
      JSON.stringify(partnerCreated.body),
    );
    ids.push(partnerCreated.body.id);
    const partner = await login(partnerSpec.email, initial);
    assert.equal(
      (
        await call(partner, {
          action: "change-initial-password",
          password: replacement,
        })
      ).status,
      200,
    );
    const customers = await ok(partner.from("customers").select("id"));
    assert.deepEqual(
      customers.map((x) => x.id),
      [customerId],
    );
    assert.equal((await call(partner, spec)).status, 403);
    const unauthorized = await fetch(url + "/functions/v1/manage-users", {
      method: "POST",
      headers: { apikey: publicKey },
      body: JSON.stringify(spec),
    });
    assert.equal(unauthorized.status, 401);
    await Promise.all([owner, staff, partner].map((x) => x.auth.signOut()));
    console.log(
      JSON.stringify({
        initialPasswordGate: true,
        authenticatedPasswordReplacement: true,
        ownerCreatesStaffAndDistributor: true,
        adminEscalationDenied: true,
        suspendedRetryStaysSuspended: true,
        retailerCustomerScope: true,
        anonymousDenied: true,
      }),
    );
  } finally {
    if (ids.length)
      await ok(admin.from("audit_logs").delete().in("actor_id", ids));
    for (const id of ids.reverse()) {
      const { error } = await admin.auth.admin.deleteUser(id);
      assert.ifError(error);
    }
    for (const id of customerIds)
      await ok(admin.from("customers").delete().eq("id", id));
    console.log(
      JSON.stringify({
        fixtureAccountsRemoved: ids.length,
        fixtureCustomersRemoved: customerIds.length,
      }),
    );
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.env.FEELINA_RUN_LIVE_ACCOUNT_TEST !== "1")
    throw new Error("Explicitly opt in to disposable hosted account tests.");
  await runCloudAccounts({
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    publicKey: process.env.SUPABASE_PUBLISHABLE_KEY,
  });
}
