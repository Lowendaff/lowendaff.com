import { init, use, type EChartsType } from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkPointComponent,
  TooltipComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

use([
  LineChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkPointComponent,
  TooltipComponent,
  SVGRenderer,
]);

interface MetricSummary {
  avg: number;
  p95: number;
  max: number;
  peak_elapsed_seconds: number;
  peak_item?: string | null;
  peak_title: string;
}

interface TelemetrySample {
  elapsed_seconds: number;
  time: string;
  item?: string | null;
  title: string;
  si_pct: number;
  st_pct: number;
}

interface TelemetryPayload {
  interval_seconds: number;
  sample_count: number;
  si_pct: MetricSummary;
  st_pct: MetricSummary;
  samples: TelemetrySample[];
}

interface RawCompactPayload {
  interval_seconds: number;
  sample_count: number;
  si_pct: MetricSummary;
  st_pct: MetricSummary;
  samples?: TelemetrySample[];
  stages?: Array<[string | null, string]>;
  rows?: Array<[number, string, number, number, number]>;
}

function normalizePayload(raw: RawCompactPayload): TelemetryPayload {
  if (Array.isArray(raw.samples)) {
    return raw as TelemetryPayload;
  }
  const stages = raw.stages ?? [];
  const samples: TelemetrySample[] = (raw.rows ?? []).map(
    ([elapsed_seconds, time, stageIdx, si_pct, st_pct]) => {
      const stage = stages[stageIdx] ?? [null, ''];
      return {
        elapsed_seconds,
        time,
        ...(stage[0] ? { item: stage[0] } : {}),
        title: stage[1],
        si_pct,
        st_pct,
      };
    },
  );
  return {
    interval_seconds: raw.interval_seconds,
    sample_count: raw.sample_count,
    si_pct: raw.si_pct,
    st_pct: raw.st_pct,
    samples,
  };
}

interface ZoomRange {
  start: number;
  end: number;
}

const STAGE_LABELS: Record<string, string> = {
  Setup: '环境准备',
  'Memory sysbench': '内存读写',
  'Memory stream': 'STREAM 带宽',
  'Memory latency': '缓存/主存延迟',
  'Disk performance': '磁盘 fio',
  'Network speed': 'iperf3 国际测速',
  'China carrier speed': '国内运营商测速',
  'Cloudflare speed': 'Cloudflare 测速',
  'Apple CDN speed': 'Apple CDN 测速',
  'Route tracing': '路由追踪',
  'BGP paths': 'BGP 路径观测',
  'IP reputation': 'IP 检测',
  'Media unlock': '流媒体与服务解锁',
  'CPU benchmark': 'CPU 基准测试',
};

function stageGroup(item?: string | null, title?: string): string {
  if (!item) return '环境准备';
  if (item.startsWith('memory.') || item.startsWith('disk.'))
    return '内存与磁盘';
  if (
    item === 'network.iperf3' ||
    item === 'network.taier' ||
    item === 'network.cloudflare' ||
    item === 'network.inetspeed'
  ) {
    return '网络带宽测速';
  }
  if (
    item === 'network.trace' ||
    item === 'network.bgp' ||
    item === 'ip.quality' ||
    item === 'ip.media'
  ) {
    return '路由追踪与解锁';
  }
  if (item.startsWith('cpu.')) return 'CPU 基准测试';
  return (title && STAGE_LABELS[title]) || title || item;
}

