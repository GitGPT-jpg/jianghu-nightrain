"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

import { createDefaultState } from "@/lib/default-state";
import {
  buildProfileSummary,
  completeTask,
  getCurrentTrack,
  getPhaseById,
  normalizeState,
} from "@/lib/engine";
import { createBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { AppState, SyncStatus, TaskSettlement } from "@/lib/types";

const STORAGE_KEY = "system-upgrade-pwa-state-v1";
const isGhPagesDemo = process.env.NEXT_PUBLIC_GH_PAGES === "1";

function readLocalState() {
  if (typeof window === "undefined") {
    return createDefaultState();
  }

  try {
    const storage = isGhPagesDemo ? window.sessionStorage : window.localStorage;
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw) as Partial<AppState>) : createDefaultState();
  } catch {
    return createDefaultState();
  }
}

function saveLocalState(state: AppState) {
  if (typeof window === "undefined") {
    return;
  }

  const storage = isGhPagesDemo ? window.sessionStorage : window.localStorage;
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function loadCloudState(client: NonNullable<ReturnType<typeof createBrowserSupabase>>, userId: string) {
  const snapshotClient = client.from("user_snapshots") as unknown as {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: { state: AppState } | null; error: Error | null }>;
      };
    };
  };
  const result = await snapshotClient.select("state").eq("user_id", userId).maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data?.state ? normalizeState(result.data.state) : null;
}

async function saveCloudState(client: NonNullable<ReturnType<typeof createBrowserSupabase>>, userId: string, state: AppState) {
  const snapshotClient = client.from("user_snapshots") as unknown as {
    upsert: (
      values: { user_id: string; state: AppState },
      options: { onConflict: string },
    ) => Promise<{ error: Error | null }>;
  };

  const snapshotResult = await snapshotClient.upsert({ user_id: userId, state }, { onConflict: "user_id" });

  if (snapshotResult.error) {
    throw snapshotResult.error;
  }

  const profileClient = client.from("user_profiles") as unknown as {
    upsert: (
      values: ReturnType<typeof buildProfileSummary>,
      options: { onConflict: string },
    ) => Promise<{ error: Error | null }>;
  };

  const profileResult = await profileClient.upsert(buildProfileSummary(state, userId), { onConflict: "user_id" });

  if (profileResult.error) {
    throw profileResult.error;
  }
}

export function useSharedAppState() {
  const [state, setState] = useState<AppState>(() => createDefaultState());
  const [supabase, setSupabase] = useState<ReturnType<typeof createBrowserSupabase>>(null);
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isSupabaseConfigured ? "connecting" : "demo");
  const [latestSettlement, setLatestSettlement] = useState<TaskSettlement | null>(null);
  const hydratedRef = useRef(false);
  const skipCloudSaveRef = useRef(true);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    setSupabase(createBrowserSupabase());
    const local = readLocalState();
    skipCloudSaveRef.current = true;
    setState(local);
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    if (!supabase) {
      setSyncStatus(isSupabaseConfigured ? "signed-out" : "demo");
      return;
    }

    let cancelled = false;

    const connect = async () => {
      setSyncStatus("connecting");
      const { data, error } = await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      if (error) {
        setSyncStatus("error");
        return;
      }

      const currentUser = data.user ?? null;
      setUser(currentUser);

      if (!currentUser) {
        setSyncStatus("signed-out");
        return;
      }

      try {
        const remoteState = await loadCloudState(supabase, currentUser.id);

        if (cancelled) {
          return;
        }

        if (remoteState) {
          skipCloudSaveRef.current = true;
          setState(remoteState);
          saveLocalState(remoteState);
        } else {
          await saveCloudState(supabase, currentUser.id, stateRef.current);
        }

        setSyncStatus("ready");
      } catch {
        setSyncStatus("error");
      }
    };

    void connect();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setSyncStatus(currentUser ? "ready" : "signed-out");
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    saveLocalState(state);

    if (skipCloudSaveRef.current) {
      skipCloudSaveRef.current = false;
      return;
    }

    if (!supabase || !user) {
      return;
    }

    setSyncStatus("saving");

    const timer = window.setTimeout(async () => {
      try {
        await saveCloudState(supabase, user.id, state);
        setSyncStatus("ready");
      } catch {
        setSyncStatus("error");
      }
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [state, supabase, user]);

  const commitState = (updater: (current: AppState) => AppState) => {
    setState((current) => normalizeState(updater(current)));
  };

  const completeTaskById = (taskId: string) => {
    let settlement: TaskSettlement | null = null;

    commitState((current) => {
      const result = completeTask(current, taskId);
      settlement = result.settlement;
      return result.state;
    });

    setLatestSettlement(settlement);
    return settlement;
  };

  const currentTrack = getCurrentTrack(state);
  const currentPhase = currentTrack ? getPhaseById(state.phases, currentTrack.currentPhaseId) : null;

  return {
    state,
    user,
    syncStatus,
    latestSettlement,
    setLatestSettlement,
    commitState,
    completeTaskById,
    currentTrack,
    currentPhase,
  };
}
