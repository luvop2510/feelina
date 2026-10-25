import { createClient } from "@supabase/supabase-js";
import { emptyWorkspace, type Workspace } from "./types";
const url = import.meta.env.VITE_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(
  url && key && import.meta.env.VITE_SUPABASE_READY === "true",
);
export const supabase = configured ? createClient(url, key) : null;
export async function rpc(name: string, args: Record<string, unknown> = {}) {
  if (!supabase)
    throw new Error(
      "The secure database is not configured. Contact your administrator.",
    );
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export const saveCustomer = (payload: unknown) =>
  rpc("save_customer", { payload });
export const saveProduct = (payload: unknown) =>
  rpc("save_product", { payload });
export const saveOrder = (payload: unknown) => rpc("save_order", { payload });
export const transitionOrder = (id: string, status: string) =>
  rpc("transition_order", { p_order_id: id, p_status: status });
export const recordPayment = (
  id: string,
  amount: number,
  method: string,
  reference: string,
  paidAt: string,
  requestId: string,
) =>
  rpc("record_payment", {
    p_order_id: id,
    p_amount_paise: amount,
    p_method: method,
    p_reference: reference,
    p_paid_at: paidAt,
    p_request_id: requestId,
  });
export const adjustStock = (
  id: string,
  quantity: number,
  note: string,
  requestId: string,
) =>
  rpc("adjust_stock", {
    p_variant_id: id,
    p_quantity: quantity,
    p_note: note,
    p_request_id: requestId,
  });
export const updateProfile = (
  id: string,
  role: string,
  status: string,
  customerId: string | null,
) =>
  rpc("update_profile", {
    p_user_id: id,
    p_role: role,
    p_status: status,
    p_customer_id: customerId,
  });
export const saveSettings = (payload: unknown) =>
  rpc("save_settings", { payload });
export const issueInvoice = (id: string) =>
  rpc("issue_invoice", { p_order_id: id });
export async function loadWorkspace(): Promise<Workspace> {
  if (!supabase) throw new Error("Database configuration is missing.");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ...emptyWorkspace };
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) return { ...emptyWorkspace };
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  if (profile.status !== "active") return { ...emptyWorkspace, profile };
  const names = [
    "profiles",
    "customers",
    "products",
    "variants",
    "orders",
    "order_lines",
    "payments",
    "stock_movements",
    "audit_logs",
    "price_lists",
    "price_list_items",
    "invoices",
    "settings",
    "internal_order_notes",
    "order_fulfilments",
    "returns",
    "return_items",
  ] as const;
  const results = await Promise.all(
    names.map(async (name) => {
      const rows: any[] = [];
      for (let start = 0; ; start += 1000) {
        let query = supabase!.from(name).select("*");
        query =
          name === "price_list_items"
            ? query.order("price_list_id").order("product_id")
            : query.order("id");
        const { data, error } = await query.range(start, start + 999);
        if (error) throw new Error(`${name}: ${error.message}`);
        rows.push(...data);
        if (data.length < 1000) break;
      }
      return [name, name === "settings" ? (rows[0] ?? null) : rows] as const;
    }),
  );
  return {
    ...emptyWorkspace,
    ...Object.fromEntries(results),
    profile,
  } as Workspace;
}

export async function uploadProductImage(file: File, productId: string) {
  if (!supabase) throw new Error("The secure database is not configured.");
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  if (!extensions[file.type] || file.size > 5 * 1024 * 1024 || file.size === 0)
    throw new Error("Choose a JPEG, PNG or WebP image up to 5 MB.");
  const path = `${productId}/${crypto.randomUUID()}.${extensions[file.type]}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from("product-images").getPublicUrl(path).data
    .publicUrl;
}
