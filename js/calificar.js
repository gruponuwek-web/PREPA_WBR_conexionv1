/* ============================================================
   WBR Portal — Módulo: Calificar WBR + Historial de Sesiones
   ============================================================
   Contiene: resetCalificar, crearSesion, renderVendedores,
   flujo por vendedor (KPIs → Descubrimiento → Acciones),
   guardarKpisYseguir, guardarDescYseguir, guardarAccionesVendedor,
   renderHistorial, showFloatingBtn, volverASesion, concluirWBR.
   ============================================================ */

// Estado local del flujo de calificación
let vendedorState = {};

// ── Textos contextuales ("tumba burros") ───────────────────────
const TUMBA_BURROS = {
  kpis: `<div class="tb-title">💡 Guía — KPIs</div>
    Marca ✅ si el vendedor presentó el KPI con dato real. Marca ❌ si no lo trajo o no lo conoce.
    <br><strong>Recuerda:</strong> no es si el número es bueno o malo, es si vino preparado con la información.`,
  descubrimiento: `<div class="tb-title">🔍 Guía — Descubrimiento</div>
    Analiza los números que acaba de presentar. Pregúntate:
    <br>• ¿Qué % de conversión hay entre cada etapa del pipeline?
    <br>• ¿Dónde se está cayendo más prospectos o clientes?
    <br>• ¿Qué canal, producto o segmento está funcionando mejor o peor?
    <br>• ¿Hay algo que llame la atención vs la semana pasada?
    <br><strong>Escribe aquí lo que descubres, no solo los números.</strong>`,
  acciones: `<div class="tb-title">⚡ Guía — Plan de Acción</div>
    Basándote en el descubrimiento, define acciones concretas.
    <br>• Cada acción debe tener un <strong>responsable claro</strong> y una <strong>fecha de compromiso</strong>.
    <br>• Si requiere apoyo externo (agencia, proveedor, otro depto), anótalo en "Proveedor Externo".
    <br>• Prioriza: ¿qué moverá más el indicador esta semana?
    <br><strong>Sin acción, el descubrimiento no sirve de nada.</strong>`
};

// ── SESIÓN ─────────────────────────────────────────────────────
function calcSemana(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00');
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
  return `Semana ${week}`;
}

function resetCalificar() {
  const saved = localStorage.getItem('wbr_sesion_activa');
  if (saved) {
    try {
      sesionActiva = JSON.parse(saved);
      document.getElementById('stepNum1').classList.add('done');
      document.getElementById('sesionInfo').textContent = `Sesión: ${sesionActiva.id} · ${sesionActiva.semana} · ${fmtDate(sesionActiva.fecha)}`;
      document.getElementById('sesionId').value     = sesionActiva.id;
      document.getElementById('sesionFecha').value  = sesionActiva.fecha;
      document.getElementById('sesionSemana').value = sesionActiva.semana;
      document.getElementById('paso2').style.display = 'block';
      renderVendedores();
      document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', i===0));
      document.querySelectorAll('.tab-content').forEach((t,i) => t.classList.toggle('active', i===0));
      return;
    } catch(e) { localStorage.removeItem('wbr_sesion_activa'); }
  }

  sesionActiva = null;
  document.getElementById('paso2').style.display = 'none';
  document.getElementById('stepNum1').classList.remove('done');

  const existing = state.calificaciones.map(c => c.ID_Sesion).filter(Boolean);
  const nums     = existing.map(s => parseInt(s.replace(/\D/g,''))).filter(n => !isNaN(n));
  const nextNum  = nums.length ? Math.max(...nums) + 1 : 1;
  document.getElementById('sesionId').value = 'SES' + String(nextNum).padStart(3,'0');

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('sesionFecha').value  = today;
  document.getElementById('sesionSemana').value = calcSemana(today);

  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', i===0));
  document.querySelectorAll('.tab-content').forEach((t,i) => t.classList.toggle('active', i===0));
}

