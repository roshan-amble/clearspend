import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "./client";

/** The redirect URL of the ClearSpend app. signIn() stores the token, then the app returns to the start page. */
export function AuthCallback() {
  const [error, setError] = useState<string | undefined>(undefined);
  const navigate = useNavigate();
  useEffect(() => {
    auth
      .signIn()
      .then(() => navigate("/", { replace: true }))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [navigate]);
  return <p role="status">{error ?? "Signing in…"}</p>;
}
