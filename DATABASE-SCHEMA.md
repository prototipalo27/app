# Database Schema — Prototipalo

## Core Business Tables

### `leads`
CRM lead records from all inbound channels.
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| full_name | text | |
| email | text | Unique (lowercase), nullable |
| phone | text | |
| company | text | |
| message | text | Original inquiry message |
| source | text | webflow, whatsapp, email, manual, holded |
| status | text | new, contacted, quoted, won, paid, lost |
| assigned_to | uuid FK→user_profiles | Manager handling the lead |
| owned_by | uuid FK→user_profiles | Captador who brought the lead |
| estimated_value | numeric | Auto-calculated via DB trigger |
| estimated_quantity | text | 1-10, 10-50, 50-200, 200-500, 500+ |
| estimated_complexity | text | low, medium, high |
| estimated_urgency | text | normal, urgent |
| project_type_tag | text | AI-classified project type |
| ai_summary | text | AI-generated summary |
| ai_draft | text | AI-generated response draft |
| lost_reason | text | Why the lead was lost |
| won_at | timestamptz | When marked as won |
| payment_condition | text | Payment terms |
| attachments | text | Uploadcare group URL |
| created_at, updated_at | timestamptz | |

**Relations**: → lead_activities, quote_requests, lead_utm_data, nda_agreements, projects

### `lead_activities`
Timeline of all interactions with a lead.
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| lead_id | uuid FK→leads | |
| activity_type | text | note, email_sent, email_received, status_change, call |
| content | text | Activity body |
| metadata | jsonb | Thread IDs, email headers, status changes |
| thread_id | text | Gmail thread grouping |
| created_by | uuid FK→user_profiles | |
| created_at | timestamptz | |

### `quote_requests`
Quotes/proformas sent to clients.
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| lead_id | uuid FK→leads | |
| token | text UNIQUE | Public access token for /quote/[token] |
| items | jsonb | Array of {concept, price, units, tax} |
| notes | text | |
| status | text | draft, sent, viewed, accepted |
| payment_status | text | pending, paid |
| holded_estimate_id | text | Holded document ID |
| holded_proforma_id | text | |
| cc_emails | jsonb | Array of {email, label} |
| paid_at | timestamptz | |
| paid_amount | numeric | |
| created_at | timestamptz | |

### `projects`
Production projects (created after payment or manually).
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | |
| description | text | |
| status | text | pending, design, printing, post_processing, qc, shipping, delivered |
| project_type | text | confirmed, upcoming |
| client_name | text | |
| client_email | text | |
| lead_id | uuid FK→leads | |
| template_id | uuid FK→project_templates | |
| project_manager_id | uuid FK→user_profiles | |
| tracking_token | text UNIQUE | Public tracking URL token |
| google_drive_folder_id | text | |
| holded_contact_id | text | |
| holded_proforma_id | text | |
| holded_invoice_id | text | |
| design_visible | boolean | Client can see designs |
| design_approved_at | timestamptz | |
| deliverable_visible | boolean | |
| deliverable_approved_at | timestamptz | |
| payment_confirmed_at | timestamptz | |
| queue_priority | integer | Print queue priority |
| deadline | date | |
| price | numeric | |
| material | text | |
| created_by | uuid FK→user_profiles | |
| created_at, updated_at | timestamptz | |

**Relations**: → project_items, project_checklist_items, shipping_info, print_jobs

### `project_items`
Line items within a project (individual parts to print).
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| project_id | uuid FK→projects | |
| name | text | |
| quantity | integer | Total pieces |
| completed | integer | Pieces done |
| printer_type_id | uuid FK→printer_types | |
| print_time_minutes | integer | |
| file_keyword | text | For auto-matching gcode filenames |
| created_at | timestamptz | |

### `print_jobs`
Individual print batches assigned to printers.
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| project_item_id | uuid FK→project_items | |
| printer_id | uuid FK→printers | |
| printer_type_id | uuid FK→printer_types | |
| batch_number | integer | Unique per item |
| pieces_in_batch | integer | |
| estimated_minutes | integer | |
| status | text | queued, printing, done, failed |
| position | integer | Queue position |
| gcode_filename | text | |
| started_at, completed_at | timestamptz | |

