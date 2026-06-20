---
name: Supabase column fallback pattern
description: New DB columns may not exist in live Supabase yet; graceful try-with-fallback prevents runtime crashes.
---

Several columns were added to the schema gradually and may not exist in older deployments:
- `students.student_status` — filter by it in `getAll`, but if the error message contains "student_status", retry without the filter
- `school_settings.current_term` — localStorage fallback if upsert errors
- `school_settings.class_list` — localStorage fallback if upsert errors

**Why:** The Supabase DB schema is applied manually; code ships before migrations run. Silent fallback keeps the UI functional.

**How to apply:** Any new column referenced in a query should: (a) catch errors that mention the column name, (b) retry the query without that constraint, and (c) warn to console rather than throwing.
