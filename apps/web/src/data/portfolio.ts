import type { CountryView } from "@clearspend/domain";
import type { Osdk } from "@osdk/client";
import { useCallback, useEffect, useState } from "react";
import { client } from "../client";
import { describe } from "../command";
import { CsAiRun, csCountry, csPortfolio, csPriceHistory, csScheduleOptions, CsInvestigation, CsInvestigator, CsInvestigatorBusy } from "../sdk";

/**
 * Portfolio data (Roshan, 2026-10-01). Every number comes from the query functions csPortfolio, csCountry, and
 * csScheduleOptions, which compute it on the server from stored objects. The browser only formats it (D2).
 */

export type CountrySummary = Pick<CountryView, "country" | "evidenceRevision" | "summary"> & { readonly foods: readonly string[] };
export interface PortfolioJson {
  readonly countries: readonly CountrySummary[];
}

export interface TripOptionJson {
  readonly investigatorId: string;
  readonly name: string;
  readonly mode: "LOCAL" | "FLY_IN";
  readonly travelDays: number;
  readonly departure: string;
  readonly onGroundStart: string;
  readonly onGroundEnd: string;
  readonly returnDate: string;
  readonly scheduleVersion: number;
  readonly baseCity: string;
  readonly homeCountryIso3: string;
}
export interface ScheduleJson {
  readonly today: string;
  readonly investigationId: string;
  readonly durationDays: number;
  readonly options: readonly TripOptionJson[];
}

async function all<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

export const loadPortfolio = async (): Promise<PortfolioJson> => JSON.parse(await client(csPortfolio).executeFunction()) as PortfolioJson;
export const loadCountry = async (iso3: string): Promise<CountryView> => JSON.parse(await client(csCountry).executeFunction({ countryIso3: iso3 })) as CountryView;
/** The latest run of 1 AI job on 1 subject, or null. Older runs stay stored and are never replaced (D8). */
export async function loadLatestRun(expansionId: string, job: string, subjectId: string): Promise<Osdk.Instance<CsAiRun> | null> {
  const runs = await all(client(CsAiRun).where({ expansionId: { $eq: expansionId }, job: { $eq: job }, subjectId: { $eq: subjectId } }).asyncIter());
  return runs.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""))[0] ?? null;
}
/** P17: the simple chart of each ingredient: what we paid against the lowest market price, month by month. */
export interface ChartJson {
  readonly commodity: string;
  readonly chart?: readonly { readonly month: string; readonly ours: string | null; readonly lowest: string | null }[];
}
export const loadPriceChart = async (expansionId: string): Promise<readonly ChartJson[]> =>
  (JSON.parse(await client(csPriceHistory).executeFunction({ expansionId })) as { readonly commodities: readonly ChartJson[] }).commodities;
export const loadSchedule = async (investigationId: string): Promise<ScheduleJson> => JSON.parse(await client(csScheduleOptions).executeFunction({ investigationId })) as ScheduleJson;

export interface InvestigationsData {
  readonly investigations: readonly Osdk.Instance<CsInvestigation>[];
  readonly investigators: readonly Osdk.Instance<CsInvestigator>[];
  readonly busy: readonly Osdk.Instance<CsInvestigatorBusy>[];
  readonly portfolio: PortfolioJson;
}
export async function loadInvestigations(): Promise<InvestigationsData> {
  const [investigations, investigators, busy, portfolio] = await Promise.all([
    all(client(CsInvestigation).asyncIter()),
    all(client(CsInvestigator).asyncIter()),
    all(client(CsInvestigatorBusy).asyncIter()),
    loadPortfolio(),
  ]);
  return { investigations: investigations.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")), investigators, busy, portfolio };
}

export type Loaded<T> = { readonly kind: "loading" } | { readonly kind: "error"; readonly message: string } | { readonly kind: "ready"; readonly data: T };

/** Loads once, again when `key` changes, and again on reload() after a write. A failure is shown, never hidden. */
export function useLoad<T>(load: () => Promise<T>, key: string): { readonly state: Loaded<T>; readonly reload: () => void } {
  const [state, setState] = useState<Loaded<T>>({ kind: "loading" });
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let live = true;
    load()
      .then((data) => live && setState({ kind: "ready", data }))
      .catch((error: unknown) => live && setState({ kind: "error", message: describe(error) }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, generation]);
  const reload = useCallback(() => setGeneration((g) => g + 1), []);
  return { state, reload };
}
