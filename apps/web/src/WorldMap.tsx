import * as echarts from "echarts";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import { useNavigate } from "react-router-dom";
import { Chart, type Colors } from "./charts";

/** ISO 3166 numeric (world-atlas IDs) for each program country. */
const NUMERIC: Readonly<Record<string, string>> = {
  MDG: "450", KEN: "404", ETH: "231", SOM: "706", SSD: "728", UGA: "800", RWA: "646", NER: "562", MLI: "466", TCD: "148", BFA: "854",
  NGA: "566", MOZ: "508", MWI: "454", ZMB: "894", ZWE: "716", COD: "180", HTI: "332", GTM: "320", BGD: "050", NPL: "524", LAO: "418",
};
const ISO3 = Object.fromEntries(Object.entries(NUMERIC).map(([iso3, numeric]) => [numeric, iso3]));

// Natural Earth 1:110m countries (world-atlas), registered once. Program countries are named by ISO3 so the series
// data can match them; Antarctica is left out to give the programs the space.
const topology = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const geo = feature(topology, topology.objects.countries);
echarts.registerMap("cs-world", {
  type: "FeatureCollection",
  features: geo.features
    .filter((f) => f.id !== "010")
    .map((f) => ({ ...f, properties: { name: ISO3[String(f.id)] ?? f.properties?.name ?? "" } })),
} as never);

export interface MapDatum {
  readonly iso3: string;
  readonly name: string;
  /** The number that colors the country; null when unknown. */
  readonly value: number | null;
  /** Formatted value for the tooltip. */
  readonly text: string;
  readonly detail: string;
  readonly isNew: boolean;
}

/** A heatmap of the program countries. Click a country to open it. Colors are relative to the other programs. */
export function WorldMap({ data, metricLabel, low, high, invert = false }: { readonly data: readonly MapDatum[]; readonly metricLabel: string; readonly low: string; readonly high: string; readonly invert?: boolean }) {
  const navigate = useNavigate();
  const values = data.map((d) => d.value).filter((v): v is number => v !== null);
  const min = values.length === 0 ? 0 : Math.min(...values);
  const max = values.length === 0 ? 1 : Math.max(...values);
  return (
    <Chart
      height={500}
      label={`Map of the program countries, colored by ${metricLabel}`}
      deps={[JSON.stringify(data), metricLabel, invert]}
      onReady={(chart) => {
        chart.on("click", (event) => {
          const iso3 = (event.data as { iso3?: string } | undefined)?.iso3;
          if (iso3 !== undefined) navigate(`/countries/${iso3}`);
        });
      }}
      build={(c: Colors) => ({
        tooltip: {
          trigger: "item",
          formatter: (p: { data?: { label: string; isNew: boolean; text: string; detail: string } }) =>
            p.data === undefined ? "" : `<b>${p.data.label}</b>${p.data.isNew ? " · new program" : ""}<br/>${metricLabel}: <b>${p.data.text}</b><br/><span style="opacity:.75">${p.data.detail}</span><br/><span style="opacity:.6">Click to open</span>`,
        },
        visualMap: {
          type: "continuous",
          min,
          max: max === min ? min + 1 : max,
          left: 16,
          bottom: 12,
          orient: "horizontal",
          itemWidth: 12,
          itemHeight: 160,
          text: [high, low],
          textStyle: { color: c.muted, fontSize: 11 },
          calculable: false,
          inRange: { color: invert ? [c.bad, c.warn, c.ok] : [c.ok, c.warn, c.bad] },
          seriesIndex: 0,
        },
        series: [
          {
            type: "map",
            map: "cs-world",
            roam: true,
            scaleLimit: { min: 1, max: 6 },
            // Frame the programs: Guatemala in the west to Laos in the east (zoom 1 shows the whole world).
            center: [8, 3],
            zoom: 2.3,
            selectedMode: false,
            itemStyle: { areaColor: c.surface, borderColor: c.line, borderWidth: 0.6 },
            emphasis: { label: { show: false }, itemStyle: { areaColor: c.brand, borderColor: c.ink, borderWidth: 1 } },
            // `name` must be the ISO3 code: it is how ECharts matches a datum to a country shape.
            data: data.map((d) => ({
              iso3: d.iso3,
              label: d.name,
              text: d.text,
              detail: d.detail,
              isNew: d.isNew,
              name: d.iso3,
              value: d.value ?? undefined,
              itemStyle: d.isNew ? { borderColor: c.ink, borderWidth: 2 } : undefined,
            })),
          },
        ],
      })}
    />
  );
}
