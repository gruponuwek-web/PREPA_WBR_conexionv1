/* ============================================================
   WBR Portal — Módulo: Generación de PDF único por sesión
   ============================================================ */

function abrirExportPanel(sid) {
  const ses = _getSesionData(sid);
  if (!ses) { toast('Sesión no encontrada', 'error'); return; }
  document.getElementById('exportSesionTitle').textContent =
    `${sid} · ${ses.semana} · ${_fmtFecha(ses.fecha)}`;
  document.getElementById('exportSesionId').value = sid;
  _setBtnState('idle');
  document.getElementById('exportPanelOverlay').classList.add('open');
}

function cerrarExportPanel() {
  document.getElementById('exportPanelOverlay').classList.remove('open');
}

function _getSesionData(sid) {
  const califs = (state.calificaciones  || []).filter(c => String(c.ID_Sesion) === String(sid));
  const acts   = (state.acciones        || []).filter(a => String(a.ID_Sesion) === String(sid));
  const descs  = (state.descubrimientos || []).filter(d => String(d.ID_Sesion) === String(sid));
  const equipo = (state.equipo          || []).filter(e => e.Rol !== 'Coordinador');
  const fecha  = califs[0]?.Fecha  || acts[0]?.Creado_En || '';
  const semana = califs[0]?.Semana || '';
  return { sid, fecha, semana, califs, acts, descs, equipo };
}

function _fmtFecha(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
}

function _setBtnState(estado) {
  const badge = document.getElementById('badgePdf');
  const map = {
    idle:    { text:'—',  cls:'badge-idle' },
    loading: { text:'⏳', cls:'badge-loading' },
    done:    { text:'✅', cls:'badge-done' },
    error:   { text:'❌', cls:'badge-error' },
  };
  if (badge) { badge.textContent = map[estado].text; badge.className = `export-badge ${map[estado].cls}`; }
}

// Obtiene nombres de KPIs para un rol, buscando de forma flexible
function _getKpiNombres(rol) {
  if (!state.kpis || !rol) return [];
  const rolLimpio = String(rol).trim();
  // Búsqueda exacta primero
  if (state.kpis[rolLimpio]) return state.kpis[rolLimpio];
  // Búsqueda case-insensitive
  const key = Object.keys(state.kpis).find(k => k.toLowerCase() === rolLimpio.toLowerCase());
  return key ? state.kpis[key] : [];
}

