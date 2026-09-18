import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./cloudSync";

export type OAuthGrantSummary = {
  clientId: string;
  clientName: string;
  clientUri: string;
  scopes: string[];
  grantedAt: string;
};

export function useOAuthGrants(user?: User) {
  const [grants, setGrants] = useState<OAuthGrantSummary[]>([]);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase || !user) {
      setGrants([]);
      return;
    }
    const { data, error } = await supabase.auth.oauth.listGrants();
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("");
    setGrants((data ?? []).map((grant) => ({
      clientId: grant.client.id,
      clientName: grant.client.name,
      clientUri: grant.client.uri,
      scopes: grant.scopes,
      grantedAt: grant.granted_at,
    })));
  }, [user]);

  const revoke = useCallback(async (clientId: string) => {
    if (!supabase || !user) return false;
    const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
    if (error) {
      setMessage(error.message);
      return false;
    }
    setGrants((current) => current.filter((grant) => grant.clientId !== clientId));
    return true;
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { grants, message, refresh, revoke };
}
