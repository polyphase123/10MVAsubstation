/**
 * ============================================================================
 * SubstationCharts — Chart Visualization Engine for 10MVA Substation Design
 * ============================================================================
 *
 * Requires: Chart.js v4.x loaded via CDN before this script.
 *
 * Usage:
 *   const chart = SubstationCharts.createTCCCurve('canvasId', data);
 *
 * All chart factories accept a canvas element ID and a data/config object,
 * and return the Chart.js instance.
 * ============================================================================
 */

(function () {
  'use strict';

  // ──────────────────────────────────────────────
  // COLOR PALETTE
  // ──────────────────────────────────────────────
  const COLORS = {
    primary:    '#0F172A',  // Premium Slate 900
    secondary:  '#0D9488',  // Teal 600
    accent:     '#F59E0B',  // Amber 500
    success:    '#10B981',  // Emerald 500
    warning:    '#F59E0B',  // Amber 500
    danger:     '#F43F5E',  // Rose 500
    info:       '#3B82F6',  // Blue 500
    muted:      '#64748B',  // Slate 500
    dark:       '#334155',  // Slate 700
    light:      '#F8FAFC',  // Slate 50
    white:      '#FFFFFF',
    gridLine:   'rgba(0,0,0,0.04)',
    gridLineDark: 'rgba(0,0,0,0.08)',

    // Chart series palette (12 distinct premium modern colours)
    series: [
      '#0F172A', '#0D9488', '#F59E0B', '#F43F5E',
      '#10B981', '#8B5CF6', '#06B6D4', '#E11D48',
      '#3B82F6', '#EC4899', '#14B8A6', '#84CC16',
    ],

    // PPE category colours (arc flash)
    ppe: [
      '#10B981',  // Cat 1 – emerald
      '#EAB308',  // Cat 2 – yellow
      '#F97316',  // Cat 3 – orange
      '#EF4444',  // Cat 4 – red
      '#7C3AED',  // Danger – violet
    ],
  };

  // ──────────────────────────────────────────────
  // SHARED DEFAULTS
  // ──────────────────────────────────────────────
  const FONT_FAMILY = "'Inter', 'Segoe UI', 'Helvetica Neue', sans-serif";

  /** Merge user opts into a deep-copied base. */
  function deepMerge(base, override) {
    const out = JSON.parse(JSON.stringify(base));
    if (!override) return out;
    for (const key of Object.keys(override)) {
      if (
        override[key] &&
        typeof override[key] === 'object' &&
        !Array.isArray(override[key]) &&
        out[key] &&
        typeof out[key] === 'object'
      ) {
        out[key] = deepMerge(out[key], override[key]);
      } else {
        out[key] = override[key];
      }
    }
    return out;
  }

  function getCanvas(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`SubstationCharts: canvas #${id} not found`);
    return el;
  }

  /** Shared Chart.js defaults applied once. */
  function applyGlobalDefaults() {
    if (applyGlobalDefaults._done) return;
    applyGlobalDefaults._done = true;

    Chart.defaults.font.family = FONT_FAMILY;
    Chart.defaults.font.size = 12;
    Chart.defaults.color = COLORS.dark;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.animation = { duration: 800, easing: 'easeOutQuart' };
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(44,62,80,0.92)';
    Chart.defaults.plugins.tooltip.titleFont = { family: FONT_FAMILY, size: 13, weight: '600' };
    Chart.defaults.plugins.tooltip.bodyFont  = { family: FONT_FAMILY, size: 12 };
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 6;
    Chart.defaults.plugins.tooltip.displayColors = true;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.padding = 16;
    Chart.defaults.plugins.legend.labels.font = { family: FONT_FAMILY, size: 12 };
  }

  // ──────────────────────────────────────────────
  // IEC 60255 IDMT CONSTANTS
  // ──────────────────────────────────────────────
  const IDMT_CURVES = {
    SI:  { K: 0.14,   alpha: 0.02,  label: 'Standard Inverse' },
    VI:  { K: 13.5,   alpha: 1.0,   label: 'Very Inverse' },
    EI:  { K: 80.0,   alpha: 2.0,   label: 'Extremely Inverse' },
    LTI: { K: 120.0,  alpha: 1.0,   label: 'Long-Time Inverse' },
  };

  /**
   * IEC 60255 IDMT operating time.
   *   t = TMS * K / ((I / Is)^alpha - 1)
   * Returns null when I <= Is (relay does not operate).
   */
  function idmtTime(I, Is, TMS, K, alpha) {
    const ratio = I / Is;
    if (ratio <= 1) return null;
    return TMS * K / (Math.pow(ratio, alpha) - 1);
  }

  /**
   * Generate {x,y} data points for a relay IDMT curve.
   * Points are generated on a logarithmic current scale from
   * slightly above pickup to maxCurrent.
   */
  function generateIDMTPoints(Is, TMS, curveType, minCurrent, maxCurrent, numPoints) {
    const curve = IDMT_CURVES[curveType];
    if (!curve) throw new Error(`Unknown IDMT curve type: ${curveType}`);
    numPoints = numPoints || 200;
    minCurrent = minCurrent || Is * 1.05;
    maxCurrent = maxCurrent || 100000;

    const points = [];
    const logMin = Math.log10(minCurrent);
    const logMax = Math.log10(maxCurrent);
    const step = (logMax - logMin) / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
      const I = Math.pow(10, logMin + step * i);
      const t = idmtTime(I, Is, TMS, curve.K, curve.alpha);
      if (t !== null && t > 0 && t <= 10000) {
        points.push({ x: I, y: t });
      }
    }
    return points;
  }

  /**
   * Generate fuse curve points (simplified power-law model).
   * Points follow: t = A / I^B  where A, B are fuse constants.
   */
  function generateFusePoints(A, B, minCurrent, maxCurrent, numPoints) {
    numPoints = numPoints || 200;
    const points = [];
    const logMin = Math.log10(minCurrent);
    const logMax = Math.log10(maxCurrent);
    const step = (logMax - logMin) / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
      const I = Math.pow(10, logMin + step * i);
      const t = A / Math.pow(I, B);
      if (t > 0.005 && t <= 10000) {
        points.push({ x: I, y: t });
      }
    }
    return points;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 1. TCC CURVE PLOTTER  (Time-Current Characteristic — LOG-LOG)
  // ════════════════════════════════════════════════════════════════════════════
  /**
   * data = {
   *   relays: [
   *     { label, Is, TMS, curveType: 'SI'|'VI'|'EI'|'LTI', color? },
   *     ...
   *   ],
   *   fuses: [
   *     { label, A_melt, B_melt, A_clear, B_clear, minI, maxI, color? },
   *     ...
   *   ],
   *   cti: 0.3,               // coordination time interval (s), optional
   *   ctiRelay: 0,            // index of relay to draw CTI band around
   *   title: 'TCC Coordination'
   * }
   */
  function createTCCCurve(canvasId, data) {
    applyGlobalDefaults();
    const ctx = getCanvas(canvasId).getContext('2d');
    const datasets = [];
    let colorIdx = 0;

    // ── Relay IDMT curves ──
    if (data.relays) {
      data.relays.forEach((relay, ri) => {
        const color = relay.color || COLORS.series[colorIdx++ % COLORS.series.length];
        const pts = generateIDMTPoints(
          relay.Is || relay.pickup, relay.TMS || relay.tms, relay.curveType,
          relay.minCurrent || 10, relay.maxCurrent || 100000
        );
        datasets.push({
          label: relay.label || relay.name || `Relay ${ri + 1} (${IDMT_CURVES[relay.curveType].label})`,
          data: pts,
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: color,
          tension: 0,
          fill: false,
          order: 1,
        });

        // CTI band (shifted curve above the reference relay)
        if (data.cti && data.ctiRelay === ri) {
          const ctiPts = pts.map(p => ({ x: p.x, y: p.y + data.cti }));
          datasets.push({
            label: `CTI Band (+${data.cti}s)`,
            data: ctiPts,
            borderColor: color,
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: {
              target: datasets.length - 1,  // fill between this & relay curve
              above: hexToRgba(color, 0.08),
            },
            order: 2,
          });
        }
      });
    }

    // ── Fuse curves ──
    if (data.fuses) {
      data.fuses.forEach((fuse, fi) => {
        const color = fuse.color || COLORS.series[colorIdx++ % COLORS.series.length];
        const minI = fuse.minI || 10;
        const maxI = fuse.maxI || 100000;

        // Melting curve
        const meltPts = generateFusePoints(fuse.A_melt, fuse.B_melt, minI, maxI);
        datasets.push({
          label: (fuse.label || `Fuse ${fi + 1}`) + ' Melt',
          data: meltPts,
          borderColor: color,
          borderWidth: 2,
          borderDash: [8, 3],
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: false,
          order: 1,
        });

        // Total clearing curve
        const clearPts = generateFusePoints(fuse.A_clear, fuse.B_clear, minI, maxI);
        datasets.push({
          label: (fuse.label || `Fuse ${fi + 1}`) + ' Clear',
          data: clearPts,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: {
            target: datasets.length - 1,
            above: hexToRgba(color, 0.10),
          },
          order: 1,
        });
      });
    }

    return new Chart(ctx, {
      type: 'scatter',
      data: { datasets },
      options: {
        onClick: function(evt) {
          const points = this.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
          if (points.length) {
            const firstPoint = points[0];
            const datasetIndex = firstPoint.datasetIndex;
            const index = firstPoint.index;
            const x = this.data.datasets[datasetIndex].data[index].x;
            const y = this.data.datasets[datasetIndex].data[index].y;
            const label = this.data.datasets[datasetIndex].label;
            
            const infoBox = document.getElementById('tcc-info-box');
            if (infoBox) {
              infoBox.style.display = 'block';
              infoBox.innerHTML = `
                <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 12px; border-radius: 4px; margin-top: 12px; color: #1e3a8a;">
                  <strong style="color: #2563eb;">${label}</strong><br>
                  Current: <strong>${x.toLocaleString()} A</strong><br>
                  Operating Time: <strong>${y.toFixed(3)} s</strong><br>
                  <span style="font-size: 11px; color: #475569;">Click other points on the curves to inspect standard grading durations.</span>
                </div>
              `;
            }
          }
        },
        showLine: true,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: data.title || 'Time-Current Characteristic (TCC) Coordination Curve',
            font: { size: 16, weight: '700', family: FONT_FAMILY },
            color: COLORS.primary,
            padding: { bottom: 12 },
          },
          legend: {
            position: 'right',
            labels: {
              font: { size: 11, family: FONT_FAMILY },
              padding: 10,
              usePointStyle: true,
              pointStyleWidth: 24,
            },
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const I = ctx.parsed.x;
                const t = ctx.parsed.y;
                return `${ctx.dataset.label}: ${formatEngineering(I, 'A')} @ ${formatTime(t)}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'logarithmic',
            min: data.xMin || 10,
            max: data.xMax || 100000,
            title: {
              display: true,
              text: 'Current (A)',
              font: { size: 13, weight: '600', family: FONT_FAMILY },
              color: COLORS.dark,
            },
            grid: {
              color: function (context) {
                // Emphasise decade lines
                const v = context.tick && context.tick.value;
                if (v && isPowerOf10(v)) return COLORS.gridLineDark;
                return COLORS.gridLine;
              },
              lineWidth: function (context) {
                const v = context.tick && context.tick.value;
                return (v && isPowerOf10(v)) ? 1.2 : 0.6;
              },
            },
            ticks: {
              callback: function (value) {
                if (isPowerOf10(value)) return formatSI(value);
                // Show 2x and 5x sub-decade ticks
                const log = Math.log10(value);
                const frac = log - Math.floor(log);
                if (Math.abs(frac - Math.log10(2)) < 0.02 ||
                    Math.abs(frac - Math.log10(5)) < 0.02) {
                  return formatSI(value);
                }
                return '';
              },
              font: { size: 10, family: FONT_FAMILY },
              color: COLORS.dark,
              maxRotation: 0,
            },
          },
          y: {
            type: 'logarithmic',
            min: data.yMin || 0.01,
            max: data.yMax || 1000,
            title: {
              display: true,
              text: 'Time (s)',
              font: { size: 13, weight: '600', family: FONT_FAMILY },
              color: COLORS.dark,
            },
            grid: {
              color: function (context) {
                const v = context.tick && context.tick.value;
                if (v && isPowerOf10(v)) return COLORS.gridLineDark;
                return COLORS.gridLine;
              },
              lineWidth: function (context) {
                const v = context.tick && context.tick.value;
                return (v && isPowerOf10(v)) ? 1.2 : 0.6;
              },
            },
            ticks: {
              callback: function (value) {
                if (isPowerOf10(value)) return value >= 1 ? value + 's' : value * 1000 + 'ms';
                return '';
              },
              font: { size: 10, family: FONT_FAMILY },
              color: COLORS.dark,
            },
          },
        },
      },
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. LOAD PROFILE CHART  (24-hour demand curve)
  // ════════════════════════════════════════════════════════════════════════════
  /**
   * data = {
   *   feeders: [
   *     { label, mw: [24 values], mvar: [24 values], color? },
   *     ...
   *   ],
   *   hours: [0..23],   // optional, defaults to 0–23
   *   title: '...'
   * }
   */
  function createLoadProfile(canvasId, data) {
    applyGlobalDefaults();
    const ctx = getCanvas(canvasId).getContext('2d');
    const hours = data.hours || Array.from({ length: 24 }, (_, i) => i);
    const labels = hours.map(h => String(h).padStart(2, '0') + ':00');
    const datasets = [];
    let colorIdx = 0;

    data.feeders.forEach((feeder, fi) => {
      const color = feeder.color || COLORS.series[colorIdx++ % COLORS.series.length];

      // MW dataset (left Y)
      datasets.push({
        label: (feeder.label || `Feeder ${fi + 1}`) + ' MW',
        data: feeder.mw,
        borderColor: color,
        backgroundColor: hexToRgba(color, 0.15),
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6,
        yAxisID: 'yMW',
        order: fi + 1,
      });

      // MVAR dataset (right Y)
      if (feeder.mvar) {
        datasets.push({
          label: (feeder.label || `Feeder ${fi + 1}`) + ' MVAR',
          data: feeder.mvar,
          borderColor: color,
          borderDash: [6, 3],
          borderWidth: 1.8,
          fill: false,
          tension: 0.35,
          pointRadius: 2,
          pointHoverRadius: 5,
          pointStyle: 'rectRot',
          yAxisID: 'yMVAR',
          order: fi + 10,
        });
      }
    });

    // Find peak MW for annotation
    let peakVal = -Infinity, peakHour = 0;
    data.feeders.forEach(f => {
      f.mw.forEach((v, i) => {
        if (v > peakVal) { peakVal = v; peakHour = i; }
      });
    });

    // Find peak MVAR for headroom suggestedMax
    let peakMvar = -Infinity;
    data.feeders.forEach(f => {
      if (f.mvar) {
        f.mvar.forEach(v => {
          if (v > peakMvar) peakMvar = v;
        });
      }
    });
    if (peakMvar === -Infinity) peakMvar = 1.0;

    // Peak annotation plugin
    const peakAnnotation = {
      id: 'peakAnnotation',
      afterDatasetsDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data[peakHour]) return;
        const pt = meta.data[peakHour];
        const ctxC = chart.ctx;
        ctxC.save();
        ctxC.fillStyle = COLORS.danger;
        ctxC.font = `bold 11px ${FONT_FAMILY}`;
        ctxC.textAlign = 'center';
        ctxC.fillText(`Peak: ${peakVal.toFixed(2)} MW`, pt.x, pt.y - 14);
        // Marker
        ctxC.beginPath();
        ctxC.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctxC.fillStyle = COLORS.danger;
        ctxC.fill();
        ctxC.restore();
      },
    };

    return new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        plugins: {
          title: {
            display: true,
            text: data.title || '24-Hour Load Profile',
            font: { size: 16, weight: '700', family: FONT_FAMILY },
            color: COLORS.primary,
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (ctx) => {
                const unit = ctx.dataset.yAxisID === 'yMW' ? ' MW' : ' MVAR';
                return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(3)}${unit}`;
              },
            },
          },
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            title: { display: true, text: 'Hour of Day', font: { size: 13, weight: '600' } },
            grid: { color: COLORS.gridLine },
          },
          yMW: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Active Power (MW)', font: { size: 13, weight: '600' }, color: COLORS.primary },
            grid: { color: COLORS.gridLine },
            beginAtZero: true,
            suggestedMax: peakVal * 1.30, // 30% headroom so peak label never intersects borders!
          },
          yMVAR: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'Reactive Power (MVAR)', font: { size: 13, weight: '600' }, color: COLORS.secondary },
            grid: { drawOnChartArea: false },
            beginAtZero: true,
            suggestedMax: peakMvar * 1.30,
          },
        },
      },
      plugins: [peakAnnotation],
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 3. HARMONIC SPECTRUM
  // ════════════════════════════════════════════════════════════════════════════
  /**
   * data = {
   *   harmonics: [ { order: 1, magnitude: 100 }, { order: 3, magnitude: 4.2 }, ... ],
   *   ieee519Limits: { odd: { '3-11': 4.0, '11-17': 2.0, ... }, even: 1.0 },
   *   thdPercent: 5.2,
   *   tddPercent: 4.8,
   *   title: '...'
   * }
   */
  function createHarmonicSpectrum(canvasId, data) {
    applyGlobalDefaults();
    const ctx = getCanvas(canvasId).getContext('2d');

    // Build limit lookup from IEEE 519 simplified ranges
    function getLimit(order) {
      if (!data.ieee519Limits) return null;
      if (order % 2 === 0 && data.ieee519Limits.even != null) return data.ieee519Limits.even;
      const odd = data.ieee519Limits.odd || {};
      if (order >= 3 && order < 11)  return odd['3-11']  || odd['default'] || null;
      if (order >= 11 && order < 17) return odd['11-17'] || odd['default'] || null;
      if (order >= 17 && order < 23) return odd['17-23'] || odd['default'] || null;
      if (order >= 23 && order < 35) return odd['23-35'] || odd['default'] || null;
      if (order >= 35)               return odd['35+']   || odd['default'] || null;
      return null;
    }

    const harmonics = data.harmonics || [];
    const labels = harmonics.map(h => 'H' + h.order);
    const magnitudes = harmonics.map(h => h.magnitude);
    const limits = harmonics.map(h => getLimit(h.order));
    const barColors = harmonics.map((h, i) => {
      const lim = limits[i];
      if (lim === null || h.order === 1) return COLORS.secondary;
      return h.magnitude <= lim ? COLORS.success : COLORS.danger;
    });

    const datasets = [
      {
        label: 'Harmonic Magnitude (%)',
        data: magnitudes,
        backgroundColor: barColors,
        borderColor: barColors.map(c => c),
        borderWidth: 1,
        borderRadius: 3,
        order: 2,
      },
    ];

    // IEEE 519 limit line dataset
    const limitValues = limits.map(l => l);
    if (limitValues.some(l => l !== null)) {
      datasets.push({
        label: 'IEEE 519 Limit',
        data: limitValues,
        type: 'line',
        borderColor: COLORS.danger,
        borderWidth: 2,
        borderDash: [6, 3],
        pointRadius: 0,
        fill: false,
        order: 1,
        spanGaps: true,
      });
    }

    // THD/TDD subtitle
    const subtitleParts = [];
    if (data.thdPercent != null) subtitleParts.push(`THD: ${data.thdPercent.toFixed(2)}%`);
    if (data.tddPercent != null) subtitleParts.push(`TDD: ${data.tddPercent.toFixed(2)}%`);

    return new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        plugins: {
          title: {
            display: true,
            text: data.title || 'Harmonic Spectrum Analysis',
            font: { size: 16, weight: '700', family: FONT_FAMILY },
            color: COLORS.primary,
          },
          subtitle: {
            display: subtitleParts.length > 0,
            text: subtitleParts.join('    |    '),
            font: { size: 13, weight: '500', family: FONT_FAMILY },
            color: COLORS.dark,
            padding: { bottom: 10 },
          },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const lim = limits[ctx.dataIndex];
                if (lim != null) return `IEEE 519 Limit: ${lim}%`;
                return '';
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Harmonic Order', font: { size: 13, weight: '600' } },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: 'Magnitude (% of Fundamental)', font: { size: 13, weight: '600' } },
            grid: { color: COLORS.gridLine },
            beginAtZero: true,
          },
        },
      },
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 4. VOLTAGE PROFILE
  // ════════════════════════════════════════════════════════════════════════════
  /**
   * data = {
   *   buses: [ { name, voltage_pu } ],
   *   upperLimit: 1.05,
   *   lowerLimit: 0.95,
   *   nominalVoltage_kV: 13.8,
   *   title: '...'
   * }
   */
  function createVoltageProfile(canvasId, data) {
    applyGlobalDefaults();
    const ctx = getCanvas(canvasId).getContext('2d');
    const upper = data.upperLimit || 1.05;
    const lower = data.lowerLimit || 0.95;

    let datasets = [];
    let labels = [];
    let allVoltages = [];

    if (data.feeders) {
      labels = ['Substation', 'Bus 1', 'Bus 2', 'Bus 3', 'Bus 4', 'Bus 5', 'Bus 6', 'Bus 7', 'Bus 8', 'Bus 9', 'Bus 10'];
      data.feeders.forEach((feeder, idx) => {
        const voltages = feeder.buses.map(b => b.voltage_pu);
        allVoltages = allVoltages.concat(voltages);
        const color = COLORS.series[idx % COLORS.series.length];
        datasets.push({
          label: feeder.label || `Feeder ${idx + 1}`,
          data: voltages,
          borderColor: color,
          backgroundColor: hexToRgba(color, 0.05),
          borderWidth: 2.5,
          fill: false,
          tension: 0.2,
          pointRadius: 4,
          pointHoverRadius: 6,
        });
      });
    } else {
      const buses = data.buses || [];
      labels = buses.map(b => b.name);
      const voltages = buses.map(b => b.voltage_pu);
      allVoltages = voltages;
      const barColors = voltages.map(v => {
        if (v > upper || v < lower) return COLORS.danger;
        if (v > upper - 0.01 || v < lower + 0.01) return COLORS.warning;
        return COLORS.secondary;
      });
      datasets.push({
        label: 'Voltage (p.u.)',
        data: voltages,
        borderColor: COLORS.primary,
        backgroundColor: hexToRgba(COLORS.primary, 0.10),
        borderWidth: 2.5,
        fill: false,
        tension: 0.2,
        pointRadius: 5,
        pointBackgroundColor: barColors,
        pointBorderColor: barColors,
        pointHoverRadius: 8,
      });
    }

    const minV = Math.min(...allVoltages);
    const maxV = Math.max(...allVoltages);

    // Limit band plugin
    const limitBandPlugin = {
      id: 'voltageLimitBands',
      beforeDatasetsDraw(chart) {
        const { ctx: c, chartArea: { left, right, top, bottom }, scales: { y } } = chart;
        const yUpper = y.getPixelForValue(upper);
        const yLower = y.getPixelForValue(lower);

        c.save();
        // Acceptable band
        c.fillStyle = hexToRgba(COLORS.success, 0.08);
        c.fillRect(left, yUpper, right - left, yLower - yUpper);

        // Upper limit line
        c.setLineDash([6, 4]);
        c.strokeStyle = COLORS.danger;
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(left, yUpper);
        c.lineTo(right, yUpper);
        c.stroke();

        // Lower limit line
        c.beginPath();
        c.moveTo(left, yLower);
        c.lineTo(right, yLower);
        c.stroke();

        // Labels
        c.setLineDash([]);
        c.fillStyle = COLORS.danger;
        c.font = `bold 10px ${FONT_FAMILY}`;
        c.textAlign = 'right';
        c.fillText(`${upper.toFixed(2)} p.u.`, right - 4, yUpper - 4);
        c.fillText(`${lower.toFixed(2)} p.u.`, right - 4, yLower + 12);
        c.restore();
      },
    };

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets,
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: data.title || `Voltage Profile (${data.nominalVoltage_kV || ''} kV)`,
            font: { size: 16, weight: '700', family: FONT_FAMILY },
            color: COLORS.primary,
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(4)} p.u. (${(ctx.parsed.y * (data.nominalVoltage_kV || 1)).toFixed(3)} kV)`,
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Bus Segment', font: { size: 13, weight: '600' } },
            grid: { color: COLORS.gridLine },
          },
          y: {
            title: { display: true, text: 'Voltage (p.u.)', font: { size: 13, weight: '600' } },
            grid: { color: COLORS.gridLine },
            min: Math.min(lower - 0.03, minV - 0.02),
            max: Math.max(upper + 0.03, maxV + 0.02),
          },
        },
      },
      plugins: [limitBandPlugin],
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 5. GROUNDING GRID VISUALIZATION (Canvas 2D)
  // ════════════════════════════════════════════════════════════════════════════
  /**
   * data = {
   *   gridWidth: 40,      // metres
   *   gridHeight: 30,     // metres
   *   meshSpacingX: 5,
   *   meshSpacingY: 5,
   *   rods: [ { x, y, depth? } ],   // positions in metres
   *   potentialData: [ [row][col] ], // optional 2D array of touch/step voltages
   *   maxPotential: 800,
   *   title: '...'
   * }
   * Returns: { canvas, redraw() }
   */
  function createGroundingGrid(canvasId, data) {
    applyGlobalDefaults();
    const canvas = getCanvas(canvasId);
    const ctx = canvas.getContext('2d');

    function draw() {
      const W = canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
      const H = canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      ctx.clearRect(0, 0, cw, ch);

      const pad = 60;
      const drawW = cw - pad * 2;
      const drawH = ch - pad * 2;

      // Fit grid with preserved aspect ratio so physics is dimensionally correct!
      const gridAspect = data.gridWidth / data.gridHeight;
      const canvasAspect = drawW / drawH;
      let finalDrawW = drawW;
      let finalDrawH = drawH;
      if (gridAspect > canvasAspect) {
        // Grid is wider than canvas ratio, limit by width
        finalDrawH = drawW / gridAspect;
      } else {
        // Grid is taller than canvas ratio, limit by height
        finalDrawW = drawH * gridAspect;
      }
      
      const offsetX = pad + (drawW - finalDrawW) / 2;
      const offsetY = pad + (drawH - finalDrawH) / 2;

      const scaleX = finalDrawW / data.gridWidth;
      const scaleY = finalDrawH / data.gridHeight;

      const toX = (m) => offsetX + m * scaleX;
      const toY = (m) => offsetY + m * scaleY;

      // ── Background ──
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(0, 0, cw, ch);

      // ── Title ──
      ctx.fillStyle = COLORS.primary;
      ctx.font = `bold 16px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(data.title || 'Grounding Grid Layout', cw / 2, 28);

      // ── Potential contour (if data provided) ──
      if (data.potentialData && data.potentialData.length > 0) {
        const rows = data.potentialData.length;
        const cols = data.potentialData[0].length;
        const cellW = finalDrawW / cols;
        const cellH = finalDrawH / rows;
        const maxV = data.maxPotential || 800;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const v = data.potentialData[r][c];
            const ratio = Math.min(v / maxV, 1);
            // Dynamic thermal HSL: Blue (safe, 240) -> Green -> Yellow -> Red (danger, 0)
            const hue = (1 - ratio) * 240;
            ctx.fillStyle = `hsla(${hue}, 85%, 55%, 0.18)`;
            ctx.fillRect(offsetX + c * cellW, offsetY + r * cellH, cellW + 1, cellH + 1);
          }
        }
      }

      // ── Grid border ──
      ctx.strokeStyle = COLORS.dark;
      ctx.lineWidth = 2;
      ctx.strokeRect(toX(0), toY(0), finalDrawW, finalDrawH);

      // ── Mesh conductors ──
      ctx.strokeStyle = COLORS.secondary;
      ctx.lineWidth = 1.5;

      // Horizontal conductors
      for (let y = 0; y <= data.gridHeight; y += data.meshSpacingY) {
        ctx.beginPath();
        ctx.moveTo(toX(0), toY(y));
        ctx.lineTo(toX(data.gridWidth), toY(y));
        ctx.stroke();
      }
      // Vertical conductors
      for (let x = 0; x <= data.gridWidth; x += data.meshSpacingX) {
        ctx.beginPath();
        ctx.moveTo(toX(x), toY(0));
        ctx.lineTo(toX(x), toY(data.gridHeight));
        ctx.stroke();
      }

      // ── Ground rods ──
      if (data.rods) {
        data.rods.forEach(rod => {
          const rx = toX(rod.x);
          const ry = toY(rod.y);

          // Rod marker
          ctx.beginPath();
          ctx.arc(rx, ry, 6, 0, Math.PI * 2);
          ctx.fillStyle = COLORS.accent;
          ctx.fill();
          ctx.strokeStyle = COLORS.dark;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Cross inside
          ctx.beginPath();
          ctx.moveTo(rx - 3, ry - 3);
          ctx.lineTo(rx + 3, ry + 3);
          ctx.moveTo(rx + 3, ry - 3);
          ctx.lineTo(rx - 3, ry + 3);
          ctx.strokeStyle = COLORS.white;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      }

      // ── Spacing labels ──
      ctx.fillStyle = COLORS.dark;
      ctx.font = `11px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';

      // X spacing
      if (data.meshSpacingX <= data.gridWidth) {
        const y0 = toY(data.gridHeight) + 18;
        ctx.fillText(`${data.meshSpacingX}m spacing`, toX(data.meshSpacingX / 2), y0);
        // Arrow line
        ctx.strokeStyle = COLORS.muted;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(toX(0), y0 - 10);
        ctx.lineTo(toX(data.meshSpacingX), y0 - 10);
        ctx.stroke();
      }

      // Y spacing
      if (data.meshSpacingY <= data.gridHeight) {
        ctx.save();
        ctx.translate(toX(data.gridWidth) + 22, toY(data.meshSpacingY / 2));
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${data.meshSpacingY}m spacing`, 0, 0);
        ctx.restore();
      }

      // ── Dimensions ──
      ctx.fillStyle = COLORS.muted;
      ctx.font = `bold 11px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${data.gridWidth}m`, cw / 2, ch - 8);
      ctx.save();
      ctx.translate(12, ch / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${data.gridHeight}m`, 0, 0);
      ctx.restore();

      // ── Legend for potential contour ──
      if (data.potentialData) {
        const lgX = cw - pad + 15;
        const lgY = offsetY;
        const lgH = finalDrawH;
        const lgW = 12;
        const gradient = ctx.createLinearGradient(0, lgY, 0, lgY + lgH);
        gradient.addColorStop(0, 'hsla(240, 85%, 55%, 0.6)'); // safe (blue)
        gradient.addColorStop(0.5, 'hsla(120, 85%, 55%, 0.6)');
        gradient.addColorStop(1, 'hsla(0, 85%, 55%, 0.6)'); // dangerous (red)
        ctx.fillStyle = gradient;
        ctx.fillRect(lgX, lgY, lgW, lgH);
        ctx.strokeStyle = COLORS.muted;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(lgX, lgY, lgW, lgH);

        ctx.fillStyle = COLORS.dark;
        ctx.font = `9px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText('0V (Safe)', lgX + lgW + 4, lgY + 10);
        ctx.fillText(`${data.maxPotential || 800}V (Limit)`, lgX + lgW + 4, lgY + lgH - 2);
      }
    }

    draw();
    window.addEventListener('resize', draw);

    // Return an object with a redraw helper (no Chart.js instance for this one)
    return { canvas, redraw: draw, destroy: () => window.removeEventListener('resize', draw) };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 6. FAULT CURRENT BAR CHART
  // ════════════════════════════════════════════════════════════════════════════
  /**
   * data = {
   *   buses: [ { name, threePh, slg, ll, llg, equipmentRating? } ],
   *   title: '...'
   * }
   */
  function createFaultCurrentChart(canvasId, data) {
    applyGlobalDefaults();
    const ctx = getCanvas(canvasId).getContext('2d');
    const buses = data.buses || [];
    const labels = buses.map(b => b.name);

    const datasets = [
      {
        label: '3-Phase',
        data: buses.map(b => b.threePh),
        backgroundColor: COLORS.series[0],
        borderColor: COLORS.series[0],
        borderWidth: 1,
        borderRadius: 3,
      },
      {
        label: 'SLG',
        data: buses.map(b => b.slg),
        backgroundColor: COLORS.series[1],
        borderColor: COLORS.series[1],
        borderWidth: 1,
        borderRadius: 3,
      },
      {
        label: 'L-L',
        data: buses.map(b => b.ll),
        backgroundColor: COLORS.series[2],
        borderColor: COLORS.series[2],
        borderWidth: 1,
        borderRadius: 3,
      },
      {
        label: 'LLG',
        data: buses.map(b => b.llg),
        backgroundColor: COLORS.series[3],
        borderColor: COLORS.series[3],
        borderWidth: 1,
        borderRadius: 3,
      },
    ];

    // Equipment rating overlay
    const hasRatings = buses.some(b => b.equipmentRating != null);
    if (hasRatings) {
      datasets.push({
        label: 'Equipment Rating',
        data: buses.map(b => b.equipmentRating || null),
        type: 'line',
        borderColor: COLORS.danger,
        borderWidth: 2.5,
        borderDash: [8, 4],
        pointRadius: 4,
        pointBackgroundColor: COLORS.danger,
        fill: false,
        order: 0,
        spanGaps: true,
      });
    }

    // Duty percentage plugin
    const dutyPlugin = {
      id: 'faultDuty',
      afterDatasetsDraw(chart) {
        if (!hasRatings) return;
        const c = chart.ctx;
        c.save();
        c.font = `bold 10px ${FONT_FAMILY}`;
        c.textAlign = 'center';

        buses.forEach((bus, idx) => {
          if (!bus.equipmentRating) return;
          const maxFault = Math.max(bus.threePh || 0, bus.slg || 0, bus.ll || 0, bus.llg || 0);
          const duty = ((maxFault / bus.equipmentRating) * 100).toFixed(0);
          const meta = chart.getDatasetMeta(0);
          if (!meta.data[idx]) return;
          const x = meta.data[idx].x;
          const yScale = chart.scales.y;
          const yPos = yScale.getPixelForValue(bus.equipmentRating);
          c.fillStyle = parseInt(duty) > 100 ? COLORS.danger : COLORS.success;
          c.fillText(`${duty}%`, x + 15, yPos - 6);
        });
        c.restore();
      },
    };

    return new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        plugins: {
          title: {
            display: true,
            text: data.title || 'Fault Current Analysis',
            font: { size: 16, weight: '700', family: FONT_FAMILY },
            color: COLORS.primary,
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatEngineering(ctx.parsed.y, 'A')}`,
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Bus', font: { size: 13, weight: '600' } },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: 'Fault Current (A)', font: { size: 13, weight: '600' } },
            grid: { color: COLORS.gridLine },
            beginAtZero: true,
            ticks: {
              callback: (v) => formatSI(v),
            },
          },
        },
      },
      plugins: [dutyPlugin],
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 7. RELIABILITY TREND CHART  (SAIFI, SAIDI, CAIDI)
  // ════════════════════════════════════════════════════════════════════════════
  /**
   * data = {
   *   years: [2019, 2020, ...],
   *   saifi: [1.2, 1.1, ...],
   *   saidi: [120, 110, ...],
   *   caidi: [100, 100, ...],
   *   targets: { saifi: 1.0, saidi: 100, caidi: 90 },
   *   title: '...'
   * }
   */
  function createReliabilityTrend(canvasId, data) {
    applyGlobalDefaults();
    const ctx = getCanvas(canvasId).getContext('2d');
    const labels = (data.years || []).map(String);

    const metricConfigs = [
      { key: 'saifi', label: 'SAIFI (int/cust·yr)', color: COLORS.series[0], unit: 'int/cust·yr', yAxis: 'ySAIFI' },
      { key: 'saidi', label: 'SAIDI (min/cust·yr)', color: COLORS.series[1], unit: 'min/cust·yr', yAxis: 'ySAIDI' },
      { key: 'caidi', label: 'CAIDI (min/int)',      color: COLORS.series[2], unit: 'min/int',      yAxis: 'ySAIDI' },
    ];

    const datasets = [];

    metricConfigs.forEach(mc => {
      if (!data[mc.key]) return;
      datasets.push({
        label: mc.label,
        data: data[mc.key],
        borderColor: mc.color,
        backgroundColor: hexToRgba(mc.color, 0.08),
        borderWidth: 2.5,
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: mc.color,
        yAxisID: mc.yAxis,
      });

      // Target line
      if (data.targets && data.targets[mc.key] != null) {
        datasets.push({
          label: `${mc.key.toUpperCase()} Target`,
          data: Array(labels.length).fill(data.targets[mc.key]),
          borderColor: mc.color,
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          yAxisID: mc.yAxis,
        });
      }
    });

    return new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        plugins: {
          title: {
            display: true,
            text: data.title || 'Reliability Indices Trend',
            font: { size: 16, weight: '700', family: FONT_FAMILY },
            color: COLORS.primary,
          },
          tooltip: { mode: 'index', intersect: false },
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            title: { display: true, text: 'Year', font: { size: 13, weight: '600' } },
            grid: { color: COLORS.gridLine },
          },
          ySAIFI: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'SAIFI (interruptions / customer·yr)', font: { size: 12, weight: '600' }, color: COLORS.series[0] },
            grid: { color: COLORS.gridLine },
            beginAtZero: true,
          },
          ySAIDI: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'SAIDI / CAIDI (minutes)', font: { size: 12, weight: '600' }, color: COLORS.series[1] },
            grid: { drawOnChartArea: false },
            beginAtZero: true,
          },
        },
      },
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 7b. RELIABILITY PERFORMANCE CHART (SAIFI, SAIDI, CAIDI comparison)
  // ════════════════════════════════════════════════════════════════════════════
  function createReliabilityChart(canvasId, result) {
    applyGlobalDefaults();
    const ctx = getCanvas(canvasId).getContext('2d');

    let saifi = 0.08, saidi = 4.2, caidi = 52.5;
    if (result && result.keyResults) {
      result.keyResults.forEach(kr => {
        if (kr.label.includes('SAIFI')) saifi = parseFloat(kr.value) || 0.08;
        if (kr.label.includes('SAIDI')) saidi = parseFloat(kr.value) || 4.2;
        if (kr.label.includes('CAIDI')) caidi = parseFloat(kr.value) || 52.5;
      });
    }

    // Convert SAIDI/CAIDI to minutes for standard visual proportions (since targets are usually 1.0 outages and 90-120 minutes)
    // IEEE standard benchmarks: SAIFI ~1.0, SAIDI ~100 min, CAIDI ~90 min
    const saifiVal = saifi;
    const saidiVal = saidi * 60; // hours to minutes
    const caidiVal = caidi * 60; // hours to minutes

    const targetSaifi = 1.0;
    const targetSaidi = 120.0; // 2 hours
    const targetCaidi = 90.0;  // 1.5 hours

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['SAIFI (outages/yr)', 'SAIDI (min/yr)', 'CAIDI (min/int)'],
        datasets: [
          {
            label: 'Calculated System Indices',
            data: [saifiVal, saidiVal, caidiVal],
            backgroundColor: [COLORS.series[0], COLORS.series[1], COLORS.series[2]],
            borderColor: [COLORS.series[0], COLORS.series[1], COLORS.series[2]],
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'IEEE Target Limit',
            data: [targetSaifi, targetSaidi, targetCaidi],
            backgroundColor: 'rgba(231, 76, 60, 0.15)',
            borderColor: COLORS.danger,
            borderWidth: 1.5,
            borderDash: [5, 5],
            borderRadius: 4
          }
        ]
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: 'System Reliability Performance vs IEEE Standards',
            font: { size: 15, weight: '700', family: FONT_FAMILY },
            color: COLORS.primary
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Metric Value (Outages / Minutes)', font: { size: 12, weight: '600' } },
            grid: { color: COLORS.gridLine }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 8. TRANSFORMER LOADING CHART  (Gauge / Donut)
  // ════════════════════════════════════════════════════════════════════════════
  /**
   * data = {
   *   loadPercent: 72,
   *   transformerName: 'T1 – 10 MVA',
   *   title: '...'
   * }
   */
  function createTransformerLoading(canvasId, data) {
    applyGlobalDefaults();
    const ctx = getCanvas(canvasId).getContext('2d');
    const pct = Math.min(Math.max(data.loadPercent || 0, 0), 150);

    // Determine colour zone
    let activeColor;
    if (pct <= 80)       activeColor = COLORS.success;
    else if (pct <= 100) activeColor = COLORS.warning;
    else                 activeColor = COLORS.danger;

    const remaining = Math.max(150 - pct, 0);  // 150% max display

    // Centre label plugin
    const centreLabel = {
      id: 'transformerGaugeLabel',
      afterDraw(chart) {
        const { ctx: c, chartArea } = chart;
        const centerX = (chartArea.left + chartArea.right) / 2;
        const centerY = (chartArea.top + chartArea.bottom) / 2 + 10;
        c.save();
        c.textAlign = 'center';

        // Percentage
        c.fillStyle = activeColor;
        c.font = `bold 36px ${FONT_FAMILY}`;
        c.fillText(`${pct.toFixed(1)}%`, centerX, centerY - 4);

        // Sub-label
        c.fillStyle = COLORS.muted;
        c.font = `13px ${FONT_FAMILY}`;
        c.fillText(data.transformerName || 'Loading', centerX, centerY + 22);

        // Status text
        let status;
        if (pct <= 80)       status = 'NORMAL';
        else if (pct <= 100) status = 'WARNING';
        else                 status = 'OVERLOADED';
        c.fillStyle = activeColor;
        c.font = `bold 12px ${FONT_FAMILY}`;
        c.fillText(status, centerX, centerY + 42);
        c.restore();
      },
    };

    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Load', 'Remaining'],
        datasets: [{
          data: [pct, remaining],
          backgroundColor: [activeColor, hexToRgba(COLORS.muted, 0.15)],
          borderColor: [activeColor, 'transparent'],
          borderWidth: [2, 0],
          circumference: 270,
          rotation: 225,
          cutout: '78%',
        }],
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: data.title || 'Transformer Loading',
            font: { size: 16, weight: '700', family: FONT_FAMILY },
            color: COLORS.primary,
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataIndex === 0) return `Load: ${pct.toFixed(1)}%`;
                return `Available: ${remaining.toFixed(1)}%`;
              },
            },
          },
        },
      },
      plugins: [centreLabel],
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 9. SYSTEM LOSS PIE CHART
  // ════════════════════════════════════════════════════════════════════════════
  /**
   * data = {
   *   losses: [ { label, value_kW } ],
   *   title: '...'
   * }
   */
  function createSystemLossChart(canvasId, data) {
    applyGlobalDefaults();
    const ctx = getCanvas(canvasId).getContext('2d');
    const losses = data.losses || [];
    const labels = losses.map(l => l.label);
    const values = losses.map(l => l.value_kW);
    const total = values.reduce((s, v) => s + v, 0);

    return new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: losses.map((_, i) => COLORS.series[i % COLORS.series.length]),
          borderColor: COLORS.white,
          borderWidth: 2,
          hoverOffset: 12,
        }],
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: data.title || 'System Loss Breakdown',
            font: { size: 16, weight: '700', family: FONT_FAMILY },
            color: COLORS.primary,
          },
          subtitle: {
            display: true,
            text: `Total Losses: ${total.toFixed(1)} kW`,
            font: { size: 13, weight: '500', family: FONT_FAMILY },
            color: COLORS.dark,
            padding: { bottom: 8 },
          },
          legend: {
            position: 'right',
            labels: { font: { size: 11 }, padding: 12 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed;
                const pct = ((v / total) * 100).toFixed(1);
                return `${ctx.label}: ${v.toFixed(1)} kW (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 10. ARC FLASH INCIDENT ENERGY CHART
  // ════════════════════════════════════════════════════════════════════════════
  /**
   * data = {
   *   buses: [ { name, incidentEnergy_cal_cm2, ppeCategory? } ],
   *   ppeBands: [       // optional, default IEEE 1584 categories
   *     { max: 1.2,  label: 'Cat 0', color: ... },
   *     { max: 4,    label: 'Cat 1', color: ... },
   *     { max: 8,    label: 'Cat 2', color: ... },
   *     { max: 25,   label: 'Cat 3', color: ... },
   *     { max: 40,   label: 'Cat 4', color: ... },
   *     { max: Infinity, label: 'Danger', color: ... },
   *   ],
   *   title: '...'
   * }
   */
  function createArcFlashChart(canvasId, data) {
    applyGlobalDefaults();
    const ctx = getCanvas(canvasId).getContext('2d');
    const buses = data.buses || [];

    const defaultBands = [
      { max: 1.2,      label: 'Cat 0', color: COLORS.ppe[0] },
      { max: 4,        label: 'Cat 1', color: COLORS.ppe[0] },
      { max: 8,        label: 'Cat 2', color: COLORS.ppe[1] },
      { max: 25,       label: 'Cat 3', color: COLORS.ppe[2] },
      { max: 40,       label: 'Cat 4', color: COLORS.ppe[3] },
      { max: Infinity, label: 'Danger', color: COLORS.ppe[4] },
    ];
    const bands = data.ppeBands || defaultBands;

    function getBandColor(energy) {
      for (const band of bands) {
        if (energy <= band.max) return band.color;
      }
      return COLORS.ppe[4];
    }

    function getBandLabel(energy) {
      for (const band of bands) {
        if (energy <= band.max) return band.label;
      }
      return 'Danger';
    }

    const labels = buses.map(b => b.name);
    const values = buses.map(b => b.incidentEnergy_cal_cm2);
    const barColors = values.map(v => getBandColor(v));

    // PPE band background plugin
    const ppeBandPlugin = {
      id: 'ppeBands',
      beforeDatasetsDraw(chart) {
        const { ctx: c, chartArea: { top, bottom, left, right }, scales: { x: xScale } } = chart;
        c.save();
        const maxVal = Math.max(...values, 40);
        const usableBands = bands.filter(b => b.max !== Infinity && b.max <= maxVal * 1.3);
        const xRight = right;

        let prevX = left;
        usableBands.forEach(band => {
          const bandX = xScale.getPixelForValue ? left + (band.max / (maxVal * 1.1)) * (right - left) : right;
          // We draw vertical band lines on the horizontal bar chart
          // For horizontal bars, x is the value axis
          const yAxis = chart.scales.y;
          if (!yAxis) return;

          // Use the x-axis (value axis) directly
          const valScale = chart.scales.x;
          const px = valScale.getPixelForValue(band.max);
          if (px > left && px < right) {
            c.strokeStyle = hexToRgba(band.color, 0.5);
            c.lineWidth = 1;
            c.setLineDash([4, 3]);
            c.beginPath();
            c.moveTo(px, top);
            c.lineTo(px, bottom);
            c.stroke();

            // Label
            c.setLineDash([]);
            c.fillStyle = hexToRgba(band.color, 0.8);
            c.font = `bold 9px ${FONT_FAMILY}`;
            c.textAlign = 'center';
            c.fillText(band.label, px, top - 4);
          }
        });
        c.restore();
      },
    };

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Incident Energy (cal/cm²)',
          data: values,
          backgroundColor: barColors,
          borderColor: barColors.map(c => c),
          borderWidth: 1,
          borderRadius: 3,
        }],
      },
      options: {
        indexAxis: 'y',  // Horizontal bars
        plugins: {
          title: {
            display: true,
            text: data.title || 'Arc Flash Incident Energy Analysis',
            font: { size: 16, weight: '700', family: FONT_FAMILY },
            color: COLORS.primary,
            padding: { bottom: 20 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const e = ctx.parsed.x;
                return `${e.toFixed(1)} cal/cm²  —  PPE ${getBandLabel(e)}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Incident Energy (cal/cm²)', font: { size: 13, weight: '600' } },
            grid: { color: COLORS.gridLine },
            beginAtZero: true,
          },
          y: {
            title: { display: true, text: 'Bus / Location', font: { size: 13, weight: '600' } },
            grid: { display: false },
          },
        },
      },
      plugins: [ppeBandPlugin],
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 12. LOAD FORECAST CHART
  // ════════════════════════════════════════════════════════════════════════════
  function createLoadForecastChart(canvasId, data) {
    applyGlobalDefaults();
    const ctx = getCanvas(canvasId).getContext('2d');
    const historical = data.historical || [];
    const forecast = data.forecast || [];
    
    const histYears = historical.map(h => h.year);
    const histDemands = historical.map(h => h.demand / 1000); // MVA
    
    const foreYears = forecast.map(f => f.year);
    const foreDemands = forecast.map(f => f.demand / 1000); // MVA
    
    const allLabels = [...histYears, ...foreYears];
    
    // Historical points
    const histDataPoints = allLabels.map(y => {
      const idx = histYears.indexOf(y);
      return idx !== -1 ? histDemands[idx] : null;
    });
    
    // Forecast points connected to last historical point
    const foreDataPoints = allLabels.map(y => {
      const idx = foreYears.indexOf(y);
      if (idx !== -1) return foreDemands[idx];
      if (y === histYears[histYears.length - 1]) return histDemands[histDemands.length - 1];
      return null;
    });

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: allLabels.map(String),
        datasets: [
          {
            label: 'Historical Demand (MVA)',
            data: histDataPoints,
            borderColor: COLORS.primary,
            backgroundColor: hexToRgba(COLORS.primary, 0.1),
            borderWidth: 3,
            fill: false,
            tension: 0.1,
            pointRadius: 5
          },
          {
            label: 'Forecasted Peak Demand (MVA)',
            data: foreDataPoints,
            borderColor: COLORS.warning,
            backgroundColor: hexToRgba(COLORS.warning, 0.1),
            borderWidth: 2.5,
            borderDash: [6, 4],
            fill: false,
            tension: 0.1,
            pointRadius: 4
          },
          {
            label: 'Substation Rated Capacity (10 MVA)',
            data: Array(allLabels.length).fill(10),
            borderColor: COLORS.danger,
            borderWidth: 1.5,
            borderDash: [2, 2],
            fill: false,
            pointRadius: 0
          }
        ]
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: data.title || 'Substation Load Growth & Capacity Forecast (MVA)',
            font: { size: 16, weight: '700', family: FONT_FAMILY },
            color: COLORS.primary
          }
        },
        scales: {
          y: {
            title: { display: true, text: 'Peak Demand (MVA)', font: { size: 13, weight: '600' } },
            grid: { color: COLORS.gridLine },
            beginAtZero: true
          },
          x: {
            grid: { color: COLORS.gridLine }
          }
        }
      }
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ════════════════════════════════════════════════════════════════════════════

  /** Convert HEX colour to rgba string. */
  function hexToRgba(hex, alpha) {
    if (!hex || hex.startsWith('rgba') || hex.startsWith('rgb') || hex.startsWith('hsl')) {
      // Already a colour function — just return it (approximate)
      return hex;
    }
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /** Check if a number is a power of 10. */
  function isPowerOf10(value) {
    if (value <= 0) return false;
    const log = Math.log10(value);
    return Math.abs(log - Math.round(log)) < 1e-6;
  }

  /** Format a number using SI prefixes (k, M, etc.). */
  function formatSI(value) {
    if (value >= 1e6)  return (value / 1e6).toFixed(value >= 1e7 ? 0 : 1) + 'M';
    if (value >= 1e3)  return (value / 1e3).toFixed(value >= 1e4 ? 0 : 1) + 'k';
    if (value >= 1)    return value.toFixed(value >= 10 ? 0 : 1);
    if (value >= 0.001) return (value * 1e3).toFixed(1) + 'm';
    return value.toExponential(1);
  }

  /** Format with engineering unit. */
  function formatEngineering(value, unit) {
    return formatSI(value) + (unit ? ' ' + unit : '');
  }

  /** Format time in engineering-friendly way. */
  function formatTime(seconds) {
    if (seconds >= 60) return (seconds / 60).toFixed(2) + ' min';
    if (seconds >= 1)  return seconds.toFixed(3) + ' s';
    return (seconds * 1000).toFixed(1) + ' ms';
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════════════════════════════════════

  window.SubstationCharts = {
    // ── Chart factories ──
    createTCCCurve,
    createLoadProfile,
    createHarmonicSpectrum,
    createVoltageProfile,
    createGroundingGrid,
    createFaultCurrentChart,
    createReliabilityTrend,
    createReliabilityChart,
    createTransformerLoading,
    createSystemLossChart,
    createArcFlashChart,
    createLoadForecastChart,

    // ── Utility exports ──
    generateIDMTPoints,
    generateFusePoints,
    idmtTime,
    IDMT_CURVES,
    COLORS,

    // ── Helpers ──
    utils: {
      hexToRgba,
      isPowerOf10,
      formatSI,
      formatEngineering,
      formatTime,
      deepMerge,
    },
  };
})();
