'use strict';
/* ============================================================
   Apuntar hablando: dictado + interpretación de lo dicho
   «el martes tengo una reunión de trabajo, el miércoles se queda con
   mi madre y tengo que comprar leche, pan y huevos»
   ============================================================ */

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const HORAS_TXT = { una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
const PALABRAS_TRABAJO = /\b(trabajo|curro|oficina|cliente|clientes|jefe|jefa|proyecto|entrega|informe|presentacion|videollamada|teams|zoom|turno|guardia|nomina|compañer[oa]s? de trabajo)\b/;
const REUNION_NO_TRABAJO = /\b(cole|colegio|tutoria|vecinos|comunidad|padres|amig[oa]s|familia)\b/;
const TIPOS_VOZ = [['agenda', '📅 Agenda'], ['trabajo', '💼 Trabajo'], ['tarea', '✅ Tarea'], ['compra', '🛒 Compra'], ['plan', '⭐ Plan']];

const normVoz = t => quitarTildes(t.normalize('NFC').toLowerCase());

// Sección del súper según el producto
function seccionDe(nombre) {
  const n = normVoz(nombre);
  const reglas = [
    ['Lácteos y huevos', /leche|yogur|queso|huevo|nata|mantequilla|kefir/],
    ['Fruta y verdura', /fruta|manzana|platano|naranja|pera|uva|fresa|kiwi|limon|tomate|lechuga|cebolla|patata|zanahoria|pimiento|ajo|verdura|calabacin|pepino|aguacate|melon|sandia|mandarina|brocoli|espinaca/],
    ['Carne y pescado', /carne|pollo|pechuga|ternera|cerdo|lomo|filete|hamburguesa|salchicha|jamon|pavo|pescado|merluza|salmon|atun fresco|gamba|chorizo/],
    ['Panadería', /\bpan\b|pan de|barra|bolleria|magdalena|tostada|picos/],
    ['Bebidas', /agua|cerveza|vino|refresco|zumo|coca|cafe\b/],
    ['Congelados', /congelad|helado|pizza/],
    ['Limpieza e higiene', /detergente|lejia|suavizante|friegasuelos|lavavajillas|papel|jabon|champu|gel|pasta de dientes|cepillo|compresas|panales|bayeta|estropajo|basura|limpia/],
    ['Despensa', /arroz|pasta|macarrones|espaguetis|aceite|sal\b|azucar|harina|lenteja|garbanzo|alubia|atun|conserva|tomate frito|galleta|cereales|cafe|cacao|legumbre/],
  ];
  return (reglas.find(([, re]) => re.test(n)) || ['Otros'])[0];
}

// Busca un día y una hora en una frase. Devuelve { fecha, hora, n } con la frase sin esas palabras.
function fechaHoraDe(frase, hoy = new Date()) {
  let n = frase, fecha = null, hora = null;
  // Borra lo encontrado con espacios para que el texto conserve su longitud
  const quitar = re => { const m = n.match(re); if (m) n = n.slice(0, m.index) + ' '.repeat(m[0].length) + n.slice(m.index + m[0].length); return m; };
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  // Hora: "a las 10", "a las 5 y media de la tarde", "a las 17:30", "a la una"
  let m = quitar(/\b(?:a|sobre|hacia) las? (\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?:[:.h](\d{2})| y (media|cuarto)| menos cuarto)?(?: (?:de la|por la) (manana|tarde|noche)| ?(am|pm))?\b/);
  if (m) {
    let h = HORAS_TXT[m[1]] ?? +m[1], min = m[2] ? +m[2] : m[3] === 'media' ? 30 : m[3] === 'cuarto' ? 15 : 0;
    if (/menos cuarto/.test(m[0])) { h -= 1; min = 45; }
    const franja = m[4] || m[5];
    if ((franja === 'tarde' || franja === 'noche' || franja === 'pm') && h < 12) h += 12;
    else if (!franja && h >= 1 && h <= 7) h += 12; // "a las 5" = 17:00
    if (h >= 0 && h < 24) hora = `${pad(h)}:${pad(min)}`;
  } else if ((m = quitar(/\ba mediodia\b/))) hora = '14:00';

  // Día
  if ((m = quitar(/\bpasado manana\b/))) fecha = addDays(base, 2);
  else if ((m = quitar(/\b(?:el )?(?:dia )?(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/))) {
    const mes = MESES_ES.indexOf(m[2]);
    fecha = new Date(base.getFullYear(), mes, +m[1]);
    if (fecha < base) fecha.setFullYear(fecha.getFullYear() + 1);
  } else if ((m = quitar(/\b(?:el )?(?:proximo |este |el que viene )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?: que viene| proximo)?\b/))) {
    const dia = DIAS_SEMANA.indexOf(m[1]);
    let d = (dia - base.getDay() + 7) % 7;
    if (d === 0) d = 7;
    if (/que viene|proximo/.test(m[0]) && d < 2) d += 7;
    fecha = addDays(base, d);
  } else if ((m = quitar(/\bel (?:dia )?(\d{1,2})\b(?! (?:kilos?|kg|litros?|gramos|euros|unidades))/))) {
    const dia = +m[1];
    fecha = new Date(base.getFullYear(), base.getMonth(), dia);
    if (fecha < base) fecha = new Date(base.getFullYear(), base.getMonth() + 1, dia);
  } else if ((m = quitar(/\b(?:la semana que viene|la proxima semana)\b/))) {
    fecha = addDays(base, ((8 - base.getDay()) % 7) || 7);
  } else if ((m = quitar(/\b(?:hoy|esta (?:manana|tarde|noche))\b/))) fecha = base;
  else if ((m = quitar(/(?<!(?:la|por|de|esta) )\bmanana\b(?: por la (?:manana|tarde|noche))?/))) fecha = addDays(base, 1);

  // "por la tarde" sin hora concreta: se quita del título
  quitar(/\b(?:por|de|a) la (?:manana|tarde|noche)\b/);
  return { fecha: fecha ? iso(fecha) : null, hora, n };
}

// Deja el título limpio: "tengo una reunión de trabajo" → "Reunión de trabajo"
function limpiarTitulo(t) {
  let s = t.trim().replace(/^[\s,.;:]+|[\s,.;:]+$/g, '');
  const fuera = [
    /^(?:y|e|pues|entonces|tambien|ademas|luego|despues|bueno|vale|oye|mira)\b\s*/,
    /^(?:apunta(?:me)?|anota(?:me)?|recuerdame|acuerdate de|no (?:te )?olvides de|no olvidar|recordar)\s+(?:que\s+)?/,
    /^(?:tengo|hay)\s+que\s+/,
    /^(?:tengo|tenemos|hay|me toca|toca)\s+(?:una?\s+|el\s+|la\s+)?/,
    /^(?:una?|el|la|los|las)\s+/,
  ];
  let cambiado = true;
  while (cambiado) {
    cambiado = false;
    for (const re of fuera) {
      const m = normVoz(s).match(re);
      if (m && m[0].length) { s = s.slice(m[0].length); cambiado = true; }
    }
  }
  s = s.replace(/\s+/g, ' ').trim().replace(/[\s,.;:]+$/, '');
  // conectores sueltos al final: "se queda con mi madre y"
  while (/\s(y|e|que|pues|luego|tambien|también|con|de|a)$/i.test(s)) s = s.replace(/\s+\S+$/, '');
  return s ? cap(s) : '';
}

// Interpreta el texto dictado sin internet
function interpretarVoz(textoOriginal, hoy = new Date()) {
  const original = textoOriginal.normalize('NFC').replace(/\s+/g, ' ').trim();
  let n = normVoz(original);
  const items = [];

  // 1. Compras: "tengo que comprar leche, pan y huevos"
  const reCompra = /\b(?:(?:tengo|tenemos|hay) que |necesito |he de |me falta |me faltan )?(?:comprar|apunta(?:me)? en la (?:lista de la )?compra|anade a la (?:lista de la )?compra|pon en la (?:lista de la )?compra|para la compra|lista de la compra)\b:?/g;
  const corte = /[.;!?]|\s(?:y\s+)?(?=(?:el |este |el proximo )?(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b|manana\b|pasado manana|hoy\b|tengo\b|tenemos\b|hay que|luego\b|despues\b|tambien\b|ademas\b|recuerdame|apunta|el dia|el \d|quiero\b|me gustaria)/;
  let m;
  const tramos = [];
  while ((m = reCompra.exec(n))) {
    const ini = m.index, desde = m.index + m[0].length;
    const resto = n.slice(desde);
    const b = resto.search(corte);
    const fin = desde + (b === -1 ? resto.length : b);
    tramos.push([ini, desde, fin]);
    reCompra.lastIndex = fin;
  }
  const compras = [];
  for (const [ini, desde, fin] of tramos) {
    const lista = original.slice(desde, fin);
    for (const trozo of lista.split(/,|\s+y\s+|\s+e\s+/)) {
      let p = trozo.trim().replace(/^(?:un|una|unos|unas|el|la|los|las|algo de|un poco de)\s+/i, '').replace(/[.;:]+$/, '').trim();
      if (p.length > 1) compras.push({ tipo: 'compra', titulo: cap(p) });
    }
    // quita el tramo del texto (manteniendo la longitud para que original y n sigan alineados)
    n = n.slice(0, ini) + ' '.repeat(fin - ini) + n.slice(fin);
  }
  const orig2 = original.split('');
  for (const [ini, , fin] of tramos) for (let i = ini; i < fin; i++) orig2[i] = ' ';
  const origSinCompra = orig2.join('');

  // 2. Resto: separa en frases
  const separador = /[.;!?\n]|,|\s+y\s+(?=(?:el |la |este |el proximo )?(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo|manana|pasado|hoy|tengo|tenemos|hay|luego|despues|tambien|ademas|me |recuerdame|el dia|el \d|quiero|he quedado|quede))/g;
  const frases = [];
  let ult = 0;
  while ((m = separador.exec(n))) { frases.push([ult, m.index]); ult = m.index + m[0].length; }
  frases.push([ult, n.length]);

  let fechaPendiente = null, horaPendiente = null;
  for (const [a, b] of frases) {
    const fn = n.slice(a, b), fo = origSinCompra.slice(a, b);
    if (!fn.trim()) continue;
    const { fecha, hora, n: sinFecha } = fechaHoraDe(fn, hoy);
    // quita del original las mismas posiciones que se borraron (fecha y hora)
    const titO = fo.split('').map((c, i) => sinFecha[i] === ' ' && fn[i] !== ' ' ? ' ' : c).join('');
    const titulo = limpiarTitulo(titO);
    const f = fecha || fechaPendiente, h = hora || horaPendiente;
    if (!titulo || titulo.length < 3) {
      // frase solo con fecha ("el martes a las 10,") → se aplica a la siguiente
      if (fecha || hora) { fechaPendiente = fecha || fechaPendiente; horaPendiente = hora || horaPendiente; }
      continue;
    }
    fechaPendiente = horaPendiente = null;
    const tn = normVoz(titulo);
    let tipo;
    if (f) tipo = (PALABRAS_TRABAJO.test(tn) || (/\breunion\b/.test(tn) && !REUNION_NO_TRABAJO.test(tn))) ? 'trabajo' : 'agenda';
    else if (/^(?:quiero|me gustaria|me apetece|ir de|escapada|viaje)\b/.test(tn) || /\bplan\b/.test(tn)) tipo = 'plan';
    else if (PALABRAS_TRABAJO.test(tn)) tipo = 'tarea';
    else tipo = 'tarea';
    items.push({ tipo, titulo: tipo === 'plan' ? cap(titulo.replace(/^(quiero|me gustaria|me apetece)\s+/i, '')) : titulo, fecha: f || '', hora: h || '' });
  }
  return [...items, ...compras];
}

/* ---------- con IA (si hay clave) ---------- */
const ESQUEMA_VOZ = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: { items: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['tipo', 'titulo', 'fecha', 'hora'],
    properties: {
      tipo: { type: 'string', enum: TIPOS_VOZ.map(t => t[0]) },
      titulo: { type: 'string' },
      fecha: { type: 'string', description: 'YYYY-MM-DD o vacío si no hay día' },
      hora: { type: 'string', description: 'HH:MM o vacío si no hay hora' },
    } } } },
};

