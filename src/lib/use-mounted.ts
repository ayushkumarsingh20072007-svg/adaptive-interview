import * as React from "react";

const emptySubscribe = () => () => {};

/**
 * Hook to safely detect client-side mounting using React's useSyncExternalStore.
 * Guarantees false on server (SSR) and true on client after hydration, with zero cascading setState.
 */
export function useIsMounted(): boolean {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
