/* OsmoNPT - lógica. Todo el cálculo ocurre en el navegador; no hay llamadas de red. */
(function () {
  /* ---------- Núcleo de cálculo (idéntico a la plantilla Excel) ---------- */
  /*CORE*/

  var LIMIT = 900; // mOsm/L, límite para vía periférica

  // Cada componente tiene una o más marcas comerciales. Por marca:
  //   conc = cantidad de la unidad por mL (g, mEq, mmol o mg según el componente)
  //   osm  = mOsm por mL
  // kcal = kcal por gramo; cat = 'p' (proteico) o 'np' (no proteico)
  var COMPONENTS = [
    { key: 'aa', name: 'Aminoácido 10 % infantil', unit: 'g', kcal: 4, cat: 'p', brands: [
      { id: 'aminoven-infant-10-fk-250', label: 'Aminoven Infant 10 %, Fresenius Kabi, 250 mL', conc: 0.1, osm: 0.885 } ] },
    { key: 'dex', name: 'Dextrosa 50 %', unit: 'g', kcal: 3.4, cat: 'np', brands: [
      { id: 'dextrosa-50-pisa-500', label: 'Dextrosa al 50 %, Pisa, 500 mL', conc: 0.5, osm: 2.523 } ] },
    { key: 'lip', name: 'Lípidos 20 %', unit: 'g', kcal: 10, cat: 'np', brands: [
      { id: 'smoflipid-20-fk-500', label: 'SMOFlipid 20 %, Fresenius Kabi, 500 mL', conc: 0.2, osm: 0.376 } ] },
    { key: 'nacl', name: 'NaCl 17.7 %', unit: 'mEq', brands: [
      { id: 'nacl-177-pisa-10', label: 'Cloruro de sodio concentrado 17.7 %, Pisa, 10 mL', conc: 3, osm: 6 } ] },
    { key: 'kcl', name: 'KCl', unit: 'mEq', brands: [
      { id: 'kcl-pisa-10', label: 'Cloruro de potasio, Pisa, 10 mL', conc: 2, osm: 4 } ] },
    { key: 'kpo4', name: 'KPO4', unit: 'mmol', brands: [
      { id: 'kpo4-medilix-15', label: 'Fosfato de potasio, Medilix Lifesciences, 15 mL (45 mmol / 66 mEq)', conc: 3, osm: 7.4 } ] },
    { key: 'mgso4', name: 'MgSO4', unit: 'mEq', brands: [
      { id: 'mgso4-pisa-10', label: 'Sulfato de magnesio 10 %, Pisa, 10 mL', conc: 0.81, osm: 0.81 } ] },
    { key: 'ca', name: 'Ca gluconato', unit: 'mg', brands: [
      { id: 'ca-gluconato-pisa-10', label: 'Gluconato de calcio, Pisa, 10 mL', conc: 100, osm: 0.68 } ] }
  ];

  // dosis: números por kg (o null si el campo está vacío); marcas: marca elegida por componente (por defecto, la primera)
  function compute(vtLitros, pesoKg, dosis, marcas) {
    var VC = 0, TO = 0, KP = 0, KN = 0, PG = 0, any = false, rows = [];
    for (var i = 0; i < COMPONENTS.length; i++) {
      var c = COMPONENTS[i], d = dosis[i], b = (marcas && marcas[i]) || c.brands[0];
      if (d === null) { rows.push(null); continue; }
      var ml = (d / b.conc) * pesoKg;   // mL de la presentación
      var mo = ml * b.osm;              // mOsm aportados
      VC += ml; TO += mo;
      if (c.kcal) { var kc = d * pesoKg * c.kcal; if (c.cat === 'p') { KP += kc; PG += d * pesoKg; } else KN += kc; }
      if (d > 0) any = true;
      rows.push({ ml: ml, mo: mo });
    }
    return {
      rows: rows, VC: VC, TO: TO, any: any,
      kcalP: KP, kcalNP: KN, kcalT: KP + KN,   // kcal (dosis por kg x peso x kcal/g)
      protG: PG,                                // gramos de aminoácidos
      osmL: TO / vtLitros,                      // mOsm/L
      water: vtLitros * 1000 - VC,              // mL de agua para completar
      exceeded: VC / 1000 > vtLitros            // VC > VT
    };
  }

  // Código de referencia: ONP-<hospital>-<AAMMDD>-<HHMM>-<verificación>
  // La verificación (4 caracteres) sale solo de los datos del cálculo: los mismos datos dan la misma verificación.
  var B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // sin I, L, O, U para no confundir al escribir a mano
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function checksum(str) {
    var h = fnv1a(str), v = (h ^ (h >>> 15)) & 0xFFFFF, out = '';
    for (var i = 0; i < 4; i++) { out = B32.charAt(v & 31) + out; v >>>= 5; }
    return out;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function canonical(hospCode, vt, wt, doses, brandIds) {
    return hospCode + '|' + vt + '|' + wt + '|' + doses.map(function (d) { return d === null ? '-' : String(d); }).join(';') + '|' + brandIds.join(',');
  }
  function makeCode(hospCode, date, canon) {
    return 'ONP-' + hospCode + '-' + pad2(date.getFullYear() % 100) + pad2(date.getMonth() + 1) + pad2(date.getDate()) +
      '-' + pad2(date.getHours()) + pad2(date.getMinutes()) + '-' + checksum(canon);
  }
  
  /*END*/

  /* ---------- Utilidades ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var NUM = /^(\d+([.,]\d*)?|[.,]\d+)$/;
  function read(el) {
    var s = el.value.trim();
    if (s === '') return { s: 'empty', v: 0 };
    if (!NUM.test(s)) return { s: 'bad', v: 0 };
    return { s: 'ok', v: parseFloat(s.replace(',', '.')) };
  }
  function fmt(n, d) { return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function ico(id) { return '<svg class="ic" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function tone(el, t) { el.setAttribute('data-tone', t); }

  var vtEl = $('vt'), wtEl = $('wt'), hospEl = $('hosp');
  var lastPrint = null;  // último cálculo válido, para la hoja de resumen
  var codeState = null;  // { sig, code } del cálculo actual, si ya se emitió

  /* ---------- Hospitales ---------- */
  var HOSPITALS = [
    { code: 'HNJRE',  name: 'Hospital del Niño Dr. José Renán Esquivel' },
    { code: 'HO',     name: 'Hospital Obaldía' },
    { code: 'HPAC',   name: 'Hospital Pediátrico de Alta Complejidad' },
    { code: 'HRVLCH', name: 'Hospital Regional de Veraguas Dr. Luis Chicho Fábrega' },
    { code: 'HST',    name: 'Hospital Santo Tomás' },
    { code: 'GEN',    name: 'Otro centro o sin especificar' }
  ];

  var HOSP_BY_CODE = {};
  hospEl.innerHTML = '<option value="" selected>Seleccione el hospital</option>';
  HOSPITALS.forEach(function (h) {
    HOSP_BY_CODE[h.code] = h;
    var o = document.createElement('option'); o.value = h.code; o.textContent = h.name + ' (' + h.code + ')';
    hospEl.appendChild(o);
  });
  try { var savedH = localStorage.getItem('osmonpt.hospital'); if (savedH && HOSP_BY_CODE[savedH]) hospEl.value = savedH; } catch (e) {}
  hospEl.addEventListener('change', function () {
    try { localStorage.setItem('osmonpt.hospital', hospEl.value); } catch (e) {}
    update();
  });

  /* ---------- Marcas comerciales y filas ---------- */
  var savedBrands = {};
  try { savedBrands = JSON.parse(localStorage.getItem('osmonpt.brands') || '{}') || {}; } catch (e) { savedBrands = {}; }
  var sel = [];   // sel[i] = marca elegida del componente i

  function brandById(c, id) {
    for (var k = 0; k < c.brands.length; k++) if (c.brands[k].id === id) return c.brands[k];
    return null;
  }
  function eqText(c, b) {
    var t = c.unit === 'mL' ? '1 mL = ' + b.osm + ' mOsm' : '1 mL = ' + b.conc + ' ' + c.unit + ' = ' + b.osm + ' mOsm';
    return c.kcal ? t + ', 1 g = ' + c.kcal + ' kcal' : t;
  }

  var doseEls = [], volCells = [], osmCells = [];
  COMPONENTS.forEach(function (c, i) {
    var opts = c.brands.map(function (b) { return '<option value="' + b.id + '">' + b.label + '</option>'; }).join('');
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="name"><span class="c-title">' + c.name + '</span>' +
        '<select class="sel c-brand" aria-label="Marca comercial de ' + c.name + '">' + opts + '</select>' +
        '<span class="c-eq"></span></td>' +
      '<td class="dosecell"><div class="uf">' +
        '<input type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next" placeholder="0" aria-label="' + c.name + ', dosis en ' + c.unit + ' por kg">' +
        '<span class="u">' + c.unit + '/kg</span></div></td>' +
      '<td class="num" data-label="Volumen (mL)">—</td>' +
      '<td class="num" data-label="Osmolaridad (mOsm)">—</td>';
    (c.kcal ? $('rowsMacro') : $('rowsElec')).appendChild(tr);
    doseEls.push(tr.querySelector('input'));
    volCells.push(tr.children[2]);
    osmCells.push(tr.children[3]);

    var sEl = tr.querySelector('select'), eqEl = tr.querySelector('.c-eq');
    sel[i] = brandById(c, savedBrands[c.key]) || c.brands[0];
    sEl.value = sel[i].id;
    sEl.title = sel[i].label;
    eqEl.textContent = eqText(c, sel[i]);
    sEl.addEventListener('change', function () {
      sel[i] = brandById(c, sEl.value) || c.brands[0];
      sEl.title = sel[i].label;
      eqEl.textContent = eqText(c, sel[i]);
      savedBrands[c.key] = sel[i].id;
      try { localStorage.setItem('osmonpt.brands', JSON.stringify(savedBrands)); } catch (e) {}
      update();
    });
  });

  /* ---------- Pestañas ---------- */
  var TABS = ['general', 'macro', 'elec', 'result'], cur = 'general', calc = $('calc');
  var dock = $('dock'), calcVisible = false;
  function syncDock() { dock.classList.toggle('on', calcVisible && cur !== 'result'); }

  function showTab(name, focusTab) {
    cur = name;
    calc.setAttribute('data-tab', name);
    TABS.forEach(function (t) {
      var on = t === name;
      $('tab-' + t).setAttribute('aria-selected', on);
      $('tab-' + t).tabIndex = on ? 0 : -1;
      $('pane-' + t).hidden = !on;
    });
    var idx = TABS.indexOf(name);
    $('prevTab').hidden = idx === 0;
    $('nextTab').hidden = idx === TABS.length - 1;
    $('nextTab').textContent = idx === TABS.length - 2 ? 'Ver resultados' : 'Siguiente';
    syncDock();
    if (focusTab) $('tab-' + name).focus();
  }
  function keepCalcInView() {
    var top = calc.getBoundingClientRect().top;
    if (top < 60) calc.scrollIntoView({ block: 'start' });
  }
  TABS.forEach(function (t, i) {
    $('tab-' + t).addEventListener('click', function () { showTab(t); });
    $('tab-' + t).addEventListener('keydown', function (e) {
      var to = null;
      if (e.key === 'ArrowRight') to = (i + 1) % TABS.length;
      else if (e.key === 'ArrowLeft') to = (i + TABS.length - 1) % TABS.length;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = TABS.length - 1;
      if (to !== null) { e.preventDefault(); showTab(TABS[to], true); }
    });
  });
  $('prevTab').addEventListener('click', function () { showTab(TABS[TABS.indexOf(cur) - 1]); keepCalcInView(); });
  $('nextTab').addEventListener('click', function () { showTab(TABS[TABS.indexOf(cur) + 1]); keepCalcInView(); });
  $('toResults').addEventListener('click', function () { showTab('result'); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { calcVisible = es[0].isIntersecting; syncDock(); }, { threshold: 0.05 }).observe($('calculadora'));
  } else { calcVisible = true; }

  /* ---------- Entradas ---------- */
  var inputs = [vtEl, wtEl].concat(doseEls);
  function focusInput(el) {
    var p = el.closest('.pane');
    if (p) showTab(p.id.replace('pane-', ''));
    el.focus();
  }
  inputs.forEach(function (el, idx) {
    el.addEventListener('input', update);
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var n = inputs[idx + 1];
      if (n) focusInput(n); else showTab('result', true);
    });
  });

  function goCalc() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('calculadora').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  Array.prototype.forEach.call(document.querySelectorAll('a[href^="#"]'), function (a) {
    a.addEventListener('click', function (e) {
      var t = document.getElementById(a.getAttribute('href').slice(1));
      if (!t) return;
      e.preventDefault();
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });
  $('newEval').addEventListener('click', function () {
    inputs.forEach(function (el) { el.value = ''; });
    codeState = null;
    update();
    showTab('general');
    goCalc();
    vtEl.focus({ preventScroll: true });
  });
  $('startEval').addEventListener('click', function (e) {
    e.preventDefault();
    showTab('general');
    goCalc();
    (hospEl.value ? vtEl : hospEl).focus({ preventScroll: true });
  });

  /* ---------- Cálculo y resultados ---------- */
  var resultsEl = $('results'), scaleEl = $('scale');

  function update() {
    var vt = read(vtEl), wt = read(wtEl);
    var bad = vt.s === 'bad' || wt.s === 'bad';
    [[vtEl, vt], [wtEl, wt]].forEach(function (p) {
      var inv = p[1].s === 'bad';
      p[0].setAttribute('aria-invalid', inv);
      p[0].parentNode.classList.toggle('bad', inv);
    });
    var dosis = doseEls.map(function (el) {
      var r = read(el), inv = r.s === 'bad';
      el.setAttribute('aria-invalid', inv);
      el.parentNode.classList.toggle('bad', inv);
      if (inv) bad = true;
      return r.s === 'ok' ? r.v : null;
    });
    $('volHint').hidden = !(vt.s === 'ok' && vt.v > 5);   // el volumen va en litros

    var baseReady = vt.s === 'ok' && wt.s === 'ok' && vt.v > 0 && wt.v > 0;
    var res = baseReady && !bad ? compute(vt.v, wt.v, dosis, sel) : null;

    COMPONENTS.forEach(function (c, i) {
      var r = res && res.rows[i];
      volCells[i].textContent = r ? fmt(r.ml, 2) : '—';
      osmCells[i].textContent = r ? fmt(r.mo, 1) : '—';
    });

    var state, show = false;
    if (bad) state = 'invalid';
    else if (!baseReady) state = 'empty';
    else if (!res.any) state = 'nodose';
    else { show = true; state = res.osmL > LIMIT ? 'central' : 'ok'; }
    resultsEl.setAttribute('data-state', state);

    /* Aviso principal */
    var M = {
      empty:   ['neutral', 'i-info',  'Aún no hay resultados', 'Ingrese el volumen total, el peso y la dosis de al menos un componente.'],
      nodose:  ['neutral', 'i-info',  'Ingrese la dosis de al menos un componente', 'La osmolaridad se calcula con los componentes prescritos.'],
      invalid: ['warn',    'i-alert', 'Revise los campos marcados en rojo', 'Use solo números positivos. Puede escribir el decimal con punto o con coma.'],
      ok:      ['ok',      'i-ok',    'Orientación: vía periférica según osmolaridad calculada', 'Osmolaridad de 900 mOsm/L o menos.'],
      central: ['danger',  'i-alert', 'Orientación: vía central según osmolaridad calculada', 'Supera 900 mOsm/L, el límite de referencia para vía periférica.']
    }[state];
    tone($('banner'), M[0]);
    $('bannerIcon').innerHTML = ico(M[1]);
    $('bannerT').textContent = M[2];
    $('bannerS').textContent = M[3];

    /* Orientación de acceso venoso */
    var R = { ok: ['ok', 'Periférica', 'Osmolaridad de 900 mOsm/L o menos.'], central: ['danger', 'Central', 'Osmolaridad superior a 900 mOsm/L.'] }[state]
            || ['neutral', '—', 'Pendiente de cálculo.'];
    tone($('routeCard'), R[0]);
    $('routeState').textContent = R[1];
    $('routeSub').textContent = R[2];
    tone($('liveRoute'), R[0]);
    $('liveRouteTxt').textContent = show ? (state === 'ok' ? 'Orientación: vía periférica' : 'Orientación: vía central') : 'Sin resultado';

    /* Osmolaridad y escala */
    var osmTxt = show ? fmt(res.osmL, 1) : '—';
    $('osmVal').textContent = osmTxt;
    $('liveOsm').textContent = osmTxt;
    $('dockVal').textContent = osmTxt;
    var max = 1200;
    if (show) max = Math.max(1200, Math.ceil((res.osmL * 1.08) / 100) * 100);
    scaleEl.style.setProperty('--thr', (LIMIT / max * 100) + '%');
    scaleEl.style.setProperty('--pos', (show ? Math.min(res.osmL / max, 1) * 100 : 0) + '%');

    /* Proteínas y calorías */
    $('protG').textContent = show ? fmt(res.protG, 1) : '—';
    $('protKg').textContent = show ? fmt(res.protG / wt.v, 1) : '—';
    $('kT').textContent = show ? fmt(res.kcalT, 1) : '—';
    $('kP').textContent = show ? fmt(res.kcalP, 1) + ' kcal' : '—';
    $('kN').textContent = show ? fmt(res.kcalNP, 1) + ' kcal' : '—';
    $('kTk').textContent = show ? fmt(res.kcalT / wt.v, 1) + ' kcal/kg' : '—';

    /* Agua y volúmenes */
    var waterEl = $('water');
    waterEl.textContent = show ? fmt(res.water, 2) : '—';
    waterEl.className = show && res.water < 0 ? 'neg' : '';
    $('vcTot').textContent = show ? fmt(res.VC, 2) + ' mL' : '—';
    $('moTot').textContent = show ? fmt(res.TO, 1) + ' mOsm' : '—';
    $('vtMl').textContent = baseReady && !bad ? fmt(vt.v * 1000, 2) + ' mL' : '—';

    /* Validación de volumen */
    var exceeded = show && res.exceeded;
    var V = !show
      ? ['neutral', 'i-check', 'Pendiente de cálculo', 'Se validará cuando complete los datos.']
      : exceeded
        ? ['warn', 'i-alert', 'Revise el volumen total de la formulación',
           'Los componentes suman ' + fmt(res.VC, 2) + ' mL y superan el volumen total (' + fmt(vt.v * 1000, 2) + ' mL). Corrija el volumen o las dosis antes de usar la osmolaridad mostrada.']
        : ['ok', 'i-ok', 'Volumen coherente',
           'Los componentes suman ' + fmt(res.VC, 2) + ' mL de los ' + fmt(vt.v * 1000, 2) + ' mL prescritos.'];
    tone($('volCard'), V[0]);
    $('volCard').querySelector('use').setAttribute('href', '#' + V[1]);
    $('volT').textContent = V[2];
    $('volS').textContent = V[3];
    $('liveVol').hidden = !exceeded;
    $('toResults').disabled = !show;

    /* Barra inferior (móvil) */
    tone(dock, show ? (state === 'ok' ? 'ok' : 'danger') : (bad ? 'warn' : 'neutral'));
    $('dockTxt').textContent = show ? (state === 'ok' ? 'Orientación: vía periférica' : 'Orientación: vía central')
                                    : (bad ? 'Revise los campos marcados' : 'Ingrese los datos');
    $('dockVol').hidden = !exceeded;

    /* Código de referencia e impresión */
    var hosp = HOSP_BY_CODE[hospEl.value] || null;
    lastPrint = show ? { vt: vt.v, wt: wt.v, res: res, doses: dosis, hosp: hosp, brands: sel.slice() } : null;
    var sigNow = (show && hosp) ? canonical(hosp.code, vt.v, wt.v, dosis, sel.map(function (b) { return b.id; })) : null;
    if (codeState && codeState.sig !== sigNow) codeState = null;   // cambió el cálculo: el código anterior ya no aplica
    $('codeLine').hidden = !codeState;
    if (codeState) $('codeVal').textContent = codeState.code;
    $('print').disabled = !(show && hosp);
    var needHosp = show && !hosp;
    $('printHint').hidden = !needHosp;
    $('printHint').textContent = needHosp ? 'Seleccione el hospital en Datos generales para poder imprimir y generar el código de referencia.' : '';
  }

  /* ---------- Hoja de resumen para imprimir ---------- */
  function ensureCode() {
    if (!lastPrint || !lastPrint.hosp) return null;
    var sig = canonical(lastPrint.hosp.code, lastPrint.vt, lastPrint.wt, lastPrint.doses, lastPrint.brands.map(function (b) { return b.id; }));
    if (!codeState || codeState.sig !== sig) codeState = { sig: sig, code: makeCode(lastPrint.hosp.code, new Date(), sig) };
    $('codeLine').hidden = false;
    $('codeVal').textContent = codeState.code;
    return codeState.code;
  }

  function buildPrint() {
    var now;
    try { now = new Date().toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short' }); }
    catch (e) { now = new Date().toLocaleString(); }

    var foot =
      '<div class="ps-foot"><p>Este código identifica únicamente el resumen impreso. Los cálculos y los datos ingresados se procesan localmente en el navegador y no se almacenan en OsmoNPT.</p>' +
      '<p>OsmoNPT es una herramienta de apoyo para la evaluación de formulaciones de Nutrición Parenteral. No sustituye el juicio clínico, la prescripción individualizada ni la validación farmacéutica.</p>' +
      '<p>© 2026 OsmoNPT. Todos los derechos reservados.</p></div>';
    function head(code) {
      return '<div class="ps-head"><div><img class="ps-logo" src="' + $('logo').src + '" alt="OsmoNPT"><h1>Resumen de evaluación de NPT</h1>' +
        '<p class="ps-sub">Impreso el ' + now + '</p></div>' +
        (code ? '<div class="ps-code"><span>Código de referencia</span><strong>' + code + '</strong><em>Anótelo en la orden o expediente físico</em></div>' : '') +
        '</div>';
    }

    var el = $('printSheet');
    if (!lastPrint || !lastPrint.hosp) {
      el.innerHTML = head(null) + '<p>' + (lastPrint
        ? 'Seleccione el hospital para generar el código de referencia.'
        : 'Complete el hospital, el volumen total, el peso y las dosis para generar el resumen.') + '</p>' + foot;
      return;
    }
    var L = lastPrint, r = L.res, central = r.osmL > LIMIT, code = ensureCode();

    var rows = '';
    COMPONENTS.forEach(function (c, i) {
      var d = L.doses[i];
      if (d === null || d <= 0) return;
      rows += '<tr><td>' + c.name + '<span class="ps-bl">' + L.brands[i].label + '</span></td><td class="num">' + d + ' ' + c.unit + '/kg</td><td class="num">' +
        fmt(r.rows[i].ml, 2) + '</td><td class="num">' + fmt(r.rows[i].mo, 1) + '</td></tr>';
    });

    var alertHtml = r.exceeded
      ? '<div class="ps-alert"><strong>Revise el volumen total de la formulación</strong>Los componentes suman ' + fmt(r.VC, 2) +
        ' mL y superan el volumen total (' + fmt(L.vt * 1000, 2) + ' mL). Corrija el volumen o las dosis antes de usar la osmolaridad.</div>'
      : '';

    el.innerHTML = head(code) +
      '<dl class="ps-data"><div><dt>Hospital</dt><dd>' + L.hosp.name + '</dd></div>' +
      '<div><dt>Volumen total</dt><dd>' + L.vt + ' L (' + fmt(L.vt * 1000, 2) + ' mL)</dd></div>' +
      '<div><dt>Peso</dt><dd>' + L.wt + ' kg</dd></div></dl>' +
      '<table><thead><tr><th>Componente</th><th class="num">Dosis prescrita</th><th class="num">Volumen (mL)</th><th class="num">Osmolaridad (mOsm)</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><th colspan="2">Total de los componentes</th><td class="num">' + fmt(r.VC, 2) + '</td><td class="num">' + fmt(r.TO, 1) + '</td></tr></tfoot></table>' +
      '<div class="ps-result"><span class="ps-osm">' + fmt(r.osmL, 1) + '</span><span>mOsm/L</span></div>' +
      '<p class="ps-verdict' + (central ? ' central' : '') + '">' +
        (central ? 'Orientación: vía central según osmolaridad calculada<span>Supera 900 mOsm/L, el límite de referencia para vía periférica.</span>'
                 : 'Orientación: vía periférica según osmolaridad calculada<span>Osmolaridad de 900 mOsm/L o menos.</span>') + '</p>' +
      alertHtml +
      '<div class="ps-two">' +
        '<table><thead><tr><th colspan="2">Volúmenes y proteína</th></tr></thead><tbody>' +
          '<tr><td>Agua para completar</td><td class="num">' + fmt(r.water, 2) + ' mL</td></tr>' +
          '<tr><td>Volumen total de la fórmula</td><td class="num">' + fmt(L.vt * 1000, 2) + ' mL</td></tr>' +
          '<tr><td>Aporte proteico (aminoácidos)</td><td class="num">' + fmt(r.protG, 1) + ' g (' + fmt(r.protG / L.wt, 1) + ' g/kg)</td></tr></tbody></table>' +
        '<table><thead><tr><th>Aporte calórico</th><th class="num">kcal</th><th class="num">kcal/kg</th></tr></thead><tbody>' +
          '<tr><td>Proteicas</td><td class="num">' + fmt(r.kcalP, 1) + '</td><td class="num">' + fmt(r.kcalP / L.wt, 1) + '</td></tr>' +
          '<tr><td>No proteicas</td><td class="num">' + fmt(r.kcalNP, 1) + '</td><td class="num">' + fmt(r.kcalNP / L.wt, 1) + '</td></tr></tbody>' +
          '<tfoot><tr><th>Total</th><td class="num">' + fmt(r.kcalT, 1) + '</td><td class="num">' + fmt(r.kcalT / L.wt, 1) + '</td></tr></tfoot></table>' +
      '</div>' +
      foot;
  }

  $('print').addEventListener('click', function () {
    buildPrint();
    try { window.print(); } catch (e) { /* si el navegador lo bloquea, Ctrl+P imprime la misma hoja */ }
  });
  window.addEventListener('beforeprint', buildPrint); // también con Ctrl+P

  showTab('general');
  update();
})();