function fmtMmSs(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isDarkActive(): boolean {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'dark') return true;
  if (explicit === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function buildBands(samples: TelemetrySample[], maxSec: number) {
  const bands: Array<{ name: string; start: number; end: number }> = [];
  samples.forEach((sample, idx) => {
    const name = stageGroup(sample.item, sample.title);
    const cur = sample.elapsed_seconds;
    const start = idx === 0 ? 0 : (samples[idx - 1].elapsed_seconds + cur) / 2;
    const prev = bands.at(-1);
    if (!prev || prev.name !== name) {
      if (prev) prev.end = start;
      bands.push({ name, start, end: maxSec });
    } else {
      prev.end = maxSec;
    }
  });
  return bands;
}

function buildOption(
  data: TelemetryPayload,
  dark: boolean,
  narrow: boolean,
  reducedMotion: boolean,
  zoom: ZoomRange,
) {
  const palette = dark
    ? {
        surface: '#202020',
        raised: '#262626',
        sliderTrack: '#191919',
        sliderFiller: 'rgba(51, 146, 255, 0.18)',
        subtleBand: 'rgba(255, 255, 255, 0.035)',
        border: '#2f2f2f',
        borderStrong: '#454545',
        text: '#f0efed',
        textSecondary: '#c7c5c1',
        muted: '#9b9a97',
        st: '#ffa344',
        stPillText: '#ffb86c',
        stPillBg: '#2b2118',
        stPillBorder: '#5c3c1e',
        si: '#3392ff',
        siArea: 'rgba(51, 146, 255, 0.14)',
        siPillText: '#7ab8ff',
        siPillBg: '#1a2636',
        siPillBorder: '#2b4c73',
      }
    : {
        surface: '#ffffff',
        raised: '#ffffff',
        sliderTrack: '#f6f5f4',
        sliderFiller: 'rgba(0, 117, 222, 0.11)',
        subtleBand: 'rgba(25, 25, 24, 0.032)',
        border: '#eae8e4',
        borderStrong: '#cfccc6',
        text: '#191918',
        textSecondary: '#31302e',
        muted: '#615d59',
        st: '#dd5b00',
        stPillText: '#b84a00',
        stPillBg: '#fdf3eb',
        stPillBorder: '#f3d2b8',
        si: '#0075de',
        siArea: 'rgba(0, 117, 222, 0.09)',
        siPillText: '#005bab',
        siPillBg: '#eef6fe',
        siPillBorder: '#c5dff8',
      };

  const samples = data.samples;
  const maxSec = Math.max(
    ...samples.map((s) => s.elapsed_seconds),
    data.interval_seconds,
  );
  const bands = buildBands(samples, maxSec);
  const fontSans =
    "'Inter Variable', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC Variable', sans-serif";
  const fontMono =
    "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace";

  const stStage =
    STAGE_LABELS[data.st_pct.peak_title] || data.st_pct.peak_title;
  const siStage =
    STAGE_LABELS[data.si_pct.peak_title] || data.si_pct.peak_title;

  const stPeakX = data.st_pct.peak_elapsed_seconds;
  const siPeakX = data.si_pct.peak_elapsed_seconds;

  const findSampleAt = (sec: number) =>
    samples.find((s) => Math.abs(s.elapsed_seconds - sec) < 0.5);

  const formatPeakLabel = (
    prefix: string,
    fallbackSec: number,
    fallbackVal: number,
    fallbackStage: string,
    param: unknown,
  ) => {
    const p = param as { data?: { coord?: [number, number] }; value?: number };
    const sec = p?.data?.coord?.[0] ?? fallbackSec;
    const val =
      typeof p?.data?.coord?.[1] === 'number'
        ? p.data.coord[1]
        : typeof p?.value === 'number'
          ? p.value
          : fallbackVal;
    if (narrow) return `${prefix} ${val.toFixed(2)}%`;
    const hit = findSampleAt(sec);
    const stage = hit ? STAGE_LABELS[hit.title] || hit.title : fallbackStage;
    return `${prefix} ${val.toFixed(2)}%（${fmtMmSs(sec)} · ${stage}）`;
  };

  const gridLeft = narrow ? 40 : 48;
  const gridRight = narrow ? 18 : 30;

  const markAreas = bands
    .map((band, idx) => ({ band, idx }))
    .filter(
      ({ idx, band }) =>
        idx % 2 === 1 || band.end - band.start >= maxSec * 0.12,
    )
    .map(({ band, idx }) => {
      const wideEnough =
        band.end - band.start >= maxSec * (narrow ? 0.24 : 0.12);
      return [
        {
          name: wideEnough ? band.name : '',
          xAxis: band.start,
          itemStyle: {
            color: idx % 2 === 1 ? palette.subtleBand : 'transparent',
          },
          label: {
            show: wideEnough,
            position: 'top',
            distance: 6,
            color: palette.muted,
            fontFamily: fontSans,
            fontSize: narrow ? 10 : 11,
            fontWeight: 500,
          },
        },
        { xAxis: band.end },
      ];
    });

  return {
    animation: !reducedMotion,
    animationDuration: 240,
    backgroundColor: 'transparent',
    legend: {
      top: 0,
      left: 0,
      itemWidth: 14,
      itemHeight: 8,
      itemGap: narrow ? 12 : 20,
      icon: 'roundRect',
      textStyle: {
        color: palette.textSecondary,
        fontFamily: fontSans,
        fontSize: narrow ? 11.5 : 12,
      },
      data: ['宿主机抢占 (%st)', '软中断开销 (%si)'],
    },
    grid: {
      top: narrow ? 54 : 58,
      left: gridLeft,
      right: gridRight,
      bottom: narrow ? 56 : 60,
    },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        start: zoom.start,
        end: zoom.end,
        filterMode: 'filter',
        zoomOnMouseWheel: 'ctrl',
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
      },
      {
        type: 'slider',
        xAxisIndex: 0,
        start: zoom.start,
        end: zoom.end,
        filterMode: 'filter',
        height: narrow ? 20 : 22,
        bottom: 6,
        left: gridLeft,
        right: gridRight,
        borderRadius: 6,
        brushSelect: false,
        backgroundColor: palette.sliderTrack,
        borderColor: palette.border,
        fillerColor: palette.sliderFiller,
        dataBackground: {
          lineStyle: { color: palette.si, opacity: 0.45, width: 1 },
          areaStyle: { color: palette.si, opacity: 0.08 },
        },
        selectedDataBackground: {
          lineStyle: { color: palette.st, opacity: 0.85, width: 1.2 },
          areaStyle: { color: palette.si, opacity: 0.18 },
        },
        handleIcon:
          'path://M-3,-8 L3,-8 A2,2 0 0,1 5,-6 L5,6 A2,2 0 0,1 3,8 L-3,8 A2,2 0 0,1 -5,6 L-5,-6 A2,2 0 0,1 -3,-8 Z',
        handleSize: '86%',
        handleStyle: {
          color: palette.raised,
          borderColor: palette.borderStrong,
          borderWidth: 1.2,
        },
        moveHandleSize: 4,
        moveHandleStyle: {
          color: palette.borderStrong,
          opacity: 0.6,
        },
        emphasis: {
          handleStyle: {
            borderColor: palette.si,
          },
          moveHandleStyle: {
            color: palette.si,
            opacity: 0.85,
          },
        },
        labelFormatter: (val: number) => fmtMmSs(val),
        textStyle: {
          color: palette.muted,
          fontFamily: fontMono,
          fontSize: 10.5,
        },
      },
    ],
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: palette.raised,
      borderColor: palette.border,
      borderWidth: 1,
      padding: [8, 10],
      extraCssText:
        'border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 12px 28px rgba(0,0,0,0.10);',
      textStyle: {
        color: palette.text,
        fontFamily: fontSans,
        fontSize: 12,
      },
      axisPointer: {
        type: 'line',
        snap: true,
        lineStyle: {
          color: palette.borderStrong,
          width: 1,
          type: 'dashed',
        },
      },
      formatter(params: unknown) {
        const list = Array.isArray(params) ? params : [params];
        const first = list[0] as
          { data?: { sampleIndex?: number } } | undefined;
        const idx = first?.data?.sampleIndex ?? 0;
        const sample = samples[idx];
        if (!sample) return '';
        const stageCn = STAGE_LABELS[sample.title] || sample.title;
        const rows = list
          .map((entry) => {
            const item = entry as {
              seriesName?: string;
              color?: string;
              value?: [number, number];
            };
            const val = item.value?.[1] ?? 0;
            return `<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:4px;">
              <span style="display:inline-flex;align-items:center;gap:6px;color:${palette.textSecondary};">
                <span style="width:8px;height:8px;border-radius:9999px;background:${escapeHtml(String(item.color ?? ''))};display:inline-block;"></span>
                ${escapeHtml(String(item.seriesName ?? ''))}
              </span>
              <strong style="font-family:${fontMono};font-variant-numeric:tabular-nums;color:${palette.text};">${val.toFixed(2)}%</strong>
            </div>`;
          })
          .join('');
        return `<div>
          <div style="font-family:${fontMono};font-size:11.5px;color:${palette.muted};margin-bottom:2px;">
            <strong style="color:${palette.text};">${escapeHtml(sample.time)}</strong> · ${Math.round(sample.elapsed_seconds)}s · ${escapeHtml(stageCn)}
          </div>
          ${rows}
        </div>`;
      },
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: maxSec,
      minInterval: data.interval_seconds,
      splitNumber: narrow ? 4 : 7,
      axisLine: { lineStyle: { color: palette.borderStrong } },
      axisTick: {
        show: true,
        length: 4,
        lineStyle: { color: palette.borderStrong },
      },
      splitLine: { show: false },
      axisLabel: {
        color: palette.muted,
        fontFamily: fontMono,
        fontSize: 11,
        hideOverlap: true,
        formatter: (val: number) => fmtMmSs(val),
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: (extent: { max: number }) => {
        const raw = Math.max(extent.max * 1.16, 0.2);
        const niceCeilings = [
          0.2, 0.4, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0,
          8.0, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100,
        ];
        return niceCeilings.find((c) => c >= raw) ?? Math.ceil(raw);
      },
      minInterval: 0.1,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: palette.border, width: 1 } },
      axisLabel: {
        color: palette.muted,
        fontFamily: fontMono,
        fontSize: 11,
        formatter: (val: number) =>
          `${Number.isInteger(val) ? val : Number(val.toFixed(2))}%`,
      },
    },
    series: [
      {
        name: '软中断开销 (%si)',
        type: 'line',
        symbol: 'none',
        sampling: 'none',
        clip: true,
        z: 2,
        itemStyle: { color: palette.si },
        lineStyle: { color: palette.si, width: 1.7 },
        areaStyle: { color: palette.siArea },
        data: samples.map((s, sampleIndex) => ({
          value: [s.elapsed_seconds, s.si_pct],
          sampleIndex,
        })),
        markArea: {
          silent: true,
          data: markAreas,
        },
        markPoint: {
          symbol: 'circle',
          symbolSize: 7,
          silent: true,
          itemStyle: {
            color: palette.si,
            borderColor: palette.surface,
            borderWidth: 2,
          },
          data: [
            {
              name: '%si 峰值',
              type: 'max',
              valueDim: 'y',
              label: {
                show: true,
                position: 'top',
                distance: 5,
                formatter: (param: unknown) =>
                  formatPeakLabel(
                    '%si 峰值',
                    siPeakX,
                    data.si_pct.max,
                    siStage,
                    param,
                  ),
                color: palette.siPillText,
                backgroundColor: palette.siPillBg,
                borderColor: palette.siPillBorder,
                borderWidth: 1,
                borderRadius: 6,
                padding: [3, 6],
                fontFamily: fontSans,
                fontSize: 10.5,
                fontWeight: 600,
              },
            },
          ],
        },
      },
      {
        name: '宿主机抢占 (%st)',
        type: 'line',
        symbol: 'none',
        sampling: 'none',
        clip: true,
        z: 4,
        itemStyle: { color: palette.st },
        lineStyle: { color: palette.st, width: 2 },
        data: samples.map((s, sampleIndex) => ({
          value: [s.elapsed_seconds, s.st_pct],
          sampleIndex,
        })),
        markPoint: {
          symbol: 'circle',
          symbolSize: 7,
          silent: true,
          itemStyle: {
            color: palette.st,
            borderColor: palette.surface,
            borderWidth: 2,
          },
          data: [
            {
              name: '%st 峰值',
              type: 'max',
              valueDim: 'y',
              label: {
                show: true,
                position: 'top',
                distance: 5,
                formatter: (param: unknown) =>
                  formatPeakLabel(
                    '%st 峰值',
                    stPeakX,
                    data.st_pct.max,
                    stStage,
                    param,
                  ),
                color: palette.stPillText,
                backgroundColor: palette.stPillBg,
                borderColor: palette.stPillBorder,
                borderWidth: 1,
                borderRadius: 6,
                padding: [3, 6],
                fontFamily: fontSans,
                fontSize: 10.5,
                fontWeight: 600,
              },
            },
          ],
        },
      },
    ],
  };
}

