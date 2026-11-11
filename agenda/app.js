'use strict';

/* ============================================================
   Utilidades
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); };
const HOY = () => iso(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const euro = n => (n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
const fmtLargo = s => cap(parse(s).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
const fmtCorto = s => parse(s).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtMes = ym => cap(new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1).toLocaleDateString('es-ES', { month: 'long' })) + ' ' + ym.slice(0, 4);
const shiftMes = (ym, n) => iso(new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1)).slice(0, 7);
// Acepta "12,50", "12.5", "1.200" y "1.200,50"
const aNumero = t => {
  t = t.replace(/[€\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  return parseFloat(t);
};
const DIAS_C = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const diasHasta = s => Math.round((parse(s) - parse(HOY())) / 864e5);
const cuando = s => {
  const n = diasHasta(s);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  if (n > 1) return `En ${n} días`;
  return `Hace ${-n} días`;
};

/* ============================================================
   Datos (se guardan en el propio móvil)
   ============================================================ */
const KEY = 'miAgenda.v1';
const vacioDB = () => ({
  agenda: [], trabajo: [], compra: [], compraHistorial: [],
  menu: {}, precios: {}, presupuesto: { limites: {}, movs: [] }, planes: [], tareas: [], ajustes: {},
});
let db = cargar();

function cargar() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    return d ? Object.assign(vacioDB(), d) : vacioDB();
  } catch { return vacioDB(); }
}
function guardar() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { toast('No se ha podido guardar'); }
  publicarResumenTareas();
}

/* ============================================================
   Estado de la pantalla
   ============================================================ */
// Ajustes pequeños de este móvil (no van en la copia de seguridad)
function ajuste(k, v) {
  try {
    if (v === undefined) return localStorage.getItem('miAgenda.' + k) || '';
    if (v === null || v === '') localStorage.removeItem('miAgenda.' + k); else localStorage.setItem('miAgenda.' + k, v);
  } catch { return ''; }
}

const ui = {
  tab: (() => { try { return localStorage.getItem('miAgenda.tab') || 'agenda'; } catch { return 'agenda'; } })(),
  agenda: { sel: HOY(), mes: HOY().slice(0, 7), vista: ajuste('vista.agenda') || 'dias', dias: 7 },
  trabajo: { sel: HOY(), mes: HOY().slice(0, 7), vista: ajuste('vista.trabajo') || 'dias', dias: 7 },
  compraModo: 'lista',
  semana: iso(mondayOf(new Date())),
  mesDinero: HOY().slice(0, 7),
  secCompra: 'Otros',
};

const SECCIONES = {
  agenda:  { titulo: 'Agenda',          render: () => vistaCalendario('agenda'),  nuevo: () => formEvento('agenda', null, ui.agenda.vista === 'dias' ? HOY() : ui.agenda.sel) },
  trabajo: { titulo: 'Agenda de trabajo', render: () => vistaCalendario('trabajo'), nuevo: () => formEvento('trabajo', null, ui.trabajo.vista === 'dias' ? HOY() : ui.trabajo.sel) },
  tareas:  { titulo: 'Tareas pendientes', render: vistaTareas },
  compra:  { titulo: 'Lista de la compra', render: vistaCompra },
  menu:    { titulo: 'Menú de la semana', render: vistaMenu },
  dinero:  { titulo: 'Presupuesto',     render: vistaDinero, nuevo: () => formMovimiento() },
  planes:  { titulo: 'Planes',          render: vistaPlanes, nuevo: () => formPlan() },
};
const tabURL = new URLSearchParams(location.search).get('tab');
if (tabURL && SECCIONES[tabURL]) ui.tab = tabURL;
if (!SECCIONES[ui.tab]) ui.tab = 'agenda';

