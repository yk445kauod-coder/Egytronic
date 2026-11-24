import { useCallback, useEffect, useState } from "react";

/** The mobile drawer: open state, Escape to close, close on link click. */
export function useNavToggle() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  return { open, setOpen, toggle: () => setOpen((v) => !v), close };
}
