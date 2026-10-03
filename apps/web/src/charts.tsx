import * as echarts from "echarts";
import { useEffect, useRef, type DependencyList } from "react";
import { useThemeTick } from "./theme";

/** Chart colors are the theme tokens, read when the chart draws. */
export function chartColors() {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string) => style.getPropertyValue(name).trim();
  return {
    rice: v("--rice"), riceInk: v("--rice-ink"), beans: v("--beans"), oil: v("--oil"), market: v("--market"), market2: v("--market-2"),
    marketFill: v("--market-fill"), quote: v("--quote"), target: v("--target"), brand: v("--brand"), brandSoft: v("--brand-soft"),
    brandFill: v("--brand-fill"), ink: v("--ink"), muted: v("--muted"), line: v("--line"), grid: v("--grid"), bad: v("--bad"),
    warn: v("--warn"), ok: v("--ok"), ai: v("--ai"), info: v("--info"), surface: v("--surface"),
  };
}
export type Colors = ReturnType<typeof chartColors>;

export const FOOD_COLOR: Record<string, keyof Colors> = { RICE: "rice", BEANS: "beans", OIL: "oil" };

export function axis(c: Colors) {
  return {
    axisLine: { lineStyle: { color: c.line } },
    axisTick: { show: false },
    axisLabel: { color: c.muted, fontFamily: "Geist", fontSize: 11 },
    splitLine: { lineStyle: { color: c.grid } },
  };
}

/** An ECharts chart in SVG. It redraws when its deps or the theme change, and resizes with its box. */
export function Chart(props: {
  readonly build: (c: Colors) => echarts.EChartsCoreOption;
  readonly deps: DependencyList;
  readonly height: number;
  readonly label: string;
  readonly onReady?: (chart: echarts.ECharts) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tick = useThemeTick();
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const chart = echarts.init(element, null, { renderer: "svg" });
    const c = chartColors();
    const option = props.build(c) as Record<string, unknown>;
    const tooltip = option.tooltip as Record<string, unknown> | undefined;
    if (tooltip !== undefined) Object.assign(tooltip, { backgroundColor: c.surface, borderColor: c.line, textStyle: { color: c.ink, fontFamily: "Geist", fontSize: 12 } });
    chart.setOption({ textStyle: { fontFamily: "Geist" }, animation: false, ...option });
    props.onReady?.(chart);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...props.deps]);
  return <div ref={ref} role="img" aria-label={props.label} style={{ height: props.height, width: "100%" }} />;
}