function render() {
  const s = SECCIONES[ui.tab];
  document.body.dataset.tab = ui.tab;
  $('#titulo').textContent = s.titulo;
  $('#hoyTxt').textContent = cap(parse(HOY()).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
  $('#vista').innerHTML = s.render();
  $('#fab').hidden = !s.nuevo;
  const n = tareasAtascadas().length;
  const b = document.querySelector('.tabs [data-tab="tareas"]');
  b.dataset.aviso = n || '';
  b.setAttribute('aria-label', n ? `Tareas, ${n} llevan mucho tiempo` : 'Tareas');
  document.querySelectorAll('.tabs button').forEach(b => {
    if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

function irA(tab) {
  ui.tab = tab;
  try { localStorage.setItem('miAgenda.tab', tab); } catch {}
  render();
  window.scrollTo(0, 0);
}

/* ============================================================
   Agenda personal y de trabajo
   ============================================================ */
const REPETIR = [['no', 'No se repite'], ['diario', 'Cada día'], ['laborables', 'De lunes a viernes'], ['semanal', 'Cada semana'], ['mensual', 'Cada mes'], ['anual', 'Cada año']];
const REP_TXT = Object.fromEntries(REPETIR);
const repite = it => it.rep && it.rep !== 'no';

function ocurre(it, d) {
  if (!repite(it)) return it.fecha === d;
  if (d < it.fecha) return false;
  const a = parse(it.fecha), b = parse(d);
  switch (it.rep) {
    case 'diario': return true;
    case 'laborables': return b.getDay() >= 1 && b.getDay() <= 5;
    case 'semanal': return a.getDay() === b.getDay();
    case 'mensual': return a.getDate() === b.getDate();
    case 'anual': return a.getDate() === b.getDate() && a.getMonth() === b.getMonth();
  }
  return false;
}
const estaHecho = (it, d) => repite(it) ? (it.hechos || []).includes(d) : !!it.hecho;
const delDia = (lista, d) => lista.filter(i => ocurre(i, d))
  .sort((x, y) => (x.hora || '99').localeCompare(y.hora || '99'));

function selectorVista(k) {
  const v = ui[k].vista;
  return `<div class="pestanas" role="tablist">
    <button role="tab" aria-selected="${v === 'dias'}" data-act="vistaCal" data-k="${k}" data-v="dias">Por días</button>
    <button role="tab" aria-selected="${v === 'mes'}" data-act="vistaCal" data-k="${k}" data-v="mes">Mes</button>
  </div>`;
}

function nombreDia(s) {
  const n = diasHasta(s);
  const largo = parse(s).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  if (n === 0) return `Hoy <small>· ${largo}</small>`;
  if (n === 1) return `Mañana <small>· ${largo}</small>`;
  if (n === 2) return `Pasado mañana <small>· ${largo}</small>`;
  return cap(largo);
}

function vistaDias(k) {
  const st = ui[k], lista = db[k];
  let html = '';
  for (let i = 0; i < st.dias; i++) {
    const s = iso(addDays(new Date(), i));
    const items = delDia(lista, s);
    html += `<section class="bloque-dia ${i === 0 ? 'es-hoy' : ''}">
      <div class="cab-dia">
        <h2>${nombreDia(s)}</h2>
        <button class="mas-dia" data-act="nuevoEnDia" data-k="${k}" data-d="${s}" aria-label="Añadir el ${fmtLargo(s)}">+</button>
      </div>
      ${items.length
        ? `<ul class="lista">${items.map(it => filaEvento(k, it, s)).join('')}</ul>`
        : `<p class="libre">${i === 0 ? 'Nada apuntado para hoy' : 'Libre'}</p>`}
    </section>`;
  }
  html += `<button class="btn bloque" data-act="masDias" data-k="${k}">Ver 7 días más</button>`;
  return html;
}

function vistaCalendario(k) {
  if (ui[k].vista === 'dias') return selectorVista(k) + vistaDias(k);
  return selectorVista(k) + vistaMes(k);
}

function vistaMes(k) {
  const st = ui[k], lista = db[k], hoy = HOY();
  const [y, m] = st.mes.split('-').map(Number);
  let d = mondayOf(new Date(y, m - 1, 1));
  let celdas = DIAS_C.map(x => `<span class="dsem">${x}</span>`).join('');
  do {
    for (let i = 0; i < 7; i++) {
      const s = iso(d);
      const n = delDia(lista, s).length;
      const cls = [d.getMonth() !== m - 1 && 'fuera', s === hoy && 'hoy', s === st.sel && 'sel'].filter(Boolean).join(' ');
      celdas += `<button class="dia ${cls}" data-act="dia" data-k="${k}" data-d="${s}" aria-label="${fmtLargo(s)}${n ? `, ${n} cosas` : ''}">
        ${d.getDate()}<span class="pts">${'<i></i>'.repeat(Math.min(n, 3))}</span></button>`;
      d = addDays(d, 1);
    }
  } while (d.getMonth() === m - 1);

  const items = delDia(lista, st.sel);
  let html = `<div class="card">
    <div class="nav-fila">
      <button class="flecha" data-act="mes" data-k="${k}" data-n="-1" aria-label="Mes anterior">‹</button>
      <span class="lbl">${fmtMes(st.mes)}</span>
      <button class="flecha" data-act="mes" data-k="${k}" data-n="1" aria-label="Mes siguiente">›</button>
    </div>
    <div class="cal">${celdas}</div>
    ${st.sel !== hoy ? `<button class="btn bloque" data-act="calHoy" data-k="${k}">Volver a hoy</button>` : ''}
  </div>
  <h2 class="sub">${st.sel === hoy ? 'Hoy · ' : ''}${fmtLargo(st.sel)}</h2>`;

  html += items.length
    ? `<ul class="lista">${items.map(it => filaEvento(k, it, st.sel)).join('')}</ul>`
    : `<p class="vacio">${k === 'trabajo' ? 'Nada de trabajo apuntado este día.' : 'No tienes nada apuntado este día.'}<br>Pulsa <b>+</b> para añadir.</p>`;

  // Próximos días
  const prox = [];
  for (let i = 1; i <= 30 && prox.length < 6; i++) {
    const s = iso(addDays(parse(st.sel), i));
    for (const it of delDia(lista, s)) if (prox.length < 6 && !estaHecho(it, s)) prox.push([it, s]);
  }
  if (prox.length) {
    html += `<h2 class="sub">Próximamente</h2><ul class="lista">${prox.map(([it, s]) => filaEvento(k, it, s, true)).join('')}</ul>`;
  }
  return html;
}

function filaEvento(k, it, d, conFecha) {
  const h = estaHecho(it, d);
  const meta = [
    conFecha && cap(fmtCorto(d)),
    it.lugar && esc(it.lugar),
    repite(it) && '↻ ' + REP_TXT[it.rep].toLowerCase(),
  ].filter(Boolean).join(' · ');
  return `<li class="item ${h ? 'hecho' : ''}">
    <button class="chk" data-act="toggleEv" data-k="${k}" data-id="${it.id}" data-d="${d}" aria-label="Marcar como hecho"></button>
    <div class="hora-col" data-act="editEv" data-k="${k}" data-id="${it.id}">${it.hora || '—'}${it.fin ? `<small>${it.fin}</small>` : ''}</div>
    <div class="cuerpo" data-act="editEv" data-k="${k}" data-id="${it.id}">
      <div class="t">${it.prioridad === 'alta' ? '<span class="badge">Urgente</span>' : ''}${esc(it.titulo)}</div>
      ${meta ? `<div class="meta">${meta}</div>` : ''}
      ${it.notas && !conFecha ? `<div class="nota">${esc(it.notas)}</div>` : ''}
    </div>
  </li>`;
}

function formEvento(k, it, fecha) {
  const campos = [
    { name: 'titulo', label: k === 'trabajo' ? '¿Qué hay que hacer?' : '¿Qué es?', required: true, placeholder: k === 'trabajo' ? 'Reunión, entrega, llamada…' : 'Médico, cumpleaños, quedada…' },
    { name: 'fecha', label: 'Día', type: 'date', required: true, def: fecha || ui[k].sel },
    { name: 'hora', label: 'Hora', type: 'time', half: true },
    { name: 'fin', label: 'Hasta', type: 'time', half: true },
    { name: 'lugar', label: k === 'trabajo' ? 'Lugar o cliente' : 'Lugar' },
    { name: 'rep', label: 'Repetir', type: 'select', options: REPETIR },
  ];
  if (k === 'trabajo') campos.push({ name: 'prioridad', label: 'Importancia', type: 'seg', options: [['normal', 'Normal'], ['alta', 'Urgente']], def: 'normal' });
  campos.push({ name: 'notas', label: 'Notas', type: 'textarea' });

  abrirFormulario({
    titulo: it ? 'Editar' : (k === 'trabajo' ? 'Nuevo en el trabajo' : 'Nuevo en la agenda'),
    campos, valores: it,
    onGuardar: v => {
      if (it) Object.assign(it, v); else db[k].push({ id: uid(), ...v });
      ui[k].sel = v.fecha; ui[k].mes = v.fecha.slice(0, 7);
      toast(it ? 'Cambios guardados' : 'Apuntado');
    },
    onBorrar: it && (() => { db[k] = db[k].filter(x => x !== it); toast('Borrado'); }),
  });
}

/* ============================================================
   Tareas pendientes (sin fecha) con aviso si llevan mucho tiempo
   ============================================================ */
const umbralTareas = () => db.ajustes?.umbralTareas ?? 7;
const edadTarea = t => Math.max(0, -diasHasta(t.creado));
const umbralDe = t => t.aviso || umbralTareas();
const atascada = t => !t.hecho && edadTarea(t) > umbralDe(t);
const tareasAtascadas = () => db.tareas.filter(atascada);
const hace = n => n === 0 ? 'Hoy' : n === 1 ? 'Ayer' : `Hace ${n} días`;

function vistaTareas() {
  const pend = db.tareas.filter(t => !t.hecho).sort((a, b) => a.creado.localeCompare(b.creado));
  const viejas = pend.filter(atascada), resto = pend.filter(t => !atascada(t));
  const hechas = db.tareas.filter(t => t.hecho).sort((a, b) => (b.hechoEl || '').localeCompare(a.hechoEl || ''));
  const opciones = [1, 2, 3, 5, 7, 10, 14, 21, 30, 60];

  let html = `<form class="rapido una" data-form="tarea">
      <input name="texto" placeholder="Nueva tarea…" autocomplete="off" enterkeyhint="done" aria-label="Nueva tarea">
      <button class="btn prim">Añadir</button>
    </form>
    <label class="ajuste-umbral">Avisarme si una tarea lleva más de
      <select data-cambio="umbral">${opciones.map(n => `<option value="${n}" ${n === umbralTareas() ? 'selected' : ''}>${n} ${n === 1 ? 'día' : 'días'}</option>`).join('')}</select>
      sin hacer</label>`;

  if (avisosDisponibles() && Notification.permission !== 'granted') {
    html += `<div class="card aviso-noti"><b>🔔 Recibir avisos en el móvil</b>
      <p class="meta">Para que el móvil te avise aunque no tengas la app abierta.</p>
      <button class="btn prim bloque" data-act="activarAvisos">Activar avisos</button></div>`;
  }

  if (!db.tareas.length) return html + `<p class="vacio" style="margin-top:14px">No tienes tareas pendientes.<br>Escribe arriba lo que tengas que hacer, sin fecha.</p>`;

  const fila = t => {
    const e = edadTarea(t), mal = atascada(t);
    return `<li class="item ${t.hecho ? 'hecho' : ''} ${mal ? 'atascada' : ''}">
      <button class="chk" data-act="toggleTarea" data-id="${t.id}" aria-label="Marcar como hecha"></button>
      <div class="cuerpo" data-act="editTarea" data-id="${t.id}">
        <div class="t">${esc(t.texto)}</div>
        <div class="meta">${t.hecho ? `Hecha ${hace(Math.max(0, -diasHasta(t.hechoEl || HOY()))).toLowerCase()}` : (mal ? `⚠️ Lleva ${e} días sin hacer` : `Apuntada: ${hace(e).toLowerCase()}`)}${t.aviso && !t.hecho ? ` · aviso a los ${t.aviso} días` : ''}</div>
        ${t.notas ? `<div class="nota">${esc(t.notas)}</div>` : ''}
      </div></li>`;
  };
  if (viejas.length) html += `<h2 class="sub alerta">Llevan demasiado tiempo <small>(${viejas.length})</small></h2><ul class="lista">${viejas.map(fila).join('')}</ul>`;
  if (resto.length) html += `<h2 class="sub">Por hacer <small>(${resto.length})</small></h2><ul class="lista">${resto.map(fila).join('')}</ul>`;
  if (!pend.length) html += `<p class="vacio" style="margin-top:14px">¡Todo hecho! 🎉</p>`;
  if (hechas.length) html += `<h2 class="sub">Hechas <small>(${hechas.length})</small></h2><ul class="lista">${hechas.map(fila).join('')}</ul>
    <button class="btn bloque" data-act="borrarHechas">Borrar las tareas hechas</button>`;
  return html;
}

function formTarea(t) {
  abrirFormulario({
    titulo: 'Tarea',
    campos: [
      { name: 'texto', label: 'Qué hay que hacer', required: true },
      { name: 'notas', label: 'Notas', type: 'textarea' },
      { name: 'aviso', label: `Avisarme si sigue sin hacer después de… (días; vacío = ${umbralTareas()})`, type: 'number', placeholder: String(umbralTareas()) },
    ],
    valores: t,
    onGuardar: v => { t.texto = v.texto; t.notas = v.notas; t.aviso = v.aviso > 0 ? Math.round(v.aviso) : null; },
    onBorrar: () => { db.tareas = db.tareas.filter(x => x !== t); },
  });
}

/* ---------- avisos ---------- */
const avisosDisponibles = () => 'Notification' in window && 'serviceWorker' in navigator;

// El service worker no puede leer los datos de la app: le dejamos un resumen en la caché
async function publicarResumenTareas() {
  try {
    if (!('caches' in window)) return;
    const c = await caches.open('mi-agenda-datos');
    const resumen = { umbral: umbralTareas(), tareas: db.tareas.filter(t => !t.hecho).map(t => ({ texto: t.texto, creado: t.creado, aviso: t.aviso || null })) };
    await c.put('resumen-tareas', new Response(JSON.stringify(resumen), { headers: { 'Content-Type': 'application/json' } }));
  } catch {}
}

async function activarAvisos() {
  if (!avisosDisponibles()) return toast('Este navegador no permite avisos');
  const r = await Notification.requestPermission();
  if (r !== 'granted') { toast('Sin permiso no puedo avisarte'); render(); return; }
  await programarRevision();
  toast('Avisos activados');
  render();
  revisarTareas(true);
}

// Android (con la app instalada) despierta la app de vez en cuando para revisar las tareas
async function programarRevision() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!('periodicSync' in reg)) return;
    const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (st.state === 'granted') await reg.periodicSync.register('revisar-tareas', { minInterval: 12 * 60 * 60 * 1000 });
  } catch {}
}

// Al abrir la app: si hay tareas atascadas, avisar (una vez al día como mucho)
async function revisarTareas(forzar) {
  const viejas = tareasAtascadas();
  if (!viejas.length) return;
  if (!forzar && ajuste('ultimoAviso') === HOY()) return;
  ajuste('ultimoAviso', HOY());
  if (ui.tab !== 'tareas') toast(viejas.length === 1 ? '⚠️ Tienes 1 tarea que lleva mucho tiempo sin hacer' : `⚠️ Tienes ${viejas.length} tareas que llevan mucho tiempo sin hacer`);
  if (avisosDisponibles() && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification('Tareas pendientes', {
        body: viejas.length === 1 ? `«${viejas[0].texto}» lleva ${edadTarea(viejas[0])} días sin hacer` : `${viejas.length} tareas llevan mucho tiempo sin hacer: ${viejas.slice(0, 3).map(t => t.texto).join(', ')}${viejas.length > 3 ? '…' : ''}`,
        icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'tareas-atascadas', data: { tab: 'tareas' },
      });
    } catch {}
  }
}

