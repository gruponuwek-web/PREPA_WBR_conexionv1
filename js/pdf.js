/* ============================================================
   WBR Portal — Módulo: Generación de PDFs
   ============================================================
   Genera 3 PDFs por sesión (KPIs, Descubrimientos, Acciones)
   con opción de descarga local o guardar en Google Drive.

   Dependencias:
   · jsPDF  (cargado desde CDN en index.html)
   · config.js → API, DRIVE_FOLDER_ID
   · utils.js  → state, COORD, post(), toast()
   ============================================================ */

// ── PANEL DE EXPORTACIÓN ───────────────────────────────────────
function abrirExportPanel(sid) {
  const ses = _getSesionData(sid);
  if (!ses) { toast('Sesión no encontrada', 'error'); return; }

  document.getElementById('exportSesionTitle').textContent =
    `${sid} · ${ses.semana} · ${_fmtFecha(ses.fecha)}`;
  document.getElementById('exportSesionId').value = sid;

  // Reset estados de botones
  ['Kpis','Desc','Acc'].forEach(t => {
    _setBtnState(t, 'idle');
  });

  document.getElementById('exportPanelOverlay').classList.add('open');
}

function cerrarExportPanel() {
  document.getElementById('exportPanelOverlay').classList.remove('open');
}

// ── HELPERS INTERNOS ───────────────────────────────────────────
function _getSesionData(sid) {
  const califs = (state.calificaciones || []).filter(c => String(c.ID_Sesion) === String(sid));
  const acts   = (state.acciones       || []).filter(a => String(a.ID_Sesion) === String(sid));
  const descs  = (state.descubrimientos|| []).filter(d => String(d.ID_Sesion) === String(sid));
  const equipo = (state.equipo         || []).filter(e => e.Rol !== 'Coordinador');
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

function _setBtnState(tipo, estado) {
  // tipo: 'Kpis' | 'Desc' | 'Acc'
  // estado: 'idle' | 'loading' | 'done' | 'error'
  const badge = document.getElementById(`badge${tipo}`);
  const map = {
    idle:    { text:'—',       cls:'badge-idle' },
    loading: { text:'⏳',      cls:'badge-loading' },
    done:    { text:'✅',      cls:'badge-done' },
    error:   { text:'❌',      cls:'badge-error' },
  };
  if (badge) {
    badge.textContent = map[estado].text;
    badge.className   = `export-badge ${map[estado].cls}`;
  }
}

// ── PDF 1: KPIs ────────────────────────────────────────────────
function _buildPdfKpis(ses) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W = 210, M = 14;
  let y = M;

  // Header
  _pdfHeader(doc, ses, 'KPIs del Equipo', y);
  y += 28;

  // Tabla
  doc.setFontSize(8);
  doc.setFont('helvetica','bold');
  doc.setFillColor(37, 99, 235);
  doc.setTextColor(255,255,255);
  doc.rect(M, y, W - M*2, 7, 'F');
  doc.text('VENDEDOR',        M+2,  y+5);
  doc.text('ROL',             M+45, y+5);
  doc.text('KPI',             M+75, y+5);
  doc.text('RESULTADO',       M+145,y+5);
  y += 7;

  doc.setFont('helvetica','normal');
  doc.setTextColor(30,30,30);

  let cumplidos = 0, total = 0;
  let rowAlt = false;

  ses.equipo.forEach(v => {
    const cal = ses.califs.find(c => c.Vendedor === v.Nombre);
    const kpiEntries = cal
      ? Object.entries(cal).filter(([k]) => k.startsWith('KPI_'))
      : [];

    if (!kpiEntries.length) {
      if (rowAlt) doc.setFillColor(245,247,250);
      else        doc.setFillColor(255,255,255);
      doc.rect(M, y, W-M*2, 7, 'F');
      doc.text(v.Nombre,  M+2,  y+5);
      doc.text(v.Rol,     M+45, y+5);
      doc.text('Sin KPIs registrados', M+75, y+5);
      y += 7; rowAlt = !rowAlt;
      return;
    }

    kpiEntries.forEach(([k, val], i) => {
      if (y > 270) { doc.addPage(); y = M; }
      if (rowAlt) doc.setFillColor(245,247,250);
      else        doc.setFillColor(255,255,255);
      doc.rect(M, y, W-M*2, 7, 'F');

      doc.text(i === 0 ? v.Nombre : '',  M+2,  y+5);
      doc.text(i === 0 ? v.Rol    : '',  M+45, y+5);

      const kpiNombre = k.replace('KPI_','KPI ');
      doc.text(kpiNombre, M+75, y+5);

      const cumple = String(val).toLowerCase() === 'true' || val === true || val === '✅';
      doc.setTextColor(cumple ? 5:220, cumple ? 150:38, cumple ? 105:38);
      doc.text(cumple ? '✓ Cumplido' : '✗ No cumplido', M+145, y+5);
      doc.setTextColor(30,30,30);

      if (cumple) cumplidos++;
      total++;
      y += 7; rowAlt = !rowAlt;
    });
  });

  // Resumen
  y += 6;
  const pct = total ? Math.round(cumplidos/total*100) : 0;
  doc.setFontSize(9);
  doc.setFont('helvetica','bold');
  doc.text(`Cumplimiento global: ${pct}%   (${cumplidos} de ${total} KPIs)`, M, y);

  // Barra de progreso
  y += 4;
  doc.setFillColor(220,220,220);
  doc.rect(M, y, 100, 4, 'F');
  doc.setFillColor(37,99,235);
  doc.rect(M, y, pct, 4, 'F');

  _pdfFooter(doc, ses.sid);
  return doc;
}

