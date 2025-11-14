/* app.js - BRC_db (atualizado)
 - Regras:
   * seção Bancos: digitar nome e criar banco
   * remoção da UI de criação de tabela (tudo via Console SQL)
   * import .sql carrega no Console (não executa)
   * executar no Console aplica tudo ao banco selecionado
   * log detalhado e lista de tabelas atualizada
*/

let SQL = null;
let databases = {}; // name -> SQL.Database
let selectedDb = null;
let selectedTable = null;

function log(msg){
  const el = document.getElementById('logArea');
  const time = new Date().toLocaleString();
  el.innerText = `[${time}] ${msg}\n` + el.innerText;
  document.getElementById('consoleStatus').innerText = msg;
}

// init sql.js (local wasm file expected)
async function initSql(){
  if(!window.initSqlJs) throw new Error('sql-wasm loader não encontrado. Coloque sql-wasm.js + sql-wasm.wasm na pasta.');
  SQL = await window.initSqlJs({ locateFile: f => 'sql-wasm.wasm' });
  log('sql-wasm inicializado');
  refreshBanksList();
}

// ---- Banks management ----
function createBankFromInput(){
  const name = document.getElementById('newBankName').value.trim();
  if(!name) return alert('Digite um nome para o banco.');
  if(databases[name]) return alert('Banco já existe: ' + name);
  databases[name] = new SQL.Database();
  log('Banco criado: ' + name);
  document.getElementById('newBankName').value = '';
  refreshBanksList();
  selectDb(name);
}

function refreshBanksList(){
  const container = document.getElementById('banksList');
  container.innerHTML = '';
  const selTables = document.getElementById('tablesList');
  selTables.innerHTML = '';
  if(Object.keys(databases).length === 0){
    container.innerHTML = '<div class="small muted">Nenhum banco</div>';
    return;
  }
  Object.keys(databases).forEach(name => {
    const div = document.createElement('div');
    div.className = 'bank';
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.alignItems = 'center';
    div.style.padding = '6px 4px';
    const left = document.createElement('div');
    left.innerHTML = `<strong style="color:#1e40af">${name}</strong><div class="small muted">${getTablesSummary(name)}</div>`;
    const right = document.createElement('div');
    right.innerHTML = `<button class="btn outline" onclick="selectDb('${name}')">Selecionar</button> <button class="btn" onclick="exportDb('${name}')">Export</button>`;
    div.appendChild(left); div.appendChild(right);
    container.appendChild(div);
  });
}

function getTablesSummary(dbName){
  try{
    const db = databases[dbName];
    const r = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    if(!r.length) return '0 tabelas';
    return r[0].values.map(v=>v[0]).join(', ');
  }catch(e){
    return 'erro';
  }
}

function selectDb(name){
  if(!databases[name]) return alert('Banco não encontrado');
  selectedDb = name;
  selectedTable = null;
  document.getElementById('status').innerText = 'Banco selecionado: ' + name;
  log('Banco selecionado: ' + name);
  refreshTablesPanel();
}