async function interpretarConIA(texto) {
  const clave = ajuste('apiKey');
  if (!clave) return null;
  const { default: Anthropic } = await import(SDK_IA);
  const client = new Anthropic({ apiKey: clave, dangerouslyAllowBrowser: true });
  const hoy = new Date();
  const resp = await client.beta.messages.create({
    model: MODELO_IA,
    max_tokens: 4000,
    system: `Conviertes lo que una persona dicta en voz alta en apuntes para su agenda en español.
Hoy es ${hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${iso(hoy)}).
Tipos: "agenda" (citas y cosas personales con día), "trabajo" (reuniones y cosas del trabajo con día),
"tarea" (cosas por hacer sin día concreto), "compra" (un producto por entrada), "plan" (planes de ocio o ideas).
Títulos cortos y naturales, sin la fecha ni la hora. "El martes" es el próximo martes (si hoy es martes, el de la semana que viene).
Si dice una hora sin "de la mañana" entre la 1 y las 7, suele ser por la tarde.`,
    messages: [{ role: 'user', content: texto }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_VOZ } },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });
  if (resp.stop_reason !== 'end_turn') return null;
  const datos = JSON.parse(resp.content.filter(b => b.type === 'text').map(b => b.text).join(''));
  return (datos.items || []).map(x => ({ tipo: x.tipo, titulo: x.titulo, fecha: /^\d{4}-\d{2}-\d{2}$/.test(x.fecha) ? x.fecha : '', hora: /^\d{2}:\d{2}$/.test(x.hora) ? x.hora : '' }));
}

