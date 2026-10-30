import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** False during the server render and hydration, true after. For values only the browser knows, like the stored theme. */
export function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
