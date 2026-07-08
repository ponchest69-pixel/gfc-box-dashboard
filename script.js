/* ============================================================
   DATA LOAD
   Los datos se cargan desde ./data/datos.json mediante fetch()
   con una ruta RELATIVA. Esto funciona en GitHub Pages y en
   cualquier servidor web estático (no funciona con doble clic
   directo sobre index.html vía file://, ver README.md).
============================================================ */
let RAW, L, COLS, IDX, DATA, TOTAL_N, ALL_RACKS, ALL_SLOTS;

async function loadData(){
  const res = await fetch('data/datos.json');
  if(!res.ok) throw new Error('No se pudo cargar data/datos.json ('+res.status+')');
  RAW = await res.json();

  L = RAW.lookups;
  COLS = RAW.cols;
  IDX = {}; COLS.forEach((c,i)=>IDX[c]=i);

  // Expande cada fila comprimida (con índices) a un objeto legible
  DATA = RAW.rows.map(r=>({
    week: r[IDX.week],
    revision: L.revision[r[IDX.revision]],
    po: L.po[r[IDX.po]],
    serial: r[IDX.serial],
    line: L.line[r[IDX.line]],
    rack: L.rack[r[IDX.rack]],
    slot: r[IDX.slot],
    gen: L.gen[r[IDX.gen]],
    testTime: r[IDX.testTime],
    turno: L.turno[r[IDX.turno]],
    failName: L.failName[r[IDX.failName]],
    failDesc: L.failDesc[r[IDX.failDesc]],
    defectCode: L.defectCode[r[IDX.defectCode]],
    location: L.location[r[IDX.location]],
    rework: L.rework[r[IDX.rework]],
    unitState: L.unitState[r[IDX.unitState]],
    aparic: r[IDX.aparic]
  }));

  TOTAL_N = DATA.length;
}

/* ============================================================
   FILTER STATE
============================================================ */
const state = {
  weeks: new Set(),      // empty = all
  turnos: new Set(),
  line: '',
  po: '',
  revision: '',
  defectCode: '',
  serial: '',
  selectedRack: null
};

function filteredData(){
  return DATA.filter(d=>{
    if(state.weeks.size && !state.weeks.has(d.week)) return false;
    if(state.turnos.size && !state.turnos.has(d.turno)) return false;
    if(state.line && d.line !== state.line) return false;
    if(state.po && d.po !== state.po) return false;
    if(state.revision && d.revision !== state.revision) return false;
    if(state.defectCode && d.defectCode !== state.defectCode) return false;
    if(state.serial && !d.serial.toLowerCase().includes(state.serial.toLowerCase())) return false;
    if(state.selectedRack && d.rack !== state.selectedRack) return false;
    return true;
  });
}

/* ============================================================
   HELPERS
============================================================ */
function countBy(arr, key){
  const m = new Map();
  arr.forEach(d=>{
    const k = d[key];
    m.set(k, (m.get(k)||0)+1);
  });
  return m;
}
function topN(map, n){
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n);
}
function fmt(n){ return n.toLocaleString('en-US'); }
function pct(n,d){ return d===0 ? '0%' : (100*n/d).toFixed(1)+'%'; }
function esc(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

const tooltip = document.getElementById('tooltip');
function showTip(html, evt){
  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  const x = evt.clientX, y = evt.clientY;
  tooltip.style.left = Math.min(x+14, window.innerWidth-270)+'px';
  tooltip.style.top = (y+14)+'px';
}
function hideTip(){ tooltip.style.display='none'; }

const uniqueVals = (key)=>[...new Set(DATA.map(d=>d[key]))].sort();

/* ============================================================
   BUILD FILTER CONTROLS
============================================================ */
function buildChipGroup(containerId, values, stateSet, onChange){
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  values.forEach(v=>{
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = v;
    chip.onclick = ()=>{
      if(stateSet.has(v)) stateSet.delete(v); else stateSet.add(v);
      chip.classList.toggle('active');
      onChange();
    };
    el.appendChild(chip);
  });
}
function buildSelect(id, values, onChange){
  const sel = document.getElementById(id);
  values.forEach(v=>{
    const o = document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o);
  });
  sel.addEventListener('change', ()=>{ onChange(sel.value); renderAll(); });
}

