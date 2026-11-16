'use strict';
/* ============================================================
   Calculadora de calorías sin internet
   Tabla de alimentos habituales en España. Valores aproximados por
   100 g o 100 ml (kcal, proteína, grasa, hidratos) y la ración típica.
   ============================================================ */

// [palabras clave, gramos de la ración, kcal, prot, grasa, hidratos, nombre de la ración, menor]
// "menor": acompañamiento que no se cuenta si en la misma frase hay un plato principal.
const ALIMENTOS = [
  // Desayuno y pan
  ['café con leche|cafe con leche|café con leche semidesnatada|café con leche semi desnatada|café con leche semi densatada|café con leche desnatada|café con leche entera', 200, 35, 1.8, 1.2, 3.5, 'taza'],
  ['cortado', 80, 30, 1.6, 1.6, 2.2, 'taza'],
  ['café|cafe|infusión|infusion|té|manzanilla', 60, 2, 0.1, 0, 0.3, 'taza', true],
  ['leche desnatada|desnatada|densatada', 250, 35, 3.4, 0.2, 4.9, 'vaso'],
  ['leche semidesnatada|semidesnatada|leche semi desnatada|semi desnatada|semi densatada', 250, 46, 3.2, 1.6, 4.7, 'vaso'],
  ['bebida de avena|leche de avena', 250, 45, 0.6, 1.5, 7, 'vaso'],
  ['bebida de soja|leche de soja', 250, 40, 3.3, 1.8, 2.5, 'vaso'],
  ['leche', 250, 63, 3.2, 3.6, 4.7, 'vaso'],
  ['colacao|cola cao|cacao en polvo|nesquik', 15, 380, 5, 3, 80, 'cucharada'],
  ['pan integral', 40, 250, 10, 3.5, 43, 'rebanada'],
  ['pan de molde|molde', 30, 265, 8, 4, 48, 'rebanada'],
  ['tostada|rebanada', 35, 280, 9, 3.5, 52, 'tostada'],
  ['biscote', 10, 400, 11, 6, 75, 'biscote'],
  ['bocadillo|bocata|sándwich|sandwich|montadito', 200, 260, 13, 9, 32, 'bocadillo'],
  ['pan', 50, 270, 9, 3.2, 51, 'trozo'],
  ['copos de avena|avena', 40, 370, 13, 7, 59, 'ración'],
  ['cereales|muesli|granola|corn flakes', 40, 380, 8, 4, 78, 'bol'],
  ['galleta', 8, 440, 7, 14, 72, 'galleta'],
  ['magdalena', 30, 420, 6, 20, 52, 'magdalena'],
  ['cruasán|croissant|cruasan', 60, 410, 8, 21, 45, 'cruasán'],
  ['napolitana|donut|dónut|bollo|bollería|bolleria|ensaimada', 70, 430, 6, 22, 50, 'pieza'],
  ['churro|porra', 25, 360, 5, 18, 42, 'churro'],
  ['tarta de queso|cheesecake', 100, 320, 6, 22, 25, 'trozo'],
  ['bizcocho|tarta|pastel', 80, 380, 6, 17, 50, 'trozo'],
  ['mantequilla', 10, 740, 0.7, 82, 0.6, 'porción'],
  ['margarina', 10, 720, 0, 80, 0.5, 'porción'],
  ['mermelada|confitura', 15, 250, 0.4, 0, 62, 'cucharada'],
  ['miel', 15, 310, 0.4, 0, 82, 'cucharada'],
  ['azúcar|azucar', 8, 400, 0, 0, 100, 'sobre'],
  ['aceite', 10, 900, 0, 100, 0, 'cucharada'],
  ['aguacate', 70, 160, 2, 15, 8.5, 'medio'],
  ['hummus', 50, 170, 8, 10, 14, 'ración'],
  ['crema de cacahuete|mantequilla de cacahuete', 15, 600, 25, 50, 15, 'cucharada'],
  ['nocilla|nutella|crema de cacao', 15, 540, 6, 31, 57, 'cucharada'],

  // Embutidos, quesos, huevos
  ['jamón serrano|jamon serrano|jamón ibérico|jamon iberico|serrano', 30, 240, 30, 13, 0, 'ración'],
  ['jamón york|jamon york|jamón cocido|jamon cocido|york', 30, 110, 18, 3, 2, 'lonchas'],
  ['pavo', 30, 105, 19, 2, 2, 'lonchas'],
  ['chorizo', 30, 450, 24, 38, 2, 'ración'],
  ['salchichón|salchichon|fuet|lomo embuchado', 30, 420, 28, 33, 1, 'ración'],
  ['queso fresco|queso de burgos|requesón|requeson|mozzarella', 60, 180, 12, 13, 3, 'ración'],
  ['queso de untar|philadelphia|queso crema', 20, 250, 6, 24, 3, 'cucharada'],
  ['queso', 30, 380, 26, 30, 0.5, 'ración'],
  ['tortilla de patata|tortilla de patatas|tortilla española|tortilla espanola', 150, 190, 6.5, 12, 14, 'trozo'],
  ['tortilla francesa|tortilla', 110, 175, 11, 14, 0.6, 'tortilla'],
  ['huevo frito|huevos fritos', 65, 200, 13.5, 15.5, 0.8, 'huevo'],
  ['revuelto|huevos revueltos', 130, 160, 10, 12, 2, 'ración'],
  ['huevo', 55, 145, 12.5, 10, 0.7, 'huevo'],

  // Lácteos y postres
  ['yogur griego|griego', 125, 120, 6, 10, 4, 'yogur'],
  ['yogur desnatado|yogur 0|yogur proteico|skyr', 125, 50, 6, 0.2, 5, 'yogur'],
  ['yogur', 125, 61, 3.5, 3.3, 4.7, 'yogur'],
  ['kéfir|kefir', 200, 60, 3.5, 3, 4.5, 'vaso'],
  ['natillas|natilla|flan|arroz con leche|cuajada', 125, 120, 3.5, 3.5, 19, 'unidad'],
  ['helado', 100, 210, 3.5, 11, 25, 'bola'],
  ['chocolate negro', 20, 560, 7, 40, 40, 'onzas'],
  ['chocolate', 20, 540, 6, 32, 55, 'onzas'],
  ['batido', 200, 70, 3, 1.5, 11, 'vaso'],

  // Fruta
  ['plátano|platano|banana', 120, 90, 1.1, 0.3, 21, 'pieza'],
  ['manzana', 180, 52, 0.3, 0.2, 12, 'pieza'],
  ['pera', 170, 57, 0.4, 0.1, 13, 'pieza'],
  ['naranja', 180, 47, 0.9, 0.1, 10, 'pieza'],
  ['mandarina', 80, 50, 0.8, 0.3, 11, 'pieza'],
  ['kiwi', 80, 61, 1.1, 0.5, 13, 'pieza'],
  ['melocotón|melocoton|nectarina|paraguaya', 150, 40, 0.9, 0.3, 9, 'pieza'],
  ['fresa|frutos rojos|arándano|arandano|frambuesa', 150, 35, 0.7, 0.3, 7, 'bol'],
  ['sandía|sandia', 300, 30, 0.6, 0.2, 7, 'tajada'],
  ['melón|melon', 250, 34, 0.8, 0.2, 8, 'tajada'],
  ['uva', 150, 69, 0.7, 0.2, 16, 'racimo'],
  ['piña|pina', 150, 50, 0.5, 0.1, 12, 'rodajas'],
  ['mango', 150, 60, 0.8, 0.4, 15, 'pieza'],
  ['ciruela', 60, 46, 0.7, 0.3, 11, 'pieza'],
  ['zumo|jugo', 200, 45, 0.6, 0.1, 10, 'vaso'],
  ['macedonia|fruta', 150, 50, 0.6, 0.2, 12, 'pieza'],

  // Legumbres, arroz, pasta, patata (platos cocinados)
  ['lentejas con chorizo|lentejas estofadas', 300, 150, 8, 7, 14, 'plato'],
  ['lenteja', 300, 110, 7, 2.5, 15, 'plato'],
  ['cocido|garbanzos con|potaje', 350, 150, 9, 6, 15, 'plato'],
  ['garbanzo', 300, 140, 7, 5, 17, 'plato'],
  ['fabada', 300, 180, 9, 10, 12, 'plato'],
  ['alubia|judías blancas|judias blancas|judía blanca|frijol', 300, 120, 7, 3, 16, 'plato'],
  ['paella|arroz con pollo|arroz a banda|arroz negro|arroz con', 350, 160, 8, 6, 19, 'plato'],
  ['arroz', 200, 130, 2.7, 0.5, 28, 'plato'],
  ['carbonara', 300, 210, 8, 10, 22, 'plato'],
  ['lasaña|lasana|lasagna|canelones', 300, 150, 8, 7, 14, 'plato'],
  ['macarrones con tomate|pasta con tomate|espaguetis con tomate|espaguetis boloñesa|boloñesa|bolonesa', 300, 145, 6, 4, 22, 'plato'],
  ['pasta|macarrones|espagueti|espaguetis|spaghetti|fideos|tallarines|fideuá|fideua|ñoquis', 250, 150, 5.5, 1, 30, 'plato'],
  ['patatas fritas|patata frita', 150, 290, 3.4, 15, 36, 'ración'],
  ['patatas bravas|bravas', 200, 220, 3, 13, 24, 'ración'],
  ['chips|patatas de bolsa', 40, 535, 6, 33, 53, 'bolsa'],
  ['puré de patata|pure de patata|puré|pure', 250, 85, 2, 3, 13, 'plato'],
  ['patata', 200, 80, 2, 0.1, 17, 'ración'],
  ['quinoa|cuscús|cuscus|bulgur', 200, 120, 4.4, 1.9, 21, 'plato'],

  // Verdura y platos de cuchara ligeros
  ['ensalada mixta|ensalada de atún|ensalada de atun|ensalada césar|ensalada cesar', 250, 85, 4, 6, 4, 'plato'],
  ['ensalada', 200, 60, 1.5, 4, 4, 'plato'],
  ['salmorejo', 200, 120, 2.5, 8, 9, 'plato'],
  ['gazpacho', 250, 70, 1, 5.5, 5, 'vaso'],
  ['crema de verduras|crema de|crema|puré de verduras|pure de verduras', 300, 55, 1.5, 2.5, 6, 'plato'],
  ['sopa|caldo|consomé|consome', 300, 40, 2.5, 1, 5, 'plato'],
  ['pisto|menestra|verduras|verdura|parrillada de verduras|judías verdes|judias verdes|brócoli|brocoli|espinaca|calabacín|calabacin|coliflor|acelga|champiñón|champinon|setas|berenjena|alcachofa|espárrago|esparrago', 250, 45, 2.2, 2, 4.5, 'plato', true],
  ['tomate', 120, 20, 0.9, 0.2, 3.5, 'pieza', true],
  ['zanahoria|pepino|lechuga|pimiento|cebolla', 100, 25, 1, 0.2, 5, 'ración', true],

  // Carne
  ['pollo empanado|nuggets|san jacobo|escalope|pechuga empanada|cachopo', 150, 260, 15, 15, 15, 'ración'],
  ['pollo asado|muslo de pollo|alitas', 200, 215, 27, 12, 0, 'ración'],
  ['pollo|pechuga', 150, 165, 31, 3.6, 0, 'filete'],
  ['hamburguesa completa|burger|hamburguesa con pan', 250, 250, 13, 12, 22, 'hamburguesa'],
  ['hamburguesa|carne picada', 150, 250, 19, 19, 0, 'hamburguesa'],
  ['albóndiga|albondiga', 200, 200, 12, 13, 8, 'ración'],
  ['ternera|filete|bistec|entrecot|solomillo|carne', 150, 180, 26, 8, 0, 'filete'],
  ['costilla', 200, 290, 24, 21, 0, 'ración'],
  ['panceta|bacon|beicon|secreto', 50, 400, 15, 37, 0, 'ración'],
  ['salchicha', 100, 270, 12, 24, 2, 'ración'],
  ['cerdo|lomo|chuleta|cinta de lomo', 150, 200, 27, 10, 0, 'filete'],
  ['cordero', 150, 250, 25, 16, 0, 'ración'],
  ['conejo', 150, 140, 22, 5.5, 0, 'ración'],

  // Pescado y marisco
  ['calamares a la romana|calamares fritos|rabas|pescaíto frito|pescaito frito|boquerones fritos|pescado frito|pescado rebozado|merluza rebozada', 150, 230, 13, 12, 17, 'ración'],
  ['salmón|salmon', 150, 205, 20, 13.5, 0, 'filete'],
  ['atún al natural|atun al natural', 60, 110, 26, 1, 0, 'lata'],
  ['atún|atun|bonito', 60, 200, 26, 10, 0, 'lata'],
  ['sardina|caballa|boquerón|boqueron|anchoa', 100, 160, 20, 9, 0, 'ración'],
  ['gamba|langostino|marisco|mejillón|mejillon|almeja|pulpo|sepia|calamar', 150, 90, 18, 1.5, 1.5, 'ración'],
  ['merluza|bacalao|lenguado|dorada|lubina|rape|gallo|pescado blanco|pescado|panga|trucha', 180, 95, 18, 2, 0, 'filete'],
  ['surimi|palitos de cangrejo', 60, 100, 8, 1, 15, 'ración'],
  ['tofu', 150, 145, 15, 9, 3, 'ración'],
  ['soja texturizada|seitán|seitan', 100, 150, 22, 3, 8, 'ración'],

  // Platos y picoteo
  ['croqueta', 30, 250, 8, 14, 23, 'croqueta'],
  ['empanadilla|empanada', 120, 300, 8, 16, 30, 'trozo'],
  ['pizza', 125, 260, 11, 10, 32, 'porciones'],
  ['kebab|durum|dürüm|shawarma', 350, 220, 12, 10, 22, 'unidad'],
  ['burrito|fajita|taco|wrap', 200, 210, 10, 8, 24, 'unidad'],
  ['sushi|maki|nigiri', 25, 150, 5, 1.5, 28, 'pieza'],
  ['nueces|nuez|almendra|cacahuete|frutos secos|anacardo|pistacho|avellana', 30, 600, 20, 52, 12, 'puñado'],
  ['aceituna', 40, 140, 1, 14, 1, 'ración'],
  ['mayonesa|alioli|allioli', 15, 700, 1, 77, 1, 'cucharada'],
  ['tomate frito|ketchup', 20, 90, 1.5, 3, 15, 'cucharada'],

  // Bebidas
  ['cerveza sin|sin alcohol', 250, 20, 0.3, 0, 4.5, 'caña'],
  ['cerveza|caña|tercio', 250, 43, 0.4, 0, 3.5, 'caña'],
  ['vino|tinto|cava|sangría|sangria|tinto de verano', 150, 83, 0.1, 0, 2.6, 'copa'],
  ['zero|light|sin azúcar|sin azucar|agua|sifón|sifon', 250, 0, 0, 0, 0, 'vaso', true],
  ['refresco|coca cola|cocacola|coca-cola|fanta|nestea|aquarius|sprite', 330, 42, 0, 0, 10.6, 'lata'],
].map(([claves, racion, kcal, p, g, hc, unidad, menor]) => ({
  claves: claves.split('|'), racion, kcal, p, g, hc, unidad, menor: !!menor,
}));