// export DB
function exportDb(name){
  try{
    const data = databases[name].export();
    const blob = new Blob([data], {type:'application/octet-stream'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + '.sqlite';
    a.click();
    setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
    log('Exportado banco: ' + name);
  }catch(e){ alert('Erro export: ' + e.message); log('Erro export: ' + e.message); }
}

// refresh tables panel (and logTables)
function refreshTablesPanel(){
  if(!selectedDb) return;
  const db = databases[selectedDb];
  try{
    const r = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const list = r.length ? r[0].values.map(v=>v[0]) : [];
    const tablesEl = document.getElementById('tablesList');
    tablesEl.innerHTML = '';
    if(list.length === 0) tablesEl.innerHTML = '<div class="small muted">Sem tabelas</div>';
    else {
      list.forEach(t => {
        const d = document.createElement('div');
        d.className = 'bank';
        d.innerHTML = `<div>${t}</div><div><button class="btn outline" onclick="openTable('${selectedDb}','${t}')">Ver</button></div>`;
        tablesEl.appendChild(d);
      });
    }

    // update logTables (under log)
    const lt = document.getElementById('logTables');
    lt.innerHTML = list.length ? list.map(x=>`<div>${x}</div>`).join('') : '<div class="small muted">Nenhuma tabela</div>';
  }catch(e){
    log('Erro listar tabelas: ' + e.message);
  }
}

// open table data
function openTable(dbName, tableName){
  selectedDb = dbName;
  selectedTable = tableName;
  document.getElementById('tableArea').style.display = 'block';
  document.getElementById('tableTitle').innerText = `${tableName} (${dbName})`;
  try{
    const rowsRes = databases[dbName].exec(`SELECT * FROM "${tableName}" LIMIT 1000`);
    if(!rowsRes.length){
      document.getElementById('tableData').innerHTML = '<div class="small muted">Tabela vazia</div>';
      document.getElementById('tableInfo').innerText = 'Linhas: 0';
      return;
    }
    const cols = rowsRes[0].columns;
    const rows = rowsRes[0].values;
    document.getElementById('tableInfo').innerText = `Linhas: ${rows.length}`;
    let html = '<table><thead><tr>';
    cols.forEach(c => html += `<th>${c}</th>`);
    html += '</tr></thead><tbody>';
    rows.forEach(r => {
      html += '<tr>';
      r.forEach(cell => html += `<td>${escapeHtml(cell)}</td>`);
      html += '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('tableData').innerHTML = html;
    log(`Exibindo ${rows.length} linhas de ${tableName}`);
  }catch(e){
    alert('Erro abrir tabela: ' + e.message);
    log('Erro abrir tabela: ' + e.message);
  }
}

function escapeHtml(v){ if(v===null||v===undefined) return ''; return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

// ---- Import / Open DB file ----
function loadDbFile(file){
  const reader = new FileReader();
  reader.onload = function(){
    try{
      const u8 = new Uint8Array(reader.result);
      const name = file.name.replace(/\.[^.]+$/,'');
      databases[name] = new SQL.Database(u8);
      log('Arquivo .db carregado: ' + name);
      refreshBanksList();
      selectDb(name);
    }catch(e){ alert('Erro abrir db: ' + e.message); log('Erro abrir db: ' + e.message); }
  };
  reader.readAsArrayBuffer(file);
}

// ---- Import .sql into console (do not execute) ----
async function importSqlFileToConsole(file){
  const text = await file.text();
  document.getElementById('sqlConsole').value = text;
  log('Arquivo .sql carregado no Console: ' + file.name);
  // don't execute automatically
}

// ---- Run SQL from console against selectedDb ----
function runSqlFromConsole(){
  const sql = document.getElementById('sqlConsole').value.trim();
  if(!sql) return alert('Console SQL vazio');
  if(!selectedDb) return alert('Selecione primeiro um banco');
  const db = databases[selectedDb];
  try{
    // Execute in transaction so CREATE / INSERT / UPDATE / DELETE are safe
    db.run('BEGIN TRANSACTION');
    // Use exec to run the SQL (can include SELECTs and DDL)
    const results = db.exec(sql); // returns result sets for SELECTs
    db.run('COMMIT');
    log(`SQL executado no banco ${selectedDb} — (executado com sucesso)`);
    // If results returned, render them
    if(results && results.length) renderSqlResult(results);
    // update tables list and logTables
    refreshTablesPanel();
    // add executed SQL to log details
    log(`Comando(s) executado(s):\\n${sql}`);
  }catch(e){
    try{ db.run('ROLLBACK'); }catch(_){}
    alert('Erro ao executar SQL: ' + e.message);
    log('Erro executar SQL: ' + e.message);
  }
}

function renderSqlResult(results){
  // show first result set in tableData
  if(!results || !results.length) return;
  const r = results[0];
  const cols = r.columns;
  const rows = r.values;
  let html = '<table><thead><tr>';
  cols.forEach(c => html += `<th>${c}</th>`);
  html += '</tr></thead><tbody>';
  rows.forEach(row => { html += '<tr>'; row.forEach(cell => html += `<td>${escapeHtml(cell)}</td>`); html += '</tr>'; });
  html += '</tbody></table>';
  document.getElementById('tableArea').style.display = 'block';
  document.getElementById('tableTitle').innerText = `Resultado SQL (${selectedDb})`;
  document.getElementById('tableInfo').innerText = `Linhas: ${rows.length}`;
  document.getElementById('tableData').innerHTML = html;
}

// ---- Save SQL console to file (download) ----
function saveSqlToFile(){
  const txt = document.getElementById('sqlConsole').value;
  const blob = new Blob([txt], {type:'text/sql'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (selectedDb ? selectedDb : 'script') + '.sql';
  a.click();
  setTimeout(()=> URL.revokeObjectURL(a.href),1000);
  log('Script salvo: ' + a.download);
}

// ---- CSV import/export for selected table (basic) ----
async function importCsvToSelectedTable(file){
  if(!selectedDb || !selectedTable) return alert('Selecione banco e tabela');
  const text = await file.text();
  const rows = parseCSV(text);
  if(rows.length < 2) return alert('CSV sem dados');
  const header = rows[0];
  try{
    const db = databases[selectedDb];
    db.run('BEGIN TRANSACTION');
    for(let i=1;i<rows.length;i++){
      const vals = rows[i];
      const quoted = vals.map(v => v===''? 'NULL' : `'${String(v).replace(/'/g,"''")}'`).join(',');
      const sql = `INSERT INTO "${selectedTable}" (${header.map(h => '"' + h + '"').join(',')}) VALUES (${quoted})`;
      db.run(sql);
    }
    db.run('COMMIT');
    log(`CSV importado para ${selectedTable} (${rows.length-1} linhas)`);
    openTable(selectedDb, selectedTable);
    refreshTablesPanel();
  }catch(e){ try{ databases[selectedDb].run('ROLLBACK'); }catch(_){} alert('Erro importar CSV: ' + e.message); log('Erro importar CSV: ' + e.message); }
}

function exportTableCsv(){
  if(!selectedDb || !selectedTable) return alert('Selecione tabela');
  try{
    const res = databases[selectedDb].exec(`SELECT * FROM "${selectedTable}"`);
    if(!res.length) return alert('Tabela vazia');
    const cols = res[0].columns;
    const rows = res[0].values;
    let csv = cols.join(',') + '\n';
    rows.forEach(r => {
      csv += r.map(v => {
        if(v===null||v===undefined) return '';
        const s = String(v);
        if(s.includes(',')||s.includes('\n')||s.includes('"')) return '"' + s.replace(/"/g,'""') + '"';
        return s;
      }).join(',') + '\n';
    });
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${selectedDb}-${selectedTable}.csv`; a.click();
    setTimeout(()=> URL.revokeObjectURL(a.href),1000);
    log(`Exportado CSV: ${selectedDb}.${selectedTable}`);
  }catch(e){ alert('Erro export CSV: ' + e.message); log('Erro export CSV: ' + e.message); }
}

// ---- helper CSV parser (simple) ----
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  function parseLine(line){
    const cols = []; let cur = ''; let inQ = false;
    for(let i=0;i<line.length;i++){
      const ch = line[i]; const nxt = line[i+1];
      if(ch === '"'){
        if(inQ && nxt === '"'){ cur += '"'; i++; continue; }
        inQ = !inQ; continue;
      }
      if(ch === ',' && !inQ){ cols.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur); return cols;
  }
  return lines.map(parseLine);
}

// ---- UI bindings ----
document.addEventListener('DOMContentLoaded', async () => {
  try{ await initSql(); }catch(e){ alert('Erro init sql: ' + e.message); return; }

  // buttons and inputs
  document.getElementById('btnCreateBank').onclick = createBankFromInput;
  document.getElementById('btnOpenDb').onclick = ()=> document.getElementById('import-db-file').click();
  document.getElementById('import-db-file').onchange = e => { if(e.target.files && e.target.files[0]) loadDbFile(e.target.files[0]); };

  document.getElementById('btnImportSql').onclick = ()=> document.getElementById('import-sql-file').click();
  document.getElementById('import-sql-file').onchange = e => { if(e.target.files && e.target.files[0]) importSqlFileToConsole(e.target.files[0]); };

  document.getElementById('btnRunSql').onclick = runSqlFromConsole;
  document.getElementById('btnClearSql').onclick = ()=> { document.getElementById('sqlConsole').value = ''; log('Console limpo'); };
  document.getElementById('btnSaveSql').onclick = saveSqlToFile;

  document.getElementById('btnExportDb').onclick = ()=> {
    if(!selectedDb) return alert('Selecione um banco primeiro');
    exportDb(selectedDb);
  };

  document.getElementById('btnExportTableCsv').onclick = exportTableCsv;
  document.getElementById('btnImportTableCsv').onclick = ()=> document.getElementById('import-csv').click();
  document.getElementById('import-csv').onchange = e => { if(e.target.files && e.target.files[0]) importCsvToSelectedTable(e.target.files[0]); };

  refreshBanksList();
});
