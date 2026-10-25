-- Approved size chart. Preserve all issued invoice/order snapshots and quantities.
alter table public.settings alter column size_labels set default
  '{"30":"S","32":"M","34":"L","36":"XL","38":"XXL","40":"XXXL","42":"4XL","44":"5XL"}'::jsonb;

update public.settings
set size_labels = size_labels || '{"30":"S","32":"M","34":"L","36":"XL","38":"XXL","40":"XXXL","42":"4XL","44":"5XL"}'::jsonb,
    updated_at = clock_timestamp()
where size_labels is distinct from size_labels || '{"30":"S","32":"M","34":"L","36":"XL","38":"XXL","40":"XXXL","42":"4XL","44":"5XL"}'::jsonb;
