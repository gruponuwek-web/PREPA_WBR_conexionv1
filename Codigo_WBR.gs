/**
 * WBR Portal — Apps Script Backend
 * ═══════════════════════════════════════════════════════════════
 * Maneja GET (lectura de datos) y POST (escritura + Drive).
 *
 * DESPLIEGUE:
 *   Implementar → Nueva implementación → Aplicación web
 *   · Ejecutar como: Yo
 *   · Quién tiene acceso: Cualquier persona
 *   Cada vez que cambies el código: Administrar implementaciones
 *   → editar → Nueva versión → Guardar.
 * ═══════════════════════════════════════════════════════════════
 */

var SS = SpreadsheetApp.getActiveSpreadsheet();

// ── GET: lectura de datos ──────────────────────────────────────
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  try {
    switch (action) {
      case 'getEquipo':          return json(getHoja('Equipo'));
      case 'getKPIs':            return json(getKPIs());
      case 'getClasificaciones': return json(getHoja('Clasificaciones'));
      case 'getCalificaciones':  return json(getHoja('Calificaciones'));
      case 'getPlanAcciones':    return json(getHoja('PlanAcciones'));
      case 'getSeguimiento':     return json(getHoja('Seguimiento'));
      case 'getDescubrimientos': return json(getHoja('Descubrimientos'));
      default:                   return json({ error: 'Acción no reconocida' });
    }
  } catch(err) {
    return json({ error: err.message });
  }
}

// ── POST: escritura de datos y Drive ──────────────────────────
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action  = payload.action;
    var data    = payload.data;
    switch (action) {
      case 'saveCalificacion':  return json(saveCalificacion(data));
      case 'saveDescubrimiento':return json(saveDescubrimiento(data));
      case 'savePlanAccion':    return json(savePlanAccion(data));
      case 'saveSeguimiento':   return json(saveSeguimiento(data));
      case 'savePdfToDrive':    return json(savePdfToDrive(data));
      default:                  return json({ error: 'Acción no reconocida' });
    }
  } catch(err) {
    return json({ error: err.message });
  }
}

// ── HELPERS ────────────────────────────────────────────────────
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getHoja(nombre) {
  var hoja = SS.getSheetByName(nombre);
  if (!hoja) return [];
  var datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return [];
  var headers = datos[0].map(function(h){ return String(h).trim(); });
  return datos.slice(1)
    .filter(function(r){ return r.join('').trim() !== ''; })
    .map(function(r){
      var obj = {};
      headers.forEach(function(h, i){ if (h) obj[h] = r[i]; });
      return obj;
    });
}

function getKPIs() {
  // Hoja "KPIs": columna A = Rol, columna B en adelante = nombre del KPI
  var hoja = SS.getSheetByName('KPIs');
  if (!hoja) return {};
  var datos = hoja.getDataRange().getValues();
  var result = {};
  datos.forEach(function(row) {
    var rol  = String(row[0]).trim();
    var kpis = row.slice(1).map(function(k){ return String(k).trim(); }).filter(Boolean);
    if (rol) result[rol] = kpis;
  });
  return result;
}

function nextId(nombreHoja, colId) {
  var hoja = SS.getSheetByName(nombreHoja);
  if (!hoja) return 1;
  var vals = hoja.getRange(2, colId, hoja.getLastRow()).getValues().flat();
  var nums = vals.map(function(v){ return parseInt(String(v).replace(/\D/g,'')); }).filter(function(n){ return !isNaN(n); });
  return nums.length ? Math.max.apply(null, nums) + 1 : 1;
}

// ── GUARDADO: Calificación (KPIs) ─────────────────────────────
function saveCalificacion(d) {
  var hoja = SS.getSheetByName('Calificaciones');
  if (!hoja) return { error: 'Hoja Calificaciones no encontrada' };

  // Eliminar calificación previa del mismo vendedor en la misma sesión
  var datos = hoja.getDataRange().getValues();
  for (var i = datos.length - 1; i >= 1; i--) {
    if (String(datos[i][1]) === String(d.id_sesion) && String(datos[i][3]) === String(d.vendedor)) {
      hoja.deleteRow(i + 1);
    }
  }

  var kpisObj = {};
  var cumplidos = 0;
  (d.kpis || []).forEach(function(k, idx) {
    kpisObj['KPI_' + (idx+1)] = k.valor ? 'TRUE' : 'FALSE';
    if (k.valor) cumplidos++;
  });
  var pct = d.kpis && d.kpis.length ? cumplidos / d.kpis.length : 0;

  var idCal = 'CAL' + String(nextId('Calificaciones', 1)).padStart(4, '0');
  var row = [idCal, d.id_sesion, d.fecha, d.vendedor, d.rol, d.semana, pct];
  // Agregar columnas de KPIs dinámicas
  (d.kpis || []).forEach(function(k) { row.push(k.valor ? 'TRUE' : 'FALSE'); });

  hoja.appendRow(row);
  return { success: true, id: idCal };
}

// ── GUARDADO: Descubrimiento ───────────────────────────────────
function saveDescubrimiento(d) {
  var hoja = SS.getSheetByName('Descubrimientos');
  if (!hoja) return { error: 'Hoja Descubrimientos no encontrada' };
  var idDesc = 'DESC' + String(nextId('Descubrimientos', 1)).padStart(4, '0');
  hoja.appendRow([idDesc, d.id_sesion, d.vendedor, d.descubrimiento, new Date()]);
  return { success: true, id: idDesc };
}

// ── GUARDADO: Plan de Acción ───────────────────────────────────
function savePlanAccion(d) {
  var hoja = SS.getSheetByName('PlanAcciones');
  if (!hoja) return { error: 'Hoja PlanAcciones no encontrada' };
  var idAcc = 'ACC' + String(nextId('PlanAcciones', 1)).padStart(4, '0');
  hoja.appendRow([
    idAcc, d.id_sesion, d.vendedor, d.clasificacion, d.prioridad,
    d.descripcion, d.descripcion_libre || '', d.resultado_esperado,
    d.cliente || '', d.acompanamiento || '', d.proveedor_externo || '',
    d.fecha_compromiso, 'Pendiente', new Date()
  ]);
  return { success: true, id: idAcc };
}

// ── GUARDADO: Seguimiento ──────────────────────────────────────
function saveSeguimiento(d) {
  var hoja = SS.getSheetByName('Seguimiento');
  if (!hoja) return { error: 'Hoja Seguimiento no encontrada' };

  // Actualizar estatus en PlanAcciones
  var hojaAcc = SS.getSheetByName('PlanAcciones');
  if (hojaAcc) {
    var datos = hojaAcc.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][0]) === String(d.id_accion)) {
        hojaAcc.getRange(i+1, 13).setValue(d.nuevo_estatus);
        break;
      }
    }
  }

  var idSeg = 'SEG' + String(nextId('Seguimiento', 1)).padStart(4, '0');
  hoja.appendRow([idSeg, d.id_accion, d.fecha_seguimiento, d.coordinador, d.notas, d.nuevo_estatus, new Date()]);
  return { success: true, id: idSeg };
}

// ── GUARDADO: PDF en Google Drive ─────────────────────────────
function savePdfToDrive(d) {
  try {
    var folder  = DriveApp.getFolderById(d.folderId);
    var decoded = Utilities.base64Decode(d.b64);
    var blob    = Utilities.newBlob(decoded, 'application/pdf', d.nombre);
    var file    = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, url: file.getUrl(), id: file.getId() };
  } catch(err) {
    return { error: err.message };
  }
}
