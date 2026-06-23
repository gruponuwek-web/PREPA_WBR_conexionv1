/* ============================================================
   WBR Portal — Módulo: Minuta
   ============================================================ */

// Máximo KPIs por rol — Setter=5, Vendedor=6
function _maxKpisMinuta(rol) {
  const m = { 'Setter': 5, 'Vendedor': 6, 'Coordinador': 6 };
  return m[String(rol||'').trim()] || 6;
}

function _getKpiNombresMinuta(rol) {
  if (!state.kpis || !rol) return [];
  const r = String(rol).trim();
  if (state.kpis[r]) return state.kpis[r];
  const key = Object.keys(state.kpis).find(k => k.toLowerCase() === r.toLowerCase());
  return key ? state.kpis[key] : [];
}

function abrirMinuta(sid) {
  const overlay = document.getElementById('minutaOverlay');
  const body    = document.getElementById('minutaBody');
  if (!overlay || !body) { alert('Error: overlay no encontrado'); return; }

  overlay.style.display = 'flex';
  body.innerHTML = '<div style="padding:48px;text-align:center;color:#6b7280"><div style="font-size:32px;margin-bottom:12px">⏳</div>Generando minuta...</div>';

  setTimeout(() => {
    try {
      const califs = (state.calificaciones  || []).filter(c => String(c.ID_Sesion) === String(sid));
      const acts   = (state.acciones        || []).filter(a => String(a.ID_Sesion) === String(sid));
      const descs  = (state.descubrimientos || []).filter(d => String(d.ID_Sesion) === String(sid));
      const equipo = (state.equipo          || []).filter(e => e.Rol !== 'Coordinador');

      const fecha  = califs[0]?.Fecha  || acts[0]?.Creado_En || '';
      const semana = califs[0]?.Semana || '';

      const vendHtml = equipo.map(v => {
        const cal   = califs.find(c => String(c.Vendedor).trim() === String(v.Nombre).trim());
        const desc  = descs.find(d  => String(d.Vendedor).trim() === String(v.Nombre).trim());
        const vActs = acts.filter(a  => String(a.Vendedor).trim() === String(v.Nombre).trim());
        if (!cal && !desc && !vActs.length) return '';

        const rol        = String(cal?.Rol || v.Rol || '').trim();
        const maxKpis    = _maxKpisMinuta(rol);
        const kpiNombres = _getKpiNombresMinuta(rol);

        const kpiRows = cal
          ? Object.entries(cal)
              .filter(([k]) => k.startsWith('KPI_'))
              .filter(([k]) => parseInt(k.replace('KPI_','')) <= maxKpis)
              .filter(([,v]) => v !== 'N/A' && v !== '' && v !== null && v !== undefined)
              .sort(([a],[b]) => parseInt(a.replace('KPI_','')) - parseInt(b.replace('KPI_','')))
              .map(([k, val]) => {
                const idx    = parseInt(k.replace('KPI_','')) - 1;
                const nombre = (kpiNombres[idx]) ? kpiNombres[idx] : k.replace('KPI_','KPI ');
                const cumple = val === '✅' || val === true || String(val).toLowerCase() === 'true';
                return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:5px 0;border-bottom:1px solid #f0f2f6">
                  <span style="color:#4b5563">${nombre}</span>
                  <span style="font-size:14px">${cumple ? '✅' : '❌'}</span>
                </div>`;
              }).join('')
          : '';

        // Calcular % real desde KPIs
        let pct = '';
        if (cal) {
          const cumplidos = Object.entries(cal)
            .filter(([k]) => k.startsWith('KPI_'))
            .filter(([k]) => parseInt(k.replace('KPI_','')) <= maxKpis)
            .filter(([,v]) => v === '✅' || v === true || String(v).toLowerCase() === 'true')
            .length;
          const pctNum = Math.round(cumplidos / maxKpis * 100);
          const cls = pctNum >= 80 ? 'pct-green' : pctNum >= 50 ? 'pct-yellow' : 'pct-red';
          pct = `<span class="pct-pill ${cls}">${pctNum}%</span>`;
        }

        const actsHtml = vActs.map(a => `
          <div style="font-size:12px;padding:7px 10px;background:#f8fafc;border-radius:6px;margin-bottom:4px;border-left:3px solid #2563eb">
            <div style="display:flex;gap:6px;margin-bottom:3px;flex-wrap:wrap">
              ${badgeClasif(a.Clasificacion)} ${badgePrio(a.Prioridad)} ${badgeEst(a.Estatus)}
            </div>
            <div style="font-weight:600">${a.Descripcion||'—'}</div>
            ${a.Descripcion_Libre ? `<div style="color:#4b5563;margin-top:2px">${a.Descripcion_Libre}</div>` : ''}
            <div style="color:#9ca3af;font-size:11px;margin-top:3px">
              Cliente: ${a.Cliente||'—'} · Compromiso: ${fmtDate(a.Fecha_Compromiso)}
              ${a.Proveedor_Externo ? ` · Proveedor: ${a.Proveedor_Externo}` : ''}
            </div>
          </div>`).join('');

        return `
          <div style="margin-bottom:20px;padding:14px;border:1px solid #e2e6ed;border-radius:8px">
            <div style="font-weight:700;font-size:15px;margin-bottom:8px">
              ${v.Nombre} <span style="font-size:12px;font-weight:400;color:#9ca3af">${v.Rol}</span> ${pct}
            </div>
            ${kpiRows ? `<div style="margin-bottom:10px">${kpiRows}</div>` : ''}
            ${desc ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px 12px;font-size:12px;color:#92400e;margin-bottom:10px"><strong>Descubrimiento:</strong> ${desc.Descubrimiento}</div>` : ''}
            ${actsHtml ? `<div><div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">Acciones</div>${actsHtml}</div>` : ''}
          </div>`;
      }).join('');

      body.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e2e6ed">
          <div>
            <div style="font-family:Syne,sans-serif;font-size:22px;font-weight:800;color:#2563eb">WBR Portal</div>
            <div style="color:#4b5563;font-size:13px">Minuta de Reunión Semanal de Negocios</div>
          </div>
          <div style="text-align:right;font-size:13px;color:#4b5563;line-height:1.8">
            <div><strong>Sesión:</strong> ${sid}</div>
            <div><strong>Fecha:</strong> ${fmtDate(fecha)}</div>
            <div><strong>Período:</strong> ${semana||'—'}</div>
            <div><strong>Coordinador:</strong> ${COORD}</div>
          </div>
        </div>
        <div style="margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;border-bottom:1px solid #e2e6ed;padding-bottom:6px;margin-bottom:14px">Evaluación del Equipo</div>
          ${vendHtml || '<p style="color:#9ca3af;font-size:13px">Sin datos registrados para esta sesión</p>'}
        </div>
        <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e2e6ed;font-size:11px;color:#9ca3af;text-align:center">
          Generado por WBR Portal · ${new Date().toLocaleDateString('es-MX')}
        </div>`;
    } catch(err) {
      body.innerHTML = `<div style="padding:32px;text-align:center;color:#dc2626">Error al generar minuta: ${err.message}</div>`;
    }
  }, 150);
}

function cerrarMinuta()   { document.getElementById('minutaOverlay').style.display = 'none'; }
function imprimirMinuta() { window.print(); }