interface InstanceRecord {
  chart: EChartsType;
  payload: TelemetryPayload;
  zoom: ZoomRange;
  resetBtn: HTMLButtonElement | null;
}

const instances = new Map<HTMLElement, InstanceRecord>();

function syncResetButton(rec: InstanceRecord) {
  if (!rec.resetBtn) return;
  const isZoomed = rec.zoom.start > 0.1 || rec.zoom.end < 99.9;
  rec.resetBtn.hidden = !isZoomed;
}

function refreshAll() {
  const dark = isDarkActive();
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  instances.forEach((rec, el) => {
    const width = el.clientWidth || 720;
    rec.chart.setOption(
      buildOption(rec.payload, dark, width < 520, reducedMotion, rec.zoom),
      { notMerge: false },
    );
  });
}

let globalListenersBound = false;

function ensureGlobalListeners() {
  if (globalListenersBound || typeof window === 'undefined') return;
  globalListenersBound = true;
  const themeObserver = new MutationObserver(() => refreshAll());
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-appearance'],
  });
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => refreshAll());
  window
    .matchMedia('(prefers-reduced-motion: reduce)')
    .addEventListener('change', () => refreshAll());
}

export function mountVmCpuTelemetryRoot(root: HTMLElement) {
  ensureGlobalListeners();
  const mount = root.querySelector<HTMLElement>('[data-vm-telemetry-chart]');
  const script = root.querySelector<HTMLScriptElement>(
    'script[data-vm-telemetry-json]',
  );
  const resetBtn = root.querySelector<HTMLButtonElement>(
    '[data-vm-telemetry-reset]',
  );
  if (!mount || !script || instances.has(mount)) return;
  const payload = normalizePayload(
    JSON.parse(script.textContent || '{}') as RawCompactPayload,
  );
  if (!Array.isArray(payload.samples) || payload.samples.length === 0) return;

  const chart = init(mount, null, { renderer: 'svg' });
  const zoom: ZoomRange = { start: 0, end: 100 };
  const rec: InstanceRecord = { chart, payload, zoom, resetBtn };
  const dark = isDarkActive();
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const initialWidth = mount.clientWidth || 720;
  chart.setOption(
    buildOption(payload, dark, initialWidth < 520, reducedMotion, zoom),
  );
  instances.set(mount, rec);

  chart.on('datazoom', () => {
    const opt = chart.getOption() as {
      dataZoom?: Array<{ start?: number; end?: number }>;
    };
    const dz = opt.dataZoom?.[0];
    if (dz) {
      rec.zoom.start = dz.start ?? 0;
      rec.zoom.end = dz.end ?? 100;
      syncResetButton(rec);
    }
  });

  resetBtn?.addEventListener('click', () => {
    rec.zoom.start = 0;
    rec.zoom.end = 100;
    chart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
    syncResetButton(rec);
  });

  let lastNarrow = initialWidth < 520;
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const w = entry.contentRect.width;
      if (w <= 0) continue;
      const narrow = w < 520;
      if (narrow !== lastNarrow) {
        lastNarrow = narrow;
        chart.setOption(
          buildOption(
            payload,
            isDarkActive(),
            narrow,
            window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            rec.zoom,
          ),
        );
      }
      chart.resize();
    }
  });
  ro.observe(mount);
}

export function initVmCpuTelemetryCharts() {
  document
    .querySelectorAll<HTMLElement>('[data-vm-telemetry-root]')
    .forEach((root) => mountVmCpuTelemetryRoot(root));
}
