/* ============================================================
   WBR Portal — Módulo: Dashboard
   ============================================================
   Contiene: filtros de fecha, renderDashboard, métricas
   globales, lista de equipo, gráfico de prioridades y
   tabla de últimas acciones.
   ============================================================ */

// ── FILTROS DE FECHA ───────────────────────────────────────────
function getFiltroFecha() {
  const ini = document.getElementById('dashFechaInicio')?.value;
  const fin = document.getElementById('dashFechaFin')?.value;
  return { ini: ini || null, fin: fin || null };
}

function setFiltroRapido(tipo) {
  const hoy = new Date();
  let ini, fin;
  if (tipo === 'semana') {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() - hoy.getDay());
    ini = d.toISOString().split('T')[0];
    const fSem = new Date(d); fSem.setDate(d.getDate() + 6);
    fin = fSem.toISOString().split('T')[0];
  } else if (tipo === 'mes') {
    ini = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`;
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate();
    fin = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`;
  } else if (tipo === 'trimestre') {
    const m = hoy.getMonth();
    const qStart = Math.floor(m/3)*3;
    const qEnd   = qStart + 2;
    ini = `${hoy.getFullYear()}-${String(qStart+1).padStart(2,'0')}-01`;
    const ultimoDiaQ = new Date(hoy.getFullYear(), qEnd+1, 0).getDate();
    fin = `${hoy.getFullYear()}-${String(qEnd+1).padStart(2,'0')}-${String(ultimoDiaQ).padStart(2,'0')}`;
  }
  document.getElementById('dashFechaInicio').value = ini;
  document.getElementById('dashFechaFin').value    = fin;
  renderDashboard();
}

function clearFiltroFecha() {
  document.getElementById('dashFechaInicio').value = '';
  document.getElementById('dashFechaFin').value    = '';
  renderDashboard();
}

function filtrarPorFecha(items, campoFecha) {
  const { ini, fin } = getFiltroFecha();
  if (!ini && !fin) return items;
  return items.filter(item => {
    const val = item[campoFecha];
    if (!val) return true;
    const d = new Date(val).toISOString().split('T')[0];
    if (ini && d < ini) return false;
    if (fin && d > fin) return false;
    return true;
  });
}

// ── RENDER DASHBOARD ───────────────────────────────────────────
function renderDashboard() {
  const { acciones: todasAcciones, calificaciones: todasCal, equipo } = state;

  const acciones       = filtrarPorFecha(todasAcciones, 'Fecha_Compromiso');
  const calificaciones = filtrarPorFecha(todasCal, 'Fecha');

  const pend = acciones.filter(a => a.Estatus === 'Pendiente').length;
  const cerr = acciones.filter(a => a.Estatus === 'Cerrado').length;
  const sess = [...new Set(calificaciones.map(c => c.ID_Sesion).filter(Boolean))].length;
  const vals = calificaciones.map(c => parseFloat(c['% Cumplimiento'])).filter(v => !isNaN(v) && v <= 1);
  const kpiPct = vals.length ? Math.round(vals.reduce((a,b) => a+b, 0) / vals.length * 100) + '%' : '—';

  // Label de período activo
  const { ini, fin } = getFiltroFecha();
  const periodoLabel = ini||fin
    ? `<span style="font-size:12px;color:var(--accent);margin-left:8px">📅 ${ini?fmtDate(ini):'inicio'} → ${fin?fmtDate(fin):'hoy'}</span>`
    : '';
  const h2 = document.querySelector('#page-dashboard .page-header h2');
  if (h2) h2.innerHTML = 'Dashboard' + periodoLabel;

  // Stats
  document.getElementById('statSesiones').textContent   = sess;
  document.getElementById('statPendientes').textContent = pend;
  document.getElementById('statCerradas').textContent   = cerr;
  document.getElementById('statKpi').textContent        = kpiPct;

  // Equipo
  const vends = equipo.filter(e => e.Rol !== 'Coordinador');
  document.getElementById('equipoList').innerHTML = vends.length ? vends.map(v => {
    const mis = acciones.filter(a => a.Vendedor === v.Nombre);
    const vp  = mis.filter(a => a.Estatus === 'Pendiente').length;
    const vc  = mis.filter(a => a.Estatus === 'Cerrado').length;
    const pct = mis.length ? Math.round(vc / mis.length * 100) : 0;
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      <div class="avatar" style="width:34px;height:34px;font-size:11px">${v.Nombre.split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500">${v.Nombre}</div>
        <div style="font-size:11px;color:var(--muted)">${v.Rol} · ${vp} pendiente(s)</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div style="text-align:right;font-size:13px;font-weight:600">${pct}%</div>
    </div>`;
  }).join('') : '<div class="empty"><p>Sin datos</p></div>';

  // Gráfico de prioridades
  const alta  = acciones.filter(a => a.Prioridad==='Alta'  && a.Estatus!=='Cerrado').length;
  const media = acciones.filter(a => a.Prioridad==='Media' && a.Estatus!=='Cerrado').length;
  const baja  = acciones.filter(a => a.Prioridad==='Baja'  && a.Estatus!=='Cerrado').length;
  const maxP  = Math.max(alta, media, baja, 1);
  document.getElementById('prioChart').innerHTML = [
    ['Alta', alta, 'var(--red)'],
    ['Media', media, 'var(--yellow)'],
    ['Baja', baja, 'var(--green)']
  ].map(([l,v,c]) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div style="width:44px;font-size:12px;color:var(--text2)">${l}</div>
      <div style="flex:1;height:8px;background:var(--border);border-radius:99px;overflow:hidden">
        <div style="width:${Math.round(v/maxP*100)}%;height:100%;background:${c};border-radius:99px"></div>
      </div>
      <div style="width:20px;text-align:right;font-size:13px;font-weight:600">${v}</div>
    </div>`).join('');

  // Últimas acciones
  const ult = [...acciones].slice(-5).reverse();
  document.getElementById('ultimasAcciones').innerHTML = ult.length ? `
    <div class="table-wrap"><table>
      <thead><tr><th>Vendedor</th><th>Clasificación</th><th>Prioridad</th><th>Descripción</th><th>Compromiso</th><th>Estatus</th></tr></thead>
      <tbody>${ult.map(a => `<tr>
        <td>${a.Vendedor}</td>
        <td>${badgeClasif(a.Clasificacion)}</td>
        <td>${badgePrio(a.Prioridad)}</td>
        <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.Descripcion}</td>
        <td>${fmtDate(a.Fecha_Compromiso)}</td>
        <td>${badgeEst(a.Estatus)}</td>
      </tr>`).join('')}</tbody>
    </table></div>` :
    '<div class="empty"><div class="ei">📋</div><p>No hay acciones aún</p></div>';
}