// ── PDF 2: DESCUBRIMIENTOS ─────────────────────────────────────
function _buildPdfDesc(ses) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W = 210, M = 14;
  let y = M;

  _pdfHeader(doc, ses, 'Descubrimientos del Equipo', y);
  y += 28;

  if (!ses.descs.length) {
    doc.setFontSize(10);
    doc.setTextColor(150,150,150);
    doc.text('No se registraron descubrimientos en esta sesión.', M, y+10);
    _pdfFooter(doc, ses.sid);
    return doc;
  }

  ses.equipo.forEach(v => {
    const desc = ses.descs.find(d => d.Vendedor === v.Nombre);
    if (!desc || !desc.Descubrimiento) return;

    if (y > 250) { doc.addPage(); y = M; }

    // Nombre vendedor
    doc.setFontSize(10);
    doc.setFont('helvetica','bold');
    doc.setFillColor(239,244,255);
    doc.rect(M, y, W-M*2, 8, 'F');
    doc.setTextColor(37,99,235);
    doc.text(`${v.Nombre}  ·  ${v.Rol}`, M+3, y+5.5);
    doc.setTextColor(30,30,30);
    y += 10;

    // Texto del descubrimiento
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(desc.Descubrimiento, W - M*2 - 4);
    lines.forEach(line => {
      if (y > 270) { doc.addPage(); y = M; }
      doc.text(line, M+2, y);
      y += 5;
    });
    y += 6;
  });

  _pdfFooter(doc, ses.sid);
  return doc;
}