---

## Shipping Tables

### `shipping_info`
One record per shipment (1:1 with project).
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| project_id | uuid FK→projects UNIQUE | |
| carrier | text | Packlink, GLS, MRW, Cabify |
| tracking_number | text | |
| packlink_shipment_ref | text | |
| gls_barcode | text | |
| mrw_albaran | text | |
| cabify_parcel_id | text | |
| shipment_status | text | |
| address_line, city, postal_code, country | text | |
| shipped_at, delivered_at | timestamptz | |

---

## Printer Tables

### `printers`
Physical Bambu Lab printers synced via MQTT.
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | e.g. PROTO-1, AMS-2 |
| serial_number | text UNIQUE | |
| printer_type_id | uuid FK→printer_types | |
| status | text | idle, running, paused, offline |
| current_file | text | Gcode filename being printed |
| progress | integer | 0-100 |
| nozzle_temp, bed_temp | numeric | |
| raw_status | jsonb | Full MQTT payload |
| lifetime_seconds | bigint | |
| last_synced_at | timestamptz | |

### `printer_types`
Printer models (P1S, A1, A1 Mini).
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text UNIQUE | |
| has_ams | boolean | |

---

## Team Tables

### `user_profiles`
All team members.
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK (FK→auth.users) | |
| email | text | |
| role | text | super_admin, manager, comercial, employee |
| is_active | boolean | |
| full_name | text | |
| nickname | text | |
| phone | text | |
| birthday | text | Format: MM-DD |
| hire_date | date | |
| contract_end_date | date | |
| career_plan | text | |

### `tasks`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| title | text | |
| description | text | |
| status | text | pending, in_progress, done |
| priority | text | low, medium, high, urgent |
| assigned_to | uuid FK→user_profiles | |
| project_id | uuid FK→projects | |
| due_date | date | |
| created_by | uuid FK→user_profiles | |

---

## Finance Tables

### `supplier_payments`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| supplier_id | uuid FK→suppliers | |
| amount | numeric | |
| description | text | |
| payment_date | date | |
| has_invoice | boolean | |

### `bank_statements`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| month | integer | |
| year | integer | |
| transactions | jsonb | Parsed BankTransaction[] |

### `tax_payments`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| model | text | Tax model number |
| period | text | e.g. "Q1-2026" |
| due_date | date | |
| status | text | pending, paid |
| UNIQUE(model, period) | | |

---

## Integration Tables

### `holded_contacts` — Cached Holded CRM contacts
### `client_addresses` — Shipping addresses per Holded contact
### `client_drive_folders` — Google Drive folder IDs per client
### `client_verifications` — Email verification for public portals
### `nda_agreements` — NDA signing records
### `push_subscriptions` — Browser push notification endpoints
### `webhook_logs` — Inbound webhook audit trail
### `whatsapp_conversations` / `whatsapp_messages` — Chat history
### `commission_configs` — Sales commission rules per user
### `vendor_mappings` — Bank statement vendor → supplier mapping
### `email_snippets` — Reusable email templates
### `scheduled_emails` — Queued outbound emails

---

## Key Relationships

```
leads ─────┬──→ lead_activities (1:many)
            ├──→ quote_requests (1:many)
            ├──→ lead_utm_data (1:1)
            ├──→ nda_agreements (1:many)
            └──→ projects (1:many)

projects ──┬──→ project_items (1:many) ──→ print_jobs (1:many)
            ├──→ project_checklist_items (1:many)
            ├──→ shipping_info (1:1)
            ├──→ project_files (1:many)
            └──→ project_status_history (1:many)

printers ──┬──→ print_jobs (1:many)
            └──→ printer_daily_stats (1:many)

user_profiles ──┬──→ tasks (assigned_to, created_by)
                 ├──→ leads (assigned_to, owned_by)
                 ├──→ projects (project_manager_id, created_by)
                 ├──→ commission_configs (1:1)
                 ├──→ overtime_entries (1:many)
                 ├──→ time_off_requests (1:many)
                 └──→ user_skills (many:many via skills)

suppliers ──┬──→ supplier_payments (1:many)
             └──→ supplier_products (1:many)
```
