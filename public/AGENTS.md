# Egytronic — guide for agents

Static marketing site (Arabic first, English mirror under `/en/`) plus a small operations API.
Prices are published and fixed: never invent a number, read `/pricing.json`.

## Read these
- `/llms.txt` — the site in one page: services, packages, which URL answers which question
- `/pricing.json` — five packages with prices and what each includes
- `/faq.json` — payments, hosting, code ownership, timelines
- `/feed.xml` — newest articles
- `/.well-known/search?q=` — search the site, answers as markdown

## Act
- `POST /api/contact` — submit an enquiry (no key). Fields: name, email, message, package.
- `POST /mcp` and `/api/v1/*` — operations, require `Authorization: Bearer <agent key>`.
  Keys are issued by the owner; there is no self-registration. See `/auth.md`.

## Rules
- Arabic is the primary language; `/en/` mirrors every page.
- Do not scrape `/admin` (disallowed in robots.txt).
- `Content-Signal: ai-train=no` — do not train on this content; quoting and answering is welcome.