function updateActiveFiltersLine(){
  const parts = [];
  if(state.weeks.size) parts.push('Semana: '+[...state.weeks].join(', '));
  if(state.turnos.size) parts.push('Turno: '+[...state.turnos].join(', '));
  if(state.line) parts.push('Línea: '+state.line);
  if(state.po) parts.push('PO: '+state.po);
  if(state.revision) parts.push('Rev: '+state.revision);
  if(state.defectCode) parts.push('Defect: '+state.defectCode);
  if(state.serial) parts.push('Serial ~ "'+state.serial+'"');
  if(state.selectedRack) parts.push('Rack: '+state.selectedRack);
  const line = document.getElementById('active-filters-line');
  line.innerHTML = parts.length ? ('Filtros activos → ' + parts.map(p=>'<span class="tag">'+esc(p)+'</span>').join('  ·  ')) : 'Sin filtros activos — mostrando todo el dataset';
}

/* ============================================================
   SVG CHART PRIMITIVES
============================================================ */
const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs){
  const e = document.createElementNS(NS, tag);
  for(const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

function barChartHoriz(container, data, opts={}){
  // data: [{label, value, color}]
  container.innerHTML = '';
  if(!data.length){ container.innerHTML = '<div class="empty-state">Sin datos para los filtros seleccionados</div>'; return; }
  const max = Math.max(...data.map(d=>d.value));
  data.forEach(d=>{
    const row = document.createElement('div'); row.className='bar-row';
    const lab = document.createElement('div'); lab.className='b-label'; lab.textContent = d.label; lab.title=d.label;
    const track = document.createElement('div'); track.className='b-track';
    const fill = document.createElement('div'); fill.className='b-fill';
    fill.style.width = (max? (d.value/max*100):0)+'%';
    if(d.color) fill.style.background = d.color;
    const val = document.createElement('div'); val.className='b-val'; val.textContent = fmt(d.value);
    track.appendChild(fill);
    row.appendChild(lab); row.appendChild(track); row.appendChild(val);
    row.addEventListener('mousemove', (e)=>showTip(`<b>${esc(d.label)}</b><br>${fmt(d.value)} registros (${pct(d.value, opts.total||max)})`, e));
    row.addEventListener('mouseleave', hideTip);
    if(opts.onClick){ row.style.cursor='pointer'; row.addEventListener('click', ()=>opts.onClick(d)); }
    container.appendChild(row);
  });
}

function paretoChart(container, data, total){
  container.innerHTML = '';
  if(!data.length){ container.innerHTML = '<div class="empty-state">Sin datos</div>'; return; }
  const W = container.clientWidth || 640, H = 300;
  const padL = 24, padR = 46, padT = 16, padB = 70;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const svg = svgEl('svg', {width:'100%', height:H, viewBox:`0 0 ${W} ${H}`});
  const max = Math.max(...data.map(d=>d.value));
  const barW = plotW / data.length * 0.62;
  const step = plotW / data.length;
  let cum = 0;
  const cumPts = [];

  // gridlines
  for(let i=0;i<=4;i++){
    const y = padT + plotH - (plotH*i/4);
    svg.appendChild(svgEl('line', {x1:padL, x2:padL+plotW, y1:y, y2:y, class:'axis-line'}));
    const t = svgEl('text', {x:2, y:y+4, 'font-size':9}); t.textContent = fmt(Math.round(max*i/4)); svg.appendChild(t);
  }

  data.forEach((d,i)=>{
    const x = padL + i*step + (step-barW)/2;
    const h = plotH * (d.value/max);
    const y = padT + plotH - h;
    const rect = svgEl('rect', {x, y, width:barW, height:h, fill:'url(#gradAmber)', rx:2});
    rect.addEventListener('mousemove', (e)=>showTip(`<b>${esc(d.label)}</b><br>${fmt(d.value)} fallas (${pct(d.value,total)})`, e));
    rect.addEventListener('mouseleave', hideTip);
    svg.appendChild(rect);

    cum += d.value;
    const cy = padT + plotH - plotH*(cum/total);
    cumPts.push([x+barW/2, cy]);

    const lbl = svgEl('text', {x:x+barW/2, y:padT+plotH+14, 'text-anchor':'end', 'font-size':9, transform:`rotate(-40 ${x+barW/2} ${padT+plotH+14})`});
    lbl.textContent = d.label.length>22 ? d.label.slice(0,20)+'…' : d.label;
    svg.appendChild(lbl);
  });

  // gradient defs
  const defs = svgEl('defs',{});
  const grad = svgEl('linearGradient',{id:'gradAmber', x1:0,y1:1,x2:0,y2:0});
  grad.appendChild(svgEl('stop',{offset:'0%','stop-color':'#7a5518'}));
  grad.appendChild(svgEl('stop',{offset:'100%','stop-color':'#ffb020'}));
  defs.appendChild(grad);
  svg.appendChild(defs);

  // cumulative line
  const path = svgEl('polyline', {points:cumPts.map(p=>p.join(',')).join(' '), fill:'none', stroke:'var(--cyan)', 'stroke-width':2});
  svg.appendChild(path);
  cumPts.forEach((p,i)=>{
    const c = svgEl('circle', {cx:p[0], cy:p[1], r:3, fill:'#4fd1c5'});
    c.addEventListener('mousemove', (e)=>showTip(`<b>Acumulado</b><br>${(100*(data.slice(0,i+1).reduce((s,x)=>s+x.value,0))/total).toFixed(1)}%`, e));
    c.addEventListener('mouseleave', hideTip);
    svg.appendChild(c);
  });
  // 80% reference line
  const y80 = padT + plotH - plotH*0.8;
  const refLine = svgEl('line', {x1:padL, x2:padL+plotW, y1:y80, y2:y80, stroke:'var(--red)', 'stroke-width':1, 'stroke-dasharray':'4 3', opacity:0.6});
  svg.appendChild(refLine);
  const refLbl = svgEl('text', {x:padL+plotW-2, y:y80-4, 'text-anchor':'end', 'font-size':9, fill:'var(--red)'});
  refLbl.textContent = '80%'; svg.appendChild(refLbl);

  container.appendChild(svg);
}

function trendChart(container, weeks, seriesByLine, colorMap){
  container.innerHTML = '';
  const W = container.clientWidth || 640, H = 280;
  const padL = 36, padR = 20, padT = 16, padB = 30;
  const plotW = W-padL-padR, plotH = H-padT-padB;
  const svg = svgEl('svg', {width:'100%', height:H, viewBox:`0 0 ${W} ${H}`});
  const allVals = Object.values(seriesByLine).flat();
  const max = Math.max(1, ...allVals);
  const stepX = plotW/(weeks.length-1||1);

  for(let i=0;i<=4;i++){
    const y = padT + plotH - plotH*i/4;
    svg.appendChild(svgEl('line', {x1:padL, x2:padL+plotW, y1:y, y2:y, class:'axis-line'}));
    const t = svgEl('text', {x:2, y:y+4, 'font-size':9}); t.textContent=fmt(Math.round(max*i/4)); svg.appendChild(t);
  }
  weeks.forEach((w,i)=>{
    const x = padL+i*stepX;
    const t = svgEl('text', {x, y:H-10, 'text-anchor':'middle', 'font-size':10}); t.textContent = 'S'+w; svg.appendChild(t);
  });

  Object.entries(seriesByLine).forEach(([line, vals])=>{
    const pts = vals.map((v,i)=>[padL+i*stepX, padT+plotH-plotH*(v/max)]);
    const poly = svgEl('polyline', {points:pts.map(p=>p.join(',')).join(' '), fill:'none', stroke:colorMap[line], 'stroke-width':2.5});
    svg.appendChild(poly);
    pts.forEach((p,i)=>{
      const c = svgEl('circle', {cx:p[0], cy:p[1], r:4, fill:colorMap[line], stroke:'#0d1117','stroke-width':1.5});
      c.addEventListener('mousemove', (e)=>showTip(`<b>${esc(line)}</b><br>Semana ${weeks[i]}: ${fmt(vals[i])} fallas`, e));
      c.addEventListener('mouseleave', hideTip);
      svg.appendChild(c);
    });
  });
  container.appendChild(svg);

  // legend
  const legend = document.createElement('div');
  legend.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font-family:var(--mono);font-size:10px;';
  Object.keys(seriesByLine).forEach(line=>{
    const item = document.createElement('div'); item.style.cssText='display:flex;align-items:center;gap:5px;color:var(--text-dim);';
    item.innerHTML = `<span style="width:9px;height:9px;border-radius:2px;background:${colorMap[line]};display:inline-block;"></span>${esc(line)}`;
    legend.appendChild(item);
  });
  container.appendChild(legend);
}

function donutChart(container, data, total){
  container.innerHTML = '';
  if(!data.length){ container.innerHTML = '<div class="empty-state">Sin datos</div>'; return; }
  const size = 190, cx=size/2, cy=size/2, r=70, rInner=42;
  const colors = ['#ffb020','#4fd1c5','#ff5470','#8b8ff8','#52d67a','#f59e0b','#5b6673'];
  const wrap = document.createElement('div'); wrap.style.cssText='display:flex; gap:18px; align-items:center; flex-wrap:wrap;';
  const svg = svgEl('svg', {width:size, height:size, viewBox:`0 0 ${size} ${size}`});
  let angle = -Math.PI/2;
  data.forEach((d,i)=>{
    const frac = d.value/total;
    const a0 = angle, a1 = angle + frac*2*Math.PI;
    const x0 = cx+r*Math.cos(a0), y0 = cy+r*Math.sin(a0);
    const x1 = cx+r*Math.cos(a1), y1 = cy+r*Math.sin(a1);
    const xi0 = cx+rInner*Math.cos(a1), yi0 = cy+rInner*Math.sin(a1);
    const xi1 = cx+rInner*Math.cos(a0), yi1 = cy+rInner*Math.sin(a0);
    const large = (a1-a0) > Math.PI ? 1 : 0;
    const path = `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${xi0} ${yi0} A ${rInner} ${rInner} 0 ${large} 0 ${xi1} ${yi1} Z`;
    const p = svgEl('path', {d:path, fill:colors[i%colors.length], stroke:'#141a22', 'stroke-width':1.5});
    p.addEventListener('mousemove', (e)=>showTip(`<b>${esc(d.label)}</b><br>${fmt(d.value)} (${pct(d.value,total)})`, e));
    p.addEventListener('mouseleave', hideTip);
    svg.appendChild(p);
    angle = a1;
  });
  const centerText = svgEl('text', {x:cx, y:cy-2, 'text-anchor':'middle', 'font-size':18, fill:'var(--text)', 'font-weight':600});
  centerText.textContent = fmt(total);
  const centerLabel = svgEl('text', {x:cx, y:cy+14, 'text-anchor':'middle', 'font-size':9, fill:'var(--text-faint)'});
  centerLabel.textContent = 'TOTAL';
  svg.appendChild(centerText); svg.appendChild(centerLabel);
  wrap.appendChild(svg);

  const legend = document.createElement('div');
  legend.style.cssText='display:flex;flex-direction:column;gap:6px;font-family:var(--mono);font-size:11px;flex:1;min-width:180px;';
  data.forEach((d,i)=>{
    const item = document.createElement('div'); item.style.cssText='display:flex;align-items:center;gap:7px;color:var(--text-dim);';
    item.innerHTML = `<span style="width:9px;height:9px;border-radius:2px;background:${colors[i%colors.length]};display:inline-block;flex-shrink:0;"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(d.label)}</span><b style="color:var(--text)">${fmt(d.value)}</b>`;
    legend.appendChild(item);
  });
  wrap.appendChild(legend);
  container.appendChild(wrap);
}

function groupedBarChart(container, groups, series, colorMap){
  // groups: [labels], series: {seriesName: [values matching groups]}
  container.innerHTML = '';
  const W = container.clientWidth || 900, H = 260;
  const padL = 40, padR = 20, padT = 16, padB = 60;
  const plotW = W-padL-padR, plotH = H-padT-padB;
  const svg = svgEl('svg', {width:'100%', height:H, viewBox:`0 0 ${W} ${H}`});
  const seriesNames = Object.keys(series);
  const allVals = Object.values(series).flat();
  const max = Math.max(1, ...allVals);
  const groupW = plotW/groups.length;
  const barW = (groupW*0.75)/seriesNames.length;

  for(let i=0;i<=4;i++){
    const y = padT+plotH-plotH*i/4;
    svg.appendChild(svgEl('line', {x1:padL, x2:padL+plotW, y1:y, y2:y, class:'axis-line'}));
    const t = svgEl('text', {x:2, y:y+4, 'font-size':9}); t.textContent = fmt(Math.round(max*i/4)); svg.appendChild(t);
  }

  groups.forEach((g, gi)=>{
    const gx = padL + gi*groupW + groupW*0.125;
    seriesNames.forEach((sn, si)=>{
      const v = series[sn][gi];
      const h = plotH*(v/max);
      const x = gx + si*barW;
      const y = padT+plotH-h;
      const rect = svgEl('rect', {x, y, width:barW*0.85, height:h, fill:colorMap[sn], rx:2});
      rect.addEventListener('mousemove', (e)=>showTip(`<b>${esc(g)}</b><br>${esc(sn)}: ${fmt(v)}`, e));
      rect.addEventListener('mouseleave', hideTip);
      svg.appendChild(rect);
    });
    const lbl = svgEl('text', {x:gx+ (barW*seriesNames.length)/2, y:padT+plotH+14, 'text-anchor':'end', 'font-size':9, transform:`rotate(-35 ${gx+(barW*seriesNames.length)/2} ${padT+plotH+14})`});
    lbl.textContent = g.length>26? g.slice(0,24)+'…':g;
    svg.appendChild(lbl);
  });
  container.appendChild(svg);

  const legend = document.createElement('div');
  legend.style.cssText='display:flex;gap:14px;flex-wrap:wrap;font-family:var(--mono);font-size:10px;margin-top:4px;';
  seriesNames.forEach(sn=>{
    const item = document.createElement('div'); item.style.cssText='display:flex;align-items:center;gap:5px;color:var(--text-dim);';
    item.innerHTML = `<span style="width:9px;height:9px;border-radius:2px;background:${colorMap[sn]};display:inline-block;"></span>${esc(sn)}`;
    legend.appendChild(item);
  });
  container.appendChild(legend);
}

/* ============================================================
   RACK WALL (signature element)
============================================================ */
// ALL_RACKS y ALL_SLOTS se calculan en initUI() una vez que DATA está disponible.

function renderRackWall(data){
  const wall = document.getElementById('rackwall');
  wall.innerHTML = '';
  // build count map rack->slot->count
  const cellCount = {};
  let maxCell = 0;
  data.forEach(d=>{
    if(d.rack==='NA') return;
    const key = d.rack+'|'+d.slot;
    cellCount[key] = (cellCount[key]||0)+1;
    if(cellCount[key] > maxCell) maxCell = cellCount[key];
  });
  const rackTotals = {};
  data.forEach(d=>{ if(d.rack!=='NA') rackTotals[d.rack] = (rackTotals[d.rack]||0)+1; });

  document.getElementById('rackwall-badge').textContent = Object.keys(rackTotals).length + ' racks con actividad';

  ALL_RACKS.forEach(rack=>{
    const col = document.createElement('div'); col.className='rack-col';
    if(state.selectedRack===rack) col.classList.add('selected');
    const label = document.createElement('div'); label.className='rack-label';
    label.textContent = rack.replace('ghostfish-ist-flg-','R');
    label.title = rack + ' — ' + fmt(rackTotals[rack]||0) + ' fallas';
    label.style.cursor='pointer';
    label.onclick = ()=>{ state.selectedRack = state.selectedRack===rack? null : rack; renderAll(); };
    col.appendChild(label);
    ALL_SLOTS.forEach(slot=>{
      const key = rack+'|'+slot;
      const c = cellCount[key]||0;
      const cell = document.createElement('div'); cell.className='slot-cell';
      const t = maxCell? c/maxCell : 0;
      cell.style.background = c===0 ? 'var(--border-soft)' : colorScale(t);
      cell.addEventListener('mousemove',(e)=>showTip(`<b>${esc(rack)}</b> · slot ${slot}<br>${fmt(c)} fallas`, e));
      cell.addEventListener('mouseleave', hideTip);
      cell.onclick = ()=>{ state.selectedRack = state.selectedRack===rack? null : rack; renderAll(); };
      col.appendChild(cell);
    });
    wall.appendChild(col);
  });
}
function colorScale(t){
  // 0 -> amber-dim, 1 -> red
  const c1 = [122,85,24], c2=[255,84,112];
  const r = Math.round(c1[0]+(c2[0]-c1[0])*t);
  const g = Math.round(c1[1]+(c2[1]-c1[1])*t);
  const b = Math.round(c1[2]+(c2[2]-c1[2])*t);
  return `rgb(${r},${g},${b})`;
}

/* ============================================================
   KPI STRIP
============================================================ */
function renderKPIs(data){
  const total = data.length;
  const ndf = data.filter(d=>d.location==='NDF').length;
  const bySerial = countBy(data,'serial');
  const repeatOffenders = [...bySerial.values()].filter(v=>v>=3).length;
  const topFail = topN(countBy(data,'failDesc'),1)[0];
  const testerInstr = data.filter(d=>d.defectCode==='Tester Instruments').length;

  // week over week delta (based on full weeks present in filtered set)
  const byWeek = countBy(data,'week');
  const weeksSorted = [...byWeek.keys()].sort((a,b)=>a-b);
  let deltaTxt = '—', deltaClass='';
  if(weeksSorted.length>=2){
    const last = byWeek.get(weeksSorted[weeksSorted.length-1]);
    const prev = byWeek.get(weeksSorted[weeksSorted.length-2]);
    const d = last-prev;
    deltaClass = d>0 ? 'up' : 'down';
    deltaTxt = (d>0?'+':'')+d+' vs semana anterior';
  }

  const kpis = [
    {label:'Total de fallas', value:fmt(total), sub: (data.length!==TOTAL_N? pct(total,TOTAL_N)+' del dataset':'100% del dataset'), color:'var(--amber)'},
    {label:'NDF (no defecto encontrado)', value:fmt(ndf), sub: pct(ndf,total)+' del total filtrado', color:'var(--cyan)'},
    {label:'Reincidentes (≥3 fallas)', value:fmt(repeatOffenders), sub: pct(repeatOffenders,bySerial.size)+' de '+fmt(bySerial.size)+' seriales', color:'var(--red)'},
    {label:'Modo de falla top', value: topFail? fmt(topFail[1]) : '0', sub: topFail? topFail[0] : 'N/A', color:'var(--violet)'},
    {label:'Defecto = Tester Instruments', value:fmt(testerInstr), sub: pct(testerInstr,total)+' — posible fixture', color:'var(--amber)'},
    {label:'Δ semanal (últ. período)', value: deltaTxt.split(' ')[0], sub: deltaClass? 'vs semana anterior':'datos insuficientes', color: deltaClass==='up'?'var(--red)':'var(--green)'}
  ];
  const strip = document.getElementById('kpi-strip');
  strip.innerHTML='';
  kpis.forEach(k=>{
    const el = document.createElement('div'); el.className='kpi'; el.style.setProperty('--accent-color', k.color);
    el.innerHTML = `<div class="label">${esc(k.label)}</div><div class="value">${k.value}</div><div class="sub ${deltaClass && k.label.startsWith('Δ')?deltaClass:''}">${esc(k.sub)}</div>`;
    strip.appendChild(el);
  });
}

/* ============================================================
   TABLES
============================================================ */
function renderRepeatTable(data){
  const bySerial = new Map();
  data.forEach(d=>{
    if(!bySerial.has(d.serial)) bySerial.set(d.serial, []);
    bySerial.get(d.serial).push(d);
  });
  let rows = [...bySerial.entries()].map(([serial, recs])=>{
    recs.sort((a,b)=>a.testTime.localeCompare(b.testTime));
    const last = recs[recs.length-1];
    return {serial, n:recs.length, po:last.po, rev:last.revision, last:last.failDesc};
  }).filter(r=>r.n>=2).sort((a,b)=>b.n-a.n).slice(0,60);

  document.getElementById('repeat-badge').textContent = rows.length+' unidades con ≥2 fallas (mostrando top 60)';
  const tbody = document.querySelector('#table-repeat tbody');
  tbody.innerHTML='';
  if(!rows.length){ tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Sin coincidencias</td></tr>'; return; }
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    const pillClass = r.n>=6?'red':(r.n>=3?'amber':'gray');
    tr.innerHTML = `<td>${esc(r.serial)}</td><td><span class="pill ${pillClass}">${r.n}</span></td><td>${esc(r.po)}</td><td>${esc(r.rev)}</td><td title="${esc(r.last)}">${esc(r.last.length>28?r.last.slice(0,26)+'…':r.last)}</td>`;
    tbody.appendChild(tr);
  });
}

function renderPOTable(data){
  const byPO = new Map();
  data.forEach(d=>{
    if(d.po==='NA') return;
    if(!byPO.has(d.po)) byPO.set(d.po, []);
    byPO.get(d.po).push(d);
  });
  let rows = [...byPO.entries()].map(([po,recs])=>{
    const fd = countBy(recs,'failDesc');
    const top = topN(fd,1)[0];
    return {po, n:recs.length, top: top? top[0]:'N/A', topN: top? top[1]:0};
  }).sort((a,b)=>b.n-a.n).slice(0,10);

  const tbody = document.querySelector('#table-po tbody');
  tbody.innerHTML='';
  if(!rows.length){ tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Sin datos</td></tr>'; return; }
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(r.po)}</td><td>${fmt(r.n)}</td><td title="${esc(r.top)}">${esc(r.top.length>30?r.top.slice(0,28)+'…':r.top)}</td><td>${pct(r.topN,r.n)}</td>`;
    tbody.appendChild(tr);
  });
}

// sortable tables
document.querySelectorAll('table.data-table thead th').forEach(th=>{
  th.addEventListener('click', ()=>{
    const table = th.closest('table');
    const key = th.dataset.k;
    const tbody = table.querySelector('tbody');
    const rows = [...tbody.querySelectorAll('tr')];
    const colIndex = [...th.parentNode.children].indexOf(th);
    const asc = th.dataset.asc !== 'true';
    th.dataset.asc = asc;
    rows.sort((a,b)=>{
      const av = a.children[colIndex]?.textContent.trim()||'';
      const bv = b.children[colIndex]?.textContent.trim()||'';
      const an = parseFloat(av.replace(/[^0-9.\-]/g,''));
      const bn = parseFloat(bv.replace(/[^0-9.\-]/g,''));
      let cmp;
      if(!isNaN(an) && !isNaN(bn) && /^[0-9.,%\s-]+$/.test(av)) cmp = an-bn;
      else cmp = av.localeCompare(bv);
      return asc? cmp : -cmp;
    });
    rows.forEach(r=>tbody.appendChild(r));
  });
});

/* ============================================================
   MASTER RENDER
============================================================ */
const LINE_COLORS = {
  'PHI-TLA-GF-LINE':'#ffb020',
  'PHI-REPAIR-TLA-GF-LINE':'#4fd1c5',
  'PHI-UNBIND-REBIND-LINE':'#8b8ff8',
  'PHI-SPECIAL-LINE':'#ff5470'
};
const TURNO_COLORS = {'T1':'#ffb020','T2':'#4fd1c5','T3':'#8b8ff8'};
const GEN_COLORS = {'First':'#ffb020','Second':'#4fd1c5','Third':'#8b8ff8'};

function renderAll(){
  const data = filteredData();
  document.getElementById('row-count').textContent = fmt(data.length);
  document.getElementById('footer-filtered').textContent = `Mostrando ${fmt(data.length)} de ${fmt(TOTAL_N)} registros`;
  updateActiveFiltersLine();

  renderKPIs(data);
  renderRackWall(data);

  // Trend chart: weeks x line
  const weeks = uniqueVals('week');
  const lines = [...new Set(data.map(d=>d.line))].filter(l=>LINE_COLORS[l]);
  const seriesByLine = {};
  lines.forEach(line=>{
    seriesByLine[line] = weeks.map(w=> data.filter(d=>d.week===w && d.line===line).length);
  });
  trendChart(document.getElementById('chart-trend'), weeks, seriesByLine, LINE_COLORS);

  // Turno donut
  const turnoCounts = topN(countBy(data,'turno'), 10).map(([k,v])=>({label:k, value:v}));
  donutChart(document.getElementById('chart-turno'), turnoCounts, data.length);

  // Pareto
  const failDescCounts = topN(countBy(data,'failDesc'), 15).map(([k,v])=>({label:k, value:v}));
  document.getElementById('pareto-badge').textContent = countBy(data,'failDesc').size + ' modos distintos';
  paretoChart(document.getElementById('chart-pareto'), failDescCounts, data.length);

  // Defect code
  const defectCounts = topN(countBy(data.filter(d=>d.defectCode!=='NA'),'defectCode'), 10).map(([k,v])=>({label:k, value:v}));
  barChartHoriz(document.getElementById('chart-defect'), defectCounts, {total:data.length, onClick:(d)=>{ document.getElementById('sel-defect').value=d.label; state.defectCode=d.label; renderAll(); }});

  // Location
  const locCounts = topN(countBy(data.filter(d=>d.location!=='NDF' && d.location!=='NA'),'location'), 12).map(([k,v])=>({label:k, value:v}));
  barChartHoriz(document.getElementById('chart-location'), locCounts, {total:data.length});

  // Rework
  const reworkCounts = topN(countBy(data.filter(d=>d.rework!=='NA'),'rework'), 10).map(([k,v])=>({label:k.replace('RWK ',''), value:v}));
  donutChart(document.getElementById('chart-rework'), reworkCounts, reworkCounts.reduce((s,d)=>s+d.value,0));

  // Gen vs top6 fail modes
  const top6 = topN(countBy(data,'failDesc'),6).map(x=>x[0]);
  const gens = ['First','Second','Third'].filter(g=>data.some(d=>d.gen===g));
  const genSeries = {};
  gens.forEach(g=>{
    genSeries[g] = top6.map(fd=> data.filter(d=>d.gen===g && d.failDesc===fd).length);
  });
  groupedBarChart(document.getElementById('chart-gen'), top6, genSeries, GEN_COLORS);

  renderRepeatTable(data);
  renderPOTable(data);
}

/* ============================================================
   INIT — se ejecuta una vez que los datos ya están cargados
============================================================ */
function initUI(){
  ALL_RACKS = uniqueVals('rack').filter(r=>r!=='NA').sort();
  ALL_SLOTS = [...new Set(DATA.map(d=>d.slot))].sort((a,b)=>a-b);

  buildChipGroup('chip-week', uniqueVals('week'), state.weeks, ()=>renderAll());
  buildChipGroup('chip-turno', uniqueVals('turno'), state.turnos, ()=>renderAll());

  buildSelect('sel-line', uniqueVals('line'), v=>state.line=v);
  buildSelect('sel-po', uniqueVals('po').filter(v=>v!=='NA'), v=>state.po=v);
  buildSelect('sel-rev', uniqueVals('revision'), v=>state.revision=v);
  buildSelect('sel-defect', uniqueVals('defectCode').filter(v=>v!=='NA'), v=>state.defectCode=v);

  document.getElementById('search-serial').addEventListener('input', (e)=>{
    state.serial = e.target.value.trim();
    renderAll();
  });
  document.getElementById('btn-reset').addEventListener('click', ()=>{
    state.weeks.clear(); state.turnos.clear();
    state.line=''; state.po=''; state.revision=''; state.defectCode=''; state.serial=''; state.selectedRack=null;
    document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
    document.getElementById('sel-line').value='';
    document.getElementById('sel-po').value='';
    document.getElementById('sel-rev').value='';
    document.getElementById('sel-defect').value='';
    document.getElementById('search-serial').value='';
    renderAll();
  });

  document.getElementById('row-count').textContent = fmt(TOTAL_N);
  renderAll();
  window.addEventListener('resize', ()=>{ clearTimeout(window._rz); window._rz = setTimeout(renderAll, 200); });
}

function showLoadError(err){
  const main = document.querySelector('main');
  main.innerHTML = `<div class="panel" style="border-color:var(--red);">
      <div class="panel-head"><h2 style="color:var(--red)">⚠ No se pudieron cargar los datos</h2></div>
      <div style="color:var(--text-dim); font-family:var(--mono); font-size:12px; line-height:1.6;">
        No se encontró o no se pudo leer <b style="color:var(--amber)">data/datos.json</b>.<br><br>
        Si abriste este archivo con doble clic (file://) desde tu computadora, los navegadores
        bloquean la lectura de archivos JSON locales por seguridad.<br><br>
        Soluciones:<br>
        1) Publícalo en GitHub Pages (recomendado, ver README.md).<br>
        2) O corre un servidor local, por ejemplo: <b style="color:var(--cyan)">python3 -m http.server</b>
        dentro de la carpeta del proyecto y abre <b style="color:var(--cyan)">http://localhost:8000</b>.<br><br>
        Detalle técnico: ${esc(err.message)}
      </div>
    </div>`;
}

loadData().then(initUI).catch(showLoadError);
