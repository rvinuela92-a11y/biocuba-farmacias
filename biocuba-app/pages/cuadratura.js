import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL')
const hoy = () => new Date().toISOString().split('T')[0]
const SUCURSALES = { maipu: 'Maipú', sanbernardo: 'San Bernardo', providencia: 'Providencia', florida: 'La Florida' }

async function upsertCuadratura(data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/cuadratura`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(data)
  })
  return res.ok
}

async function getCuadratura(mes) {
  const desde = mes + '-01'
  const hasta = mes + '-31'
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/cuadratura?fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha.desc`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  )
  return res.json()
}

export default function Cuadratura() {
  const [tab, setTab] = useState('ingresar')
  const [sucursal, setSucursal] = useState('maipu')
  const [fecha, setFecha] = useState(hoy())
  const [form, setForm] = useState({ c1:'', f1:'', c2:'', f2:'', dm:'', db:'', dc:'', do_:'', obs:'' })
  const [depOk, setDepOk] = useState(false)
  const [gastos, setGastos] = useState([])
  const [golanData, setGolanData] = useState({ ef:0, deb:0, cred:0, transf:0, conv:0 })
  const [golanCargado, setGolanCargado] = useState([false, false])
  const [registros, setRegistros] = useState([])
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState('admin')
  const mesActual = new Date().toISOString().slice(0,7)

  useEffect(() => { if(tab==='historial') cargarRegistros() }, [tab])

  async function cargarRegistros() {
    const data = await getCuadratura(mesActual)
    setRegistros(Array.isArray(data) ? data : [])
  }

  const f = k => parseFloat((form[k]+'').replace(/[^\d.,]/g,'').replace(',','.'))||0
  const n1 = Math.max(0, f('c1')-f('f1'))
  const n2 = Math.max(0, f('c2')-f('f2'))
  const ef = n1+n2
  const dm = depOk ? (parseFloat(form.dm)||0) : 0
  const tg = gastos.reduce((s,g)=>s+g.monto,0)
  const golanTotal = golanData.ef+golanData.deb+golanData.cred+golanData.transf+golanData.conv
  const difDep = dm-ef
  const difGolan = ef-golanData.ef

  async function parsearCSV(file, cajaNum) {
    const text = await file.text()
    const lines = text.replace(/\r/g,'').split('\n')
    const result = { ef:0, deb:0, cred:0, transf:0, conv:0, total:0 }
    const monto = s => parseInt((s||'').replace(/[$.,]/g,'').trim())||0
    for(const line of lines) {
      const cols = line.split(',')
      const flat = cols.map(c=>c.trim())
      const tipo = flat[2]||''
      const val = (cols[8]||'').trim()
      if(tipo==='Efectivo' && val.startsWith('$')) result.ef=monto(val)
      if(tipo==='Tarjeta Crédito' && val.startsWith('$')) result.cred=monto(val)
      if(tipo==='Tarjeta Débito' && val.startsWith('$')) result.deb=monto(val)
      if(tipo.includes('Transfer') && val.startsWith('$')) result.transf=monto(val)
      if(tipo==='Total' && val.startsWith('$')) result.total=monto(val)
    }
    const nuevos = {...golanData}
    nuevos.ef += result.ef
    nuevos.deb += result.deb
    nuevos.cred += result.cred
    nuevos.transf += result.transf
    nuevos.conv += result.conv
    setGolanData(nuevos)
    const cargados = [...golanCargado]
    cargados[cajaNum-1] = true
    setGolanCargado(cargados)
  }

  async function guardar() {
    if(!ef) { alert('Ingresa el efectivo de al menos una caja'); return }
    setSaving(true)
    const data = {
      id: fecha+'_'+sucursal,
      fecha, sucursal,
      c1_total: f('c1'), c1_fondo: f('f1'), c1_neto: n1,
      c2_total: f('c2'), c2_fondo: f('f2'), c2_neto: n2,
      efectivo_total: ef,
      golan_ef: golanData.ef, golan_deb: golanData.deb, golan_cred: golanData.cred,
      golan_transf: golanData.transf, golan_conv: golanData.conv, golan_total: golanTotal,
      deposito_monto: dm, deposito_banco: form.db, deposito_comp: form.dc, deposito_obs: form.do_,
      gastos: JSON.stringify(gastos), gastos_total: tg,
      observacion: form.obs, guardado_por: user,
      updated_at: new Date().toISOString()
    }
    const ok = await upsertCuadratura(data)
    setSaving(false)
    if(ok) { alert('✓ Cuadratura guardada — '+SUCURSALES[sucursal]); limpiar() }
    else alert('Error al guardar')
  }

  function limpiar() {
    setForm({ c1:'', f1:'', c2:'', f2:'', dm:'', db:'', dc:'', do_:'', obs:'' })
    setDepOk(false); setGastos([])
    setGolanData({ ef:0, deb:0, cred:0, transf:0, conv:0 })
    setGolanCargado([false,false])
  }

  const inp = (id, label, type='number', ph='0') => (
    <div style={{display:'flex',flexDirection:'column',gap:4}}>
      <label style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.5,color:'#6a6858'}}>{label}</label>
      <input type={type} value={form[id]} onChange={e=>setForm({...form,[id]:e.target.value})}
        placeholder={ph} style={{fontFamily:type==='number'?'DM Mono,monospace':'inherit',fontSize:13,padding:'8px 11px',border:'1px solid #e3e1d8',borderRadius:7,width:'100%',outline:'none'}}/>
    </div>
  )

  const card = (label, val, color='#1a1910') => (
    <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:'13px 15px'}}>
      <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.5,color:'#9b9880',marginBottom:5}}>{label}</div>
      <div style={{fontSize:20,fontWeight:600,fontFamily:'DM Mono,monospace',color}}>{val}</div>
    </div>
  )

  return (
    <>
      <Head><title>Cuadratura — BioCuba</title></Head>
      <div style={{minHeight:'100vh',background:'#f4f3ef',fontFamily:"'DM Sans',sans-serif"}}>

        {/* HEADER */}
        <div style={{background:'#fff',borderBottom:'2.5px solid #e53030',padding:'0 24px',display:'flex',alignItems:'center',justifyContent:'space-between',minHeight:54}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <Link href="/" style={{fontSize:12,color:'#6a6858',textDecoration:'none'}}>← Inicio</Link>
            <div style={{width:1,height:20,background:'#e3e1d8'}}></div>
            <span style={{fontSize:14,fontWeight:500}}>Cuadratura de caja</span>
            <span style={{fontSize:11,fontWeight:500,padding:'3px 10px',borderRadius:20,background:'#e8f4ee',color:'#2a5c3a'}}>
              {SUCURSALES[sucursal]}
            </span>
          </div>
          <div style={{display:'flex',gap:4}}>
            {['ingresar','historial'].map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{fontFamily:'inherit',fontSize:12,fontWeight:500,
                padding:'10px 16px',border:'none',background:'transparent',color:tab===t?'#1a3fa0':'#6a6858',
                borderBottom:tab===t?'2px solid #1a3fa0':'2px solid transparent',cursor:'pointer'}}>
                {t==='ingresar'?'Ingresar día':'Historial'}
              </button>
            ))}
          </div>
        </div>

        <div style={{padding:'24px 20px 80px',maxWidth:880,margin:'0 auto'}}>
          {tab==='ingresar' && (
            <>
              {/* Controles */}
              <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap',alignItems:'center',
                background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:'12px 16px'}}>
                <select value={sucursal} onChange={e=>setSucursal(e.target.value)}
                  style={{fontFamily:'inherit',fontSize:13,padding:'7px 11px',border:'1px solid #e3e1d8',borderRadius:7,background:'#fff'}}>
                  {Object.entries(SUCURSALES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
                <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
                  style={{fontFamily:'inherit',fontSize:13,padding:'7px 11px',border:'1px solid #e3e1d8',borderRadius:7}}/>
                <span style={{fontSize:12,color:'#9b9880'}}>
                  {['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][new Date(fecha+'T12:00:00').getDay()]}
                </span>
              </div>

              {/* KPIs */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
                {card('Venta total c/IVA (Golan)', fmt(golanTotal), '#2a5c3a')}
                {card('Efectivo a depositar', fmt(ef))}
                {card('Dif. Golan vs real', fmt(ef-golanData.ef), Math.abs(ef-golanData.ef)<2000?'#2a5c3a':'#c0392b')}
                {card('Dif. con depósito', dm>0?(difDep>=0?'+':'')+fmt(difDep):'—', dm>0&&Math.abs(difDep)<2000?'#2a5c3a':'#9b9880')}
              </div>

              {/* Upload CSV Golan */}
              <div style={{background:'#eef3fc',border:'1px solid #c5d8f5',borderRadius:10,padding:16,marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:.5,color:'#1a4a8a',marginBottom:12}}>
                  Cierre Z de Golan — subir CSV
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {[1,2].map(n=>(
                    <label key={n} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
                      background:golanCargado[n-1]?'#e8f4ee':'#fff',
                      border:golanCargado[n-1]?'1.5px solid #aed0b8':'1.5px dashed #8ab4e8',
                      borderRadius:8,cursor:'pointer'}}>
                      <span style={{fontSize:20}}>📂</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:500,color:golanCargado[n-1]?'#2a5c3a':'#1a4a8a'}}>
                          {golanCargado[n-1]?'✓ Caja '+n+' cargada':'Subir CSV Caja '+n}
                        </div>
                        <div style={{fontSize:11,color:'#9b9880'}}>Exportar desde Golan → CSV</div>
                      </div>
                      <input type="file" accept=".csv" style={{display:'none'}}
                        onChange={e=>e.target.files[0]&&parsearCSV(e.target.files[0],n)}/>
                    </label>
                  ))}
                </div>
                {golanCargado.some(Boolean) && (
                  <div style={{marginTop:12,display:'flex',gap:16,fontSize:12,color:'#1a4a8a',flexWrap:'wrap'}}>
                    <span>Ef: {fmt(golanData.ef)}</span>
                    <span>Déb: {fmt(golanData.deb)}</span>
                    <span>Créd: {fmt(golanData.cred)}</span>
                    {golanData.transf>0&&<span>Transf: {fmt(golanData.transf)}</span>}
                    <span style={{fontWeight:600}}>Total: {fmt(golanTotal)}</span>
                  </div>
                )}
              </div>

              {/* Cajas */}
              <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:16,marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:.5,color:'#6a6858',marginBottom:12,paddingBottom:8,borderBottom:'1px solid #e3e1d8'}}>
                  Efectivo en cajas — conteo real
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {[1,2].map(n=>(
                    <div key={n} style={{background:'#f4f3ef',borderRadius:9,padding:'13px 15px'}}>
                      <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',color:'#6a6858',marginBottom:10}}>Caja {n}</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                        {inp('c'+n,'Total contado')}
                        {inp('f'+n,'Fondo de caja')}
                      </div>
                      <div style={{fontSize:12,fontFamily:'DM Mono,monospace',color:'#6a6858',textAlign:'right',marginTop:8}}>
                        Neto: {fmt(n===1?n1:n2)}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:10,color:'#9b9880',marginTop:8}}>Neto = Total contado − Fondo de caja</div>
              </div>

              {/* Depósito */}
              <div style={{background:'#fef8ec',border:'1px solid #e8d5a3',borderRadius:10,padding:16,marginBottom:16}}>
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,fontWeight:500,color:'#7a5100',marginBottom:depOk?14:0,userSelect:'none'}}>
                  <input type="checkbox" checked={depOk} onChange={e=>setDepOk(e.target.checked)}
                    style={{accentColor:'#7a5100',width:15,height:15,cursor:'pointer'}}/>
                  Se realizó depósito hoy
                </label>
                {depOk && (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
                    {inp('dm','Monto depositado')}
                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                      <label style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.5,color:'#6a6858'}}>Banco</label>
                      <select value={form.db} onChange={e=>setForm({...form,db:e.target.value})}
                        style={{fontFamily:'inherit',fontSize:13,padding:'8px 11px',border:'1px solid #e3e1d8',borderRadius:7,background:'#fff'}}>
                        <option value=''>Seleccionar...</option>
                        {['Banco de Chile','Itaú','Scotiabank','Santander','BCI','Banco Estado'].map(b=><option key={b}>{b}</option>)}
                      </select>
                    </div>
                    {inp('dc','Comprobante (opc.)','text','')}
                  </div>
                )}
                {depOk && inp('do_','Nota del depósito (opc.)','text','ej: incluye sábado y domingo')}
              </div>

              {/* Gastos */}
              <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:16,marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,paddingBottom:8,borderBottom:'1px solid #e3e1d8'}}>
                  <span style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:.5,color:'#6a6858'}}>Gastos del local</span>
                  <span style={{fontSize:11,color:'#9b9880',fontFamily:'DM Mono,monospace',background:'#f4f3ef',padding:'2px 10px',borderRadius:20}}>{fmt(tg)}</span>
                </div>
                {gastos.map((g,i)=>(
                  <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 120px 34px',gap:8,marginBottom:8,alignItems:'end'}}>
                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                      <label style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.5,color:'#6a6858'}}>Descripción</label>
                      <input value={g.desc} onChange={e=>{const ng=[...gastos];ng[i]={...ng[i],desc:e.target.value};setGastos(ng)}}
                        placeholder="ej: escoba" style={{fontFamily:'inherit',fontSize:13,padding:'8px 11px',border:'1px solid #e3e1d8',borderRadius:7,width:'100%'}}/>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                      <label style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.5,color:'#6a6858'}}>Monto</label>
                      <input type="number" value={g.monto} onChange={e=>{const ng=[...gastos];ng[i]={...ng[i],monto:parseFloat(e.target.value)||0};setGastos(ng)}}
                        placeholder="0" style={{fontFamily:'DM Mono,monospace',fontSize:13,padding:'8px 11px',border:'1px solid #e3e1d8',borderRadius:7,width:'100%'}}/>
                    </div>
                    <button onClick={()=>setGastos(gastos.filter((_,j)=>j!==i))}
                      style={{width:34,height:34,borderRadius:6,border:'1px solid #e3e1d8',background:'#fff',cursor:'pointer',fontSize:18,color:'#9b9880',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                  </div>
                ))}
                <button onClick={()=>setGastos([...gastos,{desc:'',monto:0}])}
                  style={{fontFamily:'inherit',fontSize:12,padding:'7px 14px',borderRadius:6,border:'1px dashed #c8c5bb',background:'transparent',color:'#6a6858',cursor:'pointer',marginTop:4}}>
                  + Agregar gasto
                </button>
              </div>

              {/* Obs */}
              <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:16,marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:.5,color:'#6a6858',marginBottom:8}}>Observaciones</div>
                <textarea value={form.obs} onChange={e=>setForm({...form,obs:e.target.value})} rows={3}
                  placeholder="Novedades, diferencias, incidentes..."
                  style={{width:'100%',fontFamily:'inherit',fontSize:13,padding:'8px 11px',border:'1px solid #e3e1d8',borderRadius:7,resize:'vertical'}}/>
              </div>

              {/* Status */}
              {dm>0 && (
                <div style={{padding:'12px 16px',borderRadius:9,marginBottom:16,fontSize:13,fontWeight:500,
                  background:Math.abs(difDep)<2000?'#e8f4ee':'#fde8e8',
                  border:Math.abs(difDep)<2000?'1px solid #aed0b8':'1px solid #e8aaaa',
                  color:Math.abs(difDep)<2000?'#2a5c3a':'#8b1a1a'}}>
                  {Math.abs(difDep)<2000?'✓ Cuadratura OK':'⚠ Diferencia de '+fmt(Math.abs(difDep))+' — revisar antes de guardar'}
                </div>
              )}

              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                <span style={{fontSize:11,color:'#9b9880'}}>Datos guardados en Supabase</span>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={limpiar} style={{fontFamily:'inherit',fontSize:12,padding:'9px 18px',borderRadius:8,border:'1px solid #c8c5bb',background:'transparent',color:'#6a6858',cursor:'pointer'}}>Limpiar</button>
                  <button onClick={guardar} disabled={saving} style={{fontFamily:'inherit',fontSize:13,fontWeight:600,padding:'11px 28px',borderRadius:8,border:'none',background:'#1a1916',color:'#fff',cursor:saving?'not-allowed':'pointer',opacity:saving?.5:1}}>
                    {saving?'Guardando...':'Guardar cuadratura'}
                  </button>
                </div>
              </div>
            </>
          )}

          {tab==='historial' && (
            <>
              <div style={{fontSize:16,fontWeight:500,marginBottom:16}}>Historial del mes</div>
              {registros.length===0 ? (
                <div style={{textAlign:'center',padding:40,color:'#9b9880',fontSize:13,border:'1px dashed #e3e1d8',borderRadius:10}}>Sin registros este mes</div>
              ) : (
                <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,overflow:'hidden'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead>
                      <tr style={{background:'#f4f3ef'}}>
                        {['Fecha','Sucursal','Venta Golan','Efectivo','Depósito','Dif.','Estado'].map(h=>(
                          <th key={h} style={{textAlign:'left',padding:'8px 12px',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.5,color:'#9b9880',borderBottom:'1px solid #e3e1d8'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map(r=>{
                        const difD=r.deposito_monto-r.efectivo_total
                        return <tr key={r.id} style={{borderBottom:'1px solid #e3e1d8'}}>
                          <td style={{padding:'9px 12px',fontFamily:'DM Mono,monospace',fontSize:11}}>{r.fecha}</td>
                          <td style={{padding:'9px 12px'}}><span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontWeight:500,background:'#eef3fc',color:'#1a4a8a'}}>{SUCURSALES[r.sucursal]||r.sucursal}</span></td>
                          <td style={{padding:'9px 12px',fontFamily:'DM Mono,monospace',color:'#2a5c3a'}}>{fmt(r.golan_total)}</td>
                          <td style={{padding:'9px 12px',fontFamily:'DM Mono,monospace'}}>{fmt(r.efectivo_total)}</td>
                          <td style={{padding:'9px 12px',fontFamily:'DM Mono,monospace'}}>{r.deposito_monto>0?fmt(r.deposito_monto)+(r.deposito_banco?' · '+r.deposito_banco:''):'—'}</td>
                          <td style={{padding:'9px 12px',fontFamily:'DM Mono,monospace',color:r.deposito_monto>0?(Math.abs(difD)<2000?'#2a5c3a':'#c0392b'):'#9b9880'}}>{r.deposito_monto>0?(difD>=0?'+':'')+fmt(difD):'—'}</td>
                          <td style={{padding:'9px 12px'}}><span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontWeight:500,background:r.deposito_monto>0&&Math.abs(difD)<2000?'#e8f4ee':r.deposito_monto===0?'#f4f3ef':'#fde8e8',color:r.deposito_monto>0&&Math.abs(difD)<2000?'#2a5c3a':r.deposito_monto===0?'#6a6858':'#8b1a1a'}}>{r.deposito_monto>0?(Math.abs(difD)<2000?'OK':'Revisar'):'Pendiente'}</span></td>
                        </tr>
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
