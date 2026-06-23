/* ============================================================
   WBR Portal — Módulo: Utilidades y configuración global
   ============================================================
   Contiene: constantes de API, estado global, helpers de UI
   (toast, setLoading, navigate, switchTab, modal), formatters
   (pctPill, badges, fmtDate) y la carga inicial de datos.
   ============================================================ */


// Estado global compartido por todos los módulos
let state = { equipo:[], kpis:{}, clasificaciones:[], calificaciones:[], acciones:[], seguimiento:[], descubrimientos:[] };
let sesionActiva = null;

// ── HTTP ────────────────────────────────────────────────────────
async function api(action) {
  const r = await fetch(`${API}?action=${action}`);
  return r.json();
}
async function post(action, data) {
  const r = await fetch(API, { method:'POST', body:JSON.stringify({action,data}), headers:{'Content-Type':'text/plain'} });
  return r.json();
}

// ── UI HELPERS ─────────────────────────────────────────────────
function toast(msg, type='success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${type==='success'?'✓':'✕'}</span> ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function setLoading(btnId, loading, text) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Guardando...`
    : text;
}

function navigate(el, page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  el.classList.add('active');
  if (page === 'dashboard')   renderDashboard();
  if (page === 'calificar')   resetCalificar();
  if (page === 'acciones')    renderAcciones();
  if (page === 'agenda')      renderAgenda();
  if (page === 'seguimiento') renderSeguimiento();
}

function switchTab(el, tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(tabId).classList.add('active');
  if (tabId === 'tab-historial') renderHistorial();
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── FORMATTERS ─────────────────────────────────────────────────
function pctPill(val) {
  let n = typeof val === 'number' ? val : parseFloat(String(val).replace('%',''));
  if (isNaN(n)) return '<span style="color:var(--muted)">—</span>';
  // Si el valor es > 1 y parece un conteo (ej. 5 o 6), lo ignoramos
  // y dejamos que calcPctFromKpis() lo resuelva. Aquí solo manejamos 0..1
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
  const cls = pct >= 80 ? 'pct-green' : pct >= 50 ? 'pct-yellow' : 'pct-red';
  return `<span class="pct-pill ${cls}">${pct}%</span>`;
}

// Máximo de KPIs por rol
const MAX_KPIS_POR_ROL = { 'Setter': 5, 'Vendedor': 6, 'Coordinador': 6 };
function _maxKpisParaRol(rol) {
  return MAX_KPIS_POR_ROL[String(rol||'').trim()] || 6;
}

// Calcula % cumplimiento real contando KPI_1..KPI_N directamente
function calcPctFromKpis(cal, rol) {
  if (!cal) return null;
  const total = _maxKpisParaRol(rol);
  const cumplidos = Object.entries(cal)
    .filter(([k]) => k.startsWith('KPI_'))
    .filter(([k]) => parseInt(k.replace('KPI_','')) <= total)
    .filter(([,v]) => v !== 'N/A' && v !== '' && v !== null)
    .filter(([,v]) => v === '✅' || v === true || String(v).toLowerCase() === 'true')
    .length;
  return Math.round(cumplidos / total * 100);
}

function _getKpiNombresForCal(rol) {
  if (!state.kpis || !rol) return [];
  const r = String(rol).trim();
  if (state.kpis[r]) return state.kpis[r];
  const key = Object.keys(state.kpis).find(k => k.toLowerCase() === r.toLowerCase());
  return key ? state.kpis[key] : [];
}

function pctPillFromCal(cal) {
  if (!cal) return '<span style="color:var(--muted)">—</span>';
  const pct = calcPctFromKpis(cal, cal.Rol);
  if (pct === null) return pctPill(cal['% Cumplimiento']);
  const cls = pct >= 80 ? 'pct-green' : pct >= 50 ? 'pct-yellow' : 'pct-red';
  return `<span class="pct-pill ${cls}">${pct}%</span>`;
}

function badgeClasif(c) {
  const m = {'Prospección':'prosp','Fidelización':'fidel','Crecimiento BCG':'bcg','Recuperación':'recup'};
  return `<span class="badge badge-${m[c]||'prosp'}">${c||'—'}</span>`;
}

function badgePrio(p) {
  return `<span class="badge badge-${(p||'').toLowerCase()}">${p||'—'}</span>`;
}

function badgeEst(e) {
  const m = {'Pendiente':'pendiente','En Proceso':'en-proceso','Cerrado':'cerrado'};
  return `<span class="badge badge-${m[e]||'pendiente'}">${e||'Pendiente'}</span>`;
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('es-MX', {day:'2-digit', month:'short', year:'numeric'});
}

// ── CARGA INICIAL ──────────────────────────────────────────────
async function loadAll() {
  try {
    const [equipo, kpis, clasificaciones, calificaciones, acciones, seguimiento, descubrimientos] = await Promise.all([
      api('getEquipo'), api('getKPIs'), api('getClasificaciones'),
      api('getCalificaciones'), api('getPlanAcciones'), api('getSeguimiento'), api('getDescubrimientos')
    ]);
    state = { equipo, kpis, clasificaciones, calificaciones, acciones, seguimiento, descubrimientos };

    const coord = equipo.find(e => e.Rol === 'Coordinador');
    if (coord) {
      document.getElementById('coordName').textContent = coord.Nombre.split(' ').slice(0,2).join(' ');
      document.getElementById('avatarInitials').textContent = coord.Nombre.split(' ').map(n=>n[0]).slice(0,2).join('');
    }
    populateSelects();
    renderDashboard();

    // Restaurar sesión activa del localStorage
    const savedSes = localStorage.getItem('wbr_sesion_activa');
    if (savedSes) {
      try { sesionActiva = JSON.parse(savedSes); showFloatingBtn(); } catch(e) {}
    }
  } catch(e) {
    toast('Error al conectar con Google Sheets', 'error');
  }
}

function populateSelects() {
  const vends = state.equipo.filter(e => e.Rol !== 'Coordinador');
  const opts  = vends.map(v => `<option value="${v.Nombre}">${v.Nombre} (${v.Rol})</option>`).join('');

  ['filtroVendedor','filtroSeguVendedor'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<option value="">Todos los vendedores</option>${opts}`;
  });
  ['mVendedor'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });

  const mAcompa = document.getElementById('mAcompa');
  if (mAcompa) mAcompa.innerHTML =
    `<option value="Leonardo Hernández">Leonardo Hernández (Coordinador)</option>` + opts +
    `<option value="No aplica">No aplica</option>`;

  const sesiones = [...new Set(state.calificaciones.map(c => c.ID_Sesion).filter(Boolean))];
  const mSesion  = document.getElementById('mSesionId');
  if (mSesion) {
    mSesion.innerHTML = sesiones.length
      ? sesiones.map(s => `<option value="${s}">${s}</option>`).join('')
      : `<option value="">Sin sesiones registradas</option>`;
  }
}

// Arrancar al cargar el DOM
loadAll();