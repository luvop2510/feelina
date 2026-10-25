begin;
-- This bucket contains catalogue photography only. Customer/order files have no public bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy feelina_product_images_read on storage.objects for select to anon,authenticated
using(bucket_id='product-images');
create policy feelina_product_images_insert on storage.objects for insert to authenticated
with check(bucket_id='product-images' and private.actor_role() in ('owner','admin'));
create policy feelina_product_images_update on storage.objects for update to authenticated
using(bucket_id='product-images' and private.actor_role() in ('owner','admin'))
with check(bucket_id='product-images' and private.actor_role() in ('owner','admin'));
create policy feelina_product_images_delete on storage.objects for delete to authenticated
using(bucket_id='product-images' and private.actor_role() in ('owner','admin'));
commit;
