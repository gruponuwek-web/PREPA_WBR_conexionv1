/* ============================================================
   WBR Portal — Módulo: Agenda / Calendario
   ============================================================
   Contiene: estado del calendario, setVista, navFecha, irHoy,
   renderCalendario, renderMes, renderSemana, seleccionarDia,
   mostrarDetalle, renderAgenda.
   ============================================================ */

let calVista          = 'mes';
let calFecha          = new Date();
let calDiaSeleccionado = null;

function clasifClass(c) {
  const m = { 'Prospección':'prosp', 'Fidelización':'fidel', 'Crecimiento BCG':'bcg', 'Recuperación':'recup' };
  return m[c] || 'prosp';
}

function setVista(v, btn) {
  calVista = v;
  document.querySelectorAll('#tabMes,#tabSemana').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderCalendario();
}

function navFecha(dir) {
  if (calVista === 'mes') {
    calFecha = new Date(calFecha.getFullYear(), calFecha.getMonth() + dir, 1);
  } else {
    calFecha = new Date(calFecha.getTime() + dir * 7 * 86400000);
  }
  renderCalendario();
}

function irHoy() { calFecha = new Date(); renderCalendario(); }

function toDateKey(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function getAccionesFiltradas() {
  const fV = document.getElementById('calFiltroVendedor')?.value || '';
  const fE = document.getElementById('calFiltroEstatus')?.value  || '';
  const fC = document.getElementById('calFiltroClasif')?.value   || '';
  let data = state.acciones;
  if (fV) data = data.filter(a => a.Vendedor      === fV);
  if (fE) data = data.filter(a => a.Estatus       === fE);
  if (fC) data = data.filter(a => a.Clasificacion === fC);
  return data;
}

function renderCalendario() {
  const acciones = getAccionesFiltradas();
  const byDate   = {};
  acciones.forEach(a => {
    const k = toDateKey(a.Fecha_Compromiso);
    if (!k) return;
    if (!byDate[k]) byDate[k] = [];
    byDate[k].push(a);
  });
  if (calVista === 'mes') renderMes(byDate);
  else renderSemana(byDate);
}

function renderMes(byDate) {
  const year  = calFecha.getFullYear();
  const month = calFecha.getMonth();
  const today = toDateKey(new Date());

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('calTitulo').textContent = `${meses[month]} ${year}`;

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();
  const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  let html = `<div class="cal-header-row">${dias.map(d => `<div class="cal-day-name">${d}</div>`).join('')}</div>`;
  html += `<div class="cal-grid-month">`;

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-cell other-month"><div class="cal-date">${daysInPrev - firstDay + 1 + i}</div></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key    = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = key === today;
    const isSel   = key === calDiaSeleccionado;
    const items   = byDate[key] || [];
    const MAX     = 3;
    let dots = items.slice(0, MAX).map(a =>
      `<div class="cal-dot ${clasifClass(a.Clasificacion)}" onclick="event.stopPropagation();seleccionarDia('${key}')" title="${a.Vendedor}: ${a.Descripcion}">${a.Vendedor.split(' ')[0]}</div>`
    ).join('');
    if (items.length > MAX) dots += `<div class="cal-more">+${items.length - MAX} más</div>`;
    html += `<div class="cal-cell${isToday?' today':''}${isSel?' selected':''}" onclick="seleccionarDia('${key}')">
      <div class="cal-date">${d}</div>${dots}</div>`;
  }

  const remainder = (firstDay + daysInMonth) % 7;
  if (remainder > 0) {
    for (let i = 1; i <= 7 - remainder; i++) {
      html += `<div class="cal-cell other-month"><div class="cal-date">${i}</div></div>`;
    }
  }
  html += `</div>`;
  document.getElementById('calGrid').innerHTML = html;

  if (calDiaSeleccionado && byDate[calDiaSeleccionado]) {
    mostrarDetalle(calDiaSeleccionado, byDate[calDiaSeleccionado]);
  } else {
    document.getElementById('calDetalle').style.display = 'none';
  }
}

function renderSemana(byDate) {
  const today = toDateKey(new Date());
  const d     = new Date(calFecha);
  const diff  = d.getDate() - d.getDay();
  const weekStart = new Date(d.setDate(diff));

  const days = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(weekStart);
    dd.setDate(weekStart.getDate() + i);
    days.push(dd);
  }

  const startFmt = days[0].toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
  const endFmt   = days[6].toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
  document.getElementById('calTitulo').textContent = `${startFmt} – ${endFmt}`;

  const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  let header = `<div class="cal-week-header">`;
  days.forEach((dd, i) => {
    const key = toDateKey(dd);
    const isT = key === today;
    header += `<div class="cal-week-hcell${isT?' today-col':''}">
      <div class="wday">${dias[i]}</div>
      <div class="wdate">${dd.getDate()}</div>
    </div>`;
  });
  header += `</div>`;

  let cells = `<div class="cal-week-grid">`;
  days.forEach(dd => {
    const key   = toDateKey(dd);
    const items = byDate[key] || [];
    cells += `<div class="cal-week-cell">`;
    cells += items.map(a => `
      <div class="cal-action-card ${clasifClass(a.Clasificacion)}" onclick="openSeguimientoModal('${a.ID_Accion}')">
        <div class="ac-name">${a.Vendedor.split(' ')[0]}</div>
        <div class="ac-desc">${a.Descripcion}</div>
        <div style="margin-top:3px">${badgeEst(a.Estatus)}</div>
      </div>`).join('');
    if (!items.length) cells += `<div style="color:var(--muted);font-size:11px;padding:4px">Sin acciones</div>`;
    cells += `</div>`;
  });
  cells += `</div>`;

  document.getElementById('calGrid').innerHTML = header + cells;
  document.getElementById('calDetalle').style.display = 'none';
}

function seleccionarDia(key) {
  calDiaSeleccionado = calDiaSeleccionado === key ? null : key;
  renderCalendario();
}

function mostrarDetalle(key, items) {
  const dt     = new Date(key + 'T12:00:00');
  const fecha  = dt.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const detalle = document.getElementById('calDetalle');
  detalle.style.display = 'block';
  detalle.innerHTML = `
    <div class="card" style="padding:0">
      <div style="padding:14px 18px;background:var(--surface2);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:600;font-size:14px;text-transform:capitalize">${fecha}</div>
        <span style="font-size:12px;color:var(--muted)">${items.length} acción(es)</span>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Vendedor</th><th>Tipo</th><th>Acción</th><th>Cliente</th><th>Prioridad</th><th>Estatus</th><th></th></tr></thead>
        <tbody>${items.map(a => `<tr>
          <td><strong>${a.Vendedor}</strong></td>
          <td>${badgeClasif(a.Clasificacion)}</td>
          <td style="font-size:12px">${a.Descripcion}</td>
          <td style="font-size:12px">${a.Cliente||'—'}</td>
          <td>${badgePrio(a.Prioridad)}</td>
          <td>${badgeEst(a.Estatus)}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="openSeguimientoModal('${a.ID_Accion}')">+ Seguimiento</button></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
}

function renderAgenda() {
  const vends = state.equipo.filter(e => e.Rol !== 'Coordinador');
  const calFV = document.getElementById('calFiltroVendedor');
  if (calFV) calFV.innerHTML =
    `<option value="">Todos los vendedores</option>` +
    vends.map(v => `<option value="${v.Nombre}">${v.Nombre}</option>`).join('');
  renderCalendario();
}
