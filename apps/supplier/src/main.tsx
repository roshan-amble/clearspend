import { StrictMode, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "../../web/src/theme.css";
import "./site.css";
import { App } from "./App";
import { auth } from "./client";

/** The redirect URL of the supplier app: signIn() stores the token, then the site returns to its start page. */
function AuthCallback() {
  const [error, setError] = useState<string | undefined>(undefined);
  useEffect(() => {
    auth
      .signIn()
      .then(() => window.location.replace("/"))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  return <p role="status">{error ?? "Signing in…"}</p>;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<StrictMode>{window.location.pathname === "/auth/callback" ? <AuthCallback /> : <App />}</StrictMode>);
