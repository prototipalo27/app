-- Carpeta de Google Drive asociada a un proyecto Studio. Sigue el mismo
-- patrón que `projects.google_drive_folder_id`: cada proyecto vive bajo
-- la carpeta del cliente en el shared drive.

alter table public.studio_projects
  add column if not exists google_drive_folder_id text;