/* ============================================================
   Lista de la compra
   ============================================================ */
const PASILLOS = ['Fruta y verdura', 'Carne y pescado', 'Lácteos y huevos', 'Panadería', 'Despensa', 'Congelados', 'Bebidas', 'Limpieza e higiene', 'Otros'];

function vistaCompra() {
  const tabs = `<div class="pestanas" role="tablist">
    <button role="tab" aria-selected="${ui.compraModo === 'lista'}" data-act="compraModo" data-v="lista">Lista</button>
    <button role="tab" aria-selected="${ui.compraModo === 'precios'}" data-act="compraModo" data-v="precios">Comparar precios</button>
  </div>`;
  return tabs + (ui.compraModo === 'precios' ? vistaPrecios() : vistaLista());
}

function vistaLista() {
  const pend = db.compra.filter(i => !i.hecho), comprados = db.compra.filter(i => i.hecho);
  const sugerencias = [...new Set([...db.compraHistorial, ...db.compra.map(i => i.nombre)])];
  let html = `<form class="rapido" data-form="compra">
      <input name="nombre" placeholder="Añadir producto…" autocomplete="off" enterkeyhint="done" list="sugCompra" aria-label="Producto">
      <select name="sec" aria-label="Sección">${PASILLOS.map(p => `<option ${p === ui.secCompra ? 'selected' : ''}>${p}</option>`).join('')}</select>
      <button class="btn prim">Añadir</button>
      <datalist id="sugCompra">${sugerencias.map(s => `<option value="${esc(s)}">`).join('')}</datalist>
    </form>`;

  if (!db.compra.length) return html + `<p class="vacio" style="margin-top:14px">La lista está vacía.<br>Escribe arriba lo que necesitas comprar.</p>`;

  if (pend.length) {
    for (const p of PASILLOS) {
      const g = pend.filter(i => (i.sec || 'Otros') === p);
      if (g.length) html += `<h3 class="grupo">${p}</h3><ul class="lista">${g.map(filaCompra).join('')}</ul>`;
    }
  } else {
    html += `<p class="vacio" style="margin-top:14px">¡Lo tienes todo! 🎉</p>`;
  }
  if (comprados.length) {
    html += `<h2 class="sub">En el carrito <small>(${comprados.length})</small></h2>
      <ul class="lista">${comprados.map(filaCompra).join('')}</ul>
      <button class="btn bloque" data-act="vaciarCompra">Quitar lo ya comprado</button>`;
  }
  return html;
}

