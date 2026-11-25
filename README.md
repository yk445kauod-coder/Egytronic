# Egytronic

The public site and the operations backend of Egytronic, a software studio in Egypt.
Arabic first (RTL), English mirror under `/en/`, prices published instead of quoted.

Live: **https://egytronic.pages.dev** · Owner: [Yousef Khamis](https://github.com/yk445kauod-coder)

## What runs here

| Layer | What it does |
|---|---|
| Static site | 30 pages, pre-rendered at build time (`vite-react-ssg`), no client-side router work for content |
| `_worker.js` | Cloudflare Worker: contact API, admin console, MCP endpoint, OAuth discovery, automations |
| D1 | SQLite: inquiries, clients, projects, tasks, channels, messages, events, time entries, agents, settings |

## Stack

React 19 · Vite 6 · `vite-react-ssg` · Tailwind 4 · Cloudflare Pages + Workers + D1 · TypeScript in the app, plain JS in the worker.

## Interesting parts

- **Static-first**: every marketing page is HTML on the first byte. No hydration cost for readers, no SEO risk from client rendering. The SEO gate (`scripts/seo-check.mjs`) fails the build if a page loses its title, description, canonical, hreflang, OG image or JSON-LD — it caught a real bug where every tag was being emitted into `<body>`.
- **Agent surface**: `/.well-known/api-catalog` (RFC 9727), an MCP server card, an ARD manifest, agent skill documents, `Accept: text/markdown` content negotiation, and `/.well-known/search`. All of it points at documents that exist.
- **MCP over HTTP**: JSON-RPC 2.0 at `/mcp`, stateless streamable-HTTP subset. Tools cover inquiries, tasks, channels, events. Agents authenticate with scoped keys (`read` / `write` / `admin`); the admin token is stored as a SHA-256 hash in `settings`.
- **No outbound calls** from the worker: every handler is a handful of D1 statements, so it stays inside the Workers free tier and has no third-party failure mode.
- **Pricing is data**: `src/data/catalog.json` drives copy, schema and the sitemap. Counts and prices are never hardcoded in prose.

## Run it

```bash
npm install
npm run dev            # site on :12000
npm run build          # astro-free SSG build + sitemap + robots + SEO gate
npm run index-status   # is the site indexed? checks every sitemap URL + Googlebot view
```

The worker needs a D1 binding (`DB`) and the schema in `schema.sql`:

```bash
npx wrangler d1 create egytronic
npx wrangler d1 execute egytronic --file=schema.sql
```

## What it is not

- No payments: packages are agreed on the contact form, then invoiced.
- No client portal yet — the console is the owner's.
- One maintainer. Everything here is written and operated by the founder.

## License

Source is public for review. The brand, copy and client data are not licensed for reuse.