/* ---------- pantalla ---------- */
const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
let grabacion = null;

function abrirVoz(empezarYa) {
  const dlg = $('#hoja');
  dlg.innerHTML = `<div class="form voz">
    <div class="asa"></div>
    <h2>Apuntar hablando</h2>
    <p>${Reconocimiento
      ? 'Pulsa el micrófono y dilo todo seguido, por ejemplo: <i>«el martes a las 10 tengo una reunión de trabajo, el miércoles se queda con mi madre y tengo que comprar leche, pan y huevos»</i>.'
      : 'Escribe o usa el micrófono del teclado 🎤, por ejemplo: <i>«el martes tengo una reunión de trabajo y tengo que comprar leche y pan»</i>.'}</p>
    ${Reconocimiento ? `<button type="button" class="mic" id="mic" aria-label="Empezar a hablar">
      <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>
      <p class="mic-estado" id="micEstado">Pulsa para hablar</p>` : ''}
    <textarea id="vozTexto" rows="4" placeholder="Lo que digas aparecerá aquí. También puedes escribir o corregir."></textarea>
    <div class="botones">
      <span class="sp"></span>
      <button type="button" class="btn" id="vozCancelar">Cancelar</button>
      <button type="button" class="btn prim" id="vozEntender">Siguiente</button>
    </div>
  </div>`;
  $('#vozCancelar').onclick = () => { pararGrabacion(); cerrarHoja(); };
  $('#vozEntender').onclick = () => { pararGrabacion(); revisarVoz($('#vozTexto').value); };
  if (Reconocimiento) $('#mic').onclick = () => grabacion ? pararGrabacion() : empezarGrabacion();
  dlg.onclose = pararGrabacion;
  dlg.showModal();
  if (empezarYa && Reconocimiento) empezarGrabacion();
}

