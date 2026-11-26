import { useSyncExternalStore } from "react";

/**
 * One drawer for the whole site. The header button, the tab bar's "more" item and the panel
 * itself all read this store, so the open state cannot drift between them.
 */
let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function set(next: boolean) {
  if (open === next) return;
  open = next;
  document.documentElement.classList.toggle("is-drawer-open", next);
  emit();
}

export const sidebar = {
  open: () => set(true),
  close: () => set(false),
  toggle: () => set(!open),
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  get: () => open,
};

export function useSidebarOpen() {
  return useSyncExternalStore(sidebar.subscribe, sidebar.get, () => false);
}