const NUMEROS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, diez: 10, medio: 0.5, media: 0.5, mitad: 0.5 };
// Unidades pequeñas con peso propio (en g o ml). Otras (plato, ración, vaso, pieza…) = la ración del alimento.
const UNIDADES = { rodaja: 40, rodajas: 40, loncha: 15, lonchas: 15, onza: 6, onzas: 6, cucharada: 12, cucharadas: 12,
  cucharadita: 5, cucharaditas: 5, punado: 30, punados: 30, rebanada: 35, rebanadas: 35, chorrito: 5, chorro: 10 };
const quitarTildes = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'ñ');
const a100 = (n, u) => u === 'kg' || /^l/.test(u) ? n * 1000 : u === 'cl' ? n * 10 : n;
const RE_NUM = '(\\d+(?:[.,]\\d+)?|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|diez|medio|media)';
const RE_UNI = '(kg|gramos|grs|gr|g|ml|cl|litros?|l)';
const valorNum = v => NUMEROS[v] ?? parseFloat(v.replace(',', '.'));

// Índice de palabras clave, de la más larga a la más corta
const CLAVES = ALIMENTOS.flatMap(a => a.claves.map(c => ({ c: quitarTildes(c.toLowerCase()), orig: c, a })))
  .sort((x, y) => y.c.length - x.c.length);