function empezarGrabacion() {
  const ta = $('#vozTexto'), estado = $('#micEstado'), boton = $('#mic');
  const previo = ta.value.trim() ? ta.value.trim() + ', ' : '';
  try {
    grabacion = new Reconocimiento();
  } catch { estado.textContent = 'Este móvil no permite el dictado aquí. Usa el micrófono del teclado.'; return; }
  grabacion.lang = 'es-ES';
  grabacion.continuous = true;
  grabacion.interimResults = true;
  let finales = '';
  grabacion.onresult = e => {
    let provisional = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finales += (finales ? ' ' : '') + r[0].transcript.trim();
      else provisional += r[0].transcript;
    }
    ta.value = previo + finales + (provisional ? ' ' + provisional : '');
  };
  grabacion.onerror = e => {
    estado.textContent = e.error === 'not-allowed' || e.error === 'service-not-allowed'
      ? 'Sin permiso para el micrófono. Actívalo en los ajustes de Chrome para esta página.'
      : e.error === 'no-speech' ? 'No te he oído. Vuelve a pulsar y habla.'
      : e.error === 'network' ? 'El dictado necesita internet.'
      : 'No se ha podido escuchar. Vuelve a intentarlo.';
  };
  grabacion.onend = () => {
    grabacion = null;
    boton?.classList.remove('grabando');
    if (estado && /Escuchando/.test(estado.textContent)) estado.textContent = ta.value.trim() ? 'Pulsa «Siguiente» o vuelve a pulsar para añadir más' : 'Pulsa para hablar';
  };
  grabacion.start();
  boton.classList.add('grabando');
  estado.textContent = 'Escuchando… pulsa otra vez cuando acabes';
}

function pararGrabacion() {
  if (grabacion) { try { grabacion.stop(); } catch {} }
}

