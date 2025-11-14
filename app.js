/*
DB Browser Web — Offline (uses local sql-wasm.js and sql-wasm.wasm)
Place sql-wasm.js and sql-wasm.wasm in the same folder before using.
*/

let SQL = null;
let db = null;
let currentFileName = null;
let currentTable = null;
let currentPage = 1;

async function initSql(){
  if(!window.initSqlJs) throw new Error('sql-wasm loader not found. Place sql-wasm.js and sql-wasm.wasm in this folder.');
  SQL = await window.initSqlJs({ locateFile: f => 'sql-wasm.wasm' });
  console.log('sql-wasm initialized');
}

function setStatus(s){ document.getElementById('status').textContent = s; }

async function openFile(ev){
  const f = ev.target.files[0];
  if(!f) return;
  const buf = await f.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buf));
  currentFileName = f.name;
  setStatus('Aberto: ' + currentFileName);
  await refreshTables();
}

async function newDb(){
  db = new SQL.Database();
  currentFileName = 'new.sqlite';
  setStatus('Novo DB');
  await refreshTables();
}

function exportDb(){
  if(!db) return alert('Abra um DB primeiro');
  const data = db.export();
  const blob = new Blob([data], {type:'application/octet-stream'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = currentFileName || 'export.sqlite';
  a.click();
  setTimeout(()=> URL.revokeObjectURL(a.href),1000);
}

async function refreshTables(){
  if(!db) return;
  const res = db.exec("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name;");
  const list = document.getElementById('tablesList');
  list.innerHTML = '';
  if(!res.length){ list.innerHTML = '<div class="small-muted">Sem tabelas</div>'; return; }
  const rows = res[0].values;
  rows.forEach(r=>{
    const name = r[0];
    const el = document.createElement('div');
    el.className = 'd-flex justify-content-between align-items-center mb-1';
    const a = document.createElement('a'); a.href='#'; a.textContent = name; a.onclick = (e)=>{ e.preventDefault(); openTable(name); };
    const grp = document.createElement('div');
    grp.innerHTML = `<button class="btn btn-sm btn-outline-primary btn-small me-1" onclick="openTable('${name}')">Ver</button><button class="btn btn-sm btn-outline-danger btn-small" onclick="backupAndDrop('${name}')">Drop</button>`;
    el.appendChild(a); el.appendChild(grp);
    list.appendChild(el);
  });
}

function backupAndDrop(name){
  if(!db) return;
  if(!confirm('Criar backup e remover tabela '+name+'?')) return;
  // download backup
  const blob = new Blob([db.export()], {type:'application/octet-stream'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (currentFileName||'db') + '.backup.' + new Date().toISOString().replace(/[:.]/g,'-') + '.sqlite';
  a.click();
  setTimeout(()=> URL.revokeObjectURL(a.href),1000);
  // drop
  try{ db.run(`DROP TABLE IF EXISTS "${name}"`); alert('Tabela removida'); refreshTables(); document.getElementById('tableView').style.display='none'; }
  catch(e){ alert('Erro: '+e.message); }
}

function runSql(){
  const sql = document.getElementById('sqlArea').value;
  if(!db) return alert('Abra um DB primeiro');
  try{
    const t0 = performance.now();
    const res = db.exec(sql);
    const t1 = performance.now();
    document.getElementById('queryInfo').textContent = `Executado em ${(t1-t0).toFixed(2)} ms — ${res.length} result set(s)`;
    renderSqlResult(res);
  }catch(e){ document.getElementById('sqlResult').innerHTML = `<div class="alert alert-danger">Erro: ${e.message}</div>`; }
}

function renderSqlResult(res){
  const container = document.getElementById('sqlResult');
  if(!res || !res.length){ container.innerHTML = '<div class="small-muted">Nenhum resultado</div>'; return; }
  let html = '';
  res.forEach((r, idx)=>{
    html += `<div class="mb-3"><strong>Result ${idx+1}</strong>`;
    html += '<div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr>';
    r.columns.forEach(c=> html += `<th>${c}</th>`);
    html += '</tr></thead><tbody>';
    r.values.forEach(row=>{ html += '<tr>'; row.forEach(v=> html += `<td>${escapeHtml(v)}</td>`); html += '</tr>'; });
    html += '</tbody></table></div></div>';
  });
  container.innerHTML = html;
}

function escapeHtml(v){ if(v===null||v===undefined) return ''; return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

async function openTable(name, page=1){
  if(!db) return;
  currentTable = name;
  currentPage = page;
  document.getElementById('tableView').style.display = 'block';
  document.getElementById('tableTitle').textContent = name;
  const filter = document.getElementById('filterInput').value.trim();
  const pageSize = Number(document.getElementById('pageSize').value);
  const offset = (page-1)*pageSize;
  const where = filter ? (' WHERE ' + filter) : '';
  const countRes = db.exec(`SELECT COUNT(*) as c FROM "${name}"${where}`);
  const total = countRes.length ? countRes[0].values[0][0] : 0;
  document.getElementById('tableCount').textContent = 'Linhas: ' + total;
  const rowsRes = db.exec(`SELECT * FROM "${name}"${where} LIMIT ${pageSize} OFFSET ${offset}`);
  const cols = rowsRes.length ? rowsRes[0].columns : [];
  const rows = rowsRes.length ? rowsRes[0].values : [];
  renderTable(cols, rows, total, page, pageSize);
}

function renderTable(cols, rows, total, page, pageSize){
  const area = document.getElementById('tableDataArea');
  let html = '<div class="table-responsive"><table class="table table-sm table-striped"><thead><tr>';
  cols.forEach(c=> html += `<th>${c}</th>`);
  html += '<th>Ações</th></tr></thead><tbody>';
  rows.forEach((r, idx)=>{ html += '<tr>'; r.forEach(cell=> html += `<td>${escapeHtml(cell)}</td>`); html += `<td><button class="btn btn-sm btn-outline-secondary btn-small me-1" onclick="editRow(${idx})">Editar</button><button class="btn btn-sm btn-danger btn-small" onclick="deleteRow(${idx})">Excluir</button></td></tr>`; });
  html += '</tbody></table></div>';
  area.innerHTML = html;
  // pagination
  const totalPages = Math.max(1, Math.ceil(total/pageSize));
  document.getElementById('paginationArea').innerHTML = `Página ${page} de ${totalPages}`;
  // store current page
  window._page = {cols, rows, page, pageSize, table: currentTable};
}

function exportTableCsv(){
  if(!currentTable) return alert('Selecione uma tabela');
  const res = db.exec(`SELECT * FROM "${currentTable}"`);
  if(!res.length) return alert('Tabela vazia');
  const cols = res[0].columns; const rows = res[0].values;
  let csv = cols.join(',') + '\n'; rows.forEach(r=>{ csv += r.map(v=> { if(v===null||v===undefined) return ''; const s = String(v); if(s.includes(',')||s.includes('\n')||s.includes('"')) return '"'+s.replace(/"/g,'""')+'"'; return s; }).join(',') + '\n'; });
  const blob = new Blob([csv], {type:'text/csv'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (currentTable||'table') + '.csv'; a.click(); setTimeout(()=> URL.revokeObjectURL(a.href),1000);
}

async function importCsv(file){
  if(!currentTable) return alert('Selecione uma tabela');
  const txt = await file.text();
  const rows = parseCSV(txt);
  if(rows.length<1) return alert('CSV vazio');
  const header = rows[0];
  // naive insert assume header matches table columns
  db.run('BEGIN TRANSACTION');
  try{
    for(let i=1;i<rows.length;i++){
      const vals = rows[i].map(v=> v===''? null : v);
      const quoted = vals.map(v=> v===null? 'NULL' : "'"+String(v).replace(/'/g,"''")+"'").join(',');
      const sql = `INSERT INTO "${currentTable}" (${header.map(h=>'"'+h+'"').join(',')}) VALUES (${quoted})`;
      db.run(sql);
    }
    db.run('COMMIT');
    alert('Importado: ' + (rows.length-1) + ' linhas');
    openTable(currentTable, currentPage);
    refreshTables();
  }catch(e){ db.run('ROLLBACK'); alert('Erro: '+e.message); }
}

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim()!==''); function parseLine(line){ const cols=[]; let cur=''; let inQ=false; for(let i=0;i<line.length;i++){ const ch=line[i]; const nxt=line[i+1]; if(ch==='"'){ if(inQ && nxt==='"'){ cur+='"'; i++; continue } inQ=!inQ; continue; } if(ch===',' && !inQ){ cols.push(cur); cur=''; continue } cur+=ch } cols.push(cur); return cols } return lines.map(parseLine);
}

function editRow(idx){
  const p = window._page; if(!p) return;
  const cols = p.cols; const row = p.rows[idx];
  let html = '<form id="fedit">';
  cols.forEach((c,i)=> html += `<div class="mb-2"><label class="form-label">${c}</label><input class="form-control form-control-sm" name="c${i}" value="${escapeHtml(row[i])}" /></div>`);
  html += '</form>';
  const modal = document.createElement('div'); modal.innerHTML = `<div style="position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:9999"><div style="background:white;padding:16px;border-radius:8px;min-width:420px">${html}<div style="text-align:right;margin-top:8px"><button id="saveedit" class="btn btn-primary btn-sm btn-small">Salvar</button><button id="canceledit" class="btn btn-outline-secondary btn-sm btn-small">Cancelar</button></div></div></div>`; document.body.appendChild(modal);
  modal.querySelector('#canceledit').onclick = ()=> modal.remove();
  modal.querySelector('#saveedit').onclick = ()=>{ const vals = Array.from(document.getElementById('fedit').elements).map(e=> e.value); const schema = db.exec(`PRAGMA table_info("${currentTable}")`); const pk = schema.length && schema[0].values ? schema[0].values.filter(r=>r[5]===1).map(r=>r[1]) : []; let where=''; if(pk.length>0){ where = pk.map(k=> `"${k}"='${String(row[cols.indexOf(k)]).replace(/'/g,"''")}'`).join(' AND ') } else { where = `"${cols[0]}"='${String(row[0]).replace(/'/g,"''")}'` } const set = cols.map((c,i)=> `"${c}"='${String(vals[i]).replace(/'/g,"''")}'`).join(','); try{ db.run(`UPDATE "${currentTable}" SET ${set} WHERE ${where}`); alert('Atualizado'); modal.remove(); openTable(currentTable, p.page); }catch(e){ alert('Erro: '+e.message); } };
}

function deleteRow(idx){
  const p = window._page; if(!p) return;
  const row = p.rows[idx]; const cols = p.cols;
  if(!confirm('Confirma excluir?')) return;
  const schema = db.exec(`PRAGMA table_info("${currentTable}")`); const pk = schema.length && schema[0].values ? schema[0].values.filter(r=>r[5]===1).map(r=>r[1]) : []; let where=''; if(pk.length>0){ where = pk.map(k=> `"${k}"='${String(row[cols.indexOf(k)]).replace(/'/g,"''")}'`).join(' AND ') } else { where = `"${cols[0]}"='${String(row[0]).replace(/'/g,"''")}'` } try{ db.run(`DELETE FROM "${currentTable}" WHERE ${where}`); alert('Removido'); openTable(currentTable, p.page); refreshTables(); }catch(e){ alert('Erro: '+e.message); }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  try{ await initSql(); }catch(e){ alert('Erro ao inicializar sql-wasm: ' + e.message); return; }
  document.getElementById('btnOpen').onclick = ()=> document.getElementById('fileInput').click();
  document.getElementById('fileInput').onchange = openFile;
  document.getElementById('btnNew').onclick = newDb;
  document.getElementById('btnExportDb').onclick = exportDb;
  document.getElementById('btnRefresh').onclick = refreshTables;
  document.getElementById('btnRun').onclick = runSql;
  document.getElementById('btnClear').onclick = ()=>{ document.getElementById('sqlArea').value=''; document.getElementById('sqlResult').innerHTML=''; }
  document.getElementById('btnCreateTable').onclick = ()=>{ const n=document.getElementById('newTableName').value.trim(); const c=document.getElementById('newTableCols').value.trim(); if(!n||!c) return alert('nome/cols'); try{ db.run(`CREATE TABLE "${n}" (${c})`); alert('Criada'); refreshTables(); }catch(e){ alert('Erro: '+e.message); } }
  document.getElementById('btnExportTable').onclick = exportTableCsv;
  document.getElementById('btnImportTableCSV').onclick = ()=> document.getElementById('csvInput').click();
  document.getElementById('csvInput').onchange = e=> importCsv(e.target.files[0]);
  document.getElementById('pageSize').onchange = ()=> openTable(currentTable,1);
  document.getElementById('filterInput').onkeydown = (e)=>{ if(e.key==='Enter') openTable(currentTable,1); }
  document.getElementById('btnPrev').onclick = ()=> { if(currentPage>1) openTable(currentTable, currentPage-1); }
  document.getElementById('btnNext').onclick = ()=> { currentPage++; openTable(currentTable, currentPage); }
});
