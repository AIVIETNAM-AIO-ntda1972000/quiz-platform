import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OAuthConsent } from "./OAuthConsent";
import "./styles.css";

const authorizationId = new URLSearchParams(window.location.search).get("authorization_id");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OAuthConsent authorizationId={authorizationId} />
  </StrictMode>,
);