// ── PDF 3: ACCIONES ────────────────────────────────────────────
function _buildPdfAcciones(ses) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
  const W = 297, M = 14;
  let y = M;

  _pdfHeader(doc, ses, 'Plan de Acciones', y, true);
  y += 28;

  if (!ses.acts.length) {
    doc.setFontSize(10);
    doc.setTextColor(150,150,150);
    doc.text('No se registraron acciones en esta sesión.', M, y+10);
    _pdfFooter(doc, ses.sid);
    return doc;
  }

  // Cabecera tabla
  doc.setFontSize(7.5);
  doc.setFont('helvetica','bold');
  doc.setFillColor(37,99,235);
  doc.setTextColor(255,255,255);
  doc.rect(M, y, W-M*2, 7, 'F');
  doc.text('#',          M+2,   y+5);
  doc.text('VENDEDOR',   M+8,   y+5);
  doc.text('CLASIF.',    M+40,  y+5);
  doc.text('TIPO',       M+72,  y+5);
  doc.text('CLIENTE',    M+98,  y+5);
  doc.text('RESULTADO',  M+130, y+5);
  doc.text('COMPROMISO', M+185, y+5);
  doc.text('PRIORIDAD',  M+220, y+5);
  doc.text('ESTATUS',    M+248, y+5);
  y += 7;

  doc.setFont('helvetica','normal');
  doc.setTextColor(30,30,30);

  const prioColor = { Alta:[220,38,38], Media:[217,119,6], Baja:[5,150,105] };
  let rowAlt = false;

  ses.acts.forEach((a, i) => {
    if (y > 185) { doc.addPage(); y = M; }
    if (rowAlt) doc.setFillColor(245,247,250);
    else        doc.setFillColor(255,255,255);
    doc.rect(M, y, W-M*2, 8, 'F');

    doc.setFontSize(7.5);
    doc.text(String(i+1),                    M+2,   y+5.5);
    doc.text(a.Vendedor||'—',                M+8,   y+5.5);
    doc.text(a.Clasificacion||'—',           M+40,  y+5.5);
    doc.text(a.Descripcion||'—',             M+72,  y+5.5);
    doc.text(a.Cliente||'—',                 M+98,  y+5.5);

    const res = doc.splitTextToSize(a.Resultado_Esperado||'—', 52);
    doc.text(res[0]||'—',                    M+130, y+5.5);

    doc.text(_fmtFecha(a.Fecha_Compromiso),  M+185, y+5.5);

    const [r,g,b] = prioColor[a.Prioridad] || [100,100,100];
    doc.setTextColor(r,g,b);
    doc.text(a.Prioridad||'—',               M+220, y+5.5);
    doc.setTextColor(30,30,30);

    doc.text(a.Estatus||'Pendiente',         M+248, y+5.5);

    y += 8; rowAlt = !rowAlt;
  });

  // Resumen pie
  y += 4;
  const alta  = ses.acts.filter(a=>a.Prioridad==='Alta').length;
  const media = ses.acts.filter(a=>a.Prioridad==='Media').length;
  const baja  = ses.acts.filter(a=>a.Prioridad==='Baja').length;
  const cerr  = ses.acts.filter(a=>a.Estatus==='Cerrado').length;
  doc.setFontSize(8);
  doc.setFont('helvetica','bold');
  doc.text(`Total: ${ses.acts.length} acciones  ·  🔴 Alta: ${alta}  ·  🟡 Media: ${media}  ·  🟢 Baja: ${baja}  ·  Cerradas: ${cerr}`, M, y);

  _pdfFooter(doc, ses.sid);
  return doc;
}

// ── UTILIDADES PDF ─────────────────────────────────────────────
function _pdfHeader(doc, ses, titulo, y, landscape=false) {
  const W = landscape ? 297 : 210;
  const M = 14;

  // Franja azul
  doc.setFillColor(37,99,235);
  doc.rect(0, 0, W, 22, 'F');

  // Logo / título sistema
  doc.setFontSize(13);
  doc.setFont('helvetica','bold');
  doc.setTextColor(255,255,255);
  doc.text('WBR Portal', M, 14);

  // Título del reporte
  doc.setFontSize(10);
  doc.setFont('helvetica','normal');
  doc.text(titulo, M + 38, 14);

  // Info sesión (derecha)
  doc.setFontSize(8);
  const infoX = W - M;
  doc.text(`Sesión: ${ses.sid}`,          infoX, 8,  {align:'right'});
  doc.text(`Período: ${ses.semana||'—'}`, infoX, 13, {align:'right'});
  doc.text(_fmtFecha(ses.fecha),          infoX, 18, {align:'right'});

  doc.setTextColor(30,30,30);
}