function crearSesion() {
  const id     = document.getElementById('sesionId').value.trim();
  const fecha  = document.getElementById('sesionFecha').value;
  const semana = document.getElementById('sesionSemana').value.trim();
  if (!id||!fecha||!semana) { toast('Completa todos los campos','error'); return; }
  sesionActiva = { id, fecha, semana };
  localStorage.setItem('wbr_sesion_activa', JSON.stringify(sesionActiva));
  document.getElementById('stepNum1').classList.add('done');
  document.getElementById('sesionInfo').textContent = `Sesión: ${id} · ${semana} · ${fmtDate(fecha)}`;
  document.getElementById('paso2').style.display = 'block';
  renderVendedores();
  showFloatingBtn();
}

function showFloatingBtn() {
  if (!sesionActiva) return;
  document.getElementById('floatingWBR').style.display = 'block';
  document.getElementById('floatingSesionInfo').textContent = `${sesionActiva.id} · ${sesionActiva.semana}`;
}

function volverASesion() {
  const navItem = document.querySelector('.nav-item[onclick*="calificar"]');
  if (navItem) navItem.click();
}

function concluirWBR() {
  if (!confirm(`¿Confirmas que la WBR ${sesionActiva?.id} ha concluido?`)) return;
  localStorage.removeItem('wbr_sesion_activa');
  sesionActiva = null;
  document.getElementById('floatingWBR').style.display = 'none';
  toast('✅ WBR concluida y cerrada');
  document.getElementById('paso2').style.display = 'none';
  document.getElementById('stepNum1').classList.remove('done');
}

