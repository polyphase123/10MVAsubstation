// ============================================================
// SubStation Designer Pro — Main Application Controller
// 10MVA Substation Design Tool
// ============================================================

window.App = (function () {
  'use strict';

  // ---- State ----
  let activeModule = 'dashboard';
  let projectData = {};
  let chartInstances = {};
  function destroyChart(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy ? chartInstances[id].destroy() : null;
      delete chartInstances[id];
    }
  }

  // ---- Default Project Parameters ----
  const DEFAULTS = {
    project: {
      name: '10 MVA Substation Design',
      location: 'Abra',
      engineer: 'Franz Xyrlo I. Tobias, PEE',
      date: new Date().toLocaleDateString(),
      standard: 'IEEE / PEC 2017',
    },
    system: {
      mvaRating: 10,
      hvVoltage: 69,
      mvVoltage: 13.2,
      frequency: 60,
      phases: 3,
      powerFactor: 0.95,
      connection: 'Dyn1',
    },
    transformer: {
      rating: 10,
      hvVoltage: 69,
      lvVoltage: 13.2,
      impedancePercent: 7.5,
      xrRatio: 12,
      noLoadLoss: 12.5,
      loadLoss: 65,
      tapRange: 5,
      cooling: 'ONAN/ONAF',
    },
    utility: {
      faultMVA: 1500,
      faultCurrent: 12.55,
      xrRatio: 15,
      voltage: 69,
    },
    grounding: {
      soilResistivity: 100,
      surfaceResistivity: 3000,
      surfaceThickness: 0.15,
      faultDuration: 0.5,
      gridLength: 40,
      gridWidth: 30,
      meshSpacingX: 5,
      meshSpacingY: 5,
      conductorDepth: 0.6,
      conductorDiameter: 0.01,
      numGroundRods: 20,
      rodLength: 3,
      rodDiameter: 0.016,
      gridCurrent: 3000,
    },
  };

  // ---- Initialize ----
  function init() {
    loadProjectData();
    setupNavigation();
    setupMobileMenu();
    setupModuleForms();
    showModule('dashboard');
    updateDashboard();
    renderSLD();
    setupThemeToggle();
    showToast('SubStation Designer Pro loaded successfully', 'success');
  }

  // ---- Navigation ----
  function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const module = link.dataset.module;
        if (module) {
          showModule(module);
          // Close mobile menu
          document.querySelector('.sidebar')?.classList.remove('open');
          document.querySelector('.sidebar-overlay')?.classList.remove('active');
        }
      });
    });
  }

  function showModule(moduleId) {
    // Update nav
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.module === moduleId);
    });

    // Update content
    document.querySelectorAll('.module-section').forEach(section => {
      section.classList.toggle('active', section.id === `module-${moduleId}`);
    });

    activeModule = moduleId;

    // Trigger module-specific init
    requestAnimationFrame(() => {
      if (moduleId === 'sld') renderSLD();
      if (moduleId === 'dashboard') updateDashboard();
    });
  }

  // ---- Mobile Menu ----
  function setupMobileMenu() {
    const hamburger = document.getElementById('hamburger-btn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (hamburger) {
      hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
      });
    }
  }

  // ---- Theme Toggle ----
  function setupThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        toggle.innerHTML = isDark ? '☀️' : '🌙';
      });
    }
  }

  // ---- Dashboard ----
  function updateDashboard() {
    const d = DEFAULTS;
    setTextContent('dash-mva', `${d.system.mvaRating} MVA`);
    setTextContent('dash-hv', `${d.system.hvVoltage} kV`);
    setTextContent('dash-mv', `${d.system.mvVoltage} kV`);
    setTextContent('dash-pf', d.system.powerFactor);

    // Calculate derived values
    const hvCurrent = (d.system.mvaRating * 1000) / (Math.sqrt(3) * d.system.hvVoltage);
    const mvCurrent = (d.system.mvaRating * 1000) / (Math.sqrt(3) * d.system.mvVoltage);
    const faultCurrent = mvCurrent / (d.transformer.impedancePercent / 100);

    setTextContent('dash-hv-current', `${hvCurrent.toFixed(1)} A`);
    setTextContent('dash-mv-current', `${mvCurrent.toFixed(1)} A`);
    setTextContent('dash-fault', `${(faultCurrent / 1000).toFixed(2)} kA`);
    setTextContent('dash-impedance', `${d.transformer.impedancePercent}%`);

    // Render dashboard charts
    renderDashboardCharts();
  }

  function renderDashboardCharts() {
    if (typeof SubstationCharts === 'undefined') return;

    // Load profile
    try {
      destroyChart('dash-load-chart');
      chartInstances['dash-load-chart'] = SubstationCharts.createLoadProfile('dash-load-chart', {
        feeders: [
          {
            label: 'Feeder 1',
            mw: [2.2, 2.1, 2.0, 2.0, 2.1, 2.3, 2.5, 2.8, 3.0, 3.2, 3.4, 3.5, 3.4, 3.3, 3.1, 2.9, 2.8, 2.7, 3.0, 3.2, 3.1, 2.9, 2.6, 2.3],
            mvar: [0.73, 0.69, 0.66, 0.66, 0.69, 0.76, 0.82, 0.92, 0.99, 1.05, 1.12, 1.15, 1.12, 1.09, 1.02, 0.95, 0.92, 0.89, 0.99, 1.05, 1.02, 0.95, 0.86, 0.76],
          },
          {
            label: 'Feeder 2',
            mw: [1.8, 1.7, 1.6, 1.6, 1.7, 1.9, 2.2, 2.5, 2.8, 3.0, 3.1, 3.1, 3.0, 2.9, 2.7, 2.5, 2.4, 2.3, 2.6, 2.8, 2.7, 2.5, 2.2, 1.9],
            mvar: [0.59, 0.56, 0.53, 0.53, 0.56, 0.63, 0.72, 0.82, 0.92, 0.99, 1.02, 1.02, 0.99, 0.95, 0.89, 0.82, 0.79, 0.76, 0.86, 0.92, 0.89, 0.82, 0.72, 0.63],
          },
          {
            label: 'Feeder 3',
            mw: [1.5, 1.4, 1.3, 1.3, 1.4, 1.5, 1.7, 1.9, 2.0, 2.1, 2.2, 2.2, 2.1, 2.0, 1.9, 1.8, 1.7, 1.6, 1.8, 2.0, 1.9, 1.8, 1.6, 1.4],
            mvar: [0.49, 0.46, 0.43, 0.43, 0.46, 0.49, 0.56, 0.63, 0.66, 0.69, 0.72, 0.72, 0.69, 0.66, 0.63, 0.59, 0.56, 0.53, 0.59, 0.66, 0.63, 0.59, 0.53, 0.46],
          },
          {
            label: 'Feeder 4',
            mw: [1.3, 1.2, 1.1, 1.1, 1.2, 1.3, 1.5, 1.7, 1.8, 1.9, 2.0, 2.0, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.6, 1.8, 1.7, 1.6, 1.4, 1.2],
            mvar: [0.43, 0.40, 0.36, 0.36, 0.40, 0.43, 0.49, 0.56, 0.59, 0.63, 0.66, 0.66, 0.63, 0.59, 0.56, 0.53, 0.49, 0.46, 0.53, 0.59, 0.56, 0.53, 0.46, 0.40],
          },
        ],
      });
    } catch (e) { /* Charts not loaded yet */ }

    // Transformer loading gauge
    try {
      destroyChart('dash-loading-chart');
      chartInstances['dash-loading-chart'] = SubstationCharts.createTransformerLoading('dash-loading-chart', {
        loadPercent: 72,
        transformerName: 'T1 — 10 MVA ONAN/ONAF',
      });
    } catch (e) { /* Charts not loaded yet */ }
  }

  // ---- Module Form Setup ----
  function setupModuleForms() {
    // Attach calculate buttons
    document.querySelectorAll('[data-calc]').forEach(btn => {
      btn.addEventListener('click', () => {
        const calcType = btn.dataset.calc;
        runCalculation(calcType);
      });
    });

    // Live calculation on input change for some modules
    document.querySelectorAll('.auto-calc').forEach(input => {
      input.addEventListener('input', debounce(() => {
        const calcType = input.closest('.module-section')?.dataset?.calc;
        if (calcType) runCalculation(calcType);
      }, 500));
    });

    // Populate default values
    populateDefaults();

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabGroup = btn.closest('.tab-group');
        const targetTab = btn.dataset.tab;

        tabGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        tabGroup.closest('.module-section').querySelectorAll('.tab-panel').forEach(panel => {
          panel.classList.toggle('active', panel.id === targetTab);
        });
      });
    });

    // Dynamic visibility for Voltage Regulator inputs
    const regTypeSelect = document.getElementById('vd-reg-type');
    const tfGroup = document.getElementById('vd-transformer-mva-group');
    const connSelect = document.getElementById('vd-connection-type');
    if (regTypeSelect) {
      const toggleFields = () => {
        const isLtc = regTypeSelect.value === 'ltc';
        if (tfGroup) tfGroup.style.display = isLtc ? 'block' : 'none';
        if (connSelect) {
          const connGroup = connSelect.closest('.form-group');
          if (connGroup) connGroup.style.display = isLtc ? 'none' : 'block';
        }
      };
      regTypeSelect.addEventListener('change', toggleFields);
      // Run once
      toggleFields();
    }
  }

  function populateDefaults() {
    // Transformer
    setInputValue('tf-rating', DEFAULTS.transformer.rating);
    setInputValue('tf-hv', DEFAULTS.transformer.hvVoltage);
    setInputValue('tf-lv', DEFAULTS.transformer.lvVoltage);
    setInputValue('tf-impedance', DEFAULTS.transformer.impedancePercent);
    setInputValue('tf-xr', DEFAULTS.transformer.xrRatio);
    setInputValue('tf-nll', DEFAULTS.transformer.noLoadLoss);
    setInputValue('tf-ll', DEFAULTS.transformer.loadLoss);

    // Utility source
    setInputValue('util-fault-mva', DEFAULTS.utility.faultMVA);
    setInputValue('util-xr', DEFAULTS.utility.xrRatio);
    setInputValue('util-voltage', DEFAULTS.utility.voltage);

    // Grounding
    Object.entries(DEFAULTS.grounding).forEach(([key, val]) => {
      setInputValue(`gnd-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, val);
    });

    // Protection
    setInputValue('prot-pickup', 400);
    setInputValue('prot-tms', 0.3);
    setInputValue('prot-ct-ratio', 400);
    setInputValue('prot-curve', 'SI');

    // Harmonics
    setInputValue('harm-isc', 5000);
    setInputValue('harm-il', 400);
    setInputValue('harm-voltage', 13.2);
  }

  // ---- Run Calculations ----
  function runCalculation(type) {
    if (typeof SubstationCalc === 'undefined') {
      showToast('Calculation engine not loaded', 'error');
      return;
    }

    const resultContainer = document.getElementById(`result-${type}`);
    if (resultContainer) {
      resultContainer.innerHTML = '<div class="calc-loading"><div class="spinner"></div>Calculating...</div>';
    }

    setTimeout(() => {
      try {
        let result;
        switch (type) {
          case 'fault':
            result = runFaultCalc();
            break;
          case 'loadflow':
            result = runLoadFlowCalc();
            break;
          case 'grounding':
            result = runGroundingCalc();
            break;
          case 'protection':
            result = runProtectionCalc();
            break;
          case 'harmonics':
            result = runHarmonicsCalc();
            break;
          case 'transformer':
            result = runTransformerCalc();
            break;
          case 'arcflash':
            result = runArcFlashCalc();
            break;
          case 'cable':
            result = runCableSizingCalc();
            break;
          case 'insulation':
            result = runInsulationCalc();
            break;
          case 'reliability':
            result = runReliabilityCalc();
            break;
          case 'ctpt':
            result = runCTPTCalc();
            break;
          case 'differential':
            result = runDifferentialCalc();
            break;
          case 'busbar':
            result = runBusBarCalc();
            break;
          case 'voltagedrop':
            result = runVoltageDropCalc();
            break;
          case 'systemloss':
            result = runSystemLossCalc();
            break;
          case 'forecast':
            result = runForecastCalc();
            break;
          case 'sequence':
            result = runSequenceCalc();
            break;
          case 'cost':
            result = runCostCalc();
            break;
          case 'motorstarting':
            result = runMotorStartingCalc();
            break;
          case 'clearance':
            result = runClearanceCalc();
            break;
          case 'battery':
            result = runBatteryCalc();
            break;
          case 'shielding':
            result = runShieldingCalc();
            break;
          case 'filter':
            result = runFilterCalc();
            break;
          case 'dcload':
            result = runDcloadCalc();
            break;
          case 'resonance':
            result = runResonanceCalc();
            break;
          case 'dga':
            result = runDgaCalc();
            break;
          case 'capovervoltage':
            result = runCapovervoltageCalc();
            break;
          case 'lighting':
            result = runLightingCalc();
            break;
          case 'ctsaturation':
            result = runCtsaturationCalc();
            break;
          case 'sound':
            result = runSoundCalc();
            break;
          case 'insulator':
            result = runInsulatorCalc();
            break;
          case 'acdemand':
            result = runAcdemandCalc();
            break;
          case 'arrester':
            result = runArresterCalc();
            break;
          case 'firebarrier':
            result = runFirebarrierCalc();
            break;
          case 'fencegpr':
            result = runFencegprCalc();
            break;
          case 'gissf6':
            result = runGissf6Calc();
            break;
          case 'busbardefl':
            result = runBusbardeflCalc();
            break;
          case 'trench':
            result = runTrenchCalc();
            break;
          case 'ageing':
            result = runAgeingCalc();
            break;
          default:
            showToast(`Unknown calculation type: ${type}`, 'error');
            return;
        }

        if (result && resultContainer) {
          displayResult(resultContainer, result, type);
        }
        showToast(`${formatCalcName(type)} completed`, 'success');
      } catch (err) {
        console.error(`Calculation error [${type}]:`, err);
        if (resultContainer) {
          resultContainer.innerHTML = `<div class="calc-error">
            <span class="error-icon">⚠️</span>
            <span>Calculation error: ${err.message}</span>
          </div>`;
        }
        showToast(`Error in ${formatCalcName(type)}`, 'error');
      }
    }, 300);
  }

  // ---- Individual Calculation Runners ----
  function runFaultCalc() {
    const params = {
      systemMVA: getInputNum('tf-rating'),
      hvVoltage: getInputNum('tf-hv'),
      lvVoltage: getInputNum('tf-lv'),
      transformerZ: getInputNum('tf-impedance') / 100,
      xrRatio: getInputNum('tf-xr'),
      utilityFaultMVA: getInputNum('util-fault-mva'),
      utilityXR: getInputNum('util-xr'),
    };
    const result = SubstationCalc.faultAnalysis(params);

    if (typeof SubstationCharts !== 'undefined') {
      try {
        destroyChart('fault-chart');
        chartInstances['fault-chart'] = SubstationCharts.createFaultCurrentChart('fault-chart', {
          buses: result.buses,
          title: 'Bolted Fault Current Profiles (A)'
        });
      } catch (e) {
        console.warn('Fault current chart error:', e);
      }
    }

    return result;
  }

  function runLoadFlowCalc() {
    const baseMVA = getInputNum('lf-base-mva') || getInputNum('tf-rating') || 10;
    const buses = [
      { name: 'Utility', voltage: 69, type: 'slack', pGen: 0, qGen: 0 },
      { name: 'HV Bus', voltage: 69, type: 'PQ', pLoad: 0, qLoad: 0 },
      { name: 'MV Bus', voltage: 13.2, type: 'PQ', pLoad: 0, qLoad: 0 }
    ];
    const lines = [
      { from: 0, to: 1, r: 0.001, x: 0.01 },
      { from: 1, to: 2, r: 0.005, x: 0.075 }
    ];

    const feederLoads = [
      { p: 2.5, q: 0.73 }, // Feeder 1
      { p: 2.8, q: 0.82 }, // Feeder 2
      { p: 2.2, q: 0.65 }, // Feeder 3
      { p: 2.0, q: 0.59 }  // Feeder 4
    ];

    let busIdx = 3;
    for (let f = 0; f < 4; f++) {
      const pPerBus = feederLoads[f].p / 10;
      const qPerBus = feederLoads[f].q / 10;
      for (let b = 1; b <= 10; b++) {
        buses.push({
          name: `Feeder ${f + 1} Bus ${b}`,
          voltage: 13.2,
          type: 'PQ',
          pLoad: Number(pPerBus.toFixed(3)),
          qLoad: Number(qPerBus.toFixed(3))
        });

        // Radial connections
        if (b === 1) {
          lines.push({ from: 2, to: busIdx, r: 0.004, x: 0.008 });
        } else {
          lines.push({ from: busIdx - 1, to: busIdx, r: 0.003, x: 0.006 });
        }
        busIdx++;
      }
    }

    return SubstationCalc.loadFlow({
      buses,
      lines,
      baseMVA
    });
  }

  function runGroundingCalc() {
    const g = DEFAULTS.grounding;
    const result = SubstationCalc.groundingDesign({
      soilResistivity: getInputNum('gnd-soil-resistivity') || g.soilResistivity,
      surfaceResistivity: getInputNum('gnd-surface-resistivity') || g.surfaceResistivity,
      surfaceThickness: getInputNum('gnd-surface-thickness') || g.surfaceThickness,
      faultDuration: getInputNum('gnd-fault-duration') || g.faultDuration,
      gridLength: getInputNum('gnd-grid-length') || g.gridLength,
      gridWidth: getInputNum('gnd-grid-width') || g.gridWidth,
      meshSpacingX: getInputNum('gnd-mesh-spacingx') || g.meshSpacingX,
      meshSpacingY: getInputNum('gnd-mesh-spacingy') || g.meshSpacingY,
      conductorDepth: getInputNum('gnd-conductor-depth') || g.conductorDepth,
      conductorDiameter: getInputNum('gnd-conductor-diameter') || g.conductorDiameter,
      numGroundRods: getInputNum('gnd-num-ground-rods') || g.numGroundRods,
      rodLength: getInputNum('gnd-rod-length') || g.rodLength,
      gridCurrent: getInputNum('gnd-grid-current') || g.gridCurrent,
      soilResistivityLower: getInputNum('gnd-soil-resistivity-lower') || 500,
      soilTopLayerThickness: getInputNum('gnd-soil-thickness') || 1.0,
      bodyWeight: getInputNum('gnd-body-weight') || 50,
    });

    if (typeof SubstationCharts !== 'undefined') {
      try {
        const rods = [];
        const nRods = getInputNum('gnd-num-ground-rods') || g.numGroundRods;
        const gridW = getInputNum('gnd-grid-width') || g.gridWidth;
        const gridL = getInputNum('gnd-grid-length') || g.gridLength;
        const meshSpacingX = getInputNum('gnd-mesh-spacingx') || g.meshSpacingX;
        const meshSpacingY = getInputNum('gnd-mesh-spacingy') || g.meshSpacingY;

        // Distribute rods along perimeter
        for (let i = 0; i < nRods; i++) {
          const t = i / nRods;
          let rx = 0, ry = 0;
          if (t < 0.25) {
            rx = t * 4 * gridL;
            ry = 0;
          } else if (t < 0.5) {
            rx = gridL;
            ry = (t - 0.25) * 4 * gridW;
          } else if (t < 0.75) {
            rx = gridL - (t - 0.5) * 4 * gridL;
            ry = gridW;
          } else {
            rx = 0;
            ry = gridW - (t - 0.75) * 4 * gridW;
          }
          rods.push({ x: rx, y: ry });
        }

        // Simulate 10x10 heat map potential data
        const potentialData = [];
        for (let r = 0; r < 10; r++) {
          const row = [];
          for (let c = 0; c < 10; c++) {
            const x = c / 9;
            const y = r / 9;
            const dist = Math.sqrt((x - 0.5) * (x - 0.5) + (y - 0.5) * (y - 0.5)) * Math.sqrt(2);
            row.push(dist * (result.summary.status === 'success' ? 400 : 900));
          }
          potentialData.push(row);
        }

        destroyChart('grounding-grid-chart');
        chartInstances['grounding-grid-chart'] = SubstationCharts.createGroundingGrid('grounding-grid-chart', {
          gridWidth: gridL,
          gridHeight: gridW,
          meshSpacingX: meshSpacingX,
          meshSpacingY: meshSpacingY,
          rods: rods,
          potentialData: potentialData,
          maxPotential: result.summary.status === 'success' ? 600 : 1200,
          title: 'Grounding Grid Layout & Potential Contour Heatmap'
        });
      } catch (e) {
        console.warn('Grounding grid chart error:', e);
      }
    }

    return result;
  }

  function runProtectionCalc() {
    const pickup = getInputNum('prot-pickup') || 400;
    const tms = getInputNum('prot-tms') || 0.3;
    const ctRatio = getInputNum('prot-ct-ratio') || 400;
    const curveSelect = document.getElementById('prot-curve');
    const curveType = curveSelect ? curveSelect.value : 'SI';

    const result = SubstationCalc.protectionCoordination({
      pickupCurrent: pickup,
      tms: tms,
      curveType: curveType,
      ctRatio: ctRatio,
      faultCurrents: [500, 1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000],
    });

    // Draw TCC curve
    if (typeof SubstationCharts !== 'undefined') {
      try {
        destroyChart('tcc-chart');
        chartInstances['tcc-chart'] = SubstationCharts.createTCCCurve('tcc-chart', {
          relays: [
            { name: 'Main (SI)', curveType: 'SI', tms: tms, pickup: pickup },
            { name: 'Backup (VI)', curveType: 'VI', tms: 0.2, pickup: pickup * 0.8 },
            { name: 'Feeder (EI)', curveType: 'EI', tms: 0.15, pickup: pickup * 0.6 },
          ],
        });
      } catch (e) { console.warn('TCC chart error:', e); }
    }

    return result;
  }

  function runHarmonicsCalc() {
    const result = SubstationCalc.harmonicsAnalysis({
      iscRms: getInputNum('harm-isc') || 5000,
      iLoadMax: getInputNum('harm-il') || 400,
      voltage: getInputNum('harm-voltage') || 13.2,
      harmonics: [
        { order: 1, magnitude: 1.0 },
        { order: 3, magnitude: 0.015 },
        { order: 5, magnitude: 0.12 },
        { order: 7, magnitude: 0.085 },
        { order: 11, magnitude: 0.045 },
        { order: 13, magnitude: 0.03 },
        { order: 17, magnitude: 0.02 },
        { order: 19, magnitude: 0.015 },
        { order: 23, magnitude: 0.01 },
        { order: 25, magnitude: 0.008 },
      ],
    });

    // Draw spectrum chart
    if (typeof SubstationCharts !== 'undefined') {
      try {
        // Extract THD and TDD from result
        let thdVal = 0, tddVal = 0;
        if (result.keyResults) {
          result.keyResults.forEach(kr => {
            if (kr.label.includes('THD')) thdVal = parseFloat(kr.value) || 0;
            if (kr.label.includes('TDD')) tddVal = parseFloat(kr.value) || 0;
          });
        }

        destroyChart('harmonics-chart');
        chartInstances['harmonics-chart'] = SubstationCharts.createHarmonicSpectrum('harmonics-chart', {
          harmonics: [
            { order: 1, magnitude: 100 },
            { order: 3, magnitude: 1.5 },
            { order: 5, magnitude: 12.0 },
            { order: 7, magnitude: 8.5 },
            { order: 11, magnitude: 4.5 },
            { order: 13, magnitude: 3.0 },
            { order: 17, magnitude: 2.0 },
            { order: 19, magnitude: 1.5 },
            { order: 23, magnitude: 1.0 },
            { order: 25, magnitude: 0.8 },
          ],
          ieee519Limits: {
            odd: { '3-11': 4.0, '11-17': 2.0, '17-23': 1.5, '23-35': 0.6, '35+': 0.3 },
            even: 1.0,
          },
          thdPercent: thdVal,
          tddPercent: tddVal,
        });
      } catch (e) { console.warn('Harmonics chart error:', e); }
    }

    return result;
  }

  function runTransformerCalc() {
    return SubstationCalc.transformerSizing({
      rating: getInputNum('tf-rating') || 10,
      hvVoltage: getInputNum('tf-hv') || 69,
      lvVoltage: getInputNum('tf-lv') || 13.2,
      impedance: getInputNum('tf-impedance') || 7.5,
      noLoadLoss: getInputNum('tf-nll') || 12.5,
      loadLoss: getInputNum('tf-ll') || 65,
      powerFactor: 0.95,
      loadPercent: 85,
    });
  }

  function runArcFlashCalc() {
    const voltage = getInputNum('af-voltage') || 13.2;
    const boltedFault = getInputNum('af-fault') || 5836;
    const clearingTime = getInputNum('af-time') || 0.5;
    const workingDistance = getInputNum('af-distance') || 910;
    const gap = getInputNum('af-gap') || 153;
    const enclosureEl = document.getElementById('af-enclosure');
    const enclosure = enclosureEl ? enclosureEl.value : 'open';

    const result = SubstationCalc.arcFlash({
      voltage,
      boltedFault,
      clearingTime,
      workingDistance,
      gapBetweenConductors: gap,
      enclosureType: enclosure,
      grounding: 'grounded'
    });

    if (typeof SubstationCharts !== 'undefined') {
      try {
        const hvBus = SubstationCalc.arcFlash({
          voltage: 69.0,
          boltedFault: 8500,
          clearingTime: 0.15,
          workingDistance: 910,
          gapBetweenConductors: 153,
          enclosureType: 'open',
          grounding: 'grounded'
        });

        const mvBus = result;

        const swgBus = SubstationCalc.arcFlash({
          voltage: voltage,
          boltedFault: boltedFault,
          clearingTime: clearingTime,
          workingDistance: workingDistance,
          gapBetweenConductors: gap,
          enclosureType: 'box',
          grounding: 'grounded'
        });

        const feederCab = SubstationCalc.arcFlash({
          voltage: voltage,
          boltedFault: boltedFault,
          clearingTime: clearingTime,
          workingDistance: 610,
          gapBetweenConductors: gap,
          enclosureType: 'box',
          grounding: 'grounded'
        });

        const lvAux = SubstationCalc.arcFlash({
          voltage: 0.48,
          boltedFault: 15000,
          clearingTime: 0.1,
          workingDistance: 455,
          gapBetweenConductors: 32,
          enclosureType: 'box',
          grounding: 'grounded'
        });

        const getEnergy = (res) => {
          const kr = res.keyResults.find(k => k.label === 'Incident Energy');
          return kr ? parseFloat(kr.value) : 0;
        };

        const buses = [
          { name: 'HV Bus (69kV) [Open]', incidentEnergy_cal_cm2: getEnergy(hvBus) },
          { name: 'MV Bus [Input Config]', incidentEnergy_cal_cm2: getEnergy(mvBus) },
          { name: 'MV Swg [Enclosed Box]', incidentEnergy_cal_cm2: getEnergy(swgBus) },
          { name: 'Feeder Cab [Working:610mm]', incidentEnergy_cal_cm2: getEnergy(feederCab) },
          { name: 'LV Aux Panel (480V)', incidentEnergy_cal_cm2: getEnergy(lvAux) }
        ];

        destroyChart('arcflash-chart');
        chartInstances['arcflash-chart'] = SubstationCharts.createArcFlashChart('arcflash-chart', {
          buses: buses
        });
      } catch (e) {
        console.warn('Arc flash chart error:', e);
      }
    }

    return result;
  }

  function runCableSizingCalc() {
    return SubstationCalc.cableSizing({
      current: 437.4,
      voltage: 13.2,
      length: 0.1,
      powerFactor: 0.95,
      material: 'copper',
      insulation: 'XLPE',
      installation: 'underground',
      ambientTemp: 30,
      maxTempRise: 90,
      soilThermalResistivity: getInputNum('cb-soil-res') || 1.2,
      groupedCircuits: getInputNum('cb-grouping') || 2,
      burialDepth: getInputNum('cb-depth') || 1.0,
    });
  }

  function runInsulationCalc() {
    return SubstationCalc.insulationCoordination({
      systemVoltage: getInputNum('ins-voltage') || 13.2,
      arresterMCOV: getInputNum('ins-mcov') || 8.4,
      arresterDischargeVoltage: getInputNum('ins-discharge') || 32,
      arresterFOW: getInputNum('ins-fow') || 41,
      arresterSSPL: getInputNum('ins-sspl') || 27,
      altitude: getInputNum('ins-altitude') || 1000,
      leadLength: getInputNum('ins-lead-length') || 1.5,
      didt: getInputNum('ins-didt') || 10,
      equipment: [
        { name: 'HV Circuit Breaker', bil: getInputNum('ins-hv-breaker-bil') || 110 },
        { name: 'Transformer HV Winding', bil: getInputNum('ins-tf-hv-bil') || 110, bsl: getInputNum('ins-tf-hv-bsl') || 83 },
        { name: 'Transformer LV Winding', bil: getInputNum('ins-tf-lv-bil') || 30 },
        { name: 'LV Circuit Breaker', bil: getInputNum('ins-lv-breaker-bil') || 30 }
      ]
    });
  }

  function runReliabilityCalc() {
    const result = SubstationCalc.reliabilityAssessment({
      components: [
        { name: 'Power Transformer', failureRate: 0.0062, repairTime: 342, customers: 50000 },
        { name: 'Circuit Breaker (HV)', failureRate: 0.004, repairTime: 83, customers: 50000 },
        { name: 'Circuit Breaker (MV)', failureRate: 0.003, repairTime: 24, customers: 50000 },
        { name: 'Feeder Line F1', failureRate: 0.1, repairTime: 5, customers: 12000 },
        { name: 'Feeder Line F2', failureRate: 0.12, repairTime: 5, customers: 14000 },
        { name: 'Feeder Line F3', failureRate: 0.08, repairTime: 4, customers: 11000 },
        { name: 'Feeder Line F4', failureRate: 0.09, repairTime: 4.5, customers: 13000 },
      ],
      totalCustomers: 50000,
    });

    if (typeof SubstationCharts !== 'undefined') {
      try {
        destroyChart('reliability-chart');
        chartInstances['reliability-chart'] = SubstationCharts.createReliabilityChart('reliability-chart', result);
      } catch (e) { console.warn('Reliability chart error:', e); }
    }

    return result;
  }

  function runCTPTCalc() {
    return SubstationCalc.ctPtSelection({
      faultCurrent: 5836,
      loadCurrent: 437.4,
      relayBurden: 2.0,
      leadResistance: 0.5,
      ctClass: 'C200',
      systemVoltage: 13.2,
    });
  }

  function runDifferentialCalc() {
    return SubstationCalc.differentialProtection({
      transformerRating: 10,
      hvVoltage: 69,
      lvVoltage: 13.2,
      connection: 'Dyn1',
      impedance: 7.5,
      ctRatioHV: '100/5',
      ctRatioLV: '500/5',
      tapSetting: 5,
    });
  }

  function runBusBarCalc() {
    return SubstationCalc.busBarSizing({
      ratedCurrent: 600,
      faultCurrent: 25000,
      faultDuration: 1,
      material: 'copper',
      ambientTemp: 40,
      maxTemp: 105,
      barWidth: 50,
      barThickness: 6,
      spacing: 300,
    });
  }

  function runVoltageDropCalc() {
    const feederParams = [
      { name: 'Feeder 1', current: 116, conductor: '4/0 AWG ACSR', r: 0.328, x: 0.408 },
      { name: 'Feeder 2', current: 100, conductor: '4/0 AWG ACSR', r: 0.328, x: 0.408 },
      { name: 'Feeder 3', current: 95, conductor: '#2 AWG ACSR', r: 0.826, x: 0.441 },
      { name: 'Feeder 4', current: 105, conductor: '4/0 AWG ACSR', r: 0.328, x: 0.408 },
    ];

    const sections = [];
    feederParams.forEach(f => {
      let current = f.current;
      for (let b = 1; b <= 10; b++) {
        const segmentCurrent = current * (1 - (b - 1) * 0.08); 
        sections.push({
          from: b === 1 ? 'Substation' : `${f.name} Bus ${b - 1}`,
          to: `${f.name} Bus ${b}`,
          length: 1.5,
          current: Number(segmentCurrent.toFixed(1)),
          conductor: f.conductor,
          r: f.r,
          x: f.x
        });
      }
    });

    const result = SubstationCalc.voltageDrop({
      sections: sections,
      baseVoltage: 13.2,
      powerFactor: 0.95,
      regulatorEnabled: (document.getElementById('vd-reg-enabled') || {}).value === 'yes',
      regulatorBusIndex: getInputNum('vd-reg-location') !== null ? getInputNum('vd-reg-location') : 3,
      regulatorRange: Number((document.getElementById('vd-reg-range') || {}).value || 10),
      regulatorType: (document.getElementById('vd-reg-type') || {}).value || 'ltc',
      connectionType: (document.getElementById('vd-connection-type') || {}).value || 'wye',
      rLine: getInputNum('vd-ldc-r') !== null ? getInputNum('vd-ldc-r') : 0.5,
      xLine: getInputNum('vd-ldc-x') !== null ? getInputNum('vd-ldc-x') : 0.8,
      overloadMargin: getInputNum('vd-overload-margin') !== null ? getInputNum('vd-overload-margin') : 20,
      transformerMVA: getInputNum('vd-transformer-mva') || 10
    });

    if (typeof SubstationCharts !== 'undefined') {
      try {
        const feeders = [];
        for (let f = 1; f <= 4; f++) {
          const buses = [{ name: 'Substation', voltage_pu: 1.0 }];
          let cumDrop = 0;
          result.table.rows.forEach(row => {
            const toNode = row[0];
            if (toNode.startsWith(`Feeder ${f}`)) {
              const drop = parseFloat(row[4]) || 0;
              cumDrop += drop;
              buses.push({ name: toNode, voltage_pu: 1.0 - cumDrop / 100 });
            }
          });
          feeders.push({
            label: `Feeder ${f}`,
            buses: buses
          });
        }

        destroyChart('voltage-profile-chart');
        chartInstances['voltage-profile-chart'] = SubstationCharts.createVoltageProfile('voltage-profile-chart', {
          feeders: feeders,
          nominalVoltage_kV: 13.2,
          upperLimit: 1.05,
          lowerLimit: 0.95
        });
      } catch (e) {
        console.warn('Voltage profile chart error:', e);
      }
    }

    return result;
  }

  function runSystemLossCalc() {
    const result = SubstationCalc.systemLoss({
      transformerNoLoad: 12.5,
      transformerLoadLoss: 65,
      loading: 0.85,
      feeders: [
        { name: 'Feeder 1', length: 25.5, current: 116, resistance: 0.328 },
        { name: 'Feeder 2', length: 28.3, current: 100, resistance: 0.328 },
        { name: 'Feeder 3', length: 22.1, current: 95, resistance: 0.328 },
        { name: 'Feeder 4', length: 24.7, current: 105, resistance: 0.328 },
      ],
    });

    if (typeof SubstationCharts !== 'undefined') {
      try {
        const transLoss = parseFloat(result.keyResults.find(kr => kr.label.includes('Transformer')).value) || 0;
        const totalFeederLoss = parseFloat(result.keyResults.find(kr => kr.label.includes('MV Distribution')).value) || 0;

        const losses = [
          { label: 'Transformer No-Load', value_kW: 12.5 },
          { label: 'Transformer Load Loss', value_kW: transLoss - 12.5 },
          { label: 'Feeder 1 (ACSR 4/0)', value_kW: totalFeederLoss * 0.28 },
          { label: 'Feeder 2 (ACSR 4/0)', value_kW: totalFeederLoss * 0.25 },
          { label: 'Feeder 3 (ACSR 4/0)', value_kW: totalFeederLoss * 0.21 },
          { label: 'Feeder 4 (ACSR 4/0)', value_kW: totalFeederLoss * 0.26 }
        ];

        destroyChart('systemloss-chart');
        chartInstances['systemloss-chart'] = SubstationCharts.createSystemLossChart('systemloss-chart', {
          losses: losses,
          title: 'Active Technical Loss Breakdown (kW)'
        });
      } catch (e) {
        console.warn('System loss chart error:', e);
      }
    }

    return result;
  }

  function runForecastCalc() {
    const historical = [
      { year: 2014, demand: 5200 },
      { year: 2015, demand: 5450 },
      { year: 2016, demand: 5720 },
      { year: 2017, demand: 6010 },
      { year: 2018, demand: 6320 },
      { year: 2019, demand: 6580 },
      { year: 2020, demand: 6750 },
    ];
    const result = SubstationCalc.loadForecast({
      historicalData: historical,
      forecastYears: 10,
      growthRate: 0.045,
    });

    if (typeof SubstationCharts !== 'undefined') {
      try {
        const forecast = result.table.rows.map(row => {
          return {
            year: parseInt(row[0]),
            demand: parseFloat(row[1])
          };
        });

        destroyChart('forecast-chart');
        chartInstances['forecast-chart'] = SubstationCharts.createLoadForecastChart('forecast-chart', {
          historical: historical,
          forecast: forecast
        });
      } catch (e) {
        console.warn('Forecast chart error:', e);
      }
    }

    return result;
  }

  function runSequenceCalc() {
    return SubstationCalc.sequenceImpedance({
      transformerMVA: 10,
      hvVoltage: 69,
      lvVoltage: 13.2,
      impedancePercent: 7.5,
      xrRatio: 12,
      connection: 'Dyn1',
      utilityFaultMVA: 1500,
      utilityXR: 15,
    });
  }

  function runCostCalc() {
    return SubstationCalc.costEstimate({
      transformerMVA: 10,
      hvVoltage: 69,
      mvVoltage: 13.2,
      numFeeders: 4,
      gridArea: 1200,
    });
  }

  function runMotorStartingCalc() {
    return SubstationCalc.motorStarting({
      motorHP: getInputNum('ms-motor-hp') || 1000,
      motorKV: getInputNum('ms-motor-kv') || 4.16,
      nemaCodeLetter: (document.getElementById('ms-nema-code') || {}).value || 'G',
      startMethod: (document.getElementById('ms-start-method') || {}).value || 'dol',
      sourceFaultMVA: getInputNum('ms-source-fault-mva') || 250,
      motorFaultMVA: getInputNum('ms-motor-fault-mva') || 180,
      accelerationTime: getInputNum('ms-accel-time') || 10
    });
  }

  function runClearanceCalc() {
    const voltageEl = document.getElementById('sc-voltage');
    const voltage = voltageEl ? parseFloat(voltageEl.value) || 13.2 : 13.2;
    return SubstationCalc.clearanceChecking({
      voltage: voltage,
      phaseToPhase: getInputNum('sc-phase-to-phase') || 200,
      phaseToGround: getInputNum('sc-phase-to-ground') || 150,
      fenceHeight: getInputNum('sc-fence-height') || 2400,
    });
  }

  function runBatteryCalc() {
    return SubstationCalc.batterySizing({
      continuousLoad: getInputNum('bat-continuous'),
      momentaryLoad: getInputNum('bat-momentary'),
      durationHours: getInputNum('bat-duration'),
      tempFactor: getInputNum('bat-temp'),
      designMargin: getInputNum('bat-margin')
    });
  }

  function runShieldingCalc() {
    return SubstationCalc.lightningShielding({
      mastHeight: getInputNum('ls-mast'),
      sphereRadius: getInputNum('ls-radius'),
      equipmentHeight: getInputNum('ls-equipment')
    });
  }

  function runFilterCalc() {
    return SubstationCalc.harmonicFilterSizing({
      fundamentalReactivePower: getInputNum('hf-power'),
      tuningOrder: getInputNum('hf-order'),
      voltage: getInputNum('hf-voltage')
    });
  }

  function runDcloadCalc() {
    return SubstationCalc.dcControlLoading({
      baseLoadW: getInputNum('dc-base'),
      indicatorCount: getInputNum('dc-indicators'),
      dcVoltage: getInputNum('dc-voltage')
    });
  }

  function runResonanceCalc() {
    return SubstationCalc.busbarResonance({
      spacing: getInputNum('br-spacing'),
      span: getInputNum('br-span'),
      mass: getInputNum('br-mass')
    });
  }

  function runDgaCalc() {
    return SubstationCalc.dgaDiagnostic({
      ch4: getInputNum('dga-ch4'),
      c2h6: getInputNum('dga-c2h6'),
      c2h4: getInputNum('dga-c2h4'),
      c2h2: getInputNum('dga-c2h2')
    });
  }

  function runCapovervoltageCalc() {
    return SubstationCalc.capacitorOvervoltage({
      bankKVAR: getInputNum('co-bank') || 1200,
      sourceFaultMVA: getInputNum('co-fault') || 250,
      systemVoltage: getInputNum('co-sys-voltage') || 13.8,
      systemFrequency: getInputNum('co-frequency') || 60,
      numBanks: getInputNum('co-num-banks') || 1,
      busInductance: getInputNum('co-bus-inductance') || 50,
      seriesReactor: getInputNum('co-series-reactor') || 0,
      dischargeVoltage: getInputNum('co-discharge-volt') || 50,
      dischargeTime: getInputNum('co-discharge-time') || 300
    });
  }

  function runLightingCalc() {
    return SubstationCalc.substationLighting({
      yardArea: getInputNum('lt-area'),
      targetLux: getInputNum('lt-lux'),
      lumens: getInputNum('lt-lumens')
    });
  }

  function runCtsaturationCalc() {
    return SubstationCalc.ctSaturationCheck({
      burden: getInputNum('ct-burden'),
      faultCurrent: getInputNum('ct-fault'),
      ctRatio: getInputNum('ct-ratio')
    });
  }

  function runSoundCalc() {
    return SubstationCalc.soundAttenuation({
      transformerMVA: getInputNum('sa-mva'),
      baseDB: getInputNum('sa-db'),
      distance: getInputNum('sa-dist')
    });
  }

  function runInsulatorCalc() {
    const pollutionEl = document.getElementById('ins-pollution');
    return SubstationCalc.insulatorSizing({
      pollutionLevel: pollutionEl ? pollutionEl.value : 'heavy',
      voltage: getInputNum('ins-voltage')
    });
  }

  function runAcdemandCalc() {
    return SubstationCalc.acAuxiliaryDemand({
      heatingW: getInputNum('ac-heating'),
      coolingHP: getInputNum('ac-cooling'),
      lightingW: getInputNum('ac-lighting')
    });
  }

  function runArresterCalc() {
    return SubstationCalc.surgeArresterEnergy({
      systemVoltage: getInputNum('sa-sys-voltage') || 13.8,
      maxSystemVoltage: getInputNum('sa-max-voltage') || 15.0,
      groundingType: (document.getElementById('sa-grounding') || {}).value || 'effectively_grounded',
      transformerConfig: (document.getElementById('sa-tf-config') || {}).value || 'wye_g',
      tovFactor: getInputNum('sa-tov-factor') || 1.4,
      tovDuration: getInputNum('sa-tov-duration') || 1.0,
      tov10Factor: getInputNum('sa-tov10-factor') || 1.25,
      surgeRateOfRise: getInputNum('sa-surge-ror') || 1000,
      separationDistance: getInputNum('sa-sep-dist') || 5.0,
      dischargeCurrent: getInputNum('sa-current') || 10,
      dischargeVoltage: getInputNum('sa-voltage') || 150,
      surgeDuration: getInputNum('sa-duration') || 2000,
      transientType: (document.getElementById('sa-transient-type') || {}).value || 'lightning'
    });
  }

  function runFirebarrierCalc() {
    return SubstationCalc.fireSeparation({
      oilVolume: getInputNum('fb-oil'),
      mvaRating: getInputNum('fb-mva')
    });
  }

  function runFencegprCalc() {
    return SubstationCalc.fencingGPR({
      gridGPR: getInputNum('fg-gpr'),
      distanceToFence: getInputNum('fg-dist')
    });
  }

  function runGissf6Calc() {
    return SubstationCalc.gisSF6Monitoring({
      temperature: getInputNum('gis-temp'),
      pressureBar: getInputNum('gis-pres')
    });
  }

  function runBusbardeflCalc() {
    return SubstationCalc.busbarDeflection({
      spanLength: getInputNum('bd-span'),
      shortCircuitForce: getInputNum('bd-force'),
      E: getInputNum('bd-modulus'),
      I: getInputNum('bd-inertia')
    });
  }

  function runTrenchCalc() {
    return SubstationCalc.cableTrenchSizing({
      totalCables: getInputNum('tr-cables'),
      cableDiameter: getInputNum('tr-diameter'),
      trenchWidth: getInputNum('tr-width'),
      trenchDepth: getInputNum('tr-depth')
    });
  }

  function runAgeingCalc() {
    return SubstationCalc.transformerAgeing({
      hotSpotTemp: getInputNum('ag-hotspot'),
      loadFactor: getInputNum('ag-factor')
    });
  }

  // ---- Display Results ----
  function displayResult(container, result, type) {
    let html = '';

    // Summary header
    if (result.summary) {
      html += `<div class="result-summary">
        <h4>${result.summary.title || formatCalcName(type)}</h4>
        ${result.summary.status ? `<span class="badge badge-${result.summary.status}">${result.summary.statusText || result.summary.status}</span>` : ''}
      </div>`;
    }

    // Key results cards
    if (result.keyResults) {
      html += '<div class="result-cards">';
      result.keyResults.forEach(kr => {
        html += `<div class="result-card">
          <div class="result-card-label">${kr.label}</div>
          <div class="result-card-value">${kr.value}</div>
          <div class="result-card-unit">${kr.unit || ''}</div>
        </div>`;
      });
      html += '</div>';
    }

    // Steps
    if (result.steps && result.steps.length > 0) {
      html += `<div class="calc-steps">
        <h4 class="steps-title" onclick="this.nextElementSibling.classList.toggle('collapsed')">
          <span class="steps-icon">📐</span> Step-by-Step Calculation
          <span class="steps-toggle">▼</span>
        </h4>
        <div class="steps-content">`;

      result.steps.forEach((step, i) => {
        html += `<div class="calc-step">
          <div class="step-number">${i + 1}</div>
          <div class="step-body">
            <div class="step-title">${step.title}</div>
            ${step.formula ? `<div class="step-formula">${step.formula}</div>` : ''}
            ${step.substitution ? `<div class="step-sub">${step.substitution}</div>` : ''}
            <div class="step-result">${step.result}</div>
            ${step.reference ? `<div class="step-ref">📖 ${step.reference}</div>` : ''}
          </div>
        </div>`;
      });

      html += '</div></div>';
    }

    // Data table
    if (result.table) {
      html += '<div class="result-table-wrap"><table class="result-table"><thead><tr>';
      
      const numericColumns = {};
      if (result.table.rows && result.table.rows.length > 0) {
        result.table.rows[0].forEach((cell, ci) => {
          if (typeof cell === 'number' || (cell != null && !isNaN(parseFloat(cell)) && isFinite(cell))) {
            numericColumns[ci] = true;
          }
        });
      }

      result.table.headers.forEach((h, hi) => {
        const cls = numericColumns[hi] ? 'num' : '';
        html += `<th class="${cls}">${h}</th>`;
      });
      html += '</tr></thead><tbody>';
      result.table.rows.forEach(row => {
        html += '<tr>';
        row.forEach((cell, ci) => {
          const cls = numericColumns[ci] ? 'num' : '';
          html += `<td class="${cls}">${cell}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    }

    // Compliance check
    if (result.compliance) {
      html += '<div class="compliance-box">';
      result.compliance.forEach(c => {
        const icon = c.pass ? '✅' : '❌';
        const cls = c.pass ? 'pass' : 'fail';
        html += `<div class="compliance-item ${cls}">
          <span class="compliance-icon">${icon}</span>
          <span class="compliance-text">${c.check}</span>
          <span class="compliance-detail">${c.detail || ''}</span>
        </div>`;
      });
      html += '</div>';
    }

    // Coordination table (insulation coordination)
    if (result.coordinationTable && result.coordinationTable.length > 0) {
      html += '<div class="result-table-wrap"><h4 class="steps-title"><span class="steps-icon">🛡️</span> Insulation Coordination Assessment</h4>';
      html += '<table class="result-table"><thead><tr>';
      html += '<th>Equipment</th><th>BIL (kV)</th><th>BSL (kV)</th><th>PR (kV)</th><th>PM (%)</th><th>Status</th>';
      html += '</tr></thead><tbody>';
      result.coordinationTable.forEach(eq => {
        const passClass = eq.pass ? 'pass' : 'fail';
        const icon = eq.pass ? '✅' : '❌';
        html += `<tr class="coordination-${passClass}">
          <td>${eq.name || ''}</td>
          <td class="num">${eq.bil != null ? eq.bil : '—'}</td>
          <td class="num">${eq.bsl != null ? eq.bsl : '—'}</td>
          <td class="num">${eq.protectiveRatio != null ? eq.protectiveRatio : '—'}</td>
          <td class="num">${eq.protectiveMargin != null ? eq.protectiveMargin : '—'}</td>
          <td><span class="compliance-icon">${icon}</span> ${eq.pass ? 'Adequate' : 'Inadequate'}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    // Breaker sizing card (capacitor overvoltage)
    if (result.breakerSizing) {
      const bs = result.breakerSizing;
      html += `<div class="result-card breaker-sizing-card" style="margin-top:1rem;padding:1.25rem;border-left:4px solid var(--accent, #4fc3f7);background:var(--surface-alt, rgba(79,195,247,0.06));border-radius:8px;">
        <h4 style="margin:0 0 0.75rem;display:flex;align-items:center;gap:0.5rem;"><span>⚡</span> Capacitor Breaker Sizing</h4>
        <div class="result-cards" style="gap:0.75rem;">
          ${bs.breakerClass ? `<div class="result-card"><div class="result-card-label">Breaker Class</div><div class="result-card-value">${bs.breakerClass}</div></div>` : ''}
          ${bs.makingCurrent != null ? `<div class="result-card"><div class="result-card-label">Making Current</div><div class="result-card-value">${bs.makingCurrent}</div><div class="result-card-unit">kA peak</div></div>` : ''}
          ${bs.frequency != null ? `<div class="result-card"><div class="result-card-label">Inrush Frequency</div><div class="result-card-value">${bs.frequency}</div><div class="result-card-unit">Hz</div></div>` : ''}
          ${bs.interrupting != null ? `<div class="result-card"><div class="result-card-label">Interrupting Rating</div><div class="result-card-value">${bs.interrupting}</div><div class="result-card-unit">kA rms</div></div>` : ''}
        </div>
      </div>`;
    }

    // Voltage regulator sizing card
    if (result.regulator) {
      const reg = result.regulator;
      html += `<div class="result-card regulator-card" style="margin-top:1.5rem;padding:1.5rem;border-left:4px solid var(--success, #66bb6a);background:var(--surface-alt, rgba(102,187,106,0.06));border-radius:12px;">
        <h4 style="margin:0 0 0.5rem;display:flex;align-items:center;gap:0.5rem;font-size:1.15rem;color:var(--text, #ffffff);">
          <span>🔄</span> Voltage Regulator & LTC Design Assessment
        </h4>
        <p style="margin:0 0 1rem;font-size:0.875rem;color:var(--text-muted, #b0bec5);line-height:1.4;">
          <strong>Device Class:</strong> ${reg.typeLabel}<br>
          <em>${reg.description}</em>
        </p>
        
        <div class="result-cards" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:0.75rem;margin-bottom:1.25rem;">
          <div class="result-card" style="padding:0.75rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);">
            <div class="result-card-label" style="font-size:0.75rem;color:var(--text-muted);">Location Node</div>
            <div class="result-card-value" style="font-size:1.1rem;font-weight:600;">${reg.location}</div>
          </div>
          <div class="result-card" style="padding:0.75rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);">
            <div class="result-card-label" style="font-size:0.75rem;color:var(--text-muted);">Regulation Range</div>
            <div class="result-card-value" style="font-size:1.1rem;font-weight:600;">±${reg.range}%</div>
          </div>
          <div class="result-card" style="padding:0.75rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);">
            <div class="result-card-label" style="font-size:0.75rem;color:var(--text-muted);">Tap Position</div>
            <div class="result-card-value" style="font-size:1.1rem;font-weight:600;color:var(--accent);">${reg.tapPosition}</div>
          </div>
          <div class="result-card" style="padding:0.75rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);">
            <div class="result-card-label" style="font-size:0.75rem;color:var(--text-muted);">Required Bank Rating</div>
            <div class="result-card-value" style="font-size:1.1rem;font-weight:600;color:var(--success);">${reg.kvaRating} kVA</div>
          </div>
        </div>

        <div style="background:rgba(0,0,0,0.15);padding:1rem;border-radius:8px;margin-bottom:1.25rem;border:1px solid rgba(255,255,255,0.05);">
          <h5 style="margin:0 0 0.75rem;font-size:0.9rem;display:flex;align-items:center;gap:0.35rem;color:var(--text);">
            <span>📈</span> Add-Amp (Load-Bonus) Capability & Limits (IEEE C57.15)
          </h5>
          <div style="display:flex;flex-wrap:wrap;gap:1.5rem;font-size:0.875rem;">
            <div><span style="color:var(--text-muted);">Actual Max Load:</span> <strong>${reg.actualCurrent} A</strong></div>
            <div><span style="color:var(--text-muted);">Load-Bonus Factor:</span> <strong style="color:var(--accent);">${reg.loadBonusMultiplier}x</strong></div>
            <div><span style="color:var(--text-muted);">Allowable Cont. Current:</span> <strong style="color:var(--success);">${reg.allowableCurrent} A</strong></div>
          </div>
          <div style="margin-top:0.5rem;font-size:0.75rem;color:var(--text-muted);">
            *By restricting tap range, allowable continuous current can safely exceed 100% of nominal rating without exceeding safe temperature rise parameters.
          </div>
        </div>

        <div style="background:rgba(0,0,0,0.15);padding:1rem;border-radius:8px;border:1px solid rgba(255,255,255,0.05);">
          <h5 style="margin:0 0 0.75rem;font-size:0.9rem;display:flex;align-items:center;gap:0.35rem;color:var(--text);">
            <span>🎛️</span> Line Drop Compensator (LDC) Setting Optimization
          </h5>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:1rem;font-size:0.875rem;">
            <div>
              <span style="color:var(--text-muted);">CT Sizing:</span> <strong>${reg.ctRatio} A</strong><br>
              <span style="color:var(--text-muted);">PT Sizing:</span> <strong style="font-size:0.8rem;">${reg.ptRatio}</strong>
            </div>
            <div>
              <span style="color:var(--text-muted);">Dial R Setting:</span> <strong style="color:var(--accent); font-size:1.05rem;">${reg.rSet} V</strong><br>
              <span style="color:var(--text-muted);">Dial X Setting:</span> <strong style="color:var(--accent); font-size:1.05rem;">${reg.xSet} V</strong>
            </div>
          </div>
          <div style="margin-top:0.5rem;font-size:0.75rem;color:var(--text-muted);">
            *Line Drop Compensator settings simulate feeder voltage drop to maintain exactly 120V nominal voltage at the distant regulating point.
          </div>
        </div>
      </div>`;
    }

    container.innerHTML = html;
  }

  // ---- SLD ----
  function renderSLD() {
    if (typeof SubstationSLD !== 'undefined') {
      SubstationSLD.render('sld-container');
    }
  }

  // ---- Project Data ----
  function loadProjectData() {
    try {
      const saved = localStorage.getItem('substation-project');
      if (saved) projectData = JSON.parse(saved);
    } catch (e) { /* ignore */ }
  }

  function saveProjectData() {
    try {
      localStorage.setItem('substation-project', JSON.stringify(projectData));
      showToast('Project saved', 'success');
    } catch (e) {
      showToast('Failed to save project', 'error');
    }
  }

  // ---- Print / Export ----
  function printReport() {
    window.print();
  }

  function exportResults() {
    // Trigger all calculations
    const types = ['fault', 'loadflow', 'grounding', 'protection', 'harmonics', 'transformer',
      'arcflash', 'cable', 'insulation', 'reliability', 'ctpt', 'differential', 'busbar',
      'voltagedrop', 'systemloss', 'forecast', 'sequence', 'cost', 'motorstarting', 'clearance',
      'battery', 'shielding', 'filter', 'dcload', 'resonance', 'dga', 'capovervoltage', 'lighting', 'ctsaturation', 'sound',
      'insulator', 'acdemand', 'arrester', 'firebarrier', 'fencegpr', 'gissf6', 'busbardefl', 'trench', 'ageing'];

    types.forEach((t, i) => {
      setTimeout(() => runCalculation(t), i * 150);
    });

    showToast('Evaluating all modules in sequence...', 'info');
  }

  function exportPDF() {
    const types = ['fault', 'loadflow', 'grounding', 'protection', 'harmonics', 'transformer',
      'arcflash', 'cable', 'insulation', 'reliability', 'ctpt', 'differential', 'busbar',
      'voltagedrop', 'systemloss', 'forecast', 'sequence', 'cost', 'motorstarting', 'clearance',
      'battery', 'shielding', 'filter', 'dcload', 'resonance', 'dga', 'capovervoltage', 'lighting', 'ctsaturation', 'sound',
      'insulator', 'acdemand', 'arrester', 'firebarrier', 'fencegpr', 'gissf6', 'busbardefl', 'trench', 'ageing'];

    types.forEach(t => {
      const resultContainer = document.getElementById(`result-${t}`);
      if (resultContainer) {
        let res;
        switch (t) {
          case 'fault': res = runFaultCalc(); break;
          case 'loadflow': res = runLoadFlowCalc(); break;
          case 'grounding': res = runGroundingCalc(); break;
          case 'protection': res = runProtectionCalc(); break;
          case 'harmonics': res = runHarmonicsCalc(); break;
          case 'transformer': res = runTransformerCalc(); break;
          case 'arcflash': res = runArcFlashCalc(); break;
          case 'cable': res = runCableSizingCalc(); break;
          case 'insulation': res = runInsulationCalc(); break;
          case 'reliability': res = runReliabilityCalc(); break;
          case 'ctpt': res = runCTPTCalc(); break;
          case 'differential': res = runDifferentialCalc(); break;
          case 'busbar': res = runBusBarCalc(); break;
          case 'voltagedrop': res = runVoltageDropCalc(); break;
          case 'systemloss': res = runSystemLossCalc(); break;
          case 'forecast': res = runForecastCalc(); break;
          case 'sequence': res = runSequenceCalc(); break;
          case 'cost': res = runCostCalc(); break;
          case 'motorstarting': res = runMotorStartingCalc(); break;
          case 'clearance': res = runClearanceCalc(); break;
          case 'battery': res = runBatteryCalc(); break;
          case 'shielding': res = runShieldingCalc(); break;
          case 'filter': res = runFilterCalc(); break;
          case 'dcload': res = runDcloadCalc(); break;
          case 'resonance': res = runResonanceCalc(); break;
          case 'dga': res = runDgaCalc(); break;
          case 'capovervoltage': res = runCapovervoltageCalc(); break;
          case 'lighting': res = runLightingCalc(); break;
          case 'ctsaturation': res = runCtsaturationCalc(); break;
          case 'sound': res = runSoundCalc(); break;
          case 'insulator': res = runInsulatorCalc(); break;
          case 'acdemand': res = runAcdemandCalc(); break;
          case 'arrester': res = runArresterCalc(); break;
          case 'firebarrier': res = runFirebarrierCalc(); break;
          case 'fencegpr': res = runFencegprCalc(); break;
          case 'gissf6': res = runGissf6Calc(); break;
          case 'busbardefl': res = runBusbardeflCalc(); break;
          case 'trench': res = runTrenchCalc(); break;
          case 'ageing': res = runAgeingCalc(); break;
        }
        if (res) displayResult(resultContainer, res, t);
      }
    });

    showToast('Report consolidated. Compiling professional PDF layout...', 'success');
    setTimeout(() => {
      window.print();
    }, 1000);
  }

  function exportCSV() {
    const csvRows = [];
    csvRows.push(['10MVA Substation Design Suite — BOQ & Takeoffs Report']);
    csvRows.push(['Programmed by: Engr. Franz Xyrlo Tobias PEE']);
    csvRows.push(['Date Generated', new Date().toLocaleString()]);
    csvRows.push([]);
    csvRows.push(['Calculation Module', 'Engineering Metric', 'Calculated Value', 'Engineering Unit']);

    const types = ['fault', 'loadflow', 'grounding', 'protection', 'harmonics', 'transformer',
      'arcflash', 'cable', 'insulation', 'reliability', 'ctpt', 'differential', 'busbar',
      'voltagedrop', 'systemloss', 'forecast', 'sequence', 'cost', 'motorstarting', 'clearance',
      'battery', 'shielding', 'filter', 'dcload', 'resonance', 'dga', 'capovervoltage', 'lighting', 'ctsaturation', 'sound',
      'insulator', 'acdemand', 'arrester', 'firebarrier', 'fencegpr', 'gissf6', 'busbardefl', 'trench', 'ageing'];

    types.forEach(t => {
      let res;
      switch (t) {
        case 'fault': res = runFaultCalc(); break;
        case 'loadflow': res = runLoadFlowCalc(); break;
        case 'grounding': res = runGroundingCalc(); break;
        case 'protection': res = runProtectionCalc(); break;
        case 'harmonics': res = runHarmonicsCalc(); break;
        case 'transformer': res = runTransformerCalc(); break;
        case 'arcflash': res = runArcFlashCalc(); break;
        case 'cable': res = runCableSizingCalc(); break;
        case 'insulation': res = runInsulationCalc(); break;
        case 'reliability': res = runReliabilityCalc(); break;
        case 'ctpt': res = runCTPTCalc(); break;
        case 'differential': res = runDifferentialCalc(); break;
        case 'busbar': res = runBusBarCalc(); break;
        case 'voltagedrop': res = runVoltageDropCalc(); break;
        case 'systemloss': res = runSystemLossCalc(); break;
        case 'forecast': res = runForecastCalc(); break;
        case 'sequence': res = runSequenceCalc(); break;
        case 'cost': res = runCostCalc(); break;
        case 'motorstarting': res = runMotorStartingCalc(); break;
        case 'clearance': res = runClearanceCalc(); break;
        case 'battery': res = runBatteryCalc(); break;
        case 'shielding': res = runShieldingCalc(); break;
        case 'filter': res = runFilterCalc(); break;
        case 'dcload': res = runDcloadCalc(); break;
        case 'resonance': res = runResonanceCalc(); break;
        case 'dga': res = runDgaCalc(); break;
        case 'capovervoltage': res = runCapovervoltageCalc(); break;
        case 'lighting': res = runLightingCalc(); break;
        case 'ctsaturation': res = runCtsaturationCalc(); break;
        case 'sound': res = runSoundCalc(); break;
        case 'insulator': res = runInsulatorCalc(); break;
        case 'acdemand': res = runAcdemandCalc(); break;
        case 'arrester': res = runArresterCalc(); break;
        case 'firebarrier': res = runFirebarrierCalc(); break;
        case 'fencegpr': res = runFencegprCalc(); break;
        case 'gissf6': res = runGissf6Calc(); break;
        case 'busbardefl': res = runBusbardeflCalc(); break;
        case 'trench': res = runTrenchCalc(); break;
        case 'ageing': res = runAgeingCalc(); break;
      }
      if (res && res.keyResults) {
        res.keyResults.forEach(kr => {
          const cleanVal = kr.value !== undefined && kr.value !== null ? String(kr.value).replace(/,/g, '') : '';
          csvRows.push([formatCalcName(t), kr.label || '', cleanVal, kr.unit || '']);
        });
      }
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + csvRows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Substation_BOQ_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV Report Downloaded Successfully', 'success');
  }

  // ---- Toast Notification ----
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span class="toast-msg">${message}</span>`;

    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ---- Utilities ----
  function setTextContent(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setInputValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function getInputNum(id) {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) || 0 : 0;
  }

  function formatCalcName(type) {
    const names = {
      fault: 'Fault Analysis', loadflow: 'Load Flow', grounding: 'Grounding Design',
      protection: 'Protection Coordination', harmonics: 'Harmonics Analysis',
      transformer: 'Transformer Sizing', arcflash: 'Arc Flash', cable: 'Cable Sizing',
      insulation: 'Insulation Coordination', reliability: 'Reliability Assessment',
      ctpt: 'CT/PT Selection', differential: 'Differential Protection',
      busbar: 'Bus Bar Sizing', voltagedrop: 'Voltage Drop', systemloss: 'System Loss',
      forecast: 'Load Forecast', sequence: 'Sequence Impedance', cost: 'Cost Estimate',
      motorstarting: 'Motor Starting', clearance: 'Safety Clearances',
      battery: 'Battery Sizing', shielding: 'Lightning Shielding', filter: 'Harmonic Filter Sizing',
      dcload: 'DC Control Loading', resonance: 'Busbar Resonance', dga: 'DGA Diagnostic',
      capovervoltage: 'Capacitor Overvoltage', lighting: 'Substation Lighting',
      ctsaturation: 'CT Saturation Margin', sound: 'Transformer Sound Attenuation',
      insulator: 'Insulator Creepage Sizing', acdemand: 'AC Auxiliary Power Demand',
      arrester: 'Surge Arrester Energy', firebarrier: 'Fire Separation Barrier',
      fencegpr: 'Fencing GPR Voltage Gradient', gissf6: 'GIS SF6 Pressure Monitoring',
      busbardefl: 'Rigid Busbar Short-Circuit Deflection', trench: 'Cable Trench Fill & Ventilation',
      ageing: 'Transformer Winding Degradation'
    };
    return names[type] || type;
  }

  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ---- Module Search ----
  function searchModules() {
    const input = document.getElementById('module-search-input');
    const query = input ? input.value.toLowerCase().trim() : '';
    const clearBtn = document.getElementById('clear-search-btn');
    
    if (clearBtn) {
      clearBtn.style.display = query ? 'inline-block' : 'none';
    }

    document.querySelectorAll('.nav-section').forEach(section => {
      let sectionHasVisibleLink = false;
      section.querySelectorAll('.nav-link').forEach(link => {
        const text = link.textContent.toLowerCase();
        const matches = text.includes(query);
        link.style.display = matches ? 'flex' : 'none';
        if (matches) {
          sectionHasVisibleLink = true;
        }
      });
      section.style.display = sectionHasVisibleLink ? 'block' : 'none';
    });
  }

  function clearSearch() {
    const input = document.getElementById('module-search-input');
    if (input) {
      input.value = '';
    }
    searchModules();
  }

  // ---- Public API ----
  return {
    init,
    showModule,
    runCalculation,
    printReport,
    exportResults,
    saveProjectData,
    showToast,
    searchModules,
    clearSearch,
    DEFAULTS,
  };
})();

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
