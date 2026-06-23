/* ============================================================
   WBR Portal — Módulo: Plan de Acciones + Seguimiento
   ============================================================
   Contiene: renderAcciones, openModalAccion, guardarAccion,
   renderSeguimiento, openSeguimientoModal, guardarSeguimiento.
   ============================================================ */

// ── PLAN DE ACCIONES ───────────────────────────────────────────
function renderAcciones() {
  const fV = document.getElementById('filtroVendedor')?.value || '';
  const fE = document.getElementById('filtroEstatus')?.value  || '';
  const fP = document.getElementById('filtroPrioridad')?.value || '';
  let data = state.acciones;
  if (fV) data = data.filter(a => a.Vendedor   === fV);
  if (fE) data = data.filter(a => a.Estatus    === fE);
  if (fP) data = data.filter(a => a.Prioridad  === fP);

  const tbody = document.getElementById('accionesTable');
  tbody.innerHTML = data.length
    ? data.map(a => `<tr>
        <td><strong>${a.Vendedor}</strong></td>
        <td>${badgeClasif(a.Clasificacion)}</td>
        <td>${badgePrio(a.Prioridad)}</td>
        <td style="font-size:12px">${a.Descripcion}</td>
        <td style="max-width:180px;font-size:12px;color:var(--text2)">${a.Descripcion_Libre||'—'}</td>
        <td style="font-size:12px">${a.Cliente||'—'}</td>
        <td style="font-size:12px">${fmtDate(a.Fecha_Compromiso)}</td>
        <td>${badgeEst(a.Estatus)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="openSeguimientoModal('${a.ID_Accion}')">+ Seguimiento</button></td>
      </tr>`).join('')
    : `<tr><td colspan="8"><div class="empty"><div class="ei">📋</div><p>Sin acciones</p></div></td></tr>`;
}

function openModalAccion() {
  const sesiones = [...new Set(state.calificaciones.map(c => c.ID_Sesion).filter(Boolean))];
  const mSesion  = document.getElementById('mSesionId');
  if (mSesion) mSesion.innerHTML = sesiones.length
    ? sesiones.map(s => `<option value="${s}">${s}</option>`).join('')
    : `<option value="">Sin sesiones</option>`;
  if (sesionActiva?.id && mSesion) mSesion.value = sesionActiva.id;

  document.getElementById('mDescripcion').value      = '';
  document.getElementById('mResultado').value        = '';
  document.getElementById('mCliente').value          = '';
  document.getElementById('mFechaCompromiso').value  = new Date().toISOString().split('T')[0];
  openModal('modalAccion');
}

async function guardarAccion() {
  const data = {
    id_sesion:        document.getElementById('mSesionId').value,
    vendedor:         document.getElementById('mVendedor').value,
    clasificacion:    document.getElementById('mClasificacion').value,
    prioridad:        document.getElementById('mPrioridad').value,
    descripcion:      document.getElementById('mDescripcion').value,
    resultado_esperado: document.getElementById('mResultado').value,
    cliente:          document.getElementById('mCliente').value,
    acompanamiento:   document.getElementById('mAcompa').value,
    fecha_compromiso: document.getElementById('mFechaCompromiso').value,
  };
  if (!data.id_sesion) { toast('Selecciona una sesión','error'); return; }
  if (!data.vendedor)  { toast('Selecciona un vendedor','error'); return; }
  setLoading('btnGuardarAccion', true);
  const res = await post('savePlanAccion', data);
  setLoading('btnGuardarAccion', false, '💾 Guardar');
  if (res.success) { toast('Acción guardada'); closeModal('modalAccion'); await loadAll(); renderAcciones(); }
  else toast('Error: ' + (res.error||''), 'error');
}

