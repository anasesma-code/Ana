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
  menu: {}, presupuesto: { limites: {}, movs: [] }, planes: [],
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
}

/* ============================================================
   Estado de la pantalla
   ============================================================ */
const ui = {
  tab: (() => { try { return localStorage.getItem('miAgenda.tab') || 'agenda'; } catch { return 'agenda'; } })(),
  agenda: { sel: HOY(), mes: HOY().slice(0, 7) },
  trabajo: { sel: HOY(), mes: HOY().slice(0, 7) },
  semana: iso(mondayOf(new Date())),
  mesDinero: HOY().slice(0, 7),
  secCompra: 'Otros',
};

const SECCIONES = {
  agenda:  { titulo: 'Agenda',          render: () => vistaCalendario('agenda'),  nuevo: () => formEvento('agenda') },
  trabajo: { titulo: 'Agenda de trabajo', render: () => vistaCalendario('trabajo'), nuevo: () => formEvento('trabajo') },
  compra:  { titulo: 'Lista de la compra', render: vistaCompra },
  menu:    { titulo: 'Menú de la semana', render: vistaMenu },
  dinero:  { titulo: 'Presupuesto',     render: vistaDinero, nuevo: () => formMovimiento() },
  planes:  { titulo: 'Planes',          render: vistaPlanes, nuevo: () => formPlan() },
};
if (!SECCIONES[ui.tab]) ui.tab = 'agenda';

function render() {
  const s = SECCIONES[ui.tab];
  document.body.dataset.tab = ui.tab;
  $('#titulo').textContent = s.titulo;
  $('#hoyTxt').textContent = cap(parse(HOY()).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
  $('#vista').innerHTML = s.render();
  $('#fab').hidden = !s.nuevo;
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

function vistaCalendario(k) {
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

function formEvento(k, it) {
  const campos = [
    { name: 'titulo', label: k === 'trabajo' ? '¿Qué hay que hacer?' : '¿Qué es?', required: true, placeholder: k === 'trabajo' ? 'Reunión, entrega, llamada…' : 'Médico, cumpleaños, quedada…' },
    { name: 'fecha', label: 'Día', type: 'date', required: true, def: ui[k].sel },
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
   Lista de la compra
   ============================================================ */
const PASILLOS = ['Fruta y verdura', 'Carne y pescado', 'Lácteos y huevos', 'Panadería', 'Despensa', 'Congelados', 'Bebidas', 'Limpieza e higiene', 'Otros'];

function vistaCompra() {
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

function abrirFormulario({ titulo, campos, valores = {}, onGuardar, onBorrar, textoBorrar = 'Borrar' }) {
  const dlg = $('#hoja');
  dlg.innerHTML = `<form class="form" novalidate>
    <div class="asa"></div>
    <h2>${esc(titulo)}</h2>
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

  toggleCompra: ({ id }) => { const i = buscar(db.compra, id); i.hecho = !i.hecho; guardar(); render(); },
  editCompra: ({ id }) => formCompra(buscar(db.compra, id)),
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
  if (e.target.dataset.form !== 'compra') return;
  e.preventDefault();
  const f = e.target, nombre = f.nombre.value;
  ui.secCompra = f.sec.value;
  if (!nombre.trim()) return;
  if (!anadirCompra(nombre, f.sec.value)) toast('Ya está en la lista');
  guardar(); render();
  $('#vista input[name=nombre]').focus();
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
});

render();

// Funcionar sin conexión y pedir que el móvil no borre los datos
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});