// ── VENDEDORES ─────────────────────────────────────────────────
function renderVendedores() {
  const { equipo, kpis } = state;
  const vends = equipo.filter(e => e.Rol !== 'Coordinador');
  if (!vends.length) {
    document.getElementById('vendedoresList').innerHTML = '<div class="empty"><div class="ei">👥</div><p>No se encontraron vendedores</p></div>';
    return;
  }
  vendedorState = {};
  vends.forEach(v => vendedorState[v.Nombre] = { saved: false, accionCount: 0 });

  document.getElementById('vendedoresList').innerHTML = vends.map((v) => {
    const misKpis = kpis[v.Rol] || [];
    const kpiHtml = misKpis.length
      ? misKpis.map(k => `
          <div class="kpi-row">
            <span class="kpi-name">${k}</span>
            <div class="kpi-toggle">
              <button class="kpi-btn yes" onclick="toggleKpi(this)">✅</button>
              <button class="kpi-btn no active" onclick="toggleKpi(this)">❌</button>
            </div>
          </div>`).join('')
      : `<p style="font-size:12px;color:var(--muted)">Sin KPIs para rol: <strong>${v.Rol}</strong></p>`;

    const vid = v.Nombre.replace(/\s+/g,'_');

    return `
      <div class="vendedor-section" id="vsec_${vid}">
        <div class="vendedor-header" onclick="toggleVendedor('${vid}', this)">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="avatar" style="width:34px;height:34px;font-size:11px">${v.Nombre.split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
            <div><div class="vname">${v.Nombre}</div><div class="vrole">${v.Rol} · ${misKpis.length} KPI(s)</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="vf-saved-indicator" id="vind_${vid}" style="display:none;font-size:11px;color:var(--green);font-weight:600">✓ Guardado</span>
            <span style="color:var(--muted);font-size:12px" id="varrow_${vid}">▾ Abrir</span>
          </div>
        </div>
        <div class="vendedor-body" id="vbody_${vid}" style="display:none;padding:16px 18px">
          <div class="vf-steps">
            <div class="vf-step-pill active" id="vpill_kpi_${vid}" onclick="switchVStep('${vid}','kpis')">1. KPIs</div>
            <div class="vf-step-pill" id="vpill_desc_${vid}" onclick="switchVStep('${vid}','desc')">2. Descubrimiento</div>
            <div class="vf-step-pill" id="vpill_acc_${vid}" onclick="switchVStep('${vid}','acc')">3. Acciones</div>
          </div>

          <!-- KPIs -->
          <div class="vf-panel active" id="vpanel_kpis_${vid}">
            <div class="tumba-burros">${TUMBA_BURROS.kpis}</div>
            <div id="vkpis_${vid}">${kpiHtml}</div>
            <button class="vf-save-btn" onclick="guardarKpisYseguir('${vid}','${v.Nombre}','${v.Rol}')">
              Guardar KPIs y continuar → Descubrimiento
            </button>
          </div>

          <!-- Descubrimiento -->
          <div class="vf-panel" id="vpanel_desc_${vid}">
            <div class="tumba-burros">${TUMBA_BURROS.descubrimiento}</div>
            <div class="form-group">
              <label>Descubrimiento / Análisis</label>
              <textarea id="vdesc_${vid}" placeholder="Escribe aquí tu análisis de los KPIs presentados..." style="min-height:120px"></textarea>
            </div>
            <button class="vf-save-btn" onclick="guardarDescYseguir('${vid}','${v.Nombre}')">
              Guardar Descubrimiento y continuar → Acciones
            </button>
          </div>

          <!-- Acciones -->
          <div class="vf-panel" id="vpanel_acc_${vid}">
            <div class="tumba-burros">${TUMBA_BURROS.acciones}</div>
            <div id="vacciones_${vid}"></div>
            <button class="add-accion-btn" onclick="agregarAccionForm('${vid}','${v.Nombre}')">+ Agregar Acción</button>
            <button class="vf-save-btn" id="vbtn_acc_${vid}" onclick="guardarAccionesVendedor('${vid}','${v.Nombre}')">
              💾 Guardar Acciones y finalizar
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function toggleVendedor(vid) {
  const body  = document.getElementById('vbody_' + vid);
  const arrow = document.getElementById('varrow_' + vid);
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  arrow.textContent  = isOpen ? '▾ Abrir' : '▴ Cerrar';
}

function switchVStep(vid, step) {
  ['kpis','desc','acc'].forEach(s => {
    document.getElementById('vpanel_' + s + 's_' + vid)?.classList.remove('active');
    document.getElementById('vpanel_' + s + '_' + vid)?.classList.remove('active');
  });
  const panelId = step === 'kpis' ? 'vpanel_kpis_' : step === 'desc' ? 'vpanel_desc_' : 'vpanel_acc_';
  document.getElementById(panelId + vid)?.classList.add('active');
  ['kpi','desc','acc'].forEach(s => document.getElementById('vpill_' + s + '_' + vid)?.classList.remove('active'));
  const pillMap = { kpis:'kpi', desc:'desc', acc:'acc' };
  document.getElementById('vpill_' + pillMap[step] + '_' + vid)?.classList.add('active');
}

function toggleKpi(btn) {
  btn.parentElement.querySelectorAll('.kpi-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── GUARDAR KPIs ───────────────────────────────────────────────
async function guardarKpisYseguir(vid, vendedor, rol) {
  const kpisData = [];
  document.querySelectorAll(`#vkpis_${vid} .kpi-row`).forEach(row => {
    const yes = row.querySelector('.kpi-btn.yes');
    kpisData.push({ nombre: row.querySelector('.kpi-name').textContent, valor: yes && yes.classList.contains('active') });
  });
  if (!kpisData.length) { switchVStep(vid, 'desc'); return; }

  const btn = document.querySelector(`#vpanel_kpis_${vid} .vf-save-btn`);
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Guardando...';

  const res = await post('saveCalificacion', {
    id_sesion: sesionActiva.id, fecha: sesionActiva.fecha,
    semana: sesionActiva.semana, vendedor, rol, kpis: kpisData
  });

  btn.disabled = false;
  btn.innerHTML = 'Guardar KPIs y continuar → Descubrimiento';

  if (res.success) {
    document.getElementById('vpill_kpi_' + vid).classList.add('done');
    toast(`KPIs de ${vendedor} guardados`);
    switchVStep(vid, 'desc');
  } else toast('Error al guardar KPIs', 'error');
}