function _pdfFooter(doc, sid) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const W = doc.internal.pageSize.getWidth();
    doc.setFontSize(7);
    doc.setTextColor(150,150,150);
    doc.text(`WBR Portal · ${sid} · Generado ${new Date().toLocaleDateString('es-MX')}`, 14, doc.internal.pageSize.getHeight()-6);
    doc.text(`Pág. ${i} / ${pages}`, W-14, doc.internal.pageSize.getHeight()-6, {align:'right'});
  }
}

// ── ACCIONES PÚBLICAS: DESCARGAR ───────────────────────────────
function descargarPdf(tipo) {
  const sid = document.getElementById('exportSesionId').value;
  const ses = _getSesionData(sid);
  _setBtnState(_tipoKey(tipo), 'loading');
  try {
    const doc = _getPdfDoc(tipo, ses);
    doc.save(`${sid}_${tipo}.pdf`);
    _setBtnState(_tipoKey(tipo), 'done');
    toast(`${tipo} descargado`);
  } catch(e) {
    _setBtnState(_tipoKey(tipo), 'error');
    toast('Error al generar PDF', 'error');
    console.error(e);
  }
}

function descargarTodos() {
  const sid = document.getElementById('exportSesionId').value;
  const ses = _getSesionData(sid);
  ['KPIs','Descubrimientos','Acciones'].forEach(tipo => {
    try {
      const doc = _getPdfDoc(tipo, ses);
      doc.save(`${sid}_${tipo}.pdf`);
    } catch(e) { console.error(tipo, e); }
  });
  toast('3 PDFs descargados');
}

// ── ACCIONES PÚBLICAS: GUARDAR EN DRIVE ────────────────────────
async function guardarEnDrive(tipo) {
  const sid = document.getElementById('exportSesionId').value;
  const ses = _getSesionData(sid);
  _setBtnState(_tipoKey(tipo), 'loading');
  try {
    const doc      = _getPdfDoc(tipo, ses);
    const b64      = doc.output('datauristring').split(',')[1];
    const nombre   = `${sid}_${tipo}.pdf`;
    const res      = await post('savePdfToDrive', { nombre, b64, folderId: DRIVE_FOLDER_ID });
    if (res.success) {
      _setBtnState(_tipoKey(tipo), 'done');
      toast(`${tipo} guardado en Drive`);
    } else {
      throw new Error(res.error || 'Error Drive');
    }
  } catch(e) {
    _setBtnState(_tipoKey(tipo), 'error');
    toast('Error al guardar en Drive: ' + e.message, 'error');
    console.error(e);
  }
}

async function guardarTodosEnDrive() {
  const sid = document.getElementById('exportSesionId').value;
  const ses = _getSesionData(sid);
  let ok = 0;
  for (const tipo of ['KPIs','Descubrimientos','Acciones']) {
    try {
      const doc    = _getPdfDoc(tipo, ses);
      const b64    = doc.output('datauristring').split(',')[1];
      const nombre = `${sid}_${tipo}.pdf`;
      const res    = await post('savePdfToDrive', { nombre, b64, folderId: DRIVE_FOLDER_ID });
      if (res.success) ok++;
    } catch(e) { console.error(tipo, e); }
  }
  toast(`${ok}/3 PDFs guardados en Drive`);
}

// ── HELPERS ────────────────────────────────────────────────────
function _tipoKey(tipo) {
  return { KPIs:'Kpis', Descubrimientos:'Desc', Acciones:'Acc' }[tipo] || 'Kpis';
}
function _getPdfDoc(tipo, ses) {
  if (tipo === 'KPIs')             return _buildPdfKpis(ses);
  if (tipo === 'Descubrimientos')  return _buildPdfDesc(ses);
  if (tipo === 'Acciones')         return _buildPdfAcciones(ses);
  throw new Error('Tipo desconocido: ' + tipo);
}
