// ============================================================
// Single Line Diagram (SLD) - Interactive SVG Renderer
// 10MVA Substation: 69kV / 13.2kV
// ============================================================

window.SubstationSLD = (function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  // Color scheme
  const COLORS = {
    hv: '#e74c3c',       // 69kV - Red
    mv: '#0066FF',       // 13.2kV - Blue
    ground: '#27ae60',   // Grounding - Green
    neutral: '#7f8c8d',  // Neutral
    text: '#1a1a2e',     // Text
    bg: '#ffffff',       // Background
    accent: '#f39c12',   // Warning/accent
    transformer: '#8e44ad', // Transformer
    breaker: '#2c3e50',  // Circuit breaker
    selected: '#0066FF',
  };

  // Equipment data store
  let equipmentData = {};

  function createSVGElement(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const [key, val] of Object.entries(attrs || {})) {
      el.setAttribute(key, val);
    }
    return el;
  }

  function addText(parent, x, y, text, opts = {}) {
    const t = createSVGElement('text', {
      x, y,
      'font-family': 'Inter, sans-serif',
      'font-size': opts.size || '11',
      'font-weight': opts.weight || '400',
      fill: opts.color || COLORS.text,
      'text-anchor': opts.anchor || 'middle',
      'dominant-baseline': opts.baseline || 'middle',
      class: opts.class || '',
    });
    t.textContent = text;
    parent.appendChild(t);
    return t;
  }

  function drawLine(parent, x1, y1, x2, y2, opts = {}) {
    return parent.appendChild(createSVGElement('line', {
      x1, y1, x2, y2,
      stroke: opts.color || COLORS.hv,
      'stroke-width': opts.width || '2.5',
      'stroke-linecap': 'round',
    }));
  }

  // ---- Circuit Breaker Symbol ----
  function drawCircuitBreaker(parent, cx, cy, label, color, data) {
    const g = createSVGElement('g', {
      class: 'sld-equipment sld-breaker',
      'data-type': 'breaker',
      'data-label': label,
      cursor: 'pointer',
    });

    // Breaker box
    const rect = createSVGElement('rect', {
      x: cx - 12, y: cy - 16,
      width: 24, height: 32,
      rx: 3,
      fill: '#fff',
      stroke: color,
      'stroke-width': '2',
    });
    g.appendChild(rect);

    // X inside
    drawLine(g, cx - 8, cy - 10, cx + 8, cy + 10, { color, width: '2' });
    drawLine(g, cx + 8, cy - 10, cx - 8, cy + 10, { color, width: '2' });

    // Label
    addText(g, cx + 22, cy, label, { size: '9', anchor: 'start', color: COLORS.text });

    // Store data
    equipmentData[label] = { type: 'Circuit Breaker', ...data };

    // Click handler
    g.addEventListener('click', () => showEquipmentInfo(label));
    g.addEventListener('mouseenter', () => rect.setAttribute('fill', '#eef5ff'));
    g.addEventListener('mouseleave', () => rect.setAttribute('fill', '#fff'));

    parent.appendChild(g);
    return g;
  }

  // ---- Disconnect Switch ----
  function drawDisconnect(parent, cx, cy, color) {
    const g = createSVGElement('g', { class: 'sld-disconnect' });
    // Fixed contact
    drawLine(g, cx, cy - 6, cx, cy + 6, { color, width: '3' });
    // Moving blade
    drawLine(g, cx, cy - 6, cx + 10, cy - 14, { color, width: '2.5' });
    parent.appendChild(g);
    return g;
  }

  // ---- Current Transformer ----
  function drawCT(parent, cx, cy, label, color) {
    const g = createSVGElement('g', {
      class: 'sld-equipment sld-ct',
      'data-type': 'ct',
      cursor: 'pointer',
    });

    // Two circles
    g.appendChild(createSVGElement('circle', {
      cx: cx, cy: cy - 5, r: 7,
      fill: 'none', stroke: color, 'stroke-width': '1.5',
    }));
    g.appendChild(createSVGElement('circle', {
      cx: cx, cy: cy + 5, r: 7,
      fill: 'none', stroke: color, 'stroke-width': '1.5',
    }));

    addText(g, cx + 14, cy, label, { size: '8', anchor: 'start', color: COLORS.neutral });

    equipmentData[label] = {
      type: 'Current Transformer',
      ratio: label.includes('HV') ? '100/5A' : '400/5A',
      class: 'C200',
      burden: '2.0 VA',
    };

    g.addEventListener('click', () => showEquipmentInfo(label));
    parent.appendChild(g);
    return g;
  }

  // ---- Potential Transformer ----
  function drawPT(parent, cx, cy, label, color) {
    const g = createSVGElement('g', {
      class: 'sld-equipment sld-pt',
      cursor: 'pointer',
    });

    // Two parallel lines with gap
    drawLine(g, cx - 8, cy - 6, cx - 8, cy + 6, { color, width: '2' });
    drawLine(g, cx - 4, cy - 6, cx - 4, cy + 6, { color, width: '2' });
    drawLine(g, cx + 4, cy - 6, cx + 4, cy + 6, { color, width: '2' });
    drawLine(g, cx + 8, cy - 6, cx + 8, cy + 6, { color, width: '2' });

    addText(g, cx, cy + 16, label, { size: '8', color: COLORS.neutral });

    equipmentData[label] = {
      type: 'Potential Transformer',
      ratio: label.includes('HV') ? '69kV/120V' : '13.2kV/120V',
      class: '0.3 WXYZ',
    };

    g.addEventListener('click', () => showEquipmentInfo(label));
    parent.appendChild(g);
    return g;
  }

  // ---- Surge Arrester ----
  function drawSurgeArrester(parent, cx, cy, label, color) {
    const g = createSVGElement('g', {
      class: 'sld-equipment sld-arrester',
      cursor: 'pointer',
    });

    // Arrester symbol - zigzag
    const points = [
      [cx, cy - 10],
      [cx - 6, cy - 3],
      [cx + 6, cy + 3],
      [cx, cy + 10],
    ];
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
    g.appendChild(createSVGElement('path', {
      d: pathData,
      fill: 'none',
      stroke: color,
      'stroke-width': '2',
    }));

    // Ground
    drawLine(g, cx - 6, cy + 12, cx + 6, cy + 12, { color: COLORS.ground, width: '2' });
    drawLine(g, cx - 4, cy + 15, cx + 4, cy + 15, { color: COLORS.ground, width: '1.5' });
    drawLine(g, cx - 2, cy + 18, cx + 2, cy + 18, { color: COLORS.ground, width: '1' });

    addText(g, cx + 14, cy, label, { size: '8', anchor: 'start', color: COLORS.neutral });

    equipmentData[label] = {
      type: 'Surge Arrester',
      rating: label.includes('HV') ? '60kV, 10kA' : '10.2kV, 10kA',
      mcov: label.includes('HV') ? '48kV' : '8.4kV',
    };

    g.addEventListener('click', () => showEquipmentInfo(label));
    parent.appendChild(g);
    return g;
  }

  // ---- Power Transformer ----
  function drawTransformer(parent, cx, cy, label) {
    const g = createSVGElement('g', {
      class: 'sld-equipment sld-transformer',
      cursor: 'pointer',
    });

    // Primary winding (top circle)
    g.appendChild(createSVGElement('circle', {
      cx: cx, cy: cy - 16, r: 22,
      fill: 'rgba(231,76,60,0.05)',
      stroke: COLORS.hv,
      'stroke-width': '2.5',
    }));

    // Secondary winding (bottom circle)
    g.appendChild(createSVGElement('circle', {
      cx: cx, cy: cy + 16, r: 22,
      fill: 'rgba(0,102,255,0.05)',
      stroke: COLORS.mv,
      'stroke-width': '2.5',
    }));

    // Dots for polarity
    g.appendChild(createSVGElement('circle', {
      cx: cx - 14, cy: cy - 22, r: 3,
      fill: COLORS.hv,
    }));
    g.appendChild(createSVGElement('circle', {
      cx: cx - 14, cy: cy + 10, r: 3,
      fill: COLORS.mv,
    }));

    // Label
    addText(g, cx + 32, cy - 10, 'T1', { size: '12', weight: '700', anchor: 'start', color: COLORS.transformer });
    addText(g, cx + 32, cy + 5, '10 MVA', { size: '9', anchor: 'start', color: COLORS.neutral });
    addText(g, cx + 32, cy + 18, '69/13.2 kV', { size: '9', anchor: 'start', color: COLORS.neutral });
    addText(g, cx + 32, cy + 31, 'Dyn1', { size: '9', anchor: 'start', color: COLORS.neutral });

    equipmentData['T1'] = {
      type: 'Power Transformer',
      rating: '10 MVA',
      voltage: '69kV / 13.2kV',
      connection: 'Delta-Wye Grounded (Dyn1)',
      impedance: '7.5%',
      xrRatio: '12',
      cooling: 'ONAN/ONAF',
      tapRange: '±5% (DETC)',
      noLoadLoss: '12.5 kW',
      loadLoss: '65 kW',
      manufacturer: 'As specified',
    };

    g.addEventListener('click', () => showEquipmentInfo('T1'));
    g.addEventListener('mouseenter', () => {
      g.querySelector('circle').setAttribute('stroke-width', '3.5');
    });
    g.addEventListener('mouseleave', () => {
      g.querySelector('circle').setAttribute('stroke-width', '2.5');
    });

    parent.appendChild(g);
    return g;
  }

  // ---- Ground Symbol ----
  function drawGround(parent, cx, cy) {
    const g = createSVGElement('g', { class: 'sld-ground' });
    drawLine(g, cx, cy, cx, cy + 8, { color: COLORS.ground, width: '2' });
    drawLine(g, cx - 8, cy + 8, cx + 8, cy + 8, { color: COLORS.ground, width: '2' });
    drawLine(g, cx - 5, cy + 12, cx + 5, cy + 12, { color: COLORS.ground, width: '1.5' });
    drawLine(g, cx - 2, cy + 16, cx + 2, cy + 16, { color: COLORS.ground, width: '1' });
    parent.appendChild(g);
    return g;
  }

  // ---- Bus Bar ----
  function drawBusBar(parent, x1, y1, x2, y2, label, color) {
    const g = createSVGElement('g', { class: 'sld-busbar' });

    g.appendChild(createSVGElement('line', {
      x1, y1, x2, y2,
      stroke: color,
      'stroke-width': '5',
      'stroke-linecap': 'round',
    }));

    const midX = (x1 + x2) / 2;
    addText(g, midX, y1 - 12, label, {
      size: '10',
      weight: '600',
      color: color,
    });

    parent.appendChild(g);
    return g;
  }

  // ---- Feeder with Recloser ----
  function drawFeeder(parent, cx, cy, label, data) {
    const g = createSVGElement('g', {
      class: 'sld-equipment sld-feeder',
      cursor: 'pointer',
    });

    // Vertical line down
    drawLine(g, cx, cy, cx, cy + 25, { color: COLORS.mv, width: '2' });

    // Recloser/breaker
    drawCircuitBreaker(g, cx, cy + 40, label, COLORS.mv, data);

    // Line down from breaker
    drawLine(g, cx, cy + 56, cx, cy + 75, { color: COLORS.mv, width: '2' });

    // CT
    drawCT(g, cx, cy + 82, `CT-${label}`, COLORS.mv);

    // Line to load arrow
    drawLine(g, cx, cy + 92, cx, cy + 115, { color: COLORS.mv, width: '2' });

    // Arrow head (load direction)
    const arrowY = cy + 115;
    g.appendChild(createSVGElement('polygon', {
      points: `${cx},${arrowY + 8} ${cx - 5},${arrowY} ${cx + 5},${arrowY}`,
      fill: COLORS.mv,
    }));

    // Feeder label
    addText(g, cx, cy + 132, `Feeder ${label.replace('F', '')}`, {
      size: '10',
      weight: '600',
      color: COLORS.mv,
    });

    parent.appendChild(g);
    return g;
  }

  // ---- Show Equipment Info Popup ----
  function showEquipmentInfo(label) {
    const data = equipmentData[label];
    if (!data) return;

    // Remove existing popup
    const existing = document.getElementById('sld-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'sld-popup';
    popup.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: white; border-radius: 12px; padding: 24px; min-width: 320px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15); z-index: 10000;
      font-family: Inter, sans-serif; animation: fadeInScale 0.2s ease;
    `;

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="margin:0; color:#1a1a2e; font-size:16px;">${label}</h3>
        <button onclick="this.closest('#sld-popup').remove()" style="
          border:none; background:#f0f0f0; border-radius:50%; width:28px; height:28px;
          cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center;
        ">✕</button>
      </div>
      <div style="background:#f8f9fa; border-radius:8px; padding:12px;">
    `;

    for (const [key, val] of Object.entries(data)) {
      const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      html += `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eee;">
        <span style="color:#666; font-size:13px;">${formattedKey}</span>
        <span style="color:#1a1a2e; font-weight:500; font-size:13px;">${val}</span>
      </div>`;
    }

    html += '</div>';
    popup.innerHTML = html;

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'sld-backdrop';
    backdrop.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.3); z-index: 9999;
    `;
    backdrop.addEventListener('click', () => {
      popup.remove();
      backdrop.remove();
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(popup);
  }

  // ============================================================
  // MAIN RENDER FUNCTION
  // ============================================================
  function render(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    equipmentData = {};

    const width = 800;
    const height = 700;

    const svg = createSVGElement('svg', {
      viewBox: `0 0 ${width} ${height}`,
      width: '100%',
      height: '100%',
      style: 'max-width:800px; margin:0 auto; display:block;',
    });

    // Background
    svg.appendChild(createSVGElement('rect', {
      x: 0, y: 0, width, height,
      fill: COLORS.bg, rx: '8',
    }));

    // Title
    addText(svg, width / 2, 20, '10 MVA SUBSTATION SINGLE LINE DIAGRAM', {
      size: '14', weight: '700', color: COLORS.text,
    });
    addText(svg, width / 2, 36, '69kV / 13.2kV — Delta-Wye Grounded', {
      size: '10', weight: '400', color: COLORS.neutral,
    });

    const centerX = width / 2;

    // ============ UTILITY SOURCE ============
    addText(svg, centerX, 58, 'UTILITY SOURCE (NGCP)', {
      size: '11', weight: '600', color: COLORS.hv,
    });
    addText(svg, centerX, 72, '69 kV, 3φ, 60 Hz', {
      size: '9', color: COLORS.neutral,
    });

    // Incoming line
    drawLine(svg, centerX, 80, centerX, 100, { color: COLORS.hv });

    // ============ 69kV SURGE ARRESTER ============
    drawSurgeArrester(svg, centerX - 40, 95, 'SA-HV', COLORS.hv);
    drawLine(svg, centerX - 40, 85, centerX, 85, { color: COLORS.hv, width: '1.5' });

    // ============ HV METERING PT ============
    drawPT(svg, centerX + 50, 95, 'PT-HV', COLORS.hv);
    drawLine(svg, centerX, 95, centerX + 42, 95, { color: COLORS.hv, width: '1.5' });

    // ============ HV DISCONNECT SWITCH ============
    drawLine(svg, centerX, 100, centerX, 115, { color: COLORS.hv });
    addText(svg, centerX + 20, 110, 'DS-1', { size: '8', anchor: 'start', color: COLORS.neutral });

    // ============ HV CT ============
    drawLine(svg, centerX, 120, centerX, 135, { color: COLORS.hv });
    drawCT(svg, centerX, 142, 'CT-HV', COLORS.hv);

    // ============ HV CIRCUIT BREAKER ============
    drawLine(svg, centerX, 152, centerX, 165, { color: COLORS.hv });
    drawCircuitBreaker(svg, centerX, 180, 'CB-HV', COLORS.hv, {
      rating: '1200A, 40kA',
      type: 'SF6 Gas Circuit Breaker',
      voltage: '72.5 kV',
      mechanism: 'Spring operated',
    });

    // ============ LINE TO TRANSFORMER ============
    drawLine(svg, centerX, 196, centerX, 230, { color: COLORS.hv });

    // ============ POWER TRANSFORMER ============
    drawTransformer(svg, centerX, 268, 'T1');

    // ============ NEUTRAL GROUNDING ============
    // Line from transformer neutral to ground
    drawLine(svg, centerX + 22, 290, centerX + 60, 290, { color: COLORS.ground, width: '1.5' });
    drawLine(svg, centerX + 60, 290, centerX + 60, 310, { color: COLORS.ground, width: '1.5' });

    // NGR (Neutral Grounding Resistor)
    const ngrX = centerX + 60;
    const ngrY = 318;
    const ngrG = createSVGElement('g', { class: 'sld-equipment', cursor: 'pointer' });
    // Zigzag resistor
    const zigzag = `M${ngrX},${ngrY - 8} l4,4 l-8,4 l8,4 l-8,4 l4,4`;
    ngrG.appendChild(createSVGElement('path', {
      d: zigzag, fill: 'none', stroke: COLORS.ground, 'stroke-width': '1.5',
    }));
    addText(ngrG, ngrX + 18, ngrY, 'NGR', { size: '8', anchor: 'start', color: COLORS.ground });
    svg.appendChild(ngrG);
    drawGround(svg, ngrX, ngrY + 10);

    equipmentData['NGR'] = {
      type: 'Neutral Grounding Resistor',
      rating: '400A, 10s',
      resistance: '19.05 Ω',
      voltage: '7.62 kV',
    };
    ngrG.addEventListener('click', () => showEquipmentInfo('NGR'));

    // ============ LINE FROM TRANSFORMER TO MV BUS ============
    drawLine(svg, centerX, 290, centerX, 340, { color: COLORS.mv });

    // ============ MV CT ============
    drawCT(svg, centerX, 348, 'CT-MV', COLORS.mv);

    // ============ MV MAIN BREAKER ============
    drawLine(svg, centerX, 358, centerX, 370, { color: COLORS.mv });
    drawCircuitBreaker(svg, centerX, 385, 'CB-MV', COLORS.mv, {
      rating: '600A, 25kA',
      type: 'Vacuum Circuit Breaker',
      voltage: '15 kV',
      mechanism: 'Spring operated',
    });

    // ============ MV SURGE ARRESTER ============
    drawSurgeArrester(svg, centerX - 50, 385, 'SA-MV', COLORS.mv);
    drawLine(svg, centerX - 50, 375, centerX - 12, 375, { color: COLORS.mv, width: '1.5' });

    // ============ MV PT ============
    drawPT(svg, centerX + 60, 385, 'PT-MV', COLORS.mv);
    drawLine(svg, centerX + 12, 385, centerX + 52, 385, { color: COLORS.mv, width: '1.5' });

    // ============ LINE TO BUS ============
    drawLine(svg, centerX, 401, centerX, 430, { color: COLORS.mv });

    // ============ 13.2kV BUS ============
    const busY = 435;
    const busLeft = centerX - 200;
    const busRight = centerX + 200;
    drawBusBar(svg, busLeft, busY, busRight, busY, '13.2 kV BUS', COLORS.mv);

    // ============ FEEDERS ============
    const feederCount = 4;
    const feederSpacing = (busRight - busLeft) / (feederCount + 1);

    const feederData = [
      { label: 'F1', area: 'Bangued, Peñarrubia', load: '2.5 MW', relay: 'SEL-351' },
      { label: 'F2', area: 'Pidigan, San Isidro', load: '2.8 MW', relay: 'SEL-351' },
      { label: 'F3', area: 'Dolores, Lagangilang', load: '2.2 MW', relay: 'SEL-351' },
      { label: 'F4', area: 'Tayum, Bucay', load: '2.5 MW', relay: 'SEL-351' },
    ];

    feederData.forEach((fd, i) => {
      const fx = busLeft + feederSpacing * (i + 1);

      // Tap from bus
      drawLine(svg, fx, busY, fx, busY + 10, { color: COLORS.mv, width: '2' });

      drawFeeder(svg, fx, busY + 10, fd.label, {
        serviceArea: fd.area,
        peakLoad: fd.load,
        protectionRelay: fd.relay,
        recloserType: '3-phase electronic',
      });
    });

    // ============ CAPACITOR BANK (on bus) ============
    const capX = busRight - 30;
    const capG = createSVGElement('g', {
      class: 'sld-equipment',
      cursor: 'pointer',
    });
    drawLine(capG, capX, busY, capX, busY + 20, { color: COLORS.mv, width: '1.5' });
    // Cap symbol - two parallel lines
    drawLine(capG, capX - 8, busY + 22, capX + 8, busY + 22, { color: COLORS.mv, width: '2' });
    drawLine(capG, capX - 8, busY + 26, capX + 8, busY + 26, { color: COLORS.mv, width: '2' });
    drawGround(capG, capX, busY + 28);
    addText(capG, capX, busY + 50, 'Cap Bank', { size: '8', color: COLORS.neutral });
    addText(capG, capX, busY + 62, '1.2 MVAR', { size: '8', color: COLORS.neutral });
    svg.appendChild(capG);

    equipmentData['Cap Bank'] = {
      type: 'Capacitor Bank',
      rating: '1.2 MVAR',
      voltage: '13.2 kV',
      steps: '2 × 600 kVAR',
      connection: 'Wye-grounded',
    };
    capG.addEventListener('click', () => showEquipmentInfo('Cap Bank'));

    // ============ STATION SERVICE TRANSFORMER ============
    const ssX = busLeft + 30;
    const ssG = createSVGElement('g', {
      class: 'sld-equipment',
      cursor: 'pointer',
    });
    drawLine(ssG, ssX, busY, ssX, busY + 18, { color: COLORS.mv, width: '1.5' });
    // Small transformer circles
    ssG.appendChild(createSVGElement('circle', {
      cx: ssX, cy: busY + 24, r: 8,
      fill: 'none', stroke: COLORS.mv, 'stroke-width': '1.5',
    }));
    ssG.appendChild(createSVGElement('circle', {
      cx: ssX, cy: busY + 36, r: 8,
      fill: 'none', stroke: COLORS.accent, 'stroke-width': '1.5',
    }));
    addText(ssG, ssX, busY + 54, 'SST', { size: '8', color: COLORS.neutral });
    addText(ssG, ssX, busY + 66, '50 kVA', { size: '8', color: COLORS.neutral });
    svg.appendChild(ssG);

    equipmentData['SST'] = {
      type: 'Station Service Transformer',
      rating: '50 kVA',
      voltage: '13.2kV / 230V',
      impedance: '4%',
      cooling: 'ONAN',
    };
    ssG.addEventListener('click', () => showEquipmentInfo('SST'));

    // ============ LEGEND ============
    const legendY = height - 60;
    addText(svg, 30, legendY, 'LEGEND:', { size: '9', weight: '600', anchor: 'start', color: COLORS.text });

    const legends = [
      { color: COLORS.hv, label: '69 kV (HV)' },
      { color: COLORS.mv, label: '13.2 kV (MV)' },
      { color: COLORS.ground, label: 'Grounding' },
      { color: COLORS.transformer, label: 'Transformer' },
    ];

    legends.forEach((leg, i) => {
      const lx = 30 + i * 140;
      drawLine(svg, lx, legendY + 16, lx + 20, legendY + 16, { color: leg.color, width: '3' });
      addText(svg, lx + 28, legendY + 16, leg.label, { size: '9', anchor: 'start', color: COLORS.text });
    });

    // ============ NOTES ============
    addText(svg, width / 2, height - 16, 'Click any equipment for detailed specifications', {
      size: '9', color: COLORS.neutral, weight: '400',
    });

    container.appendChild(svg);
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  return {
    render,
    getEquipmentData: () => ({ ...equipmentData }),
    showEquipmentInfo,
  };
})();
