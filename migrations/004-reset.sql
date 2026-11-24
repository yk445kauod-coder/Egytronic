-- ONE-TIME RESET, NOT A MIGRATION. Ran once on 2026-11-24 to drop every test row.
-- Do not re-run after real inquiries or clients exist. Settings is untouched on purpose
-- so the admin token keeps working.
DELETE FROM messages;
DELETE FROM channels;
DELETE FROM time_entries;
DELETE FROM tasks;
DELETE FROM projects;
DELETE FROM activities;
DELETE FROM inquiries;
DELETE FROM clients;
DELETE FROM agents;
DELETE FROM events;
DELETE FROM oauth_tokens;
DELETE FROM oauth_codes;
DELETE FROM oauth_clients;
DELETE FROM members;

DELETE FROM sqlite_sequence;
