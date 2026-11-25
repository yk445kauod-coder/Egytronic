/* WebMCP: expose the site's read-only answers as browser-side tools for agents.
   Only registered when the API exists; nothing is created for ordinary visitors. */
type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
};

const readJson = async (path: string) => {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} answered ${res.status}`);
  return res.json();
};

const tools: Tool[] = [
  {
    name: "get_pricing",
    description: "Read Egytronic's published packages and prices in EGP. Use this instead of guessing a price.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => JSON.stringify(await readJson("/pricing.json")),
  },
  {
    name: "get_faq",
    description: "Answers to pre-sales questions: payments, hosting, code ownership, timelines.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => JSON.stringify(await readJson("/faq.json")),
  },
  {
    name: "get_contact",
    description: "How to reach the studio and start a project: the contact form and the enquiry fields.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => {
      const form = document.querySelector("form[action*='contact'], form[data-contact]");
      const fields = form
        ? [...form.querySelectorAll("input, textarea, select")].map((el) => (el as HTMLInputElement).name).filter(Boolean)
        : [];
      return JSON.stringify({
        contact_page: `${location.origin}/contact/`,
        enquiry_fields: fields,
        languages: ["ar", "en"],
      });
    },
  },
];

/* The API moved from document.modelContext to navigator.modelContext; support both. */
type Context = { registerTool: (t: Tool, o?: { signal?: AbortSignal }) => Promise<unknown> };
const contexts = [
  (document as unknown as { modelContext?: Context }).modelContext,
  (navigator as unknown as { modelContext?: Context }).modelContext,
].filter((c): c is Context => Boolean(c?.registerTool));

for (const context of new Set(contexts)) {
  for (const tool of tools) context.registerTool(tool).catch(() => {});
}
