import { useSyncExternalStore } from "react";

const EMPTY: never[] = [];

declare global {
  interface Window {
    presence?: { onlineUsers: string[] };
  }
}

export function useOnlineUsers(): string[] {
  return useSyncExternalStore(
    (cb) => { window.addEventListener('presence', cb); return () => window.removeEventListener('presence', cb); },
    () => window.presence?.onlineUsers ?? EMPTY,
  );
}
