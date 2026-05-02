-- Firma manuscrita (PNG base64) que se incrusta en los NDAs en la columna
-- de Prototipalo. La firma del NDA siempre es la del super_admin del
-- sistema (Manu), independientemente de quién dispare el envío.

alter table public.user_profiles
  add column if not exists signature_data text;
