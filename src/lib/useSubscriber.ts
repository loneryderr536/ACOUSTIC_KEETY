"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "hoa_subscriber_key";
const NAME_KEY = "hoa_subscriber_name";
const AUTH_CHANGE_EVENT = "hoa_auth_change";

// Shared listeners — ensures all hook instances re-render on auth change
let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => { listeners = listeners.filter((l) => l !== listener); };
}

function notifyAll() {
  for (const l of listeners) l();
}

function getApiKey() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

function getName() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(NAME_KEY);
}

interface SubscriberState {
  apiKey: string | null;
  name: string | null;
  isSignedIn: boolean;
  signIn: (key: string, name: string) => void;
  signOut: () => void;
}

export function useSubscriber(): SubscriberState {
  const apiKey = useSyncExternalStore(subscribe, getApiKey, () => null);
  const name = useSyncExternalStore(subscribe, getName, () => null);

  // Also listen for cross-tab storage events
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY || e.key === NAME_KEY) notifyAll();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const signIn = useCallback((key: string, subscriberName: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    localStorage.setItem(NAME_KEY, subscriberName);
    notifyAll();
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NAME_KEY);
    notifyAll();
  }, []);

  return { apiKey, name, isSignedIn: !!apiKey, signIn, signOut };
}
