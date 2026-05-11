import { useState, useEffect } from 'react'
import Head from 'next/head'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const fmt = n => new Intl.NumberFormat('es-CL', {style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n||0)

async function query(table, select='*', filters={}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`
  Object.entries(filters).forEach(([k,v]) => url += `&${k}=eq.${v}`)
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  })
  return res.json()
}

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [colaboradores, setColaboradores] = useState([])
  const [periodos, setPeriodos] = useState([])
  const [mesActivo, setMesActivo] = useState('')
  const [ventas, setVentas] = useState([])
  const [bonosQF, setBonosQF] = useState([])
  const [anticipos, setAnticipos] = useState([])
  const [horas, setHoras] = useState([])
  const [activeSection, setActiveSection] = useState('dashboard')
  const [error, setError] = useState(null)

  useEffect(() => { initApp() }, [])
  useEffect(() => { if(mesActivo) loadDatosMes() }, [mesActivo])

  async function initApp() {
    try {
      const [cols, pers] = await Promise.all([
        query('colaboradores', '*'),
        query('periodos', '*')
      ])
      if(cols.error) { setError('conexion'); setLoading(false); return }
      setColaboradores(cols||[])
      const sorted = (pers||[]).sort((a,b)=>b.año-a.año||(b.mes||0)-(a.mes||0))
      setPeriodos(sorted)
      if(sorted.length) setMesActivo(sorted[0].mes_label)
      setLoading(false)
    } catch(e) {
      setError('conexion')
      setLoading(false)
    }
  }

  async function loadDatosMes() {
    const periodo = periodos.find(p=>p.mes_label===mesActivo)
    if(!periodo) return
    const pid = periodo.id
    const [v, q, a, h] = await Promise.all([
      query('ventas','*',{periodo_id:pid}),
      query('bonos_qf','*',{periodo_id:pid}),
      query('anticipos','*',{periodo_id:pid}),
      query('horas_extra','*',{periodo_id:pid}),
    ])
    setVentas(v||[])
    setBonosQF(q||[])
    setAnticipos(a||[])
    setHoras(h||[])
  }

  const auxActivos = colaboradores.filter(c=>c.rol==='auxiliar'&&c.estado==='activo')
  const tAux = ventas.reduce((s,v)=>s+v.bono,0)
  const tQF = bonosQF.reduce((s,q)=>s+q.bono,0)
  const tHrs = horas.reduce((s,h)=>s+h.cantidad,0)
  const tAnt = anticipos.reduce((s,a)=>s+a.monto,0)

  const navItems = [
    {id:'dashboard',label:'Inicio',icon:'⊞'},
    {id:'resumen',label:'Resumen del mes',icon:'📋'},
    {id:'desempeno',label:'Desempeño',icon:'📈'},
    {id:'colaboradores',label:'Colaboradores',icon:'👤'},
    {id:'exportar',label:'Exportar',icon:'⬇'},
    {id:'ajustes',label:'Ajustes',icon:'⚙️'},
  ]

  const titles = {
    dashboard:'Inicio',resumen:'Resumen del mes',desempeno:'Desempeño',
    colaboradores:'Colaboradores',exportar:'Exportar',ajustes:'Ajustes'
  }

  if(loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16,fontFamily:'DM Sans,sans-serif'}}>
      <div style={{width:36,height:36,border:'3px solid #e3e1d8',borderTop:'3px solid #2a5c3a',borderRadius:'50%',animation:'spin 1s linear infinite'}}></div>
      <p style={{color:'#6a6858',fontSize:14}}>Cargando BioCuba Farmacia...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if(error) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'DM Sans,sans-serif'}}>
      <div style={{background:'#fde8e8',border:'1px solid #e8aaaa',borderRadius:10,padding:24,maxWidth:400,textAlign:'center'}}>
        <div style={{fontSize:24,marginBottom:8}}>⚠️</div>
        <h2 style={{color:'#8b1a1a',marginBottom:8}}>Error de conexión</h2>
        <p style={{color:'#6a6858',fontSize:13}}>No se pudo conectar a la base de datos. Verifique las variables de entorno en Vercel.</p>
      </div>
    </div>
  )

  return (
    <>
      <Head>
        <title>BioCuba Farmacia — Gestión</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap"/>
      </Head>
      <div style={{display:'flex',minHeight:'100vh',fontFamily:"'DM Sans',sans-serif",background:'#f4f3ef'}}>

        {/* SIDEBAR */}
        <aside style={{width:210,background:'#fff',borderRight:'1px solid #e3e1d8',display:'flex',flexDirection:'column',position:'sticky',top:0,height:'100vh'}}>
          <div style={{padding:'14px 16px 10px',borderBottom:'1px solid #e3e1d8'}}>
            <div style={{fontSize:14,fontWeight:600}}>BioCuba Farmacia</div>
            <div style={{fontSize:11,color:'#9b9880'}}>Gestión de sueldos</div>
          </div>
          <nav style={{padding:'8px 7px',flex:1}}>
            {navItems.map(item=>(
              <button key={item.id} onClick={()=>setActiveSection(item.id)}
                style={{display:'flex',alignItems:'center',gap:8,padding:'7px 9px',borderRadius:6,
                  cursor:'pointer',color:activeSection===item.id?'#2a5c3a':'#6a6858',
                  fontSize:13,border:'none',background:activeSection===item.id?'#e5f0e8':'none',
                  fontWeight:activeSection===item.id?500:400,width:'100%',textAlign:'left',
                  marginBottom:2,fontFamily:'inherit'}}>
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
          <div style={{padding:10,borderTop:'1px solid #e3e1d8',fontSize:11,color:'#9b9880'}}>
            <div>{mesActivo}</div>
            <div>{colaboradores.filter(c=>c.estado==='activo').length} activos</div>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{flex:1,display:'flex',flexDirection:'column'}}>
          <div style={{background:'#fff',borderBottom:'1px solid #e3e1d8',padding:'11px 22px',
            display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:20}}>
            <div style={{fontSize:15,fontWeight:600}}>{titles[activeSection]}</div>
            <select value={mesActivo} onChange={e=>{setMesActivo(e.target.value)}}
              style={{fontSize:13,padding:'6px 10px',border:'1px solid #ccc9bc',borderRadius:6,fontFamily:'inherit',background:'#fff'}}>
              {periodos.map(p=><option key={p.id}>{p.mes_label}</option>)}
            </select>
          </div>

          <div style={{padding:'18px 22px'}}>

            {/* DASHBOARD */}
            {activeSection==='dashboard' && (
              <div>
                {/* Stats */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:16}}>
                  {[
                    {label:'Bonos auxiliares',val:fmt(tAux)},
                    {label:'Bonos QF',val:fmt(tQF)},
                    {label:'Horas extra',val:tHrs+' hrs'},
                    {label:'Anticipos',val:fmt(tAnt),red:true},
                    {label:'Activos',val:colaboradores.filter(c=>c.estado==='activo').length},
                  ].map(s=>(
                    <div key={s.label} style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:'12px 14px'}}>
                      <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.5,color:'#9b9880',marginBottom:4}}>{s.label}</div>
                      <div style={{fontSize:20,fontWeight:600,fontFamily:'DM Mono',color:s.red?'#8b1a1a':'#1a1910'}}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* Estado auxiliares */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:'16px 18px'}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>👥 Auxiliares — {mesActivo}</div>
                    {auxActivos.length===0 && <div style={{color:'#9b9880',fontSize:13}}>Sin auxiliares activos</div>}
                    {auxActivos.map(c=>{
                      const v = ventas.find(x=>x.colaborador_id===c.id)
                      return (
                        <div key={c.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid #e3e1d8'}}>
                          <div style={{width:8,height:8,borderRadius:'50%',background:v?'#2a5c3a':c.ausencia?'#7a4e00':'#ccc9bc',flexShrink:0}}></div>
                          <div style={{flex:1,fontSize:13}}>{c.nombre} {c.apellido}</div>
                          {v?<span style={{fontSize:12,fontFamily:'DM Mono',color:'#2a5c3a'}}>{fmt(v.venta_neta)}</span>
                            :c.ausencia?<span style={{fontSize:11,color:'#7a4e00'}}>{c.ausencia}</span>
                            :<span style={{fontSize:11,color:'#9b9880'}}>Sin ingresar</span>}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:'16px 18px'}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>⚡ Acciones rápidas</div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {[
                        {label:'Ver resumen del mes',sec:'resumen',color:'#2a5c3a',bg:'#e5f0e8',border:'#aed0b8'},
                        {label:'Ver colaboradores',sec:'colaboradores',color:'#1a1910',bg:'#fff',border:'#ccc9bc'},
                        {label:'Exportar para contadora',sec:'exportar',color:'#1c3a5e',bg:'#e4edf5',border:'#adc5de'},
                      ].map(a=>(
                        <button key={a.sec} onClick={()=>setActiveSection(a.sec)}
                          style={{padding:'9px 14px',borderRadius:6,fontSize:13,cursor:'pointer',
                            border:`1px solid ${a.border}`,background:a.bg,color:a.color,fontFamily:'inherit',textAlign:'left'}}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RESUMEN */}
            {activeSection==='resumen' && (
              <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:'16px 18px'}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>📋 {mesActivo}</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr>{['Colaborador','Local','Rol','Venta neta','Bono'].map(h=>(
                        <th key={h} style={{textAlign:'left',padding:'7px 10px',fontSize:10,fontWeight:600,
                          textTransform:'uppercase',letterSpacing:.5,color:'#9b9880',
                          borderBottom:'1px solid #e3e1d8',background:'#f0efe9'}}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {ventas.map((v,i)=>{
                        const c = colaboradores.find(x=>x.id===v.colaborador_id)
                        return <tr key={i}>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8',fontWeight:500}}>{c?.nombre} {c?.apellido}</td>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8'}}>{v.local}</td>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8'}}><span style={{background:'#e4edf5',color:'#1c3a5e',padding:'2px 8px',borderRadius:20,fontSize:11}}>Auxiliar</span></td>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8',fontFamily:'DM Mono'}}>{fmt(v.venta_neta)}</td>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8',fontFamily:'DM Mono',color:'#2a5c3a',fontWeight:600}}>{fmt(v.bono)}</td>
                        </tr>
                      })}
                      {bonosQF.map((q,i)=>{
                        const c = colaboradores.find(x=>x.id===q.colaborador_id)
                        return <tr key={'qf'+i}>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8',fontWeight:500}}>{c?.nombre} {c?.apellido}</td>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8'}}>{q.local}</td>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8'}}><span style={{background:'#ede8f5',color:'#44277a',padding:'2px 8px',borderRadius:20,fontSize:11}}>QF titular</span></td>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8',fontFamily:'DM Mono'}}>—</td>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8',fontFamily:'DM Mono',color:'#2a5c3a',fontWeight:600}}>{fmt(q.bono)}</td>
                        </tr>
                      })}
                      {ventas.length===0&&bonosQF.length===0&&<tr><td colSpan={5} style={{padding:24,textAlign:'center',color:'#9b9880'}}>Sin datos para este período</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* COLABORADORES */}
            {activeSection==='colaboradores' && (
              <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:'16px 18px'}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Colaboradores ({colaboradores.length})</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr>{['Nombre','RUT','Local','Rol','Estado'].map(h=>(
                        <th key={h} style={{textAlign:'left',padding:'7px 10px',fontSize:10,fontWeight:600,
                          textTransform:'uppercase',letterSpacing:.5,color:'#9b9880',
                          borderBottom:'1px solid #e3e1d8',background:'#f0efe9'}}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {colaboradores.map(c=>(
                        <tr key={c.id}>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8',fontWeight:500}}>{c.nombre} {c.apellido}</td>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8',fontFamily:'DM Mono',fontSize:11,color:'#6a6858'}}>{c.rut||'—'}</td>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8'}}>{c.local||'—'}</td>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8'}}>
                            <span style={{background:c.rol==='auxiliar'?'#e4edf5':'#ede8f5',color:c.rol==='auxiliar'?'#1c3a5e':'#44277a',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500}}>
                              {c.rol==='auxiliar'?'Auxiliar':c.rol==='qf'?'QF titular':'QF compl.'}
                            </span>
                          </td>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8'}}>
                            <span style={{background:c.estado==='activo'?'#e5f0e8':'#fde8e8',color:c.estado==='activo'?'#2a5c3a':'#8b1a1a',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500}}>
                              {c.estado==='activo'?'Activo':c.ausencia||'Inactivo'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* EXPORTAR */}
            {activeSection==='exportar' && (
              <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:'16px 18px'}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Exportar — {mesActivo}</div>
                <div style={{fontSize:13,color:'#6a6858',marginBottom:16}}>Resumen para la contadora</div>
                <button onClick={()=>{
                  let csv='Nombre,Apellido,RUT,Local,Rol,Venta Neta,Bono\n'
                  ventas.forEach(v=>{const c=colaboradores.find(x=>x.id===v.colaborador_id);csv+=`"${c?.nombre}","${c?.apellido}","${c?.rut||''}","${v.local}","Auxiliar",${v.venta_neta},${v.bono}\n`})
                  bonosQF.forEach(q=>{const c=colaboradores.find(x=>x.id===q.colaborador_id);csv+=`"${c?.nombre}","${c?.apellido}","${c?.rut||''}","${q.local}","QF titular","",${q.bono}\n`})
                  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));a.download=`Reporte_${mesActivo}.csv`;a.click()
                }} style={{background:'#1c3a5e',color:'#fff',border:'none',padding:'9px 18px',borderRadius:6,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
                  ⬇ Descargar CSV
                </button>
              </div>
            )}

            {/* AJUSTES */}
            {activeSection==='ajustes' && (
              <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:'16px 18px'}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>⚙️ Ajustes</div>
                <div style={{fontSize:13,color:'#6a6858',marginBottom:8}}>Base de datos: Supabase ✓</div>
                <div style={{fontSize:13,color:'#6a6858'}}>Colaboradores: {colaboradores.length} | Períodos: {periodos.length}</div>
              </div>
            )}

            {activeSection==='desempeno' && (
              <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:40,textAlign:'center'}}>
                <div style={{fontSize:32,marginBottom:12}}>📈</div>
                <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>Desempeño</div>
                <div style={{fontSize:13,color:'#6a6858'}}>Este módulo se construirá en la próxima actualización.</div>
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  )
}
