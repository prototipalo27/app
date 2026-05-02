-- Descripción del proyecto que aparece en el Recital I del NDA de Studio.
-- Por defecto un placeholder genérico — el manager puede editarlo desde
-- el tab Brief para describir el proyecto concreto (p.ej. "wearable
-- monitoring device for horses") y que el contrato salga personalizado.

alter table public.studio_projects
  add column if not exists nda_project_description text;

-- Cargo / posición del firmante. Solo se usa en el NDA de Studio
-- (la plantilla mutual lo pide en la cláusula de partes y en la firma).
-- Para NDAs de lead se queda en null sin afectar al PDF.

alter table public.nda_agreements
  add column if not exists signer_position text;
