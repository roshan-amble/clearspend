import type { ReactNode } from "react";

const PATHS: Record<string, ReactNode> = {
  home: <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  chart: <path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6" />,
  alert: <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />,
  users: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />,
  db: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  map: <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" />,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
  check: <path d="M20 6 9 17l-5-5" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  send: <><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>,
  flag: <path d="M4 22V4M4 4h13l-2 4 2 4H4" />,
  theme: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18A9 9 0 0 0 12 3z" fill="currentColor" /></>,
};

export function Icon({ name, size = 16 }: { readonly name: keyof typeof PATHS | string; readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/** A titled section of a page: the name of what it shows, an optional short subtitle, and optional controls. */
export function Section(props: { readonly title: ReactNode; readonly sub?: ReactNode; readonly actions?: ReactNode; readonly children: ReactNode; readonly id?: string }) {
  const id = props.id ?? `sec-${typeof props.title === "string" ? props.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "x"}`;
  return (
    <section className="sec" aria-labelledby={id}>
      <header className="sec-h">
        <h2 id={id}>{props.title}</h2>
        {props.sub === undefined ? null : <span className="sec-sub">{props.sub}</span>}
        {props.actions === undefined ? null : <div className="sec-actions">{props.actions}</div>}
      </header>
      {props.children}
    </section>
  );
}

/** A function tag: what object, Action, or function powers this part of the screen. Shown with "Show functions". */
export function Fn({ children, isNew = false }: { readonly children: ReactNode; readonly isNew?: boolean }) {
  return <span className={isNew ? "fn new" : "fn"}>ƒ {children}</span>;
}

export function FnRow({ items, newItems = [] }: { readonly items: readonly string[]; readonly newItems?: readonly string[] }) {
  return (
    <div className="fnrow">
      {items.map((item) => (
        <Fn key={item}>{item}</Fn>
      ))}
      {newItems.map((item) => (
        <Fn key={item} isNew>
          {item}
        </Fn>
      ))}
    </div>
  );
}

export function ShareBar({ percent, color, threshold = 100 }: { readonly percent: number; readonly color: string; readonly threshold?: number }) {
  return (
    <div className="bar" style={{ flex: 1 }}>
      <i style={{ width: `${Math.min(percent, 100)}%`, background: color }} />
      <span style={{ position: "absolute", left: `${threshold}%`, top: -5, width: 2, height: 18, background: "var(--bad)" }} title="Review threshold" />
    </div>
  );
}

export const FOOD_VAR: Record<string, string> = { RICE: "var(--rice)", BEANS: "var(--beans)", OIL: "var(--oil)" };
export const FOOD_CHIP: Record<string, string> = { RICE: "rice", BEANS: "beans", OIL: "oil" };
export const foodName = (commodity: string): string => commodity.charAt(0) + commodity.slice(1).toLowerCase();