function _buildPdf(ses) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W = 210, M = 14;
  let y = M;

  _pdfHeader(doc, ses, y);
  y += 30;

  // ══ SECCIÓN 1: KPIs ══
  y = _seccionTitulo(doc, '1. KPIs del Equipo', y, W, M);

  ses.equipo.forEach(v => {
    // Buscar la calificación más reciente del vendedor en esta sesión
    const cals = ses.califs.filter(c => String(c.Vendedor).trim() === String(v.Nombre).trim());
    const cal  = cals[cals.length - 1]; // última calificación
    const kpiNombres = _getKpiNombres(v.Rol);

    if (y > 255) { doc.addPage(); y = M; }
    y = _vendedorHeader(doc, v, cal, y, W, M);

    if (!cal) {
      doc.setFontSize(8.5); doc.setTextColor(150,150,150);
      doc.text('Sin calificación registrada', M+4, y+5);
      y += 10; return;
    }

    const kpiEntries = Object.entries(cal)
      .filter(([k]) => k.startsWith('KPI_'))
      .filter(([k]) => parseInt(k.replace('KPI_','')) <= _maxKpisParaRol(cal?.Rol || v.Rol))
      .filter(([,v]) => v !== 'N/A' && v !== '' && v !== null && v !== undefined)
      .sort(([a],[b]) => parseInt(a.replace('KPI_','')) - parseInt(b.replace('KPI_','')));

    if (!kpiEntries.length) {
      doc.setFontSize(8.5); doc.setTextColor(150,150,150);
      doc.text('Sin KPIs registrados', M+4, y+5);
      y += 10; return;
    }

    kpiEntries.forEach(([k, val], i) => {
      if (y > 270) { doc.addPage(); y = M; }
      const idx    = parseInt(k.replace('KPI_','')) - 1;
      const nombre = (kpiNombres.length > idx && kpiNombres[idx]) ? kpiNombres[idx] : k.replace('KPI_','KPI ');
      const cumple = val === '✅' || val === true || String(val).toLowerCase() === 'true';

      doc.setFillColor(i % 2 === 0 ? 255 : 247, i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 252);
      doc.rect(M+2, y, W-M*2-2, 7, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(55,55,55);
      doc.text(nombre, M+5, y+5);
      doc.setTextColor(cumple ? 5:210, cumple ? 150:30, cumple ? 105:30);
      doc.text(cumple ? '✓ Cumplido' : '✗ No cumplido', W-M-30, y+5);
      doc.setTextColor(55,55,55);
      y += 7;
    });
    y += 5;
  });

  // ══ SECCIÓN 2: Descubrimientos ══
  if (y > 235) { doc.addPage(); y = M; } else { y += 6; }
  y = _seccionTitulo(doc, '2. Descubrimientos', y, W, M);

  ses.equipo.forEach(v => {
    const desc = ses.descs.find(d => String(d.Vendedor).trim() === String(v.Nombre).trim());
    const cal  = ses.califs.find(c => String(c.Vendedor).trim() === String(v.Nombre).trim());

    if (y > 255) { doc.addPage(); y = M; }
    y = _vendedorHeader(doc, v, cal, y, W, M);

    const texto = desc?.Descubrimiento;
    if (!texto) {
      doc.setFontSize(8.5); doc.setTextColor(150,150,150);
      doc.text('Sin descubrimiento registrado', M+4, y+5);
      y += 10; return;
    }

    doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(55,55,55);
    doc.setFillColor(255,251,235);
    const lines = doc.splitTextToSize(texto, W-M*2-10);
    const boxH  = lines.length * 5 + 6;
    if (y + boxH > 270) { doc.addPage(); y = M; }
    doc.rect(M+2, y, W-M*2-2, boxH, 'F');
    lines.forEach((line, i) => { doc.text(line, M+5, y+5+(i*5)); });
    y += boxH + 5;
  });

  // ══ SECCIÓN 3: Acciones ══
  if (y > 220) { doc.addPage(); y = M; } else { y += 6; }
  y = _seccionTitulo(doc, '3. Plan de Acciones', y, W, M);

  const prioColor = { Alta:[220,38,38], Media:[217,119,6], Baja:[5,150,105] };

  ses.equipo.forEach(v => {
    const vActs = ses.acts.filter(a => String(a.Vendedor).trim() === String(v.Nombre).trim());
    const cal   = ses.califs.find(c => String(c.Vendedor).trim() === String(v.Nombre).trim());

    if (y > 255) { doc.addPage(); y = M; }
    y = _vendedorHeader(doc, v, cal, y, W, M);

    if (!vActs.length) {
      doc.setFontSize(8.5); doc.setTextColor(150,150,150);
      doc.text('Sin acciones registradas', M+4, y+5);
      y += 10; return;
    }

    vActs.forEach((a, i) => {
      if (y > 263) { doc.addPage(); y = M; }
      doc.setFillColor(i % 2 === 0 ? 255 : 247, i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 252);
      doc.rect(M+2, y, W-M*2-2, 11, 'F');

      doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(30,30,30);
      doc.text(`${i+1}. ${a.Descripcion||'—'}`, M+5, y+5);

      doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
      const [r,g,b] = prioColor[a.Prioridad] || [100,100,100];
      doc.setTextColor(r,g,b);
      doc.text(a.Prioridad||'—', M+5, y+9.5);
      doc.setTextColor(100,100,100);
      doc.text(`Cliente: ${a.Cliente||'—'}`, M+22, y+9.5);
      doc.text(`Compromiso: ${_fmtFecha(a.Fecha_Compromiso)}`, M+75, y+9.5);
      doc.text(`${a.Resultado_Esperado||'—'}`, M+130, y+9.5);
      y += 12;
    });
    y += 3;
  });

  // Resumen
  if (y > 265) { doc.addPage(); y = M; } else { y += 5; }
  const alta  = ses.acts.filter(a=>a.Prioridad==='Alta').length;
  const media = ses.acts.filter(a=>a.Prioridad==='Media').length;
  const baja  = ses.acts.filter(a=>a.Prioridad==='Baja').length;
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(60,60,60);
  doc.text(`Total acciones: ${ses.acts.length}  ·  Alta: ${alta}  ·  Media: ${media}  ·  Baja: ${baja}`, M, y);

  _pdfFooter(doc, ses.sid);
  return doc;
}