const filaCompra = i => `<li class="item ${i.hecho ? 'hecho' : ''}">
  <button class="chk" data-act="toggleCompra" data-id="${i.id}" aria-label="Marcar como comprado"></button>
  <div class="cuerpo" data-act="editCompra" data-id="${i.id}">
    <div class="t">${esc(i.nombre)}</div>
    ${i.cantidad ? `<div class="meta">${esc(i.cantidad)}</div>` : ''}
  </div></li>`;

function anadirCompra(nombre, sec = 'Otros', cantidad = '') {
  nombre = nombre.trim();
  if (!nombre) return false;
  const ya = db.compra.find(i => !i.hecho && i.nombre.toLowerCase() === nombre.toLowerCase());
  if (ya) return false;
  db.compra.push({ id: uid(), nombre: cap(nombre), sec, cantidad, hecho: false });
  return true;
}

function formCompra(it) {
  abrirFormulario({
    titulo: 'Producto',
    campos: [
      { name: 'nombre', label: 'Producto', required: true },
      { name: 'cantidad', label: 'Cantidad', placeholder: '2 kg, 1 paquete…' },
      { name: 'sec', label: 'Sección', type: 'select', options: PASILLOS.map(p => [p, p]) },
    ],
    valores: it,
    onGuardar: v => { Object.assign(it, v); },
    onBorrar: () => { db.compra = db.compra.filter(x => x !== it); },
  });
}

/* ============================================================
   Comparador de precios de supermercados
   ============================================================ */
const TIENDAS = ['Mercadona', 'Lidl', 'Eroski', 'Dia', 'Carrefour'];
const clavePrecio = n => n.trim().toLowerCase();
const preciosDe = n => (db.precios ||= {})[clavePrecio(n)] ||= {};
let busqueda = { activa: false, estado: '' };

function productosComparar() {
  const pend = db.compra.filter(i => !i.hecho);
  return [...new Set((pend.length ? pend : db.compra).map(i => i.nombre))];
}

function vistaPrecios() {
  const nombres = productosComparar();
  if (!nombres.length) return `<p class="vacio">Añade productos a la lista y aquí verás en qué supermercado sale más barata tu compra.</p>`;

  // Total por supermercado
  const tot = TIENDAS.map(t => {
    let total = 0, n = 0;
    for (const nom of nombres) { const p = preciosDe(nom)[t]; if (p) { total += p.precio; n++; } }
    return { t, total, n };
  });
  let mezcla = 0, nMezcla = 0;
  for (const nom of nombres) {
    const ps = Object.values(preciosDe(nom)).map(p => p.precio);
    if (ps.length) { mezcla += Math.min(...ps); nMezcla++; }
  }
  const hayPrecios = tot.some(x => x.n);
  const maxN = Math.max(...tot.map(x => x.n));
  const orden = [...tot].sort((a, b) => b.n - a.n || a.total - b.total);
  const ganador = hayPrecios ? orden[0].t : null;

  let html = `<div class="card ia">
    <button class="btn prim bloque" style="margin-top:0" data-act="buscarIA" ${busqueda.activa ? 'disabled' : ''}>
      ${busqueda.activa ? 'Buscando…' : `🔎 Buscar precios de ${nombres.length > 10 ? 'los 10 primeros productos' : 'mi lista'}`}</button>
    <p class="meta" id="estadoIA" style="text-align:center;margin-top:8px">${esc(busqueda.estado) || 'Busca los precios actuales en internet, o toca un precio para apuntarlo tú.'}</p>
  </div>`;

  if (hayPrecios) {
    html += `<div class="card"><b>Comprando toda la lista en…</b>
      ${orden.map(x => `<div class="tienda-total ${x.t === ganador ? 'gana' : ''}">
        <span>${x.t}${x.t === ganador ? ' <span class="chip">La más barata</span>' : ''}</span>
        <b>${x.n ? euro(x.total) : '—'}</b>
        <small>${x.n === nombres.length ? 'todos los productos' : `${x.n} de ${nombres.length} productos`}</small>
      </div>`).join('')}
      ${nMezcla ? `<p class="meta" style="margin-top:10px">Comprando cada cosa donde es más barata: <b>${euro(mezcla)}</b>${nMezcla < nombres.length ? ` (${nMezcla} de ${nombres.length} productos)` : ''}.</p>` : ''}
      ${maxN < nombres.length ? `<p class="meta" style="margin-top:6px">Ojo: los totales solo suman los productos con precio en cada súper.</p>` : ''}
    </div>`;
  }

  for (const nom of nombres) {
    const pr = preciosDe(nom);
    const vals = Object.values(pr).map(p => p.precio);
    const min = vals.length ? Math.min(...vals) : null;
    const fechas = Object.values(pr).map(p => p.fecha).filter(Boolean).sort();
    html += `<div class="card producto-precios">
      <div class="t">${esc(nom)}</div>
      ${fechas.length ? `<div class="meta">Precios del ${fmtCorto(fechas[fechas.length - 1])}</div>` : ''}
      <ul class="tiendas">${TIENDAS.map(t => {
        const p = pr[t];
        return `<li data-act="editPrecio" data-p="${esc(nom)}" data-t="${t}" class="${p && p.precio === min && vals.length > 1 ? 'barato' : ''}">
          <span class="tn">${t}</span>
          <span class="desc">${p ? esc([p.producto, p.unitario].filter(Boolean).join(' · ')) : ''}</span>
          <b>${p ? euro(p.precio) : '<span class="nada">Añadir</span>'}</b>
        </li>`;
      }).join('')}</ul>
    </div>`;
  }
  html += `<p class="meta" style="text-align:center">Los precios pueden cambiar según la zona y las ofertas.</p>`;
  return html;
}

function formPrecio(nombre, tienda) {
  const pr = preciosDe(nombre), p = pr[tienda];
  abrirFormulario({
    titulo: `${nombre} en ${tienda}`,
    campos: [
      { name: 'precio', label: 'Precio (€)', type: 'number', required: true, placeholder: '1,25' },
      { name: 'producto', label: 'Producto y formato', placeholder: 'Marca blanca, 1 L' },
    ],
    valores: p,
    onGuardar: v => {
      if (!(v.precio > 0)) { toast('Pon un precio mayor que 0'); return false; }
      pr[tienda] = { precio: v.precio, producto: v.producto, fecha: HOY() };
    },
    onBorrar: p && (() => { delete pr[tienda]; }),
    textoBorrar: 'Quitar precio',
  });
}

