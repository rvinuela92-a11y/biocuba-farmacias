import { useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function dbGet(table, filters = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`
  Object.entries(filters).forEach(([k, v]) => url += `&${k}=eq.${v}`)
  const res = await fetch(url, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  })
  return res.json()
}

export default function Cuadratura() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window._initCuadratura && setTimeout(window._initCuadratura, 500)
      }, 300)
    }
  }, [])

  return (
    <>
      <Head>
        <title>Arqueo de Caja — BioCuba</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Inter:wght@400;500;600;700&display=swap" />
      </Head>

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        :root{
          --bg:#f5f4f0;--surf:#fff;--s2:#f0efe9;--bdr:#e2e0d8;--bdr2:#c8c5bb;
          --tx:#1a1916;--t2:#6b6860;--t3:#9e9b93;
          --green:#2a5c3a;--gbg:#e5f0e8;--gbdr:#aed0b8;
          --red:#c0392b;--rbg:#fde8e8;--rbdr:#e8aaaa;
          --amber:#7a5100;--abg:#fef8ec;--abdr:#e8d5a3;
          --blue:#1a4a8a;--bbg:#eef3fc;--bbdr:#c5d8f5;
          --br:#e53030;--font:'DM Sans',sans-serif;--mono:'Inter',sans-serif;
        }
        body{font-family:var(--font);background:var(--bg);color:var(--tx);min-height:100vh}
        .hdr{background:#fff;border-bottom:2.5px solid var(--br);padding:0 24px;display:flex;align-items:center;min-height:54px;gap:14px}
        .hdr-sep{width:1px;height:22px;background:var(--bdr)}
        .tabs{background:#fff;border-bottom:1px solid var(--bdr);padding:0 24px;display:flex;overflow-x:auto}
        .tab{font-family:var(--font);font-size:12px;font-weight:500;padding:13px 18px;border:none;background:transparent;color:var(--t2);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
        .tab.on{color:var(--blue);border-bottom-color:var(--blue)}
        .main{padding:24px 20px 80px;max-width:980px;margin:0 auto}
        .ctrl-bar{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center;background:#fff;border:1px solid var(--bdr);border-radius:10px;padding:12px 16px}
        .ctrl-bar select,.ctrl-bar input[type=date]{font-family:var(--font);font-size:13px;padding:7px 11px;border:1px solid var(--bdr);border-radius:7px;background:#fff;color:var(--tx);outline:none}
        .dia-badge{font-size:12px;font-weight:500;color:var(--t2);background:var(--s2);padding:5px 12px;border-radius:20px}
        .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
        .kpi{background:#fff;border:1px solid var(--bdr);border-radius:10px;padding:14px 16px}
        .kpi-lbl{font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}
        .kpi-val{font-family:var(--mono);font-size:26px;font-weight:600;letter-spacing:-.5px}
        .kpi-sub{font-size:11px;color:var(--t3);margin-top:3px}
        .layout{display:flex;min-height:100vh}
        .sidebar{width:220px;background:#fff;border-right:1px solid var(--bdr);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto;flex-shrink:0}
        .sb-logo{padding:14px 16px 12px;border-bottom:2.5px solid var(--br)}
        .sb-section{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.7px;color:var(--t3);padding:12px 16px 4px}
        .sb-link{display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:6px;cursor:pointer;font-size:13px;text-decoration:none;color:var(--t2);font-weight:400;margin:1px 8px;transition:background .1s}
        .sb-link:hover{background:var(--s2)}
        .sb-link.active{color:var(--green);background:var(--gbg);font-weight:500}
        .sb-link.soon{color:var(--t3);cursor:not-allowed;opacity:.6}
        .sb-sep{height:1px;background:var(--bdr);margin:6px 12px}
        .content{flex:1;display:flex;flex-direction:column;min-width:0}
        .content-hdr{background:#fff;border-bottom:1px solid var(--bdr);padding:11px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:20}
        .main{padding:24px 20px 80px;max-width:980px;margin:0 auto}
        .paso{background:#fff;border:1px solid var(--bdr);border-radius:12px;margin-bottom:16px;overflow:hidden}
        .paso-hdr{padding:13px 18px;background:var(--s2);border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:12px}
        .paso-num{width:26px;height:26px;border-radius:50%;background:var(--blue);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .paso-num.done{background:var(--green)}
        .paso-title{font-size:13px;font-weight:600;color:var(--tx)}
        .paso-sub{font-size:11px;color:var(--t3);margin-left:auto}
        .paso-body{padding:18px}
        .golan-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
        .upload-zona{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#fff;border:1.5px dashed #8ab4e8;border-radius:8px;cursor:pointer;transition:all .15s}
        .upload-zona.cargada{border-color:var(--green);background:var(--gbg);border-style:solid}
        .upload-zona input{display:none}
        .upload-txt{font-size:13px;font-weight:500;color:var(--blue)}
        .upload-sub{font-size:11px;color:var(--t3)}
        .golan-desglose{display:none;background:var(--bbg);border:1px solid var(--bbdr);border-radius:9px;padding:14px}
        .golan-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--bbdr)}
        .golan-row:last-child{border-bottom:none;padding-top:8px;margin-top:4px}
        .golan-lbl{font-size:12px;color:var(--t2)}
        .golan-val{font-family:var(--mono);font-size:15px;font-weight:600;color:var(--blue)}
        .golan-total .golan-lbl{font-weight:700;font-size:13px;color:var(--tx)}
        .golan-total .golan-val{font-size:20px;font-weight:700;color:var(--green)}
        .cajas-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .caja-wrap{border:1px solid var(--bdr);border-radius:10px;overflow:hidden}
        .caja-hdr{padding:10px 16px;background:var(--s2);border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between}
        .caja-titulo{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--t2)}
        .caja-total-disp{font-family:var(--mono);font-size:18px;font-weight:700;color:var(--green)}
        .billetes-lista{padding:12px 16px}
        .billete-row{display:grid;grid-template-columns:72px 60px 1fr;gap:8px;align-items:center;margin-bottom:6px}
        .billete-lbl{font-family:var(--mono);font-size:14px;font-weight:600;color:var(--tx);text-align:right}
        .billete-inp{font-family:var(--mono);font-size:18px;font-weight:600;padding:8px 10px;border:1.5px solid var(--bdr);border-radius:6px;text-align:center;outline:none;width:100%;background:#fff;transition:border-color .15s}
        .billete-inp:focus{border-color:var(--blue)}
        .billete-sub{font-family:var(--mono);font-size:14px;color:var(--green);text-align:right;font-weight:700}
        .caja-fondo{padding:10px 16px;border-top:1px solid var(--bdr);background:#fafaf8;display:flex;align-items:center;justify-content:space-between;gap:10px}
        .caja-fondo label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)}
        .fondo-inp{font-family:var(--mono);font-size:13px;padding:6px 10px;border:1px solid var(--bdr);border-radius:6px;width:110px;text-align:right;outline:none;transition:border-color .15s}
        .fondo-inp:focus{border-color:var(--blue)}
        .caja-dep{padding:8px 16px;border-top:1px solid var(--bdr);background:var(--gbg);display:flex;align-items:center;justify-content:space-between}
        .caja-dep-lbl{font-size:11px;font-weight:600;color:var(--green)}
        .caja-dep-val{font-family:var(--mono);font-size:20px;font-weight:700;color:var(--green)}
        .cmp-box{margin-top:16px;background:var(--s2);border:1px solid var(--bdr);border-radius:9px;padding:14px}
        .cmp-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:10px}
        .cmp-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center}
        .cmp-lbl{font-size:10px;color:var(--t3);margin-bottom:4px}
        .cmp-val{font-family:var(--mono);font-size:22px;font-weight:700;letter-spacing:-.5px}
        .convenios-box{background:#fff;border:1px solid var(--bdr);border-radius:9px;padding:14px;margin-top:16px}
        .conv-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:12px}
        .conv-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bdr)}
        .conv-row:last-child{border-bottom:none}
        .conv-lbl{font-size:12px;color:var(--t2)}
        .conv-val{font-family:var(--mono);font-size:16px;font-weight:600}
        .alerta-conv{border-radius:9px;padding:12px 16px;margin-top:12px;font-size:13px;font-weight:500;display:none}
        .alerta-ok{background:var(--gbg);border:1px solid var(--gbdr);color:var(--green);display:flex;align-items:center;gap:8px}
        .alerta-bad{background:var(--rbg);border:1px solid var(--rbdr);color:var(--red)}
        .alerta-bad .al-titulo{font-weight:700;margin-bottom:6px}
        .alerta-bad .al-detalle{font-size:12px;color:#7a2020;line-height:1.5}
        .alerta-bad .al-solucion{margin-top:8px;font-size:12px;background:#fff4f4;border-radius:6px;padding:8px 12px;color:var(--red)}
        .verificacion-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .verif-seccion{background:var(--s2);border:1px solid var(--bdr);border-radius:9px;padding:14px}
        .verif-titulo{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:10px}
        .verif-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--bdr)}
        .verif-row:last-child{border-bottom:none}
        .verif-lbl{font-size:12px;color:var(--t2)}
        .inp-sm{font-family:var(--mono);font-size:13px;padding:5px 10px;border:1px solid var(--bdr);border-radius:6px;width:130px;text-align:right;outline:none;background:#fff;transition:border-color .15s}
        .inp-sm:focus{border-color:var(--blue)}
        .dif-badge{font-family:var(--mono);font-size:12px;font-weight:500;padding:3px 10px;border-radius:20px}
        .dif-ok{background:var(--gbg);color:var(--green)}
        .dif-bad{background:var(--rbg);color:var(--red)}
        .dif-neu{background:var(--s2);color:var(--t3)}
        .dep-wrap{background:var(--abg);border:1px solid var(--abdr);border-radius:10px;padding:16px;margin-bottom:16px}
        .dep-tog{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:500;color:var(--amber);user-select:none}
        .dep-tog input{accent-color:var(--amber);width:16px;height:16px;cursor:pointer}
        .dep-inner{margin-top:14px;display:none}
        .dep-inner.on{display:block}
        .fg3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
        .f{display:flex;flex-direction:column;gap:4px}
        .f label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--t2)}
        .f input,.f select,.f textarea{font-family:var(--font);font-size:13px;padding:8px 11px;border:1px solid var(--bdr);border-radius:7px;background:#fff;color:var(--tx);outline:none;width:100%;transition:border-color .15s}
        .f input:focus,.f select:focus{border-color:var(--blue)}
        .f textarea{resize:vertical;min-height:54px}
        .sec{background:#fff;border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:16px}
        .sec-hdr{display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid var(--bdr);margin-bottom:14px}
        .sec-t{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--t2)}
        .sec-b{font-family:var(--mono);font-size:11px;color:var(--t3);background:var(--s2);padding:2px 10px;border-radius:20px}
        .gasto-row{display:grid;grid-template-columns:1fr 120px 34px;gap:8px;align-items:end;margin-bottom:8px}
        .btn-rm{width:34px;height:34px;border-radius:6px;border:1px solid var(--bdr);background:#fff;color:var(--t3);cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center}
        .btn-rm:hover{background:var(--rbg);color:var(--red)}
        .btn-add{font-family:var(--font);font-size:12px;padding:7px 14px;border-radius:7px;border:1px dashed var(--bdr2);background:transparent;color:var(--t2);cursor:pointer;margin-top:4px}
        .btn-add:hover{background:var(--s2)}
        .status-bar{border-radius:10px;padding:14px 16px;margin-bottom:20px;font-size:13px;font-weight:500}
        .st-ok{background:var(--gbg);border:1px solid var(--gbdr);color:var(--green)}
        .st-bad{background:var(--rbg);border:1px solid var(--rbdr);color:var(--red)}
        .btn-p{font-family:var(--font);font-size:13px;font-weight:600;padding:11px 28px;border-radius:8px;border:none;background:var(--tx);color:#fff;cursor:pointer}
        .btn-p:hover{opacity:.85}
        .btn-s{font-family:var(--font);font-size:12px;padding:9px 18px;border-radius:8px;border:1px solid var(--bdr2);background:transparent;color:var(--t2);cursor:pointer}
        .btn-s:hover{background:var(--s2)}
        .sub-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .tbl{width:100%;border-collapse:collapse;font-size:12px}
        .tbl th{text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--t3);padding:8px 12px;border-bottom:1px solid var(--bdr)}
        .tbl td{padding:9px 12px;border-bottom:1px solid var(--bdr);vertical-align:middle}
        .tbl tr:hover td{background:var(--s2)}
        .mono{font-family:var(--mono)}
        .bdg{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:500}
        .bdg-ok{background:var(--gbg);color:var(--green)}
        .bdg-bad{background:var(--rbg);color:var(--red)}
        .bdg-pend{background:var(--s2);color:var(--t2)}
        .s-maipu{background:#e8f4ee;color:#2d6a4f}
        .s-sanbernardo{background:#eef3fc;color:#1a4a8a}
        .s-providencia{background:#f5eefb;color:#6b2fa0}
        .s-florida{background:#fef8ec;color:#7a5100}
        .dep-fila{display:grid;grid-template-columns:28px 1fr 130px 110px;gap:8px;padding:13px 16px;border-bottom:0.5px solid var(--bdr);align-items:center;cursor:pointer;transition:background .1s}
        .dep-fila:last-child{border-bottom:none}
        .dep-fila:hover{background:var(--s2)}
        .dep-fila.sel{background:var(--gbg)}
        .dep-fila.depd{opacity:.5;cursor:default}
        .dep-chk{width:17px;height:17px;border:1.5px solid var(--bdr2);border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:#fff}
        .dep-chk.on{background:var(--green);border-color:var(--green)}
        .empty{text-align:center;padding:36px;color:var(--t3);font-size:13px;border:1px dashed var(--bdr);border-radius:10px}
        .toast{position:fixed;bottom:24px;right:24px;background:var(--tx);color:#fff;font-size:12px;font-weight:500;padding:11px 20px;border-radius:9px;opacity:0;transform:translateY(8px);transition:all .22s;pointer-events:none;z-index:999}
        .toast.on{opacity:1;transform:translateY(0)}
        @media(max-width:700px){
          .kpis{grid-template-columns:1fr 1fr}
          .cajas-grid{grid-template-columns:1fr}
          .golan-grid{grid-template-columns:1fr}
          .fg3{grid-template-columns:1fr 1fr}
          .verificacion-grid{grid-template-columns:1fr}
        }
      `}</style>

      <div className="layout">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sb-logo">
            <svg width="110" height="34" viewBox="0 0 110 34" fill="none">
              <rect x="1" y="2" width="7" height="18" rx="2.5" fill="#e53030"/>
              <rect x="0" y="9" width="9" height="9" rx="2" fill="#e53030"/>
              <path d="M13 4 L13 28 L17 28 L17 20 Q24 24 26 15 Q27 8 19 5 Q15 4 13 4Z" fill="#1a3fa0"/>
              <ellipse cx="20" cy="15" rx="5" ry="7" fill="#1a3fa0"/>
              <text x="32" y="20" fontFamily="Arial,sans-serif" fontSize="14" fontWeight="700"><tspan fill="#1a3fa0">Bio</tspan><tspan fill="#e53030">Cuba</tspan></text>
              <text x="33" y="30" fontFamily="Arial,sans-serif" fontSize="6" fill="#666" letterSpacing="2.5">FARMACIA</text>
            </svg>
          </div>

          <div className="sb-section">RRHH y Sueldos</div>
          <Link href="/" className="sb-link">⊞ Inicio</Link>
          <Link href="/?sec=resumen" className="sb-link">📋 Resumen del mes</Link>
          <Link href="/?sec=colaboradores" className="sb-link">👤 Colaboradores</Link>
          <Link href="/?sec=exportar" className="sb-link">⬇ Exportar</Link>

          <div className="sb-sep"></div>

          <div className="sb-section">Módulos</div>
          <Link href="/cuadratura" className="sb-link active">💰 Arqueo de Caja</Link>
          <Link href="/bienestar" className="sb-link">🏥 Bienestar Municipal</Link>
          <Link href="/sindicato" className="sb-link">🤝 Sindicato Municipal</Link>
          <span className="sb-link soon">📊 Dashboard Chipax <span style={{fontSize:9,marginLeft:'auto',background:'var(--s2)',padding:'1px 6px',borderRadius:10}}>Próximo</span></span>
          <span className="sb-link soon">🛒 Compras <span style={{fontSize:9,marginLeft:'auto',background:'var(--s2)',padding:'1px 6px',borderRadius:10}}>Próximo</span></span>
        </aside>

        {/* CONTENIDO */}
        <div className="content">
          <div className="content-hdr">
            <span style={{fontSize:15,fontWeight:600}}>Arqueo de Caja</span>
            <div style={{display:'flex',gap:4}}>
              {[
                {id:'ingresar',label:'Ingreso Diario'},
                {id:'depositos',label:'Depósitos'},
                {id:'historial',label:'Historial del Mes'},
                {id:'dashboard',label:'Resumen Mensual'},
              ].map((t,i) => (
                <button key={t.id} id={'tab-btn-'+t.id} className={'tab'+(i===0?' on':'')}
                  onClick={() => window._setTab(t.id)}
                  style={{padding:'8px 14px',fontSize:12}}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

      <div className="main">

        {/* ===== INGRESO DIARIO ===== */}
        <div id="tab-ingresar">

          <div className="ctrl-bar">
            <select id="suc" onChange={() => { window._verificarGuardado && window._verificarGuardado(); window._updDia && window._updDia() }}>
              <option value="maipu">Maipú</option>
              <option value="sanbernardo">San Bernardo</option>
              <option value="providencia">Providencia</option>
              <option value="florida">La Florida</option>
            </select>
            <input type="date" id="fecha" onChange={() => window._updDia && window._updDia()} />
            <span className="dia-badge" id="dianom"></span>
            <span id="ya-guardado" style={{fontSize:11,color:'var(--amber)',marginLeft:'auto'}}></span>
          </div>

          <div className="kpis">
            <div className="kpi"><div className="kpi-lbl">Venta Total del Día</div><div className="kpi-val" id="kv-golan" style={{color:'var(--blue)'}}>$0</div><div className="kpi-sub">Según cierre Z de Golan</div></div>
            <div className="kpi"><div className="kpi-lbl">Efectivo a Depositar</div><div className="kpi-val" id="kv-ef" style={{color:'var(--green)'}}>$0</div><div className="kpi-sub">Total cajas menos fondos</div></div>
            <div className="kpi"><div className="kpi-lbl">Diferencia en Efectivo</div><div className="kpi-val" id="kv-dif" style={{color:'var(--t3)'}}>—</div><div className="kpi-sub" id="kv-dif-sub">Golan vs. arqueo real</div></div>
            <div className="kpi"><div className="kpi-lbl">Convenios (Cheque)</div><div className="kpi-val" id="kv-conv" style={{color:'var(--amber)'}}>$0</div><div className="kpi-sub" id="kv-conv-sub">Bienestar + Sindicato</div></div>
          </div>

          {/* PASO 1: GOLAN */}
          <div className="paso">
            <div className="paso-hdr">
              <div className="paso-num" id="p1num">1</div>
              <span className="paso-title">Registro de Ventas Golan</span>
              <span className="paso-sub">Importe del cierre Z — un archivo por caja</span>
            </div>
            <div className="paso-body">
              <div className="golan-grid">
                <label className="upload-zona" id="zona1">
                  <input type="file" accept=".csv" onChange={e => { const f=e.target.files[0]; if(f && window._parsearCSV) window._parsearCSV(f,1); }} />
                  <span style={{fontSize:22}}>📄</span>
                  <div><div className="upload-txt" id="nombre1">Importar Cierre Z — Caja 1</div><div className="upload-sub">Golan → Cierre Z → Exportar CSV</div></div>
                </label>
                <label className="upload-zona" id="zona2">
                  <input type="file" accept=".csv" onChange={e => { const f=e.target.files[0]; if(f && window._parsearCSV) window._parsearCSV(f,2); }} />
                  <span style={{fontSize:22}}>📄</span>
                  <div><div className="upload-txt" id="nombre2">Importar Cierre Z — Caja 2</div><div className="upload-sub">Golan → Cierre Z → Exportar CSV</div></div>
                </label>
              </div>
              <div className="golan-desglose" id="golan-desglose">
                <div className="golan-row"><span className="golan-lbl">Efectivo (neto, sin devoluciones)</span><span className="golan-val" id="gv-ef">$0</span></div>
                <div className="golan-row" style={{padding:'3px 0'}}><span className="golan-lbl" style={{fontSize:11,color:'var(--red)'}}>↳ Devoluciones / Notas de crédito</span><span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--red)',fontWeight:500}} id="gv-dev">$0</span></div>
                <div className="golan-row"><span className="golan-lbl">Tarjeta Débito</span><span className="golan-val" id="gv-deb">$0</span></div>
                <div className="golan-row"><span className="golan-lbl">Tarjeta Crédito</span><span className="golan-val" id="gv-cred">$0</span></div>
                <div className="golan-row"><span className="golan-lbl">Transferencias Electrónicas</span><span className="golan-val" id="gv-transf">$0</span></div>
                <div className="golan-row"><span className="golan-lbl" style={{color:'var(--amber)',fontWeight:600}}>📄 Cheque 30 días (Bienestar + Sindicato)</span><span className="golan-val" style={{color:'var(--amber)'}} id="gv-cheque">$0</span></div>
                <div className="golan-row golan-total"><span className="golan-lbl">Total Venta del Día</span><span className="golan-val" id="gv-total">$0</span></div>
              </div>
            </div>
          </div>

          {/* PASO 2: ARQUEO EFECTIVO */}
          <div className="paso">
            <div className="paso-hdr">
              <div className="paso-num" id="p2num">2</div>
              <span className="paso-title">Arqueo de Efectivo por Caja</span>
              <span className="paso-sub">Cuenta el efectivo de la bolsa e ingresa la cantidad de cada denominación</span>
            </div>
            <div className="paso-body">
              <div className="cajas-grid">
                <div className="caja-wrap">
                  <div className="caja-hdr"><span className="caja-titulo">Caja 1</span><span className="caja-total-disp" id="c1-total-disp">$0</span></div>
                  <div className="billetes-lista" id="billetes1"></div>
                  <div className="caja-fondo"><label>Fondo de Caja</label><input type="number" className="fondo-inp" id="c1fondo" placeholder="0" onInput={() => window._recalc && window._recalc()} /></div>
                  <div className="caja-dep"><span className="caja-dep-lbl">Total a Depositar</span><span className="caja-dep-val" id="c1-dep">$0</span></div>
                </div>
                <div className="caja-wrap">
                  <div className="caja-hdr"><span className="caja-titulo">Caja 2</span><span className="caja-total-disp" id="c2-total-disp">$0</span></div>
                  <div className="billetes-lista" id="billetes2"></div>
                  <div className="caja-fondo"><label>Fondo de Caja</label><input type="number" className="fondo-inp" id="c2fondo" placeholder="0" onInput={() => window._recalc && window._recalc()} /></div>
                  <div className="caja-dep"><span className="caja-dep-lbl">Total a Depositar</span><span className="caja-dep-val" id="c2-dep">$0</span></div>
                </div>
              </div>

              <div className="cmp-box">
                <div className="cmp-title">Comparación Efectivo — Golan vs. Arqueo Real</div>
                <div className="cmp-grid">
                  <div><div className="cmp-lbl">Golan dice</div><div className="cmp-val" id="cmp-golan" style={{color:'var(--blue)'}}>$0</div></div>
                  <div><div className="cmp-lbl">Arqueo real</div><div className="cmp-val" id="cmp-real">$0</div></div>
                  <div><div className="cmp-lbl">Diferencia</div><div className="cmp-val" id="cmp-dif" style={{color:'var(--t3)'}}>—</div></div>
                </div>
              </div>

              {/* CONVENIOS: Bienestar + Sindicato */}
              <div className="convenios-box" id="convenios-box">
                <div className="conv-title">📄 Convenios — Cheque 30 días</div>
                <div className="conv-row">
                  <span className="conv-lbl">Cheque según Golan (total a cuadrar)</span>
                  <span className="conv-val" style={{color:'var(--amber)'}} id="conv-golan">$0</span>
                </div>
                <div className="conv-row">
                  <span className="conv-lbl">Bienestar Municipal Maipú (registrado hoy)</span>
                  <span className="conv-val" style={{color:'var(--green)'}} id="conv-bienestar">$0</span>
                </div>
                <div className="conv-row">
                  <span className="conv-lbl">Sindicato Municipal (registrado hoy)</span>
                  <span className="conv-val" style={{color:'var(--green)'}} id="conv-sindicato">$0</span>
                </div>
                <div className="conv-row" style={{borderTop:'2px solid var(--bdr)',marginTop:4,paddingTop:8}}>
                  <span className="conv-lbl" style={{fontWeight:600}}>Diferencia convenios</span>
                  <span className="conv-val" id="conv-dif" style={{color:'var(--t3)'}}>—</span>
                </div>
                <div className="alerta-conv" id="alerta-conv-ok">
                  ✓ Convenios cuadran perfectamente con Golan
                </div>
                <div className="alerta-conv alerta-bad" id="alerta-conv-bad">
                  <div className="al-titulo">⚠ Los convenios no cuadran con Golan</div>
                  <div className="al-detalle" id="al-detalle"></div>
                  <div className="al-solucion" id="al-solucion"></div>
                </div>
              </div>
            </div>
          </div>

          {/* PASO 3: VERIFICACIÓN MEDIOS ELECTRÓNICOS */}
          <div className="paso">
            <div className="paso-hdr">
              <div className="paso-num" id="p3num">3</div>
              <span className="paso-title">Verificación de Medios de Pago Electrónicos</span>
              <span className="paso-sub">Confirma que SumUp y transferencias bancarias cuadren con Golan</span>
            </div>
            <div className="paso-body">
              <div className="verificacion-grid">
                <div>
                  <div className="verif-titulo">SumUp — Débito y Crédito</div>
                  <div className="verif-seccion">
                    <div className="verif-row"><span className="verif-lbl">Golan registró (débito + crédito)</span><span style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--blue)'}} id="sumup-golan">$0</span></div>
                    <div className="verif-row"><span className="verif-lbl">Total según SumUp</span><input type="number" className="inp-sm" id="sumup-total" placeholder="0" onInput={() => window._recalcSumup && window._recalcSumup()} /></div>
                    <div className="verif-row" style={{borderBottom:'none'}}><span className="verif-lbl">Diferencia</span><span className="dif-badge dif-neu" id="sumup-dif">—</span></div>
                  </div>
                  <div style={{fontSize:11,color:'var(--t3)',marginTop:6}}>Ingresa el total de débito + crédito que muestra SumUp al cierre del día.</div>
                </div>
                <div>
                  <div className="verif-titulo">Transferencias Bancarias</div>
                  <div className="verif-seccion">
                    <div className="verif-row"><span className="verif-lbl">Golan registró (transferencias)</span><span style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--blue)'}} id="transf-golan">$0</span></div>
                    <div className="verif-row"><span className="verif-lbl">Recibido en cuenta bancaria</span><input type="number" className="inp-sm" id="transf-real" placeholder="0" onInput={() => window._recalcTransf && window._recalcTransf()} /></div>
                    <div className="verif-row" style={{borderBottom:'none'}}><span className="verif-lbl">Diferencia</span><span className="dif-badge dif-neu" id="transf-dif">—</span></div>
                  </div>
                  <div style={{fontSize:11,color:'var(--t3)',marginTop:6}}>Revisa la cuenta bancaria y confirma que las transferencias de Golan hayan ingresado.</div>
                </div>
              </div>
            </div>
          </div>

          {/* DEPÓSITO */}
          <div className="dep-wrap">
            <label className="dep-tog"><input type="checkbox" id="chkdep" onChange={() => window._togDep && window._togDep()} />Se realizó depósito bancario hoy</label>
            <div className="dep-inner" id="dep-inner">
              <div className="fg3" style={{marginTop:0}}>
                <div className="f"><label>Monto Depositado</label><input type="number" id="dm" placeholder="0" onInput={() => window._recalc && window._recalc()} /></div>
                <div className="f"><label>Banco</label>
                  <select id="db"><option value="">Seleccionar...</option><option>Banco de Chile</option><option>Itaú</option><option>Scotiabank</option><option>Santander</option><option>BCI</option><option>Banco Estado</option></select>
                </div>
                <div className="f"><label>Observación del Depósito</label><input type="text" id="dobs" placeholder="Ej: incluye ventas del fin de semana" /></div>
              </div>
            </div>
          </div>

          {/* GASTOS */}
          <div className="sec">
            <div className="sec-hdr"><span className="sec-t">Gastos del Local</span><span className="sec-b" id="b-gas">$0</span></div>
            <div id="gastos-list"></div>
            <button className="btn-add" onClick={() => window._addGasto && window._addGasto()}>+ Agregar gasto</button>
          </div>

          {/* OBSERVACIONES */}
          <div className="sec">
            <div className="sec-hdr"><span className="sec-t">Observaciones del Día</span></div>
            <div className="f"><textarea id="obs" rows={3} placeholder="Registra cualquier diferencia encontrada, error o novedad relevante del día..."></textarea></div>
          </div>

          <div id="status-box"></div>

          <div className="sub-row">
            <span style={{fontSize:11,color:'var(--t3)'}}>Los datos quedan guardados y disponibles para todas las sucursales</span>
            <div style={{display:'flex',gap:8}}>
              <button className="btn-s" onClick={() => window._limpiar && window._limpiar()}>Limpiar</button>
              <button className="btn-p" onClick={() => window._guardar && window._guardar()}>Guardar Arqueo</button>
            </div>
          </div>
        </div>

        {/* ===== DEPÓSITOS ===== */}
        <div id="tab-depositos" style={{display:'none'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
            <div>
              <div style={{fontSize:16,fontWeight:500,marginBottom:2}}>Depósitos Bancarios</div>
              <div style={{fontSize:12,color:'var(--t3)'}} id="dep-sub"></div>
            </div>
            <select id="dep-suc" style={{fontFamily:'var(--font)',fontSize:12,padding:'6px 10px',border:'1px solid var(--bdr)',borderRadius:7,background:'#fff',outline:'none'}} onChange={() => window._renderDepositos && window._renderDepositos()}>
              <option value="maipu">Maipú</option>
              <option value="sanbernardo">San Bernardo</option>
              <option value="providencia">Providencia</option>
              <option value="florida">La Florida</option>
            </select>
          </div>

          <div className="kpis" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
            <div className="kpi"><div className="kpi-lbl">Efectivo pendiente</div><div className="kpi-val" id="dep-k-pend" style={{color:'var(--amber)'}}>$0</div><div className="kpi-sub" id="dep-k-dias">0 días sin depositar</div></div>
            <div className="kpi"><div className="kpi-lbl">Seleccionado</div><div className="kpi-val" id="dep-k-sel" style={{color:'var(--green)'}}>$0</div><div className="kpi-sub">Para depositar ahora</div></div>
            <div className="kpi"><div className="kpi-lbl">Depositado este mes</div><div className="kpi-val" id="dep-k-dep">$0</div><div className="kpi-sub" id="dep-k-ndep">0 depósitos</div></div>
          </div>

          <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,overflow:'hidden',marginBottom:16}}>
            <div style={{display:'grid',gridTemplateColumns:'28px 1fr 130px 110px',gap:8,padding:'9px 16px',background:'var(--s2)',borderBottom:'1px solid var(--bdr)'}}>
              <div></div>
              <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t3)'}}>Día</div>
              <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t3)',textAlign:'right'}}>Efectivo</div>
              <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t3)',textAlign:'right'}}>Estado</div>
            </div>
            <div id="dep-lista"></div>
          </div>

          <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:18}}>
            <div style={{fontSize:14,fontWeight:500,marginBottom:14,paddingBottom:12,borderBottom:'1px solid var(--bdr)'}}>Registrar depósito bancario</div>
            <div id="dep-panel-body">
              <div style={{fontSize:13,color:'var(--t3)',padding:'12px 0'}}>Selecciona uno o más días de la lista para calcular el total a depositar.</div>
            </div>
            <div style={{display:'none',background:'var(--gbg)',border:'1px solid var(--gbdr)',borderRadius:8,padding:'12px 14px',marginTop:12,alignItems:'center',gap:8,fontSize:13,fontWeight:500,color:'var(--green)'}} id="dep-ok">
              ✓ <span id="dep-ok-txt"></span>
            </div>
          </div>
        </div>

        {/* ===== HISTORIAL ===== */}
        <div id="tab-historial" style={{display:'none'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
            <div><div style={{fontSize:16,fontWeight:500,marginBottom:2}}>Historial del Mes</div><div style={{fontSize:12,color:'var(--t3)'}} id="hist-sub"></div></div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <select id="hist-suc" style={{fontFamily:'var(--font)',fontSize:12,padding:'6px 10px',border:'1px solid var(--bdr)',borderRadius:7,background:'#fff',outline:'none'}} onChange={() => window._renderHist && window._renderHist()}>
                <option value="">Todas las Sucursales</option>
                <option value="maipu">Maipú</option><option value="sanbernardo">San Bernardo</option>
                <option value="providencia">Providencia</option><option value="florida">La Florida</option>
              </select>
              <button className="btn-s" style={{fontSize:11,padding:'6px 12px'}} onClick={() => window._exportCSV && window._exportCSV()}>↓ Exportar CSV</button>
            </div>
          </div>
          <div id="hist-content"><div className="empty">Cargando registros...</div></div>
        </div>

        {/* ===== DASHBOARD ===== */}
        <div id="tab-dashboard" style={{display:'none'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{fontSize:16,fontWeight:500}} id="dash-titulo">Resumen Mensual</div>
            <select id="dash-suc" style={{fontFamily:'var(--font)',fontSize:12,padding:'6px 10px',border:'1px solid var(--bdr)',borderRadius:7,background:'#fff',outline:'none'}} onChange={() => window._renderDash && window._renderDash()}>
              <option value="">Todas las Sucursales</option>
              <option value="maipu">Maipú</option><option value="sanbernardo">San Bernardo</option>
              <option value="providencia">Providencia</option><option value="florida">La Florida</option>
            </select>
          </div>
          <div className="kpis" id="dash-kpis"></div>
          <div id="dash-cal"></div>
        </div>

      </div>

      </div>{/* content */}
      </div>{/* layout */}

      <div className="toast" id="toast"></div>

      <script dangerouslySetInnerHTML={{__html:`
(function(){
const SN={maipu:'Maipú',sanbernardo:'San Bernardo',providencia:'Providencia',florida:'La Florida'}
const SC={maipu:'s-maipu',sanbernardo:'s-sanbernardo',providencia:'s-providencia',florida:'s-florida'}
const DIAS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const DIAS_S=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const BILLETES=[20000,10000,5000,2000,1000,500,100,50,10]
const fmt=n=>'$'+Math.round(n||0).toLocaleString('es-CL')
const pn=v=>parseFloat((v+'').replace(/[^\\d.,]/g,'').replace(',','.'))||0
const hoy=()=>new Date().toISOString().split('T')[0]
const g=id=>document.getElementById(id)
const gv=id=>g(id)?g(id).value:''
const gpn=id=>pn(gv(id))
const dnom=(f,s)=>(s?DIAS_S:DIAS)[new Date(f+'T12:00:00').getDay()]
function toast(m){const t=g('toast');if(!t)return;t.textContent=m;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),3200)}

// Storage con Supabase
let MEM=[]
async function getData(){
  if(MEM.length)return MEM
  try{
    const url='${SUPABASE_URL}/rest/v1/cuadratura?select=*&order=fecha.desc&limit=200'
    const res=await fetch(url,{headers:{'apikey':'${SUPABASE_KEY}','Authorization':'Bearer ${SUPABASE_KEY}'}})
    const d=await res.json();if(Array.isArray(d)){MEM=d;return MEM}
  }catch{}
  try{const r=localStorage.getItem('bc_cuad_v5');if(r){MEM=JSON.parse(r);return MEM}}catch{}
  return[]
}
async function saveReg(reg){
  try{
    const res=await fetch('${SUPABASE_URL}/rest/v1/cuadratura',{
      method:'POST',
      headers:{'apikey':'${SUPABASE_KEY}','Authorization':'Bearer ${SUPABASE_KEY}','Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
      body:JSON.stringify({
        id:reg.id,fecha:reg.fecha,sucursal:reg.suc,
        c1_total:reg.c1.total,c1_fondo:reg.c1.fondo,c1_neto:reg.c1.neto,
        c2_total:reg.c2.total,c2_fondo:reg.c2.fondo,c2_neto:reg.c2.neto,
        efectivo_total:reg.efTotal,
        golan_ef:reg.golan.efNeto,golan_deb:reg.golan.deb,golan_cred:reg.golan.cred,
        golan_transf:reg.golan.transf,golan_cheque:reg.golan.cheque,
        golan_dev:reg.golan.devTotal,golan_total:reg.golan.totalVentas,
        deposito_monto:reg.dep?.monto||0,deposito_banco:reg.dep?.banco||'',deposito_obs:reg.dep?.obs||'',
        gastos:JSON.stringify(reg.gastos),gastos_total:reg.tg,
        observacion:reg.obs,
        updated_at:new Date().toISOString()
      })
    })
    if(res.ok){MEM=[];return true}
  }catch{}
  // fallback localStorage
  try{
    const all=JSON.parse(localStorage.getItem('bc_cuad_v5')||'[]')
    const idx=all.findIndex(r=>r.id===reg.id)
    if(idx>=0)all[idx]=reg;else all.push(reg)
    localStorage.setItem('bc_cuad_v5',JSON.stringify(all))
    MEM=all;return true
  }catch{return false}
}

// Construir billetes
function buildBilletes(){
  [1,2].forEach(n=>{
    const el=g('billetes'+n);if(!el)return
    el.innerHTML=BILLETES.map(b=>\`
      <div class="billete-row">
        <span class="billete-lbl">\${fmt(b)}</span>
        <input type="number" class="billete-inp" id="b\${n}_\${b}" min="0" placeholder="0"
          oninput="window._calcCaja(\${n})">
        <span class="billete-sub" id="bs\${n}_\${b}"></span>
      </div>\`).join('')
  })
}

window._calcCaja=function(n){
  let total=0
  BILLETES.forEach(b=>{
    const cant=parseInt(g('b'+n+'_'+b)?.value||'0')||0
    const sub=cant*b;total+=sub
    const el=g('bs'+n+'_'+b)
    if(el)el.textContent=cant>0?fmt(sub):''
  })
  if(g('c'+n+'-total-disp'))g('c'+n+'-total-disp').textContent=fmt(total)
  window._recalc()
}

function getTotalCaja(n){
  return BILLETES.reduce((s,b)=>{
    const cant=parseInt(g('b'+n+'_'+b)?.value||'0')||0
    return s+cant*b
  },0)
}

// Golan
let golan={ef:0,efNeto:0,efBruto:0,deb:0,cred:0,transf:0,cheque:0,devTotal:0,totalVentas:0,convenios:0,total:0}

window._parsearCSV=async function(file,n){
  if(!file)return
  // Leer con encoding latin1 para CSV de Golan
  const buffer=await file.arrayBuffer()
  const decoder=new TextDecoder('iso-8859-1')
  const text=decoder.decode(buffer)
  const pm=s=>parseInt((s||'').replace(/[$.()\\.\\s]/g,'').replace(/,/g,''))||0
  const r={efBruto:0,efNeto:0,deb:0,cred:0,transf:0,cheque:0,devTotal:0,totalVentas:0,convenios:0}
  for(const line of text.replace(/\\r/g,'').split('\\n')){
    const c=line.split(',').map(x=>x.trim())
    // Ventas brutas col 8
    if(c[2]==='Cheque 30 dias'||c[2]==='Cheque 30 días') r.cheque=pm(c[8])
    if(c[2]==='Efectivo') r.efBruto=pm(c[8])
    if(c[2]&&(c[2].includes('D\xe9bito')||c[2].includes('D\xc3\xa9bito')||c[2].includes('Debito')||c[2].includes('bito'))) r.deb=pm(c[8])
    if(c[2]&&(c[2].includes('Cr\xe9dito')||c[2].includes('Cr\xc3\xa9dito')||c[2].includes('Credito')||c[2].includes('dito'))) r.cred=pm(c[8])
    if(c[2]&&c[2].includes('Transferencia')) r.transf=pm(c[8])
    // Totales netos col 16 (ya con devoluciones descontadas)
    if(c[12]==='Efectivo') r.efNeto=pm(c[16])
    if(c[12]&&(c[12].includes('D\xe9bito')||c[12].includes('D\xc3\xa9bito')||c[12].includes('Debito')||c[12].includes('bito'))) r.deb=pm(c[16])
    if(c[12]&&(c[12].includes('Cr\xe9dito')||c[12].includes('Cr\xc3\xa9dito')||c[12].includes('Credito')||c[12].includes('dito'))) r.cred=pm(c[16])
    if(c[12]&&c[12].includes('Transferencia')) r.transf=pm(c[16])
    if(c[12]==='Cheque') r.cheque=pm(c[16])
    // Totales globales col 24
    if(c[20]==='Total Ventas') r.totalVentas=pm(c[24])
    if(c[20]==='Total Abono Convenios') r.convenios=pm(c[24])
    if(c[20]==='Total Devoluciones') r.devTotal=pm(c[24])
  }
  // Acumular ambas cajas
  golan.efBruto+=r.efBruto;golan.efNeto+=r.efNeto
  golan.deb=r.deb;golan.cred=r.cred;golan.transf=r.transf
  golan.cheque+=r.cheque;golan.devTotal+=r.devTotal
  golan.totalVentas+=r.totalVentas;golan.convenios+=r.convenios
  golan.ef=golan.efNeto;golan.total=golan.totalVentas

  const z=g('zona'+n);if(z)z.classList.add('cargada')
  const nb=g('nombre'+n);if(nb)nb.textContent='✓ Caja '+n+' — '+fmt(r.totalVentas)
  const desg=g('golan-desglose');if(desg)desg.style.display='block'
  if(g('gv-ef'))g('gv-ef').textContent=fmt(golan.efNeto)
  if(g('gv-dev'))g('gv-dev').textContent=golan.devTotal>0?'-'+fmt(golan.devTotal):'$0'
  if(g('gv-deb'))g('gv-deb').textContent=fmt(golan.deb)
  if(g('gv-cred'))g('gv-cred').textContent=fmt(golan.cred)
  if(g('gv-transf'))g('gv-transf').textContent=fmt(golan.transf)
  if(g('gv-cheque'))g('gv-cheque').textContent=fmt(golan.cheque)
  if(g('gv-total'))g('gv-total').textContent=fmt(golan.totalVentas)
  if(g('kv-golan'))g('kv-golan').textContent=fmt(golan.totalVentas)
  if(g('kv-conv'))g('kv-conv').textContent=fmt(golan.cheque)
  if(g('conv-golan'))g('conv-golan').textContent=fmt(golan.cheque)
  if(g('sumup-golan'))g('sumup-golan').textContent=fmt(golan.deb+golan.cred)
  if(g('transf-golan'))g('transf-golan').textContent=fmt(golan.transf)
  if(g('p1num')){g('p1num').textContent='✓';g('p1num').classList.add('done')}
  const sucursal=document.getElementById('suc')?.value
  const convBox=document.getElementById('convenios-box')
  if(convBox)convBox.style.display=sucursal==='maipu'?'block':'none'
  if(sucursal==='maipu') await actualizarConvenios()
  window._recalcSumup();window._recalcTransf();window._recalc()
  toast('✓ Caja '+n+' importada — '+fmt(r.totalVentas))
}

// Leer ventas del día de Bienestar y Sindicato desde Supabase
async function actualizarConvenios(){
  const fecha=gv('fecha');const suc=gv('suc')
  if(!fecha||suc!=='maipu'){
    // Solo Maipú tiene convenios por ahora
    if(g('conv-bienestar'))g('conv-bienestar').textContent='$0'
    if(g('conv-sindicato'))g('conv-sindicato').textContent='$0'
    alertaConvenios(0,0)
    return
  }
  // Bienestar: tabla bienestar_ventas filtrada por mes
  const mes=fecha.slice(0,7)
  let bienestarTotal=0,sindicatoTotal=0
  try{
    const url='${SUPABASE_URL}/rest/v1/bienestar_ventas?select=monto_bienestar,fecha&mes=eq.'+mes
    const res=await fetch(url,{headers:{'apikey':'${SUPABASE_KEY}','Authorization':'Bearer ${SUPABASE_KEY}'}})
    const d=await res.json()
    if(Array.isArray(d)){
      // Solo ventas del día actual para comparar con Golan del día
      bienestarTotal=d.filter(v=>v.fecha===fecha).reduce((s,v)=>s+(v.monto_bienestar||0),0)
    }
  }catch{}
  try{
    const url2='${SUPABASE_URL}/rest/v1/sindicato_ventas?select=monto,fecha&fecha=eq.'+fecha
    const res2=await fetch(url2,{headers:{'apikey':'${SUPABASE_KEY}','Authorization':'Bearer ${SUPABASE_KEY}'}})
    const d2=await res2.json()
    if(Array.isArray(d2)){
      sindicatoTotal=d2.reduce((s,v)=>s+(v.monto||0),0)
    }
  }catch{}
  if(g('conv-bienestar'))g('conv-bienestar').textContent=fmt(bienestarTotal)
  if(g('conv-sindicato'))g('conv-sindicato').textContent=fmt(sindicatoTotal)
  alertaConvenios(bienestarTotal,sindicatoTotal)
}

function alertaConvenios(bienestar,sindicato){
  const chequeGolan=golan.cheque
  if(chequeGolan===0){
    if(g('alerta-conv-ok'))g('alerta-conv-ok').style.display='none'
    if(g('alerta-conv-bad'))g('alerta-conv-bad').style.display='none'
    if(g('conv-dif')){g('conv-dif').textContent='—';g('conv-dif').style.color='var(--t3)'}
    return
  }
  const totalConv=bienestar+sindicato
  const dif=chequeGolan-totalConv
  if(g('conv-dif')){
    g('conv-dif').textContent=(dif===0?'Sin diferencia ✓':(dif>0?'+':'')+fmt(dif))
    g('conv-dif').style.color=dif===0?'var(--green)':'var(--red)'
  }
  if(dif===0){
    if(g('alerta-conv-ok'))g('alerta-conv-ok').style.display='flex'
    if(g('alerta-conv-bad'))g('alerta-conv-bad').style.display='none'
  } else {
    if(g('alerta-conv-ok'))g('alerta-conv-ok').style.display='none'
    if(g('alerta-conv-bad'))g('alerta-conv-bad').style.display='block'
    const falta=Math.abs(dif)
    const tipo=dif>0?'falta por registrar':'está de más registrado'
    if(g('al-detalle')){
      g('al-detalle').innerHTML=
        'Golan registró <strong>'+fmt(chequeGolan)+'</strong> en Cheque 30 días.<br>'+
        'Bienestar del día: <strong>'+fmt(bienestar)+'</strong> · '+
        'Sindicato del día: <strong>'+fmt(sindicato)+'</strong> · '+
        'Total registrado: <strong>'+fmt(totalConv)+'</strong><br>'+
        '<strong>'+fmt(falta)+'</strong> '+tipo+'.'
    }
    if(g('al-solucion')){
      if(dif>0){
        g('al-solucion').innerHTML=
          '💡 <strong>Acción sugerida:</strong> Revisa si hay una boleta de Bienestar o Sindicato que no fue ingresada al sistema hoy. '+
          'Si el monto faltante corresponde a Bienestar, ve al módulo Bienestar y registra la venta pendiente. '+
          'Si es de Sindicato, ingresa la boleta en el módulo Sindicato.'
      } else {
        g('al-solucion').innerHTML=
          '💡 <strong>Acción sugerida:</strong> Hay más registrado en el sistema que lo que indica Golan. '+
          'Verifica que no haya una venta duplicada en Bienestar o Sindicato para la fecha de hoy.'
      }
    }
  }
}

// Gastos
let GS=[],GID=0
window._addGasto=function(){GS.push({id:++GID,desc:'',monto:0});renderGastos()}
function rmGasto(id){GS=GS.filter(x=>x.id!==id);renderGastos();window._recalc()}
function upG(id,k,v){const x=GS.find(g=>g.id===id);if(x)x[k]=v}
function renderGastos(){
  const el=g('gastos-list');if(!el)return
  el.innerHTML=GS.map(x=>\`
    <div class="gasto-row">
      <div class="f"><label>Descripción</label><input type="text" value="\${x.desc}" placeholder="ej: escoba, bolsas" oninput="upG(\${x.id},'desc',this.value)"></div>
      <div class="f"><label>Monto</label><input type="number" value="\${x.monto||''}" placeholder="0" oninput="upG(\${x.id},'monto',parseFloat(this.value)||0);window._recalc()"></div>
      <button class="btn-rm" onclick="rmGasto(\${x.id})">×</button>
    </div>\`).join('')
  if(g('b-gas'))g('b-gas').textContent=fmt(GS.reduce((s,x)=>s+x.monto,0))
}

window._togDep=function(){g('dep-inner').classList.toggle('on',g('chkdep').checked);window._recalc()}

window._recalcSumup=function(){
  const golanDC=golan.deb+golan.cred
  if(g('sumup-golan'))g('sumup-golan').textContent=fmt(golanDC)
  const su=gpn('sumup-total')
  if(!su){if(g('sumup-dif')){g('sumup-dif').textContent='—';g('sumup-dif').className='dif-badge dif-neu'}return}
  const dif=su-golanDC
  const el=g('sumup-dif');if(!el)return
  el.textContent=(dif>=0?'+':'')+fmt(dif)
  el.className='dif-badge '+(Math.abs(dif)<2000?'dif-ok':'dif-bad')
}

window._recalcTransf=function(){
  const real=gpn('transf-real')
  if(!real){if(g('transf-dif')){g('transf-dif').textContent='—';g('transf-dif').className='dif-badge dif-neu'}return}
  const dif=real-golan.transf
  const el=g('transf-dif');if(!el)return
  el.textContent=(dif>=0?'+':'')+fmt(dif)
  el.className='dif-badge '+(Math.abs(dif)<2000?'dif-ok':'dif-bad')
}

window._recalc=function(){
  const c1t=getTotalCaja(1),c2t=getTotalCaja(2)
  const c1f=gpn('c1fondo'),c2f=gpn('c2fondo')
  const c1n=Math.max(0,c1t-c1f),c2n=Math.max(0,c2t-c2f)
  const efReal=c1t+c2t,efNeto=c1n+c2n
  if(g('c1-dep'))g('c1-dep').textContent=fmt(c1n)
  if(g('c2-dep'))g('c2-dep').textContent=fmt(c2n)
  if(g('kv-ef'))g('kv-ef').textContent=fmt(efNeto)
  if(g('cmp-golan'))g('cmp-golan').textContent=fmt(golan.ef)
  if(g('cmp-real'))g('cmp-real').textContent=fmt(efReal)
  const difEf=efReal-golan.ef,hayG=golan.ef>0
  if(g('cmp-dif')){g('cmp-dif').textContent=hayG?(difEf>=0?'+':'')+fmt(difEf):'—';g('cmp-dif').style.color=hayG?(difEf===0?'var(--green)':'var(--red)'):'var(--t3)'}
  if(g('kv-dif')){
    g('kv-dif').textContent=hayG?(difEf>=0?'+':'')+fmt(difEf):'—'
    g('kv-dif').style.color=hayG?(difEf===0?'var(--green)':'var(--red)'):'var(--t3)'
    if(g('kv-dif-sub'))g('kv-dif-sub').textContent=!hayG?'Sube CSV Golan primero':difEf===0?'Sin diferencias ✓':difEf>0?'Más efectivo que Golan':'Menos efectivo que Golan'
  }
  if(g('b-gas'))g('b-gas').textContent=fmt(GS.reduce((s,x)=>s+x.monto,0))
  const dOk=g('chkdep')?.checked,dm=dOk?gpn('dm'):0
  if(dOk&&dm>0){
    const difDep=dm-efNeto
    const sb=g('status-box');if(sb){
      if(difEf===0&&Math.abs(difDep)<2000)sb.innerHTML='<div class="status-bar st-ok">✓ Cuadratura completa — efectivo y depósito cuadran perfectamente</div>'
      else{let msg='⚠ ';if(difEf!==0)msg+='Diferencia en efectivo: '+(difEf>=0?'+':'')+fmt(difEf);if(Math.abs(difDep)>=2000){if(difEf!==0)msg+=' · ';msg+='Diferencia en depósito: '+(difDep>=0?'+':'')+fmt(difDep)};sb.innerHTML='<div class="status-bar st-bad">'+msg+'</div>'}
    }
  } else {
    if(g('status-box'))g('status-box').innerHTML=''
  }
}

window._updDia=function(){
  const suc=document.getElementById('suc')?.value
  const convBox=document.getElementById('convenios-box')
  if(convBox)convBox.style.display=suc==='maipu'?'block':'none'
  const kvConv=document.getElementById('kv-conv')
  const kvConvSub=document.getElementById('kv-conv-sub')
  if(kvConv){
    const kpiConv=kvConv.closest('.kpi')
    if(kpiConv)kpiConv.style.display=suc==='maipu'?'block':'none'
  }
  const f=gv('fecha');if(f&&g('dianom'))g('dianom').textContent=dnom(f)
  window._verificarGuardado()
  actualizarConvenios()
}

window._verificarGuardado=async function(){
  const f=gv('fecha'),s=gv('suc');if(!f||!s)return
  const all=await getData()
  const existe=all.find(r=>(r.id||r.fecha+'_'+r.sucursal||r.fecha+'_'+r.suc)===(f+'_'+s)||(r.fecha===f&&(r.sucursal===s||r.suc===s)))
  if(g('ya-guardado'))g('ya-guardado').textContent=existe?'⚠ Ya existe un registro para esta fecha':''
}

window._guardar=async function(){
  const fecha=gv('fecha'),suc=gv('suc')
  const c1t=getTotalCaja(1),c2t=getTotalCaja(2)
  if(!fecha){toast('Debes ingresar la fecha antes de guardar');return}
  if(!c1t&&!c2t){toast('Debes ingresar el arqueo de efectivo en al menos una caja');return}
  const c1f=gpn('c1fondo'),c2f=gpn('c2fondo')
  const c1n=Math.max(0,c1t-c1f),c2n=Math.max(0,c2t-c2f)
  const billetes1={},billetes2={}
  BILLETES.forEach(b=>{billetes1[b]=parseInt(g('b1_'+b)?.value||'0')||0;billetes2[b]=parseInt(g('b2_'+b)?.value||'0')||0})
  const dOk=g('chkdep')?.checked
  const dep=dOk?{monto:gpn('dm'),banco:gv('db'),obs:gv('dobs')}:null
  const reg={
    id:fecha+'_'+suc,fecha,suc,
    c1:{billetes:billetes1,total:c1t,fondo:c1f,neto:c1n},
    c2:{billetes:billetes2,total:c2t,fondo:c2f,neto:c2n},
    efTotal:c1t+c2t,efNeto:c1n+c2n,
    golan:{...golan},difEf:(c1t+c2t)-golan.ef,
    sumup:gpn('sumup-total'),transfReal:gpn('transf-real'),
    dep,tg:GS.reduce((s,x)=>s+x.monto,0),
    gastos:GS.map(x=>({...x})),obs:gv('obs'),ts:Date.now()
  }
  const ok=await saveReg(reg)
  if(ok){toast('✓ Guardado — '+SN[suc]+' · '+dnom(fecha));window._limpiar()}
  else toast('Error al guardar — verifica la conexión')
}

window._limpiar=function(){
  BILLETES.forEach(b=>{[1,2].forEach(n=>{const e=g('b'+n+'_'+b);if(e)e.value='';const s=g('bs'+n+'_'+b);if(s)s.textContent=''})})
  ;['c1fondo','c2fondo','dm','dobs','obs','sumup-total','transf-real'].forEach(id=>{const e=g(id);if(e)e.value=''})
  const db=g('db');if(db)db.value='';const chk=g('chkdep');if(chk)chk.checked=false
  const di=g('dep-inner');if(di)di.classList.remove('on')
  golan={ef:0,efNeto:0,efBruto:0,deb:0,cred:0,transf:0,cheque:0,devTotal:0,totalVentas:0,convenios:0,total:0}
  ;[1,2].forEach(n=>{
    const z=g('zona'+n);if(z)z.classList.remove('cargada')
    const nb=g('nombre'+n);if(nb)nb.textContent='Importar Cierre Z — Caja '+n
    if(g('c'+n+'-total-disp'))g('c'+n+'-total-disp').textContent='$0'
    if(g('c'+n+'-dep'))g('c'+n+'-dep').textContent='$0'
  })
  const desg=g('golan-desglose');if(desg)desg.style.display='none'
  const p1=g('p1num');if(p1){p1.textContent='1';p1.classList.remove('done')}
  GS=[];GID=0;renderGastos()
  if(g('status-box'))g('status-box').innerHTML=''
  if(g('ya-guardado'))g('ya-guardado').textContent=''
  ;['sumup-dif','transf-dif'].forEach(id=>{const e=g(id);if(e){e.textContent='—';e.className='dif-badge dif-neu'}})
  ;['gv-ef','gv-deb','gv-cred','gv-transf','gv-cheque','gv-total'].forEach(id=>{const e=g(id);if(e)e.textContent='$0'})
  if(g('gv-dev'))g('gv-dev').textContent='$0'
  if(g('conv-golan'))g('conv-golan').textContent='$0'
  if(g('conv-dif')){g('conv-dif').textContent='—';g('conv-dif').style.color='var(--t3)'}
  if(g('alerta-conv-ok'))g('alerta-conv-ok').style.display='none'
  if(g('alerta-conv-bad'))g('alerta-conv-bad').style.display='none'
  if(g('kv-conv'))g('kv-conv').textContent='$0'
  window._recalc()
}

window._renderHist=async function(){
  const fs=gv('hist-suc')
  let all=await getData()
  all=all.map(r=>({...r,suc:r.suc||r.sucursal,efTotal:r.efTotal||r.efectivo_total||0,efNeto:r.efNeto||(r.c1_neto||0)+(r.c2_neto||0)||0,difEf:r.difEf||0,dep:r.dep||{monto:r.deposito_monto||0,banco:r.deposito_banco||''}}))
  if(fs)all=all.filter(r=>r.suc===fs)
  all.sort((a,b)=>b.fecha.localeCompare(a.fecha))
  const mes=hoy().slice(0,7),dm=all.filter(r=>r.fecha.startsWith(mes))
  if(g('hist-sub'))g('hist-sub').textContent=dm.length+' días este mes · Ef. acumulado: '+fmt(dm.reduce((s,r)=>s+r.efNeto,0))
  const el=g('hist-content');if(!el)return
  if(!all.length){el.innerHTML='<div class="empty">Sin registros — comienza ingresando la cuadratura del primer día</div>';return}
  const hd=r=>{const dep=r.dep?.monto||0;const difD=dep-(r.efNeto||0);const ok=r.difEf===0&&(dep===0||Math.abs(difD)<2000)
    return\`<tr>
      <td class="mono" style="font-size:11px">\${r.fecha}</td>
      <td style="font-size:11px;color:var(--t3)">\${dnom(r.fecha,true)}</td>
      <td><span class="bdg \${SC[r.suc]||''}">\${SN[r.suc]||r.suc}</span></td>
      <td class="mono" style="color:var(--blue)">\${fmt(r.golan?.totalVentas||r.golan_total||0)}</td>
      <td class="mono">\${fmt(r.efTotal)}</td>
      <td class="mono" style="color:var(--green);font-weight:500">\${fmt(r.efNeto)}</td>
      <td class="mono" style="color:\${r.difEf===0?'var(--green)':'var(--red)'}">\${(r.difEf>=0?'+':'')+fmt(r.difEf)}</td>
      <td class="mono" style="color:var(--amber)">\${fmt(r.golan?.cheque||r.golan_cheque||0)}</td>
      <td class="mono">\${dep>0?fmt(dep):'—'}</td>
      <td style="font-size:11px;color:var(--t3)">\${r.dep?.banco||r.deposito_banco||'—'}</td>
      <td><span class="bdg \${ok?'bdg-ok':dep===0?'bdg-pend':'bdg-bad'}">\${ok?'OK ✓':dep===0?'Sin depósito':'Revisar'}</span></td>
    </tr>\`
  }
  const totM=dm.reduce((s,r)=>s+(r.dep?.monto||r.deposito_monto||0),0)
  el.innerHTML='<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Fecha</th><th>Día</th><th>Sucursal</th><th>Golan total</th><th>Ef. real</th><th>A depositar</th><th>Dif. ef.</th><th>Cheque conv.</th><th>Depósito</th><th>Banco</th><th>Estado</th></tr></thead><tbody>'+all.map(hd).join('')+'</tbody><tfoot><tr style="background:var(--s2);font-weight:600"><td colspan="3" style="padding:10px 12px;font-size:12px">Total del Mes</td><td class="mono" style="padding:10px 12px;color:var(--blue)">'+fmt(dm.reduce((s,r)=>s+(r.golan?.totalVentas||r.golan_total||0),0))+'</td><td class="mono" style="padding:10px 12px">'+fmt(dm.reduce((s,r)=>s+r.efTotal,0))+'</td><td class="mono" style="padding:10px 12px;color:var(--green)">'+fmt(dm.reduce((s,r)=>s+r.efNeto,0))+'</td><td colspan="3" style="padding:10px 12px"></td><td colspan="2" style="padding:10px 12px;font-size:11px;color:var(--t2)">Depositado: '+fmt(totM)+'</td></tr></tfoot></table></div>'
}

window._exportCSV=async function(){
  const mes=hoy().slice(0,7),fs=gv('hist-suc')
  let all=(await getData()).filter(r=>r.fecha.startsWith(mes))
  all=all.map(r=>({...r,suc:r.suc||r.sucursal,efTotal:r.efTotal||r.efectivo_total||0,efNeto:r.efNeto||(r.c1_neto||0)+(r.c2_neto||0)||0}))
  if(fs)all=all.filter(r=>r.suc===fs)
  all.sort((a,b)=>a.fecha.localeCompare(b.fecha))
  if(!all.length){toast('No hay registros para exportar en este período');return}
  const rows=[['Día','Fecha','Sucursal','Caja 1 total','Caja 2 total','Ef. real','A depositar','Golan ef.','Golan total','Cheque conv.','Devoluciones','Dif. ef.','SumUp','Dif. SumUp','Transf. real','Dif. Transf.','Depósito','Banco','Nota dep.','Gastos','Observaciones']]
  all.forEach(r=>{
    const dep=r.dep?.monto||r.deposito_monto||0
    const golanDC=(r.golan?.deb||r.golan_deb||0)+(r.golan?.cred||r.golan_cred||0)
    const golanT=r.golan?.transf||r.golan_transf||0
    rows.push([dnom(r.fecha),r.fecha,SN[r.suc]||r.suc,r.c1?.total||r.c1_total||0,r.c2?.total||r.c2_total||0,r.efTotal,r.efNeto,r.golan?.ef||r.golan_ef||0,r.golan?.totalVentas||r.golan_total||0,r.golan?.cheque||r.golan_cheque||0,r.golan?.devTotal||r.golan_dev||0,r.difEf||0,r.sumup||0,(r.sumup||0)-golanDC,r.transfReal||0,(r.transfReal||0)-golanT,dep,r.dep?.banco||r.deposito_banco||'',r.dep?.obs||r.deposito_obs||'',r.tg||r.gastos_total||0,r.obs||r.observacion||''])
  })
  const csv=rows.map(r=>r.map(v=>'"'+v+'"').join(';')).join('\\n')
  const blob=new Blob(['\\uFEFF'+csv],{type:'text/csv;charset=utf-8'})
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='arqueo_biocuba_'+mes+'.csv';a.click()
  toast('Archivo CSV exportado correctamente')
}

window._renderDash=async function(){
  const fs=gv('dash-suc'),mes=hoy().slice(0,7)
  let all=(await getData()).filter(r=>r.fecha.startsWith(mes))
  all=all.map(r=>({...r,suc:r.suc||r.sucursal,efTotal:r.efTotal||r.efectivo_total||0,efNeto:r.efNeto||(r.c1_neto||0)+(r.c2_neto||0)||0}))
  if(fs)all=all.filter(r=>r.suc===fs)
  all.sort((a,b)=>a.fecha.localeCompare(b.fecha))
  const mn=new Date(mes+'-15').toLocaleDateString('es-CL',{month:'long',year:'numeric'})
  if(g('dash-titulo'))g('dash-titulo').textContent='Resumen — '+mn.charAt(0).toUpperCase()+mn.slice(1)
  const tG=all.reduce((s,r)=>s+(r.golan?.totalVentas||r.golan_total||0),0)
  const tEf=all.reduce((s,r)=>s+r.efNeto,0)
  const tDep=all.reduce((s,r)=>s+(r.dep?.monto||r.deposito_monto||0),0)
  const tCheque=all.reduce((s,r)=>s+(r.golan?.cheque||r.golan_cheque||0),0)
  const difM=tDep-tEf
  if(g('dash-kpis'))g('dash-kpis').innerHTML=
    '<div class="kpi"><div class="kpi-lbl">Venta Total Golan</div><div class="kpi-val" style="color:var(--blue)">'+fmt(tG)+'</div><div class="kpi-sub">'+all.length+' días con registro</div></div>'+
    '<div class="kpi"><div class="kpi-lbl">Efectivo Acumulado</div><div class="kpi-val" style="color:var(--green)">'+fmt(tEf)+'</div><div class="kpi-sub">Total a depositar</div></div>'+
    '<div class="kpi"><div class="kpi-lbl">Total Depositado</div><div class="kpi-val">'+fmt(tDep)+'</div><div class="kpi-sub">'+all.filter(r=>r.dep?.monto||r.deposito_monto>0).length+' depósitos</div></div>'+
    '<div class="kpi"><div class="kpi-lbl">Convenios Mes</div><div class="kpi-val" style="color:var(--amber)">'+fmt(tCheque)+'</div><div class="kpi-sub">Bienestar + Sindicato</div></div>'
  if(g('dash-cal')){
    const regs={};all.forEach(r=>regs[r.fecha]=r)
    const first=new Date(mes+'-01'),last=new Date(first.getFullYear(),first.getMonth()+1,0).getDate()
    const hoyStr=hoy()
    let cal='<div style="margin-top:20px;margin-bottom:8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--t2)">Calendario del Mes</div>'
    cal+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">'
    ;['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].forEach(d=>{cal+='<div style="text-align:center;font-size:10px;font-weight:600;color:var(--t3);padding:4px">'+d+'</div>'})
    const startDow=(first.getDay()+6)%7
    for(let i=0;i<startDow;i++)cal+='<div></div>'
    for(let d=1;d<=last;d++){
      const ds=mes+'-'+(d<10?'0'+d:d),r=regs[ds],isHoy=ds===hoyStr
      const dep=r?(r.dep?.monto||r.deposito_monto||0):0
      cal+='<div style="background:'+(r?'var(--gbg)':'#fff')+';border:'+(isHoy?'2px solid var(--blue)':'1px solid var(--bdr)')+';border-radius:8px;padding:8px 6px;text-align:center">'+
        '<div style="font-size:9px;color:var(--t3);margin-bottom:2px">'+DIAS_S[new Date(ds+'T12:00:00').getDay()]+'</div>'+
        '<div style="font-size:16px;font-weight:600;color:'+(isHoy?'var(--blue)':'var(--tx)')+'">'+d+'</div>'+
        (r?'<div style="font-family:var(--mono);font-size:9px;color:var(--green);margin-top:2px">'+fmt(r.efNeto)+'</div>'+
           '<div style="width:6px;height:6px;border-radius:50%;background:'+(dep>0?'var(--green)':'var(--amber)')+';margin:3px auto 0"></div>':
           '<div style="height:16px"></div>')+
        '</div>'
    }
    cal+='</div><div style="display:flex;gap:16px;margin-top:10px;font-size:11px;color:var(--t2)">'+
      '<span>🟢 Con depósito bancario</span><span>🟡 Pendiente de depósito</span><span>⬜ Sin registro de caja</span></div>'
    g('dash-cal').innerHTML=cal
  }
}

window._renderDepositos=async function(){
  const suc=document.getElementById('dep-suc')?.value||'maipu'
  const all=(await getData()).filter(r=>(r.suc||r.sucursal)===suc)
  all.sort((a,b)=>b.fecha.localeCompare(a.fecha))
  const mes=hoy().slice(0,7)
  const delMes=all.filter(r=>r.fecha.startsWith(mes))
  const pend=delMes.filter(r=>!r.dep?.monto&&!r.deposito_monto)
  const depd=delMes.filter(r=>r.dep?.monto||r.deposito_monto)
  const tPend=pend.reduce((s,r)=>s+(r.efNeto||(r.c1_neto||0)+(r.c2_neto||0)||0),0)
  const tDep=depd.reduce((s,r)=>s+(r.dep?.monto||r.deposito_monto||0),0)
  const tSel=[...window._depSel].reduce((s,id)=>{const r=delMes.find(x=>x.id===id||x.fecha+'_'+(x.suc||x.sucursal)===id);return s+(r?.efNeto||(r?.c1_neto||0)+(r?.c2_neto||0)||0)},0)
  if(g('dep-sub'))g('dep-sub').textContent=delMes.length+' días registrados este mes'
  if(g('dep-k-pend'))g('dep-k-pend').textContent=fmt(tPend)
  if(g('dep-k-dias'))g('dep-k-dias').textContent=pend.length+' días sin depositar'
  if(g('dep-k-sel'))g('dep-k-sel').textContent=fmt(tSel)
  if(g('dep-k-dep'))g('dep-k-dep').textContent=fmt(tDep)
  if(g('dep-k-ndep'))g('dep-k-ndep').textContent=depd.length+' depósito'+( depd.length!==1?'s':'')
  const lista=g('dep-lista');if(!lista)return
  if(!delMes.length){lista.innerHTML='<div class="empty">Sin registros este mes — ingresa el arqueo diario primero</div>';return}
  lista.innerHTML=[...pend,...depd].map(r=>{
    const id=r.id||r.fecha+'_'+(r.suc||r.sucursal)
    const ef=r.efNeto||(r.c1_neto||0)+(r.c2_neto||0)||0
    const isDep=!!(r.dep?.monto||r.deposito_monto)
    const isSel=window._depSel.has(id)
    const banco=r.dep?.banco||r.deposito_banco||''
    return\`<div class="dep-fila\${isDep?' depd':isSel?' sel':''}" onclick="\${isDep?'':('window._depTog(\''+id+'\')') }">
      <div class="dep-chk\${isSel&&!isDep?' on':''}">\${isSel&&!isDep?'✓':''}</div>
      <div>
        <div style="font-size:14px;font-weight:500;color:var(--tx)">\${dnom(r.fecha)} \${r.fecha.slice(8,10)}/\${r.fecha.slice(5,7)}</div>
        \${isDep?\`<div style="font-size:11px;color:var(--t3)">Depositado\${banco?' — '+banco:''}</div>\`:''}
      </div>
      <div style="font-size:16px;font-weight:500;font-family:var(--mono);text-align:right;color:\${isDep?'var(--t3)':'var(--tx)'}">$ \${Math.round(ef).toLocaleString('es-CL')}</div>
      <div style="text-align:right"><span class="bdg \${isDep?'bdg-ok':isSel?'bdg-ok':'bdg-pend'}">\${isDep?'Depositado':isSel?'Seleccionado':'Pendiente'}</span></div>
    </div>\`
  }).join('')
  renderDepPanel(delMes,tSel)
}

function renderDepPanel(delMes,tSel){
  const pb=g('dep-panel-body');if(!pb)return
  if(!window._depSel.size){
    pb.innerHTML='<div style="font-size:13px;color:var(--t3);padding:12px 0">Selecciona uno o más días de la lista para calcular el total a depositar.</div>'
    return
  }
  const selDias=[...window._depSel].map(id=>delMes.find(r=>(r.id||r.fecha+'_'+(r.suc||r.sucursal))===id)).filter(Boolean)
  pb.innerHTML=\`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;margin-bottom:10px;border-bottom:2px solid var(--bdr)">
      <span style="font-size:14px;font-weight:500">Total a depositar</span>
      <span style="font-size:26px;font-weight:500;font-family:var(--mono);color:var(--green)">\${fmt(tSel)}</span>
    </div>
    \${selDias.map(r=>{const ef=r.efNeto||(r.c1_neto||0)+(r.c2_neto||0)||0;return\`<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px"><span style="color:var(--t2)">\${dnom(r.fecha)} \${r.fecha.slice(8,10)}/\${r.fecha.slice(5,7)}</span><span style="font-family:var(--mono);font-weight:500">\${fmt(ef)}</span></div>\`}).join('')}
    <div style="font-size:11px;color:var(--t3);margin-top:6px;margin-bottom:16px">\${window._depSel.size} día\${window._depSel.size>1?'s':''} seleccionado\${window._depSel.size>1?'s':''}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      <div class="f"><label>Banco</label>
        <select id="dep-banco"><option value="">Seleccionar...</option><option>Banco de Chile</option><option>Itaú</option><option>Scotiabank</option><option>Santander</option><option>BCI</option><option>Banco Estado</option></select>
      </div>
      <div class="f"><label>Observación</label>
        <input type="text" id="dep-nota" placeholder="ej: incluye fin de semana">
      </div>
    </div>
    <button onclick="window._confirmarDep()" style="width:100%;padding:12px;border-radius:8px;border:none;background:var(--green);color:#fff;font-size:14px;font-weight:500;cursor:pointer">
      Confirmar depósito de \${fmt(tSel)}
    </button>
    <div style="background:var(--bbg);border:0.5px solid var(--bbdr);border-radius:8px;padding:12px 14px;margin-top:12px;font-size:12px;color:var(--blue)">
      Al confirmar, el depósito quedará registrado en Supabase y se buscará el abono correspondiente en Chipax para conciliar automáticamente.
    </div>\`
}

window._depSel=new Set()
window._depTog=function(id){
  if(window._depSel.has(id))window._depSel.delete(id);else window._depSel.add(id)
  if(g('dep-ok'))g('dep-ok').style.display='none'
  window._renderDepositos()
}
window._confirmarDep=async function(){
  const banco=gv('dep-banco')
  if(!banco){toast('Selecciona el banco antes de confirmar');return}
  const nota=gv('dep-nota')
  const suc=document.getElementById('dep-suc')?.value||'maipu'
  const all=await getData()
  const mes=hoy().slice(0,7)
  let totalDep=0
  const ids=[...window._depSel]
  for(const id of ids){
    const idx=all.findIndex(r=>(r.id||r.fecha+'_'+(r.suc||r.sucursal))===id)
    if(idx>=0){
      const ef=all[idx].efNeto||(all[idx].c1_neto||0)+(all[idx].c2_neto||0)||0
      totalDep+=ef
      all[idx].dep={monto:ef,banco,obs:nota}
      all[idx].deposito_monto=ef;all[idx].deposito_banco=banco;all[idx].deposito_obs=nota
    }
  }
  await setData(all)
  MEM=all
  window._depSel.clear()
  const ok=g('dep-ok');if(ok){ok.style.display='flex';document.getElementById('dep-ok-txt').textContent='Depósito de '+fmt(totalDep)+' registrado en '+banco}
  toast('✓ Depósito registrado — '+fmt(totalDep)+' en '+banco)
  window._renderDepositos()
}

window._setTab=function(name){
  ;['ingresar','depositos','historial','dashboard'].forEach(t=>{const el=g('tab-'+t);if(el)el.style.display='none'})
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('on'))
  const el=g('tab-'+name);if(el)el.style.display='block'
  const btn=g('tab-btn-'+name);if(btn)btn.classList.add('on')
  if(name==='historial')window._renderHist()
  if(name==='dashboard')window._renderDash()
  if(name==='depositos'){window._depSel=new Set();window._renderDepositos()}
}

window._initCuadratura=function(){
  // Retry buildBilletes hasta que el DOM esté listo
  function tryBuild(intentos){
    const el=g('billetes1')
    if(el){buildBilletes();window._recalc()}
    else if(intentos>0)setTimeout(()=>tryBuild(intentos-1),200)
  }
  tryBuild(10)
  const f=g('fecha')
  if(f){f.value=new Date().toISOString().split('T')[0];window._updDia()}
}

window._initCuadratura()
})()
      `}} />
    </>
  )
}
