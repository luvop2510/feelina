import { useEffect, useRef } from "react";
export function useUnsavedChanges() {
  const dirty = useRef(false);
  useEffect(() => {
    const route = (e: Event) => {
      if (
        dirty.current &&
        !window.confirm("Leave this order? Unsaved changes will be lost.")
      )
        e.preventDefault();
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("feelina:before-navigate", route);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("feelina:before-navigate", route);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  return {
    markDirty: () => {
      dirty.current = true;
    },
    markSaved: () => {
      dirty.current = false;
    },
  };
}
export function allowNavigation() {
  return window.dispatchEvent(
    new Event("feelina:before-navigate", { cancelable: true }),
  );
}