// Cantidad en gramos para un alimento, mirando el texto justo antes y justo después
function gramosDe(antes, despues, a) {
  let m = despues.match(new RegExp('^\\s*(?:[a-zñ]+\\s+){0,3}?(\\d+(?:[.,]\\d+)?)\\s*' + RE_UNI + '(?![a-zñ])'));
  if (m) return a100(parseFloat(m[1].replace(',', '.')), m[2]);
  m = antes.match(new RegExp('(\\d+(?:[.,]\\d+)?)\\s*' + RE_UNI + '\\s+(?:de\\s+)?(?:[a-zñ]+\\s+){0,1}$'));
  if (m) return a100(parseFloat(m[1].replace(',', '.')), m[2]);
  m = antes.match(new RegExp(RE_NUM + '\\s+(?:([a-zñ]+)\\s+)?(?:de\\s+)?(?:[a-zñ]+\\s+)?$'));
  let n = 1, porUnidad = a.racion;
  if (m) {
    n = valorNum(m[1]);
    if (m[2] && UNIDADES[m[2]]) porUnidad = UNIDADES[m[2]];
  } else {
    const u = antes.match(/([a-zñ]+)\s+(?:de\s+)?$/);
    if (u && UNIDADES[u[1]]) porUnidad = UNIDADES[u[1]];
  }
  return n * porUnidad;
}

