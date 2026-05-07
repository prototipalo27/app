-- Quitamos los campos de facturación duplicados en studio_projects.
-- La fuente real son los contratos firmados (NDA / dev_agreement) — el cliente
-- los rellena ahí. Mantenemos solo `tax_rate` como override manual de IVA por
-- proyecto (Holded no decide IVA por país automáticamente en su API).

alter table public.studio_projects
  drop column if exists client_company_name,
  drop column if exists client_tax_id,
  drop column if exists client_address,
  drop column if exists client_city,
  drop column if exists client_postal_code,
  drop column if exists client_country,
  drop column if exists client_country_code,
  drop column if exists client_representative;
