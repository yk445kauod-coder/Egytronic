# Agent authentication

Egytronic's public pages need no credentials. The operations API does.

## Public, no auth
- `GET /pricing.json`, `GET /faq.json`, `GET /llms.txt`, `GET /feed.xml`
- `GET /.well-known/*` (catalogues, cards, skills)

## Operations API (agent keys)
- `POST /api/contact` — submit an enquiry (no key).
- `POST /mcp` and `/api/v1/*` — require `Authorization: Bearer <agent key>`.
- Keys are issued by the owner in the console (`/admin`). There is no self-service registration:
  write to the contact page and ask for a key with the scope you need (read, write, admin).

## Discovery
- `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` describe the
  OAuth surface the console uses.
- `/.well-known/mcp/server-card.json` describes the MCP endpoint.