// ── SEGUIMIENTO ────────────────────────────────────────────────
function renderSeguimiento() {
  const fV = document.getElementById('filtroSeguVendedor')?.value || '';
  const fE = document.getElementById('filtroSeguEstatus')?.value  || '';
  let acc  = state.acciones;
  if (fV) acc = acc.filter(a => a.Vendedor === fV);
  if (fE) acc = acc.filter(a => a.Estatus  === fE);

  if (!acc.length) {
    document.getElementById('seguimientoContent').innerHTML = '<div class="empty"><div class="ei">👁️</div><p>Sin acciones</p></div>';
    return;
  }

  document.getElementById('seguimientoContent').innerHTML = acc.map(a => {
    const hist     = state.seguimiento.filter(s => s.ID_Accion === a.ID_Accion);
    const histHtml = hist.length
      ? hist.map(s => `
          <div style="padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;margin-top:6px;font-size:12px">
            <div style="display:flex;justify-content:space-between"><strong>${s.Coordinador}</strong><span style="color:var(--muted)">${fmtDate(s.Fecha_Seguimiento)}</span></div>
            <div style="color:var(--text2);margin-top:3px">${s.Notas}</div>
            <div style="margin-top:5px">${badgeEst(s.Nuevo_Estatus)}</div>
          </div>`).join('')
      : '<div style="font-size:12px;color:var(--muted);padding:6px 0">Sin seguimientos registrados</div>';

    return `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:5px">
              <strong>${a.Vendedor}</strong>${badgeClasif(a.Clasificacion)} ${badgePrio(a.Prioridad)} ${badgeEst(a.Estatus)}
            </div>
            <div style="font-size:13px;color:var(--text2)">${a.Descripcion}</div>
            ${a.Cliente ? `<div style="font-size:11px;color:var(--muted);margin-top:3px">Cliente: ${a.Cliente}</div>` : ''}
          </div>
          <button class="btn btn-primary btn-sm" style="flex-shrink:0;margin-left:12px" onclick="openSeguimientoModal('${a.ID_Accion}')">+ Seguimiento</button>
        </div>
        <div class="divider" style="margin:10px 0"></div>
        <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Historial</div>
        ${histHtml}
      </div>`;
  }).join('');
}

function openSeguimientoModal(idAccion) {
  const a = state.acciones.find(x => x.ID_Accion === idAccion);
  if (!a) return;

  document.getElementById('sIdAccion').value = idAccion;
  document.getElementById('sFecha').value    = new Date().toISOString().split('T')[0];
  document.getElementById('sNotas').value    = '';
  document.getElementById('sEstatus').value  = a.Estatus || 'Pendiente';

  const hist = state.seguimiento.filter(s => s.ID_Accion === idAccion);
  const histHtml = hist.length
    ? hist.map(s => `
        <div style="padding:8px 10px;background:#fff;border:1px solid var(--border);border-radius:6px;margin-top:6px;font-size:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px">
            <strong>${s.Coordinador}</strong>
            <span style="color:var(--muted)">${fmtDate(s.Fecha_Seguimiento)}</span>
          </div>
          <div style="color:var(--text2)">${s.Notas}</div>
          <div style="margin-top:4px">${badgeEst(s.Nuevo_Estatus)}</div>
        </div>`).join('')
    : `<div style="font-size:12px;color:var(--muted);padding:4px 0;font-style:italic">Sin seguimientos registrados aún</div>`;

  document.getElementById('seguimientoAccionInfo').innerHTML = `
    <div style="font-weight:600;font-size:14px;margin-bottom:4px">${a.Vendedor}</div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
      ${badgeClasif(a.Clasificacion)} ${badgePrio(a.Prioridad)} ${badgeEst(a.Estatus)}
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin-bottom:8px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Acción</div>
      <div style="font-size:13px;font-weight:500">${a.Descripcion||a.descripcion||'—'}</div>
      ${a.Descripcion_Libre ? `<div style="font-size:13px;color:var(--text2);margin-top:6px;padding:6px 8px;background:#fff;border-radius:4px;border-left:3px solid var(--accent)">${a.Descripcion_Libre}</div>` : ''}
      ${a.Resultado_Esperado ? `<div style="font-size:11px;color:var(--muted);margin-top:6px">Resultado esperado: <strong style="color:var(--text2)">${a.Resultado_Esperado}</strong></div>` : ''}
      ${a.Cliente ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">Cliente: <strong style="color:var(--text2)">${a.Cliente}</strong></div>` : ''}
      ${a.Proveedor_Externo ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">Proveedor externo: <strong style="color:var(--text2)">${a.Proveedor_Externo}</strong></div>` : ''}
      <div style="font-size:11px;color:var(--muted);margin-top:2px">Compromiso: <strong style="color:var(--text2)">${fmtDate(a.Fecha_Compromiso)}</strong></div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:8px">
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Historial de seguimientos</div>
      ${histHtml}
    </div>`;

  openModal('modalSeguimiento');
}

async function guardarSeguimiento() {
  const data = {
    id_accion:         document.getElementById('sIdAccion').value,
    fecha_seguimiento: document.getElementById('sFecha').value,
    coordinador:       COORD,
    notas:             document.getElementById('sNotas').value,
    nuevo_estatus:     document.getElementById('sEstatus').value,
  };
  if (!data.notas) { toast('Escribe una nota','error'); return; }
  setLoading('btnGuardarSeg', true);
  const res = await post('saveSeguimiento', data);
  setLoading('btnGuardarSeg', false, '💾 Guardar');
  if (res.success) {
    toast('Seguimiento registrado');
    closeModal('modalSeguimiento');
    await loadAll();
    renderSeguimiento();
    renderAgenda();
  } else toast('Error: ' + (res.error||''), 'error');
}
