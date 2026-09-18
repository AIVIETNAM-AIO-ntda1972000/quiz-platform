import { useEffect, useMemo, useState } from "react";
import { supabase, usernameToAuthEmail } from "./cloudSync";

export type AuthorizationDetails = {
  authorizationId: string;
  clientName: string;
  clientUri: string;
  redirectUri: string;
  scopes: string[];
};

export type OAuthConsentService = {
  configured: boolean;
  hasSession: () => Promise<boolean>;
  signIn: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  getDetails: (authorizationId: string) => Promise<{ details?: AuthorizationDetails; redirectUrl?: string; error?: string }>;
  decide: (authorizationId: string, decision: "approve" | "deny") => Promise<{ redirectUrl?: string; error?: string }>;
};

export function createOAuthConsentService(): OAuthConsentService {
  return {
    configured: Boolean(supabase),
    hasSession: async () => {
      if (!supabase) return false;
      return Boolean((await supabase.auth.getSession()).data.session);
    },
    signIn: async (username, password) => {
      if (!supabase) return { ok: false, error: "Supabase is not configured." };
      try {
        const { error } = await supabase.auth.signInWithPassword({ email: usernameToAuthEmail(username), password });
        return error ? { ok: false, error: error.message } : { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Sign-in failed." };
      }
    },
    getDetails: async (authorizationId) => {
      if (!supabase) return { error: "Supabase is not configured." };
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (error || !data) return { error: error?.message ?? "The authorization request is invalid." };
      if (!("authorization_id" in data)) return { redirectUrl: data.redirect_url };
      return {
        details: {
          authorizationId: data.authorization_id,
          clientName: data.client.name,
          clientUri: data.client.uri,
          redirectUri: data.redirect_uri,
          scopes: data.scope.split(" ").filter(Boolean),
        },
      };
    },
    decide: async (authorizationId, decision) => {
      if (!supabase) return { error: "Supabase is not configured." };
      const method = decision === "approve" ? supabase.auth.oauth.approveAuthorization : supabase.auth.oauth.denyAuthorization;
      const { data, error } = await method.call(supabase.auth.oauth, authorizationId, { skipBrowserRedirect: true });
      return error || !data ? { error: error?.message ?? "The authorization decision failed." } : { redirectUrl: data.redirect_url };
    },
  };
}

type OAuthConsentProps = {
  authorizationId: string | null;
  service?: OAuthConsentService;
  navigate?: (url: string) => void;
};

export function OAuthConsent({ authorizationId, service, navigate = (url) => window.location.assign(url) }: OAuthConsentProps) {
  const activeService = useMemo(() => service ?? createOAuthConsentService(), [service]);
  const [details, setDetails] = useState<AuthorizationDetails>();
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  const loadDetails = async () => {
    if (!authorizationId) {
      setMessage("Missing authorization_id. Start the connection again from your AI client.");
      setBusy(false);
      return;
    }
    const result = await activeService.getDetails(authorizationId);
    if (result.redirectUrl) {
      navigate(result.redirectUrl);
      return;
    }
    if (result.error) setMessage(result.error);
    else setDetails(result.details);
    setBusy(false);
  };

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      if (!activeService.configured) {
        if (active) {
          setMessage("Supabase is not configured for this deployment.");
          setBusy(false);
        }
        return;
      }
      const signedIn = await activeService.hasSession();
      if (!active) return;
      if (!signedIn) {
        setNeedsSignIn(true);
        setBusy(false);
        return;
      }
      await loadDetails();
    };
    void initialize();
    return () => { active = false; };
  }, [authorizationId, activeService]);

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const result = await activeService.signIn(username, password);
    if (!result.ok) {
      setMessage(result.error ?? "Sign-in failed.");
      setBusy(false);
      return;
    }
    setNeedsSignIn(false);
    await loadDetails();
  };

  const decide = async (decision: "approve" | "deny") => {
    if (!authorizationId) return;
    setBusy(true);
    setMessage("");
    const result = await activeService.decide(authorizationId, decision);
    if (result.redirectUrl) navigate(result.redirectUrl);
    else {
      setMessage(result.error ?? "The authorization decision failed.");
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar"><span className="brand"><span className="brand-mark">Q</span><span>Quiz Platform</span></span></header>
      <main className="narrow-page oauth-page">
        <p className="eyebrow">CONNECT AI CLIENT</p>
        <h1>Authorize quiz access</h1>
        {busy && <div className="sync-status" role="status">Loading authorization…</div>}
        {message && <div className="error-box" role="alert">{message}</div>}
        {!busy && needsSignIn && (
          <form className="account-panel" onSubmit={(event) => void handleSignIn(event)}>
            <h2>Sign in to continue</h2>
            <p>Use the same Quiz Platform username and password as the web or Android app.</p>
            <label>Username<input required minLength={3} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
            <label>Password<input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
            <button className="primary-button" type="submit">Sign in</button>
          </form>
        )}
        {!busy && details && (
          <section className="account-panel consent-panel">
            <h2>{details.clientName} wants to connect</h2>
            <p>This client will be able to list quiz summaries and submit new quizzes to your private review inbox. It cannot accept drafts or overwrite your library.</p>
            <dl>
              <dt>Client website</dt><dd>{details.clientUri || "Not provided"}</dd>
              <dt>Redirect destination</dt><dd>{details.redirectUri}</dd>
              <dt>Requested scopes</dt><dd>{details.scopes.join(", ") || "Basic account access"}</dd>
            </dl>
            <div className="account-actions">
              <button className="primary-button" type="button" onClick={() => void decide("approve")}>Approve connection</button>
              <button className="secondary-button" type="button" onClick={() => void decide("deny")}>Deny</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