// ── GUARDAR DESCUBRIMIENTO ─────────────────────────────────────
async function guardarDescYseguir(vid, vendedor) {
  const desc = document.getElementById('vdesc_' + vid).value.trim();
  const btn  = document.querySelector(`#vpanel_desc_${vid} .vf-save-btn`);
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Guardando...';

  if (desc) {
    await post('saveDescubrimiento', { id_sesion: sesionActiva.id, vendedor, descubrimiento: desc });
  }

  btn.disabled = false;
  btn.innerHTML = 'Guardar Descubrimiento y continuar → Acciones';
  document.getElementById('vpill_desc_' + vid).classList.add('done');
  toast(`Descubrimiento de ${vendedor} guardado`);
  agregarAccionForm(vid, vendedor);
  switchVStep(vid, 'acc');
}

// ── ACCIONES INLINE ────────────────────────────────────────────
function agregarAccionForm(vid, vendedor) {
  const container = document.getElementById('vacciones_' + vid);
  const idx = container.querySelectorAll('.accion-card').length;
  const vends = state.equipo.filter(e => e.Rol !== 'Coordinador');
  const acompaOpts =
    `<option value="Leonardo Hernández">Leonardo Hernández (Coordinador)</option>` +
    vends.map(v => `<option value="${v.Nombre}">${v.Nombre} (${v.Rol})</option>`).join('') +
    `<option value="No aplica">No aplica</option>`;

  const card = document.createElement('div');
  card.className = 'accion-card';
  card.innerHTML = `
    <button class="remove-btn" onclick="this.parentElement.remove()">✕</button>
    <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Acción ${idx+1}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-group" style="margin:0"><label>Tipo de Acción</label>
        <select class="ac-desc"><option>Llamada</option><option>Whatsapp</option><option>Email</option><option>Reunión</option><option>Visita</option><option>Capacitación</option></select>
      </div>
      <div class="form-group" style="margin:0"><label>Clasificación</label>
        <select class="ac-clasif"><option>Prospección</option><option>Fidelización</option><option>Crecimiento BCG</option><option>Recuperación</option></select>
      </div>
      <div class="form-group" style="margin:0"><label>Prioridad</label>
        <select class="ac-prio"><option>Alta</option><option>Media</option><option>Baja</option></select>
      </div>
      <div class="form-group" style="margin:0"><label>Resultado Esperado</label>
        <select class="ac-resultado">
          <option>Cita agendada</option><option>Cotización enviada</option><option>Contrato firmado</option>
          <option>Pedido realizado</option><option>Acuerdo de continuidad</option>
          <option>Reactivación confirmada</option><option>Capacitación completada</option>
          <option>Sin respuesta / Seguimiento pendiente</option>
        </select>
      </div>
      <div class="form-group" style="margin:0"><label>Cliente</label>
        <input type="text" class="ac-cliente" placeholder="Nombre del cliente">
      </div>
      <div class="form-group" style="margin:0"><label>Acompañamiento</label>
        <select class="ac-acompa">${acompaOpts}</select>
      </div>
      <div class="form-group" style="margin:0"><label>Proveedor Externo <span style="color:var(--muted)">(opcional)</span></label>
        <input type="text" class="ac-proveedor" placeholder="Ej: Agencia de Marketing">
      </div>
      <div class="form-group" style="margin:0"><label>Fecha Compromiso</label>
        <input type="date" class="ac-fecha" value="${new Date().toISOString().split('T')[0]}">
      </div>
    </div>
    <div class="form-group" style="margin-top:10px;margin-bottom:0"><label>Descripción <span style="color:var(--muted)">(opcional)</span></label>
      <textarea class="ac-descripcion-libre" placeholder="Ej: Hablar con marketing sobre cambiar campañas..." style="min-height:64px"></textarea>
    </div>`;
  container.appendChild(card);
}

