import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import { useExpansion } from "./data/expansion";
import { applyTheme, storedTheme, type Theme } from "./theme";
import { Icon } from "./ui";

const STUDIO = import.meta.env.DEV;

/** Each page's name in the header. */
const PAGES: Record<string, { readonly title: string }> = {
  "": { title: "Overview" },
  prices: { title: "Price intelligence" },
  incidents: { title: "Incident review" },
  leads: { title: "Suppliers & leads" },
  studio: { title: "Data studio" },
  system: { title: "System map" },
};

function Item({ to, icon, color, label, badge, hot }: { readonly to: string; readonly icon: string; readonly color: string; readonly label: string; readonly badge?: number | undefined; readonly hot?: boolean }) {
  return (
    <NavLink end className={({ isActive }) => (isActive ? "item on" : "item")} to={to}>
      <span className="ico" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>
        <Icon name={icon} size={15} />
      </span>
      {label}
      {badge === undefined || badge === 0 ? null : <span className={hot ? "badge hot" : "badge"}>{badge}</span>}
    </NavLink>
  );
}

/** The frame of every screen: sidebar, header with the page name and labels, and the toggles. */
export function Frame(props: { readonly nav: ReactNode; readonly status: ReactNode; readonly crumb: ReactNode; readonly title: ReactNode; readonly pills?: ReactNode; readonly children: ReactNode }) {
  const [showFn, setShowFn] = useState(() => document.body.classList.contains("show-fn"));
  const [theme, setTheme] = useState<Theme>(storedTheme());
  return (
    <div className="shell">
      <nav className="side" aria-label="ClearSpend">
        <div className="logo">
          <span className="logo-mark">
            <span />
          </span>
          ClearSpend
        </div>
        {props.nav}
        <div className="ns">{props.status}</div>
      </nav>
      <div className="main">
        <header className="top">
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginRight: "auto" }}>
            <span className="crumb">{props.crumb}</span>
            <h1 className="title">{props.title}</h1>
          </div>
          {props.pills}
          <button
            className="btn sm"
            type="button"
            aria-pressed={showFn}
            onClick={() => {
              document.body.classList.toggle("show-fn");
              setShowFn(document.body.classList.contains("show-fn"));
            }}
          >
            ƒ {showFn ? "Hide" : "Show"} functions
          </button>
          <button
            className="btn sm"
            type="button"
            aria-label={`Switch to the ${theme === "dark" ? "gray" : "dark"} theme`}
            onClick={() => {
              const next = theme === "dark" ? "gray" : "dark";
              applyTheme(next);
              setTheme(next);
            }}
          >
            <Icon name="theme" size={14} /> Theme
          </button>
        </header>
        <main className="content">{props.children}</main>
      </div>
    </div>
  );
}

const PORTFOLIO_PAGES: Record<string, string> = { portfolio: "Portfolio", countries: "Program", investigations: "Investigations" };

/** The portfolio screens: every country, 1 country, and the investigations across countries. */
export function PortfolioShell() {
  const { pathname } = useLocation();
  const section = pathname.split("/")[1] ?? "portfolio";
  return (
    <Frame
      nav={
        <>
          <div className="navlab">Harbor Meals</div>
          <Item to="/portfolio" icon="map" color="#6366F1" label="Portfolio" />
          <div className="navlab">New program</div>
          <Item to="/countries/MDG" icon="flag" color="#F59E0B" label="Madagascar" />
        </>
      }
      status={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="dot live" />
          <span>Connected to Foundry</span>
        </div>
      }
      crumb="Harbor Meals · food assistance in 22 countries"
      title={PORTFOLIO_PAGES[section] ?? "Portfolio"}
      pills={<span className="pill">Synthetic programs · real WFP prices for Madagascar</span>}
    >
      <Outlet />
    </Frame>
  );
}

/** The screens of 1 country's program (an expansion): the deep evidence behind the country page. */
export function Shell() {
  const { expansionId = "" } = useParams();
  const { pathname } = useLocation();
  const { state } = useExpansion();
  const page = PAGES[pathname.split("/")[3] ?? ""] ?? PAGES[""];
  const data = state.kind === "ready" ? state.data : null;
  const base = `/expansions/${encodeURIComponent(expansionId)}`;
  const openIncidents = data?.incidents.filter((i) => i.status === "UNCONFIRMED" || i.status === "AI_PROPOSED").length;
  const leads = data === null ? undefined : [...data.profiles.keys()].length;
  const iso3 = /^EXP-([A-Z]{3})-/.exec(expansionId)?.[1];
  return (
    <Frame
      nav={
        <>
          <NavLink className="item" to={iso3 === undefined ? "/portfolio" : `/countries/${iso3}`}>
            <span className="ico" style={{ background: "var(--side-2)" }}>
              ←
            </span>
            {iso3 === undefined ? "Portfolio" : "Country"}
          </NavLink>
          <div className="navlab">{data === null ? "Program" : `${data.expansion.region} program`}</div>
          <Item to={base} icon="home" color="#6366F1" label="Overview" />
          <Item to={`${base}/prices`} icon="chart" color="#F59E0B" label="Price intelligence" />
          <Item to={`${base}/incidents`} icon="alert" color="#E11D48" label="Incident review" badge={openIncidents} hot />
          <Item to={`${base}/leads`} icon="users" color="#10B981" label="Suppliers & leads" badge={leads} />
          {STUDIO ? <Item to={`${base}/studio`} icon="db" color="#0EA5E9" label="Data studio" /> : null}
          <Item to={`${base}/system`} icon="gear" color="#8B5CF6" label="System map" />
        </>
      }
      status={
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={data === null ? "dot" : "dot live"} style={data === null ? { background: "var(--muted)" } : undefined} />
            <span>{data === null ? "Connecting to Foundry" : "Connected to Foundry"}</span>
          </div>
          <div className="mono" style={{ fontSize: 11 }}>
            {expansionId}
          </div>
        </>
      }
      crumb={data === null ? expansionId : data.expansion.name}
      title={page?.title}
      pills={
        <>
          {data === null ? null : (
            <span className="pill">
              <span className="dot live" />
              Evidence revision <b className="mono">{String(data.expansion.evidenceRevision)}</b>
            </span>
          )}
          <span className="pill">Synthetic data</span>
          <span className="pill">Market prices · {data?.snapshot.marketDataAsOf ?? "…"}</span>
        </>
      }
    >
      <Outlet />
    </Frame>
  );
}

/** Loading and error states shared by every screen. A failure is shown, never replaced by fixtures. */
export function Ready({ children }: { readonly children: (data: NonNullable<ReturnType<typeof useReady>>) => ReactNode }) {
  const { state, reload } = useExpansion();
  if (state.kind === "loading") return <p className="loading" role="status">Loading from Foundry…</p>;
  if (state.kind === "error")
    return (
      <div className="error-box" role="alert">
        <b>Could not load this expansion from Foundry.</b> {state.message}{" "}
        <button className="btn sm" type="button" onClick={reload}>
          Try again
        </button>
      </div>
    );
  return <>{children(state.data)}</>;
}

function useReady() {
  const { state } = useExpansion();
  return state.kind === "ready" ? state.data : null;
}