function formClave(yBuscar) {
  abrirFormulario({
    titulo: 'Buscar precios en internet',
    nota: 'Para buscar los precios automáticamente, la app usa Claude con búsqueda en internet. Necesitas una clave de la API de Anthropic (se consigue en console.anthropic.com). Cada búsqueda tiene un pequeño coste que se cobra en esa cuenta. La clave se guarda solo en este móvil.',
    campos: [
      { name: 'clave', label: 'Clave de la API', placeholder: 'sk-ant-…' },
      { name: 'cp', label: 'Tu código postal (opcional)', placeholder: '28001' },
    ],
    valores: { clave: ajuste('apiKey'), cp: ajuste('cp') },
    onGuardar: v => {
      if (v.clave && !v.clave.startsWith('sk-ant-')) { toast('La clave empieza por sk-ant-'); return false; }
      ajuste('apiKey', v.clave); ajuste('cp', v.cp);
      if (yBuscar && v.clave) setTimeout(buscarPreciosIA, 50);
    },
  });
}

const MODELO_IA = 'claude-opus-5-5';
const SDK_IA = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm';
const PROMPT_PRECIOS = `Eres un comparador de precios de supermercados en España. Te doy una lista de la compra
y averiguas cuánto cuesta cada producto HOY en Mercadona, Lidl, Eroski, Dia y Carrefour.

Cómo trabajar:
- Busca precios reales y actuales en las tiendas online oficiales (tienda.mercadona.es,
  lidl.es, supermercado.eroski.es, dia.es, carrefour.es). Si una tienda no lo muestra,
  puedes usar comparadores de precios fiables.
- Compara productos equivalentes y de formato parecido. Por defecto elige la marca propia
  o la opción más barata de cada súper, salvo que el producto nombre una marca concreta.
- Si un producto es ambiguo (p. ej. "queso"), elige la variante más común.
- Si no encuentras un precio en una tienda, pon null. Nunca te inventes un precio.

Responde SOLO con un bloque \`\`\`json y nada más, con esta forma exacta:
{"productos":[{"nombre":"<el nombre exactamente como te lo he dado>","tiendas":{
"Mercadona":{"producto":"<nombre y formato, p. ej. Leche entera Hacendado 1 L>","precio":0.95,"unitario":"0,95 €/L"},
"Lidl":null,"Eroski":{...},"Dia":{...},"Carrefour":{...}}}]}
"precio" es el precio del envase en euros, como número con punto decimal.`;

function extraerJSON(texto) {
  const bloques = [...texto.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(m => m[1]);
  const candidato = bloques.length ? bloques[bloques.length - 1] : texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1);
  return JSON.parse(candidato);
}

function pintarEstado(t) {
  busqueda.estado = t;
  const el = document.getElementById('estadoIA');
  if (el) el.textContent = t;
}