async function revisarVoz(texto) {
  texto = (texto || '').trim();
  if (!texto) return toast('Di o escribe algo primero');
  let items = null, conIA = false;
  if (ajuste('apiKey')) {
    $('#vozEntender').disabled = true; $('#vozEntender').textContent = 'Entendiendo…';
    try { items = await interpretarConIA(texto); conIA = !!items; } catch { items = null; }
  }
  if (!items) items = interpretarVoz(texto);
  if (!items.length) items = [{ tipo: 'tarea', titulo: cap(texto), fecha: '', hora: '' }];

  const fila = (it, i) => `<li class="voz-item" data-i="${i}">
    <div class="voz-fila1">
      <select name="tipo" aria-label="Dónde">${TIPOS_VOZ.map(([v, l]) => `<option value="${v}" ${v === it.tipo ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button type="button" class="x" data-quitar aria-label="Quitar">×</button>
    </div>
    <input name="titulo" value="${esc(it.titulo)}" aria-label="Qué">
    <div class="voz-fila2" ${['compra', 'tarea'].includes(it.tipo) ? 'hidden' : ''}>
      <input type="date" name="fecha" value="${it.fecha || ''}" aria-label="Día">
      <input type="time" name="hora" value="${it.hora || ''}" aria-label="Hora">
    </div>
  </li>`;

  const dlg = $('#hoja');
  dlg.innerHTML = `<div class="form voz">
    <div class="asa"></div>
    <h2>¿Lo apunto así?</h2>
    <p>${conIA ? '✨ Entendido con IA. ' : ''}Revisa y corrige lo que haga falta.</p>
    <p class="voz-dicho">«${esc(texto)}»</p>
    <ul class="voz-lista">${items.map(fila).join('')}</ul>
    <div class="botones">
      <button type="button" class="btn" id="vozOtra">Volver a hablar</button>
      <span class="sp"></span>
      <button type="button" class="btn prim" id="vozGuardar">Guardar todo</button>
    </div>
  </div>`;
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
  const lista = dlg.querySelector('.voz-lista');
  lista.addEventListener('click', e => { if (e.target.closest('[data-quitar]')) e.target.closest('li').remove(); });
  lista.addEventListener('change', e => {
    if (e.target.name === 'tipo') {
      const li = e.target.closest('li');
      li.querySelector('.voz-fila2').hidden = ['compra', 'tarea'].includes(e.target.value);
      if (['agenda', 'trabajo'].includes(e.target.value) && !li.querySelector('[name=fecha]').value) li.querySelector('[name=fecha]').value = HOY();
    }
  });
  $('#vozOtra').onclick = () => { abrirVoz(); $('#vozTexto').value = texto; };
  $('#vozGuardar').onclick = () => guardarVoz(lista);
}

function guardarVoz(lista) {
  let n = 0;
  const ir = new Set();
  for (const li of lista.querySelectorAll('li')) {
    const tipo = li.querySelector('[name=tipo]').value;
    const titulo = li.querySelector('[name=titulo]').value.trim();
    const fecha = li.querySelector('[name=fecha]').value;
    const hora = li.querySelector('[name=hora]').value;
    if (!titulo) continue;
    if (tipo === 'agenda' || tipo === 'trabajo') {
      db[tipo].push({ id: uid(), titulo, fecha: fecha || HOY(), hora, fin: '', lugar: '', rep: 'no', notas: '', ...(tipo === 'trabajo' ? { prioridad: 'normal' } : {}) });
    } else if (tipo === 'compra') {
      if (!anadirCompra(titulo, seccionDe(titulo))) continue;
    } else if (tipo === 'tarea') {
      db.tareas.push({ id: uid(), texto: cap(titulo), creado: HOY(), hecho: false });
    } else if (tipo === 'plan') {
      db.planes.push({ id: uid(), titulo, fecha, hora, hecho: false });
    }
    ir.add(tipo); n++;
  }
  guardar(); cerrarHoja();
  if (ir.size === 1) { const t = [...ir][0]; irA(t === 'plan' ? 'planes' : t); } else render();
  toast(n ? `Apuntado: ${n} ${n === 1 ? 'cosa' : 'cosas'} ✓` : 'No había nada que apuntar');
}

$('#btnVoz').onclick = () => abrirVoz(true);
if (new URLSearchParams(location.search).get('voz')) setTimeout(() => abrirVoz(true), 300);