async function guardarAccionesVendedor(vid, vendedor) {
  const cards = document.querySelectorAll(`#vacciones_${vid} .accion-card`);
  const btn   = document.getElementById('vbtn_acc_' + vid);
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Guardando...';

  let saved = 0;
  for (const card of cards) {
    const data = {
      id_sesion:          sesionActiva.id,
      vendedor,
      descripcion:        card.querySelector('.ac-desc').value,
      descripcion_libre:  card.querySelector('.ac-descripcion-libre')?.value || '',
      clasificacion:      card.querySelector('.ac-clasif').value,
      prioridad:          card.querySelector('.ac-prio').value,
      resultado_esperado: card.querySelector('.ac-resultado').value,
      cliente:            card.querySelector('.ac-cliente').value,
      acompanamiento:     card.querySelector('.ac-acompa').value,
      proveedor_externo:  card.querySelector('.ac-proveedor').value,
      fecha_compromiso:   card.querySelector('.ac-fecha').value,
    };
    const res = await post('savePlanAccion', data);
    if (res.success) saved++;
  }

  vendedorState[vendedor] = { saved: true };
  document.getElementById('vpill_acc_' + vid).classList.add('done');
  document.getElementById('vind_' + vid).style.display = 'inline';
  document.querySelector(`#vpanel_acc_${vid} .vf-save-btn`).outerHTML =
    `<div class="vf-saved">✅ ${vendedor} completado — ${saved} acción(es) guardada(s)</div>`;
  toast(`✅ ${vendedor} finalizado`);

  await loadAll();
  setTimeout(() => {
    document.getElementById('vbody_' + vid).style.display = 'none';
    document.getElementById('varrow_' + vid).textContent = '▾ Abrir';
  }, 1200);
}

// ── HISTORIAL DE SESIONES ──────────────────────────────────────
function renderHistorial() {
  const { calificaciones, equipo } = state;
  const container = document.getElementById('historialContent');
  if (!calificaciones.length) {
    container.innerHTML = '<div class="empty"><div class="ei">📜</div><p>No hay sesiones registradas aún</p></div>';
    return;
  }

  const sesiones = {};
  calificaciones.forEach(c => {
    const sid = c.ID_Sesion;
    if (!sesiones[sid]) sesiones[sid] = { id:sid, fecha:c.Fecha, semana:c.Semana, vendedores:{} };
    sesiones[sid].vendedores[c.Vendedor] = parseFloat(c['% Cumplimiento']) || 0;
  });

  const vends = equipo.filter(e => e.Rol !== 'Coordinador').map(e => e.Nombre);
  const rows  = Object.values(sesiones).reverse().map(ses => {
    const pcts  = vends.map(v => ses.vendedores[v] !== undefined ? ses.vendedores[v] : null);
    const valid = pcts.filter(p => p !== null);
    const prom  = valid.length ? valid.reduce((a,b) => a+b, 0) / valid.length : null;
    return `<tr>
      <td><strong>${ses.id}</strong></td>
      <td>${fmtDate(ses.fecha)}</td>
      <td style="color:var(--text2)">${ses.semana||'—'}</td>
      ${vends.map(v => {
        const p = ses.vendedores[v];
        return `<td>${p !== undefined ? pctPill(p) : '<span style="color:var(--muted);font-size:12px">—</span>'}</td>`;
      }).join('')}
      <td>${prom !== null ? pctPill(prom) : '—'}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="abrirMinuta('${ses.id}')">📄 Minuta</button></td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table class="hist-table">
        <thead><tr>
          <th>Sesión</th><th>Fecha</th><th>Semana</th>
          ${vends.map(v => `<th>${v.split(' ')[0]}</th>`).join('')}
          <th>Promedio</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding:12px 18px;border-top:1px solid var(--border);font-size:12px;color:var(--muted);display:flex;gap:16px">
      <span>🟢 ≥ 80%</span><span>🟡 50–79%</span><span>🔴 &lt; 50%</span>
    </div>`;
}