// Devuelve { kcal, p, g, hc, partes: [texto], dudas: [texto] }
function estimarCalorias(texto) {
  const res = { kcal: 0, p: 0, g: 0, hc: 0, partes: [], dudas: [] };
  if (!texto || !texto.trim()) return res;
  const trozos = quitarTildes(texto.toLowerCase())
    .split(/[,;+\n]|\s+y\s+|\s+mas\s+|\s+o\s+/).map(t => t.trim()).filter(Boolean);
  let anterior = null;

  for (const trozo of trozos) {
    // Busca alimentos sin solaparse, priorizando las palabras clave más largas
    const ocupado = new Array(trozo.length).fill(false);
    let hallados = [];
    for (const { c, orig, a } of CLAVES) {
      let desde = 0, i;
      while ((i = trozo.indexOf(c, desde)) !== -1) {
        const fin = i + c.length;
        const antesOk = i === 0 || !/[a-zñ]/.test(trozo[i - 1]);
        const resto = trozo.slice(fin);
        const despuesOk = !/^[a-zñ]/.test(resto) || /^(s|es)(?![a-zñ])/.test(resto);
        if (antesOk && despuesOk && !ocupado.slice(i, fin).some(Boolean)) {
          ocupado.fill(true, i, fin);
          hallados.push({ a, orig, i, fin });
        }
        desde = fin;
      }
    }
    if (!hallados.length) {
      // "1 plato", "2 raciones": multiplica lo anterior
      const m = trozo.match(new RegExp('^' + RE_NUM + '\\s+(plato|platos|racion|raciones|vaso|vasos|taza|tazas|bol|boles|unidad|unidades)$'));
      if (m && anterior) {
        const extra = valorNum(m[1]) - 1;
        for (const k of ['kcal', 'p', 'g', 'hc']) res[k] += anterior[k] * extra;
      } else if (!/^(de|con|sin|al|a la|el|la|los|las|un|una|para)$/.test(trozo)) res.dudas.push(trozo);
      continue;
    }
    hallados.sort((x, y) => x.i - y.i);
    // El mismo alimento nombrado dos veces ("pechuga de pollo") cuenta una vez
    hallados = hallados.filter((h, j) => hallados.findIndex(x => x.a === h.a) === j);
    // Los huevos de una tortilla o un revuelto ya están contados
    if (hallados.some(h => /tortilla|revuelto/.test(h.orig))) hallados = hallados.filter(h => h.orig !== 'huevo');
    // "huevos cocidos", "garbanzos cocidos": aquí "cocido" describe el alimento anterior, no es el plato
    hallados = hallados.filter((h, j) => !(h.orig === 'cocido' && j > 0));
    // "café con leche semidesnatada": el tipo de leche ya va dentro del café, no es otro vaso
    const cafe = hallados.find(h => /con leche/.test(h.orig));
    if (cafe) hallados = hallados.filter(h => h === cafe || h.i < cafe.fin || !/leche|desnatada|densatada|bebida de/.test(h.orig));
    // "crema de calabacín", "sopa de verduras": la verdura forma parte del plato
    hallados = hallados.filter((h, j) => !(h.a.menor && j > 0 && /^\s*de\s*$/.test(trozo.slice(hallados[j - 1].fin, h.i))
      || (h.a.menor && j > 0 && / de$/.test(hallados[j - 1].orig))));
    const hayPrincipal = hallados.some(h => !h.a.menor);

    const suma = { kcal: 0, p: 0, g: 0, hc: 0 };
    hallados.forEach((h, j) => {
      const antes = trozo.slice(j ? hallados[j - 1].fin : 0, h.i);
      const despues = trozo.slice(h.fin, hallados[j + 1]?.i ?? trozo.length);
      let g = gramosDe(antes, despues, h.a);
      if (/\b(grande|doble|abundante)\b/.test(antes + despues)) g *= 1.4;
      if (/\b(pequen[oa]|pequenit[oa]|poco|poca)\b/.test(antes + despues)) g *= 0.7;
      if (h.a.menor && hayPrincipal) g *= 0.5; // acompañamiento: media ración
      const f = g / 100;
      suma.kcal += h.a.kcal * f; suma.p += h.a.p * f; suma.g += h.a.g * f; suma.hc += h.a.hc * f;
      const liquido = /zumo|leche|vino|cerveza|refresco|batido|gazpacho|bebida|kefir|kéfir|agua|café|cafe|caña|cortado/.test(h.orig);
      const nombre = / de$/.test(h.orig) ? (trozo.slice(h.i).match(/^[a-zñ ]*?de [a-zñ]+/)?.[0] ?? h.orig) : h.orig;
      res.partes.push(`${nombre} (${Math.round(g)} ${liquido ? 'ml' : 'g'})`);
    });
    for (const k of ['kcal', 'p', 'g', 'hc']) res[k] += suma[k];
    anterior = suma;
  }
  for (const k of ['kcal', 'p', 'g', 'hc']) res[k] = Math.round(res[k]);
  return res;
}
