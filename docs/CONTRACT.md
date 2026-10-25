# Feelina implementation contract

A React 19 + TypeScript + Vite application deployed to Vercel, backed by a dedicated Supabase PostgreSQL project and Supabase Auth. No business persistence in local storage. Browser auth session storage is permitted. All writes go through restricted PostgreSQL RPCs with explicit role checks and RLS; private tables deny anonymous access.

## Modules and build order
identity → catalogue/customers → orders → inventory/payments/documents → reporting.

## Data contract
All money values use integer paise. UUID identifiers. Dates ISO strings. Eight size keys: 30,32,34,36,38,40,42,44. Labels default to 30 / S,32 / M,34 / L,36 / XL,38,40,42,44, marked pending invoice verification.

Tables in public schema: profiles(id auth user uuid, email, full_name, role, status, customer_id); customers(id,name,shop_name,email,phone,billing_address,shipping_address,gstin,price_list_id,credit_days); products(id,sku,name,category,image_url,mrp_paise,retail_paise,wholesale_paise,active); variants(id,product_id,colour,size,stock,reserved); price_lists(id,name); price_list_items(price_list_id,product_id,rate_paise); orders(id,number,customer_id,created_by,order_type,status,order_date,due_date,transporter,lr_number,lr_date,dispatch_details,notes,subtotal_paise,discount_paise,tax_paise,total_paise,paid_paise,customer_snapshot,settings_snapshot,created_at); order_lines(id,order_id,product_id,product_name,sku,colour,quantities JSON size→integer,mrp_paise,rate_paise,quantity,amount_paise); payments(id,order_id,amount_paise,method,reference,paid_at,created_by); stock_movements(id,variant_id,order_id,quantity,kind,note,created_by,created_at); audit_logs(id,actor_id,action,entity_id,details,created_at); settings(id=1,company_name,business_address,gstin,company_verified,tax_verified,tax_mode,tax_rate_bps,size_labels JSON,payment_terms,bank_details); invoices(id,number,order_id,snapshot,created_at).
Roles: owner,admin,sales,inventory,accounts,fulfilment,retailer. Status profile pending/active/suspended/deactivated. Retailer gets own records only after approval. No first-user owner escalation.
Order states draft,submitted,confirmed,processing,packed,dispatched,delivered,cancelled.

## RPC contract
- save_customer(payload jsonb) → uuid (payload id optional)
- save_product(payload jsonb) → uuid (payload id optional; variants [{colour,size,stock}] initial only)
- save_order(payload jsonb) → uuid: id optional; customer_id,order_type,order_date,due_date,transporter,lr_number,lr_date,dispatch_details,notes,discount_paise,lines [{product_id,colour,quantities}]. Server ignores client prices/totals. Draft edit only. Immutable snapshots at save; rates locked upon submission.
- transition_order(p_order_id uuid,p_status text) → void. Draft→submitted→confirmed→processing→packed→dispatched→delivered; cancellation eligible pre-dispatch releases reservations; stock deducted at dispatch. Transactions lock inventory variants in stable order. Idempotent same-state transitions.
- record_payment(p_order_id uuid,p_amount_paise bigint,p_method text,p_reference text,p_paid_at date) → uuid. Prevent overpayment, cancelled/draft payments. Order row lock.
- adjust_stock(p_variant_id uuid,p_quantity integer,p_note text) → void. Prevent stock below reserved.
- update_profile(p_user_id uuid,p_role text,p_status text,p_customer_id uuid) → void. Owner/admin only; admins cannot assign/manage owner/admin. Protect last owner.
- save_settings(payload jsonb) → void. Owner/admin only. No invented statutory details.
- issue_invoice(p_order_id uuid) → uuid. Separate sequential invoice and immutable snapshot; require company/tax verified, valid GSTIN/address and eligible order.
- record_return(p_order_id uuid,p_items jsonb,p_note text) → uuid. Items [{variant_id,quantity}], only dispatched/delivered; cap at fulfilled quantity, stock and credit audit. If unsupported document honestly rather than simulate.

Frontend src/lib/api.ts owns exports supabase, configured, loadWorkspace(), saveCustomer(payload), saveProduct(payload), saveOrder(payload), transitionOrder(id,status), recordPayment(...), adjustStock(...), updateProfile(...), saveSettings(payload), issueInvoice(id). loadWorkspace returns tables as arrays plus settings object and profile; all types in src/lib/types.ts. Frontend can call Supabase directly through this module. Modules use standard HTML semantic controls, HashRouter or hash state, no hidden fake API. Sample workspace, if included, is visibly labelled and read-only; never call sample persistence operational.

## Verification
Typecheck/build; real PostgreSQL integration tests using PGlite where possible for RLS, role boundaries, rate tampering, quantities, stock, payments and idempotency; browser workflows at desktop/375px, keyboard and print layout. CI runs typecheck, tests, build, audit. No claims of verification without recorded evidence.

## Retry and supply-state extension
Stock RPCs take a mandatory stable p_request_id UUID: adjust_stock(uuid,integer,text,uuid), dispatch_order(uuid,jsonb,text,uuid), record_return(uuid,jsonb,text,uuid). Payment RPC likewise takes p_request_id. Customer supply_state_code and order place_of_supply_state hold a verified two-digit delivery state code. For configured GST, the server derives IGST vs CGST/SGST using supply state versus issuer GSTIN state; configured tax rate remains business-verified. Invoice issuer is the immutable order settings snapshot. Amounts are capped at 1e12 paise to stay within exact JavaScript integer arithmetic.
