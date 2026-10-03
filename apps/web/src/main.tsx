import { lazy, StrictMode, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useParams } from "react-router-dom";
import { AuthCallback } from "./AuthCallback";
import { ExpansionProvider } from "./data/expansion";
import { AnalysisPage, CountryLayout, IncidentsPage, IngredientsPage, InvestigationsPage } from "./pages/Country";
import { FoodRedirect, SuppliersPage } from "./pages/Food";
import { Incidents } from "./pages/Incidents";
import { Leads } from "./pages/Leads";
import { Overview } from "./pages/Overview";
import { Portfolio } from "./pages/Portfolio";
import { Prices } from "./pages/Prices";
import { SystemMap } from "./pages/SystemMap";
import { PortfolioShell, Shell } from "./Shell";
import { applyTheme, storedTheme } from "./theme";
import "./theme.css";

/** "/" opens the portfolio (Roshan, 2026-10-01): countries first, then 1 country, then its program detail. */
const home = "/portfolio";

// UI3 A: the data studio exists only in the development build. A production build has no route and no fixtures.
const Studio = import.meta.env.DEV ? lazy(() => import("./pages/Studio").then((m) => ({ default: m.Studio }))) : null;

/** 1 expansion's data, loaded once for all its screens and reloaded after each write. */
function Expansion() {
  const { expansionId = "" } = useParams();
  return (
    <ExpansionProvider key={expansionId} expansionId={expansionId}>
      <Outlet />
    </ExpansionProvider>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <Navigate to={home} replace /> },
  {
    element: <PortfolioShell />,
    children: [
      { path: "/portfolio", element: <Portfolio /> },
      {
        // P17: every country has 5 pages and nothing else.
        path: "/countries/:iso3",
        element: <CountryLayout />,
        children: [
          { index: true, element: <Navigate to="ingredients" replace /> },
          { path: "ingredients", element: <IngredientsPage /> },
          { path: "suppliers", element: <SuppliersPage /> },
          { path: "incidents", element: <IncidentsPage /> },
          { path: "analysis", element: <AnalysisPage /> },
          { path: "investigations", element: <InvestigationsPage /> },
          { path: "foods/:commodity", element: <FoodRedirect /> },
        ],
      },
      { path: "/investigations", element: <Navigate to={home} replace /> },
    ],
  },
  {
    path: "/expansions/:expansionId",
    element: <Expansion />,
    children: [
      {
        element: <Shell />,
        children: [
          { index: true, element: <Overview /> },
          { path: "prices", element: <Prices /> },
          { path: "incidents", element: <Incidents /> },
          { path: "leads", element: <Leads /> },
          ...(Studio === null
            ? []
            : [
                {
                  path: "studio",
                  element: (
                    <Suspense fallback={<p className="loading">Loading the data studio…</p>}>
                      <Studio />
                    </Suspense>
                  ),
                },
              ]),
          { path: "system", element: <SystemMap /> },
        ],
      },
    ],
  },
  // The route history screen became the price intelligence screen (UI1).
  { path: "/routes/:routeId", element: <Navigate to={home} replace /> },
  { path: "/auth/callback", element: <AuthCallback /> },
  { path: "*", element: <Navigate to={home} replace /> },
]);

applyTheme(storedTheme());
const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root element.");
ReactDOM.createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