function _pdfHeader(doc, ses, y) {
  const W = 210, M = 14;
  doc.setFillColor(37,99,235);
  doc.rect(0, 0, W, 24, 'F');
  doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text('WBR Portal', M, 11);
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text('Reporte de Sesión', M, 18);
  doc.setFontSize(8);
  doc.text(`Sesión: ${ses.sid}`,             W-M, 8,  {align:'right'});
  doc.text(`Período: ${ses.semana||'—'}`,    W-M, 13, {align:'right'});
  doc.text(`Fecha: ${_fmtFecha(ses.fecha)}`, W-M, 18, {align:'right'});
  doc.text(`Coordinador: ${COORD}`,          W-M, 23, {align:'right'});
  doc.setTextColor(30,30,30);
}

function _seccionTitulo(doc, titulo, y, W, M) {
  doc.setFillColor(37,99,235);
  doc.rect(M, y, W-M*2, 8, 'F');
  doc.setFontSize(9.5); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text(titulo, M+4, y+5.5);
  doc.setTextColor(30,30,30);
  return y + 11;
}

function _vendedorHeader(doc, v, cal, y, W, M) {
  let pct = null;
  if (cal) {
    pct = calcPctFromKpis(cal, cal.Rol || v.Rol);
  }
  doc.setFillColor(239,244,255);
  doc.rect(M+2, y, W-M*2-2, 8, 'F');
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(37,99,235);
  const nombreW = doc.getTextWidth(v.Nombre);
  doc.text(v.Nombre, M+5, y+5.5);
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(120,120,120);
  doc.text(v.Rol, M+5+nombreW+3, y+5.5);
  if (pct !== null) {
    const color = pct >= 80 ? [5,150,105] : pct >= 50 ? [217,119,6] : [220,38,38];
    doc.setTextColor(...color); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
    doc.text(`${pct}%`, W-M-3, y+5.5, {align:'right'});
  }
  doc.setTextColor(30,30,30);
  return y + 10;
}

function _pdfFooter(doc, sid) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(220,220,220); doc.line(14, H-10, W-14, H-10);
    doc.setFontSize(7); doc.setTextColor(150,150,150);
    doc.text(`WBR Portal · ${sid} · Generado ${new Date().toLocaleDateString('es-MX')}`, 14, H-5);
    doc.text(`Pág. ${i} / ${pages}`, W-14, H-5, {align:'right'});
  }
}

// ── ACCIONES PÚBLICAS ──────────────────────────────────────────
function descargarPdf() {
  const sid = document.getElementById('exportSesionId').value;
  const ses = _getSesionData(sid);
  _setBtnState('loading');
  try {
    const doc = _buildPdf(ses);
    doc.save(`${sid}_Reporte_WBR.pdf`);
    _setBtnState('done');
    toast('PDF descargado');
  } catch(e) {
    _setBtnState('error');
    toast('Error al generar PDF', 'error');
    console.error(e);
  }
}

async function guardarEnDrive() {
  const sid = document.getElementById('exportSesionId').value;
  const ses = _getSesionData(sid);
  _setBtnState('loading');
  try {
    const doc    = _buildPdf(ses);
    const b64    = doc.output('datauristring').split(',')[1];
    const nombre = `${sid}_Reporte_WBR.pdf`;
    const res    = await post('savePdfToDrive', { nombre, b64, folderId: DRIVE_FOLDER_ID });
    if (res.success) { _setBtnState('done'); toast('PDF guardado en Drive'); }
    else throw new Error(res.error || 'Error Drive');
  } catch(e) {
    _setBtnState('error');
    toast('Error al guardar en Drive: ' + e.message, 'error');
    console.error(e);
  }
}

function descargarTodos()      { descargarPdf(); }
function guardarTodosEnDrive() { guardarEnDrive(); }