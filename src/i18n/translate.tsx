import { cloneElement, isValidElement, type ReactNode } from "react";
import dict from "./copy.json";

/* English is produced by swapping the Arabic phrase map that scripts/build-en.py used
   to hold. Components stay written in Arabic, so there is one source of truth. */
const map = dict as Record<string, string>;

const ATTRS = new Set([
  "aria-label",
  "title",
  "alt",
  "placeholder",
  "data-label-open",
  "data-label-close",
]);

export function translate(node: ReactNode): ReactNode {
  if (typeof node === "string") {
    const key = node.trim();
    const hit = map[key];
    if (!hit) return node;
    return node.replace(key, hit);
  }
  if (typeof node === "number" || node == null || typeof node === "boolean") return node;
  if (Array.isArray(node)) return node.map((child, i) => <Frag key={i}>{translate(child)}</Frag>);
  if (isValidElement(node)) {
    const props = { ...(node.props as Record<string, unknown>) };
    for (const name of Object.keys(props)) {
      const value = props[name];
      if (typeof value === "string" && ATTRS.has(name) && map[value.trim()]) {
        props[name] = map[value.trim()];
      }
    }
    if (props.dangerouslySetInnerHTML) return node;
    const children = (node.props as { children?: ReactNode }).children;
    return cloneElement(node, props, children === undefined ? undefined : translate(children));
  }
  return node;
}

function Frag({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function hasPhrase(text: string) {
  return Boolean(map[text.trim()]);
}