async function buscarPreciosIA() {
  if (busqueda.activa) return;
  const clave = ajuste('apiKey');
  if (!clave) return formClave(true);
  const nombres = productosComparar().slice(0, 10);
  if (!nombres.length) return toast('Añade primero productos a la lista');

  busqueda.activa = true; busqueda.estado = 'Buscando precios… puede tardar 1 o 2 minutos. No cierres la app.';
  render();
  let Anthropic;
  try {
    ({ default: Anthropic } = await import(SDK_IA));
    const client = new Anthropic({ apiKey: clave, dangerouslyAllowBrowser: true });
    const cp = ajuste('cp');
    const messages = [{
      role: 'user',
      content: `Lista de la compra:\n${nombres.map(n => '- ' + n).join('\n')}${cp ? `\n\nMi código postal es ${cp}; úsalo si la tienda pide zona.` : ''}`,
    }];
    let consultas = 0, resp;
    for (let i = 0; i < 8; i++) {
      const stream = client.beta.messages.stream({
        model: MODELO_IA,
        max_tokens: 32000,
        system: PROMPT_PRECIOS,
        tools: [
          { type: 'web_search_20260209', name: 'web_search', max_uses: 40,
            user_location: { type: 'approximate', country: 'ES', timezone: 'Europe/Madrid' } },
          { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 30 },
        ],
        messages,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
      stream.on('streamEvent', ev => {
        if (ev.type === 'content_block_start' && ev.content_block.type === 'server_tool_use') {
          consultas++;
          pintarEstado(`Buscando precios… (${consultas} consultas en internet)`);
        }
      });
      resp = await stream.finalMessage();
      if (resp.stop_reason !== 'pause_turn') break;
      // El servidor hizo una pausa: se le devuelve lo que lleva y continúa solo
      const ultimo = messages[messages.length - 1];
      if (ultimo.role === 'assistant') ultimo.content = [...ultimo.content, ...resp.content];
      else messages.push({ role: 'assistant', content: resp.content });
    }
    if (resp.stop_reason === 'pause_turn') throw new Error('La búsqueda se ha alargado demasiado. Prueba con menos productos.');
    if (resp.stop_reason === 'refusal') throw new Error('No se ha podido completar la búsqueda.');

    const texto = resp.content.filter(b => b.type === 'text').map(b => b.text).join('');
    let datos;
    try { datos = extraerJSON(texto); } catch { throw new Error('No he entendido la respuesta. Vuelve a intentarlo.'); }

    let n = 0;
    for (const prod of datos.productos || []) {
      const nombre = nombres.find(x => clavePrecio(x) === clavePrecio(String(prod.nombre || '')));
      if (!nombre) continue;
      const pr = preciosDe(nombre);
      for (const t of TIENDAS) {
        const d = prod.tiendas?.[t];
        const precio = Number(d?.precio);
        if (d && precio > 0) { pr[t] = { precio, producto: d.producto || '', unitario: d.unitario || '', fecha: HOY(), auto: true }; n++; }
      }
    }
    guardar();
    busqueda.estado = n ? `${n} precios encontrados. Toca cualquiera para corregirlo.` : 'No he encontrado precios. Prueba a escribir los productos de forma más concreta.';
  } catch (e) {
    if (Anthropic && e instanceof Anthropic.AuthenticationError) { busqueda.estado = 'La clave de la API no es válida.'; setTimeout(() => formClave(), 50); }
    else if (Anthropic && e instanceof Anthropic.RateLimitError) busqueda.estado = 'Demasiadas búsquedas seguidas; espera un momento.';
    else if (Anthropic && e instanceof Anthropic.APIConnectionError) busqueda.estado = 'Sin conexión. Comprueba tu internet.';
    else if (!Anthropic) busqueda.estado = 'Sin conexión. Hace falta internet para buscar precios.';
    else busqueda.estado = 'Error: ' + (e?.message || e);
  } finally {
    busqueda.activa = false;
    render();
  }
}

/* ============================================================
   Menú semanal
   ============================================================ */
function vistaMenu() {
  const lunes = parse(ui.semana), hoy = HOY();
  const esEsta = ui.semana === iso(mondayOf(new Date()));
  const rango = `${lunes.getDate()} ${lunes.toLocaleDateString('es-ES', { month: 'short' })} – ${addDays(lunes, 6).getDate()} ${addDays(lunes, 6).toLocaleDateString('es-ES', { month: 'short' })}`;
  let html = `<div class="nav-fila">
      <button class="flecha" data-act="semana" data-n="-1" aria-label="Semana anterior">‹</button>
      <span class="lbl">${esEsta ? 'Esta semana' : rango}<br><small style="font-weight:500;color:var(--tx2);font-size:13px">${esEsta ? rango : ''}</small></span>
      <button class="flecha" data-act="semana" data-n="1" aria-label="Semana siguiente">›</button>
    </div>`;
  if (!esEsta) html += `<button class="btn bloque" style="margin:0 0 12px" data-act="semanaHoy">Ir a esta semana</button>`;

  let hayIngr = false;
  for (let i = 0; i < 7; i++) {
    const s = iso(addDays(lunes, i)), m = db.menu[s] || {};
    if (m.ingredientes) hayIngr = true;
    const plato = t => t ? `<p>${esc(t)}</p>` : `<p class="nada">Sin decidir</p>`;
    html += `<article class="menu-dia ${s === hoy ? 'hoy' : ''}" data-act="editMenu" data-d="${s}">
      <header><span>${cap(parse(s).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }))}</span>${s === hoy ? '<small>Hoy</small>' : ''}</header>
      <div class="comidas">
        <div><small>Comida</small>${plato(m.comida)}</div>
        <div><small>Cena</small>${plato(m.cena)}</div>
      </div>
      ${m.ingredientes ? `<div class="ingr">🛒 ${esc(m.ingredientes)}</div>` : ''}
    </article>`;
  }
  html += `<button class="btn bloque" data-act="menuCompra">🛒 Pasar los ingredientes a la lista de la compra</button>`;
  if (!hayIngr) html += `<p class="meta" style="text-align:center;margin-top:8px">Al editar un día puedes apuntar los ingredientes que te faltan.</p>`;
  return html;
}

function formMenu(d) {
  const m = db.menu[d] || {};
  abrirFormulario({
    titulo: fmtLargo(d),
    campos: [
      { name: 'comida', label: 'Comida', type: 'textarea', rows: 2, placeholder: 'Lentejas, ensalada…' },
      { name: 'cena', label: 'Cena', type: 'textarea', rows: 2, placeholder: 'Tortilla, fruta…' },
      { name: 'ingredientes', label: 'Ingredientes que faltan (separados por comas)', placeholder: 'huevos, patatas, cebolla' },
    ],
    valores: m,
    onGuardar: v => {
      if (!v.comida && !v.cena && !v.ingredientes) delete db.menu[d]; else db.menu[d] = v;
    },
    onBorrar: db.menu[d] && (() => { delete db.menu[d]; }),
    textoBorrar: 'Vaciar día',
  });
}

/* ============================================================
   Presupuesto
   ============================================================ */
const CATS = { Casa: '🏠', Comida: '🛒', Facturas: '💡', Transporte: '🚗', Salud: '💊', Ropa: '👕', Ocio: '🎉', Niños: '🧸', Trabajo: '💼', Otros: '📦' };

function limiteDe(mes) {
  const l = db.presupuesto.limites;
  if (l[mes] != null) return l[mes];
  const ant = Object.keys(l).filter(k => k < mes).sort().pop();
  return ant ? l[ant] : null;
}

function vistaDinero() {
  const mes = ui.mesDinero;
  const movs = db.presupuesto.movs.filter(m => m.fecha.startsWith(mes))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const gastos = movs.filter(m => m.tipo === 'gasto').reduce((s, m) => s + m.cantidad, 0);
  const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.cantidad, 0);
  const lim = limiteDe(mes);

  let html = `<div class="nav-fila">
      <button class="flecha" data-act="mesDinero" data-n="-1" aria-label="Mes anterior">‹</button>
      <span class="lbl">${fmtMes(mes)}</span>
      <button class="flecha" data-act="mesDinero" data-n="1" aria-label="Mes siguiente">›</button>
    </div>
    <div class="card resumen">`;
  if (lim) {
    const queda = lim - gastos, pct = Math.min(100, gastos / lim * 100);
    html += `<div class="lbl">${queda >= 0 ? 'Te quedan' : 'Te has pasado'}</div>
      <div class="cifra ${queda < 0 ? 'mal' : ''}">${euro(Math.abs(queda))}</div>
      <div class="barra ${queda < 0 ? 'mal' : ''}"><i style="width:${pct}%"></i></div>
      <div class="lbl">Gastado ${euro(gastos)} de ${euro(lim)} · <button class="chip" data-act="limite">Cambiar</button></div>`;
  } else {
    html += `<div class="lbl">Gastado este mes</div><div class="cifra">${euro(gastos)}</div>
      <button class="btn bloque" data-act="limite">Poner un presupuesto mensual</button>`;
  }
  html += `<div class="fila3">
      <div><b class="pos">${euro(ingresos)}</b><span>Ingresos</span></div>
      <div><b>${euro(gastos)}</b><span>Gastos</span></div>
      <div><b class="${ingresos - gastos < 0 ? 'mal' : ''}">${euro(ingresos - gastos)}</b><span>Balance</span></div>
    </div></div>`;

  const porCat = {};
  movs.filter(m => m.tipo === 'gasto').forEach(m => porCat[m.cat] = (porCat[m.cat] || 0) + m.cantidad);
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  if (cats.length) {
    html += `<div class="card"><b>¿En qué se va el dinero?</b>${cats.map(([c, v]) => `
      <div class="cat"><span>${CATS[c] || '📦'} ${esc(c)}</span><b>${euro(v)}</b>
      <div class="barra"><i style="width:${v / cats[0][1] * 100}%"></i></div></div>`).join('')}</div>`;
  }

  html += `<h2 class="sub">Movimientos</h2>`;
  html += movs.length
    ? `<ul class="lista">${movs.map(m => `<li class="item">
        <div class="cuerpo" data-act="editMov" data-id="${m.id}" style="display:flex;gap:12px">
          <span style="font-size:22px">${m.tipo === 'ingreso' ? '💶' : (CATS[m.cat] || '📦')}</span>
          <div style="flex:1;min-width:0"><div class="t">${esc(m.concepto || m.cat)}</div>
          <div class="meta">${cap(fmtCorto(m.fecha))}${m.tipo === 'gasto' ? ' · ' + esc(m.cat) : ''}</div></div>
          <span class="der ${m.tipo === 'ingreso' ? 'pos' : ''}">${m.tipo === 'ingreso' ? '+' : '−'}${euro(m.cantidad)}</span>
        </div></li>`).join('')}</ul>`
    : `<p class="vacio">No hay movimientos este mes.<br>Pulsa <b>+</b> para apuntar un gasto o un ingreso.</p>`;
  return html;
}

function formMovimiento(it) {
  const hoy = HOY();
  abrirFormulario({
    titulo: it ? 'Editar movimiento' : 'Nuevo movimiento',
    campos: [
      { name: 'tipo', label: 'Tipo', type: 'seg', options: [['gasto', 'Gasto'], ['ingreso', 'Ingreso']], def: 'gasto' },
      { name: 'cantidad', label: 'Cantidad (€)', type: 'number', required: true, placeholder: '0,00' },
      { name: 'concepto', label: 'Concepto', placeholder: 'Supermercado, nómina…' },
      { name: 'cat', label: 'Categoría', type: 'select', options: Object.entries(CATS).map(([c, e]) => [c, `${e} ${c}`]), half: true },
      { name: 'fecha', label: 'Fecha', type: 'date', required: true, half: true, def: ui.mesDinero === hoy.slice(0, 7) ? hoy : ui.mesDinero + '-01' },
    ],
    valores: it,
    onGuardar: v => {
      if (!(v.cantidad > 0)) { toast('Pon una cantidad mayor que 0'); return false; }
      if (it) Object.assign(it, v); else db.presupuesto.movs.push({ id: uid(), ...v });
      ui.mesDinero = v.fecha.slice(0, 7);
      toast('Guardado');
    },
    onBorrar: it && (() => { db.presupuesto.movs = db.presupuesto.movs.filter(x => x !== it); }),
  });
}

function formLimite() {
  const mes = ui.mesDinero;
  abrirFormulario({
    titulo: 'Presupuesto mensual',
    campos: [{ name: 'lim', label: `Lo máximo que quieres gastar en ${fmtMes(mes).toLowerCase()} (y los meses siguientes)`, type: 'number', placeholder: '1200' }],
    valores: { lim: limiteDe(mes) },
    onGuardar: v => {
      // Se aplica desde este mes en adelante
      const l = db.presupuesto.limites;
      Object.keys(l).filter(k => k > mes).forEach(k => delete l[k]);
      l[mes] = v.lim > 0 ? v.lim : null;
    },
  });
}

/* ============================================================
   Planes
   ============================================================ */
function vistaPlanes() {
  const hoy = HOY();
  const prox = db.planes.filter(p => !p.hecho && p.fecha && p.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ideas = db.planes.filter(p => !p.hecho && !p.fecha);
  const pasados = db.planes.filter(p => p.hecho || (p.fecha && p.fecha < hoy)).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  if (!db.planes.length) return `<p class="vacio">Aquí puedes apuntar planes: escapadas, cenas, cumpleaños, cosas que te apetece hacer…<br>Pulsa <b>+</b> para añadir el primero.</p>`;

  const fila = p => `<li class="item ${p.hecho ? 'hecho' : ''}">
    <button class="chk" data-act="togglePlan" data-id="${p.id}" aria-label="Marcar como hecho"></button>
    <div class="cuerpo" data-act="editPlan" data-id="${p.id}">
      <div class="t">${esc(p.titulo)}</div>
      <div class="meta">${[p.fecha && `${cap(fmtCorto(p.fecha))}${p.hora ? ' ' + p.hora : ''}`, p.lugar && esc(p.lugar), p.con && 'con ' + esc(p.con), p.coste && euro(p.coste)].filter(Boolean).join(' · ')}</div>
      ${p.notas ? `<div class="nota">${esc(p.notas)}</div>` : ''}
    </div>
    ${p.fecha && !p.hecho && p.fecha >= hoy ? `<span class="chip">${cuando(p.fecha)}</span>` : ''}
  </li>`;

  let html = '';
  html += `<h2 class="sub" style="margin-top:4px">Próximos planes</h2>` + (prox.length ? `<ul class="lista">${prox.map(fila).join('')}</ul>` : `<p class="vacio">No hay planes con fecha.</p>`);
  if (ideas.length) html += `<h2 class="sub">Ideas sin fecha</h2><ul class="lista">${ideas.map(fila).join('')}</ul>`;
  if (pasados.length) html += `<h2 class="sub">Ya pasados</h2><ul class="lista">${pasados.map(fila).join('')}</ul>`;
  return html;
}

function formPlan(it) {
  abrirFormulario({
    titulo: it ? 'Editar plan' : 'Nuevo plan',
    campos: [
      { name: 'titulo', label: 'Plan', required: true, placeholder: 'Escapada a la playa, cena con amigas…' },
      { name: 'fecha', label: 'Día (opcional)', type: 'date', half: true },
      { name: 'hora', label: 'Hora', type: 'time', half: true },
      { name: 'lugar', label: 'Dónde' },
      { name: 'con', label: 'Con quién', half: true },
      { name: 'coste', label: 'Coste (€)', type: 'number', half: true },
      { name: 'notas', label: 'Notas', type: 'textarea' },
    ],
    valores: it,
    onGuardar: v => { if (it) Object.assign(it, v); else db.planes.push({ id: uid(), hecho: false, ...v }); toast('Plan guardado'); },
    onBorrar: it && (() => { db.planes = db.planes.filter(x => x !== it); }),
  });
}

/* ============================================================
   Formulario genérico (hoja que sube desde abajo)
   ============================================================ */
function campoHTML(c, v) {
  v = v ?? c.def ?? '';
  const id = 'f_' + c.name;
  const ph = c.placeholder ? ` placeholder="${esc(c.placeholder)}"` : '';
  let input;
  if (c.type === 'textarea') input = `<textarea id="${id}" name="${c.name}" rows="${c.rows || 3}"${ph}>${esc(v)}</textarea>`;
  else if (c.type === 'select') input = `<select id="${id}" name="${c.name}">${c.options.map(([val, l]) => `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  else if (c.type === 'seg') {
    return `<div class="campo"><span>${c.label}</span><div class="seg">${c.options.map(([val, l]) =>
      `<label><input type="radio" name="${c.name}" value="${val}" ${val === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>`;
  }
  else if (c.type === 'number') input = `<input id="${id}" name="${c.name}" type="text" inputmode="decimal" autocomplete="off" value="${v === '' || v == null ? '' : String(v).replace('.', ',')}"${ph}>`;
  else input = `<input id="${id}" name="${c.name}" type="${c.type || 'text'}" autocomplete="off" value="${esc(v)}"${ph}>`;
  return `<label class="campo ${c.half ? 'mitad' : ''}" for="${id}"><span>${c.label}</span>${input}</label>`;
}

function abrirFormulario({ titulo, nota, campos, valores = {}, onGuardar, onBorrar, textoBorrar = 'Borrar' }) {
  const dlg = $('#hoja');
  dlg.innerHTML = `<form class="form" novalidate>
    <div class="asa"></div>
    <h2>${esc(titulo)}</h2>
    ${nota ? `<p>${esc(nota)}</p>` : ''}
    <div class="campos">${campos.map(c => campoHTML(c, valores?.[c.name])).join('')}</div>
    <div class="botones">
      ${onBorrar ? `<button type="button" class="btn peligro" data-x="borrar">${textoBorrar}</button>` : ''}
      <span class="sp"></span>
      <button type="button" class="btn" data-x="cancelar">Cancelar</button>
      <button type="submit" class="btn prim">Guardar</button>
    </div>
  </form>`;
  const f = dlg.querySelector('form');
  f.onsubmit = e => {
    e.preventDefault();
    const v = {};
    for (const c of campos) {
      const el = f.elements[c.name];
      let val = (el.value ?? '').trim();
      if (c.type === 'number') val = val === '' ? null : aNumero(val);
      if (c.type === 'number' && Number.isNaN(val)) val = null;
      if (c.required && (val === '' || val == null)) {
        (el.focus ? el : f).focus?.(); el.classList?.add('error');
        toast(`Falta rellenar: ${c.label}`);
        return;
      }
      v[c.name] = val;
    }
    if (onGuardar(v) === false) return;
    guardar(); cerrarHoja(); render();
  };
  f.querySelector('[data-x=cancelar]').onclick = cerrarHoja;
  const b = f.querySelector('[data-x=borrar]');
  if (b) b.onclick = () => {
    if (!confirm('¿Seguro que quieres borrarlo?')) return;
    onBorrar(); guardar(); cerrarHoja(); render();
  };
  dlg.showModal();
  dlg.scrollTop = 0;
}

function cerrarHoja() { const d = $('#hoja'); if (d.open) d.close(); }
// Tocar fuera de la hoja la cierra
$('#hoja').addEventListener('click', e => { if (e.target.id === 'hoja') cerrarHoja(); });

/* ============================================================
   Copia de seguridad
   ============================================================ */
function abrirOpciones() {
  const dlg = $('#hoja');
  dlg.innerHTML = `<div class="form opciones">
    <div class="asa"></div>
    <h2>Copia de seguridad</h2>
    <p>Todo lo que apuntas se guarda solo en este móvil. Descarga una copia de vez en cuando para no perder nada si cambias de móvil o borras el navegador.</p>
    <button class="btn prim" id="exp">Descargar copia</button>
    <label class="btn">Restaurar una copia<input type="file" id="imp" accept="application/json,.json" hidden></label>
    <button class="btn" id="claveOp">Clave para buscar precios</button>
    <button class="btn" id="cerrarOp">Cerrar</button>
  </div>`;
  $('#exp', dlg).onclick = () => {
    const blob = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mi-agenda-${HOY()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Copia descargada');
  };
  $('#imp', dlg).onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (typeof data !== 'object' || !Array.isArray(data.agenda)) throw new Error();
      if (!confirm('Esto sustituirá lo que tienes ahora por la copia. ¿Seguir?')) return;
      db = Object.assign(vacioDB(), data);
      guardar(); cerrarHoja(); render(); toast('Copia restaurada');
    } catch { toast('Ese archivo no es una copia válida'); }
  };
  $('#cerrarOp', dlg).onclick = cerrarHoja;
  $('#claveOp', dlg).onclick = () => formClave();
  dlg.showModal();
}

/* ============================================================
   Acciones
   ============================================================ */
const buscar = (lista, id) => lista.find(x => x.id === id);

const ACCIONES = {
  dia: ({ k, d }) => { ui[k].sel = d; ui[k].mes = d.slice(0, 7); render(); },
  mes: ({ k, n }) => { ui[k].mes = shiftMes(ui[k].mes, +n); render(); },
  calHoy: ({ k }) => { ui[k].sel = HOY(); ui[k].mes = HOY().slice(0, 7); render(); },
  toggleEv: ({ k, id, d }) => {
    const it = buscar(db[k], id);
    if (repite(it)) {
      const h = new Set(it.hechos || []);
      h.has(d) ? h.delete(d) : h.add(d);
      it.hechos = [...h];
    } else it.hecho = !it.hecho;
    guardar(); render();
  },
  editEv: ({ k, id }) => formEvento(k, buscar(db[k], id)),
  vistaCal: ({ k, v }) => { ui[k].vista = v; ajuste('vista.' + k, v); render(); },
  nuevoEnDia: ({ k, d }) => formEvento(k, null, d),
  masDias: ({ k }) => { ui[k].dias += 7; render(); },

  compraModo: ({ v }) => { ui.compraModo = v; render(); },
  editPrecio: ({ p, t }) => formPrecio(p, t),
  buscarIA: () => buscarPreciosIA(),
  claveIA: () => formClave(),

  toggleCompra: ({ id }) => { const i = buscar(db.compra, id); i.hecho = !i.hecho; guardar(); render(); },
  editCompra: ({ id }) => formCompra(buscar(db.compra, id)),
  toggleTarea: ({ id }) => {
    const t = buscar(db.tareas, id);
    t.hecho = !t.hecho; t.hechoEl = t.hecho ? HOY() : null;
    guardar(); render();
    if (t.hecho) toast('¡Hecho! 👏');
  },
  editTarea: ({ id }) => formTarea(buscar(db.tareas, id)),
  borrarHechas: () => {
    if (!confirm('¿Borrar todas las tareas hechas?')) return;
    db.tareas = db.tareas.filter(t => !t.hecho); guardar(); render();
  },
  activarAvisos: () => activarAvisos(),

  vaciarCompra: () => {
    const fuera = db.compra.filter(i => i.hecho);
    db.compraHistorial = [...new Set([...fuera.map(i => i.nombre), ...db.compraHistorial])].slice(0, 300);
    db.compra = db.compra.filter(i => !i.hecho);
    guardar(); render(); toast(`${fuera.length} quitados de la lista`);
  },

  semana: ({ n }) => { ui.semana = iso(addDays(parse(ui.semana), 7 * n)); render(); },
  semanaHoy: () => { ui.semana = iso(mondayOf(new Date())); render(); },
  editMenu: ({ d }) => formMenu(d),
  menuCompra: () => {
    const lunes = parse(ui.semana);
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const m = db.menu[iso(addDays(lunes, i))];
      if (m?.ingredientes) m.ingredientes.split(/[,\n;]+/).forEach(x => { if (anadirCompra(x)) n++; });
    }
    guardar();
    toast(n ? `${n} ingredientes añadidos a la compra` : 'No hay ingredientes nuevos que añadir');
  },

  mesDinero: ({ n }) => { ui.mesDinero = shiftMes(ui.mesDinero, +n); render(); },
  limite: () => formLimite(),
  editMov: ({ id }) => formMovimiento(buscar(db.presupuesto.movs, id)),

  togglePlan: ({ id }) => { const p = buscar(db.planes, id); p.hecho = !p.hecho; guardar(); render(); },
  editPlan: ({ id }) => formPlan(buscar(db.planes, id)),
};

$('#vista').addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el) ACCIONES[el.dataset.act]?.(el.dataset);
});

$('#vista').addEventListener('submit', e => {
  if (e.target.dataset.form === 'tarea') {
    e.preventDefault();
    const texto = e.target.texto.value.trim();
    if (!texto) return;
    db.tareas.push({ id: uid(), texto: cap(texto), creado: HOY(), hecho: false });
    guardar(); render();
    $('#vista input[name=texto]').focus();
    return;
  }
  if (e.target.dataset.form !== 'compra') return;
  e.preventDefault();
  const f = e.target, nombre = f.nombre.value;
  ui.secCompra = f.sec.value;
  if (!nombre.trim()) return;
  if (!anadirCompra(nombre, f.sec.value)) toast('Ya está en la lista');
  guardar(); render();
  $('#vista input[name=nombre]').focus();
});

$('#vista').addEventListener('change', e => {
  if (e.target.dataset.cambio === 'umbral') {
    db.ajustes.umbralTareas = +e.target.value;
    guardar(); render();
  }
});

document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => irA(b.dataset.tab));
$('#fab').onclick = () => SECCIONES[ui.tab].nuevo?.();
$('#btnOpciones').onclick = abrirOpciones;

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('ver');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('ver'), 2200);
}

// Si la app se queda abierta y cambia el día, refrescar
let ultimoDia = HOY();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && HOY() !== ultimoDia) {
    ultimoDia = HOY();
    ui.agenda.sel = ui.trabajo.sel = ultimoDia;
    ui.agenda.mes = ui.trabajo.mes = ultimoDia.slice(0, 7);
    ui.semana = iso(mondayOf(new Date()));
    render();
  }
  if (document.visibilityState === 'visible') revisarTareas();
});

render();

// Funcionar sin conexión y pedir que el móvil no borre los datos
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});
publicarResumenTareas();
if (avisosDisponibles() && Notification.permission === 'granted') programarRevision();
setTimeout(() => revisarTareas(), 800);
