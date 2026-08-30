# Archived one-off SQL

These are not migrations. They are copy-and-paste repair scripts written to fix a specific
database at a specific moment — each duplicates a numbered migration, and several are
actively destructive if replayed:

| File | Duplicates | Why it is not safe to run |
|---|---|---|
| `FIX_WAITLIST_TABLE.sql` | `017b_create_appointment_waitlist.sql` | opens with `DROP TABLE appointment_waitlist CASCADE` |
| `FIX_WAITLIST_TABLE_UUID.sql` | `017b_create_appointment_waitlist.sql` | same drop, different column types |
| `FIX_APPOINTMENT_TYPES_TABLE.sql` | `017a_create_appointment_types.sql` | rebuilds the table |
| `RUN_THESE_MIGRATIONS.sql` | `017_create_scheduling_system.sql` | a bundle of already-numbered migrations |
| `RUN_032_INSURANCE_PAYER.sql` | `032_add_insurance_payer_to_patients.sql` | verbatim copy |
| `run-audit-migration.sql` | `040_create_audit_logs_table.sql` | contains psql `\echo` meta-commands, so it is not valid SQL to a driver at all |

They sat in `migrations/`, where the runner picked them up by extension and executed them
**after** the numbered files — so a from-scratch run ended by dropping the waitlist table it
had just built. They are kept here for reference only; `run-migrations.js` reads the top
level of `migrations/` and does not recurse.
