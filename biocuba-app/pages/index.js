import { useState, useEffect } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

const fmt = n => new Intl.NumberFormat('es-CL', {style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n||0)

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [colaboradores, setColaboradores] = useState([])
  const [activeSection, setActiveSection] = useState('dashboard')
  const [mesActivo, setMesActivo] = useState('')
  const [meses, setMeses] = useState([])
  const [stats, setStats] = useState({bonosAux:0,bonosQF:0,horas:0,anticipos:0})
  const [ventas, setVentas] = useState([])
  const [bonosQF, setBonosQF] = useState([])
  const [anticipos, setAnticipos] = useState([])
  const [horas, setHoras] = useState([])
  const [dbReady, setDbReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    initApp()
  }, [])

  async function initApp() {
    try {
      // Test connection
      const { data, error } = await supabase.from('colaboradores').select('count').limit(1)
      if (error && error.code === '42P01') {
        setError('base_de_datos')
        setLoading(false)
        return
      }
      setDbReady(true)
      await loadColaboradores()
      await loadMeses()
      setLoading(false)
    } catch(e) {
      setError('conexion')
      setLoading(false)
    }
  }

  async function loadColaboradores() {
    const { data } = await supabase.from('colaboradores').select('*').order('nombre')
    if (data) setColaboradores(data)
  }

  async function loadMeses() {
    const { data } = await supabase.from('periodos').select('*').order('año', {ascending:false}).order('mes', {ascending:false})
    if (data && data.length) {
      setMeses(data.map(p => p.mes_label))
      setMesActivo(data[0].mes_label)
      await loadDatosMes(data[0].id)
    } else {
      // Crear mes actual
      const hoy = new Date()
      const mesLabel = hoy.toLocaleString('es-CL', {month:'long', year:'numeric'}).replace(/^\w/, c => c.toUpperCase())
      const { data: newPeriodo } = await supabase.from('periodos').insert({
        mes: hoy.getMonth() + 1,
        año: hoy.getFullYear(),
        mes_label: mesLabel
      }).select().single()
      if (newPeriodo) {
        setMeses([mesLabel])
        setMesActivo(mesLabel)
      }
    }
  }

  async function loadDatosMes(periodoId) {
    const [v, q, a, h] = await Promise.all([
      supabase.from('ventas').select('*, colaboradores(nombre,apellido,rut)').eq('periodo_id', periodoId),
      supabase.from('bonos_qf').select('*, colaboradores(nombre,apellido,rut)').eq('periodo_id', periodoId),
      supabase.from('anticipos').select('*, colaboradores(nombre,apellido,rut)').eq('periodo_id', periodoId),
      supabase.from('horas_extra').select('*, colaboradores(nombre,apellido,rut)').eq('periodo_id', periodoId),
    ])
    setVentas(v.data||[])
    setBonosQF(q.data||[])
    setAnticipos(a.data||[])
    setHoras(h.data||[])
    setStats({
      bonosAux: (v.data||[]).reduce((s,x)=>s+x.bono,0),
      bonosQF: (q.data||[]).reduce((s,x)=>s+x.bono,0),
      horas: (h.data||[]).reduce((s,x)=>s+x.cantidad,0),
      anticipos: (a.data||[]).reduce((s,x)=>s+x.monto,0),
    })
  }

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}>
      <div style={{width:40,height:40,border:'3px solid #e3e1d8',borderTop:'3px solid #2a5c3a',borderRadius:'50%',animation:'spin 1s linear infinite'}}></div>
      <p style={{color:'#6a6858',fontSize:14}}>Cargando BioCuba Farmacia...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error === 'base_de_datos') return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16,padding:24}}>
      <div style={{background:'#fde8e8',border:'1px solid #e8aaaa',borderRadius:10,padding:20,maxWidth:500,textAlign:'center'}}>
        <div style={{fontSize:24,marginBottom:8}}>⚠️</div>
        <h2 style={{marginBottom:8,color:'#8b1a1a'}}>Base de datos no configurada</h2>
        <p style={{color:'#6a6858',fontSize:14,marginBottom:16}}>Necesita ejecutar el schema SQL en Supabase. Vaya a SQL Editor en su dashboard de Supabase y ejecute el archivo <strong>supabase-schema.sql</strong> incluido.</p>
        <a href={`https://supabase.com/dashboard/project/pvttkbweqgjbrhwvabnp/sql/new`} target="_blank" rel="noreferrer"
          style={{display:'inline-block',background:'#2a5c3a',color:'#fff',padding:'8px 16px',borderRadius:6,textDecoration:'none',fontSize:13}}>
          Abrir SQL Editor →
        </a>
      </div>
    </div>
  )

  return (
    <>
      <Head>
        <title>BioCuba Farmacia — Gestión de Sueldos</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" />
      </Head>
      <div style={{display:'flex',minHeight:'100vh',fontFamily:"'DM Sans',sans-serif"}}>

        {/* SIDEBAR */}
        <aside style={{width:220,background:'#fff',borderRight:'1px solid #e3e1d8',display:'flex',flexDirection:'column',position:'sticky',top:0,height:'100vh',overflowY:'auto'}}>
          <div style={{padding:'14px 16px 10px',borderBottom:'1px solid #e3e1d8'}}>
            <div style={{fontSize:14,fontWeight:600,color:'#1a1910'}}>BioCuba</div>
            <div style={{fontSize:11,color:'#9b9880'}}>Gestión de sueldos</div>
          </div>
          <nav style={{padding:'8px 7px',flex:1}}>
            {[
              {id:'dashboard',label:'Inicio',icon:'⊞'},
              {id:'resumen',label:'Resumen del mes',icon:'📋'},
              {id:'desempeno',label:'Desempeño',icon:'📈'},
              {id:'historial',label:'Historial',icon:'🕐'},
              {id:'auxiliares',label:'Auxiliares',icon:'👥'},
              {id:'qf',label:'QF titulares',icon:'⚗️'},
              {id:'qfc',label:'QF complementarios',icon:'⏱'},
              {id:'anticipos',label:'Anticipos',icon:'💰'},
              {id:'horas',label:'Horas extra',icon:'⌚'},
              {id:'colaboradores',label:'Colaboradores',icon:'👤'},
              {id:'exportar',label:'Exportar',icon:'⬇'},
              {id:'ajustes',label:'Ajustes',icon:'⚙️'},
            ].map(item => (
              <button key={item.id} onClick={() => setActiveSection(item.id)}
                style={{display:'flex',alignItems:'center',gap:8,padding:'7px 9px',borderRadius:6,
                  cursor:'pointer',color: activeSection===item.id ? '#2a5c3a' : '#6a6858',
                  fontSize:13,transition:'all .12s',border:'none',
                  background: activeSection===item.id ? '#e5f0e8' : 'none',
                  fontWeight: activeSection===item.id ? 500 : 400,
                  width:'100%',textAlign:'left',marginBottom:1,fontFamily:'inherit'}}>
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
          <div style={{padding:'10px',borderTop:'1px solid #e3e1d8',fontSize:11,color:'#9b9880'}}>
            <div>{mesActivo}</div>
            <div>{colaboradores.filter(c=>c.estado==='activo').length} colaboradores activos</div>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
          {/* TOPBAR */}
          <div style={{background:'#fff',borderBottom:'1px solid #e3e1d8',padding:'11px 22px',
            display:'flex',alignItems:'center',justifyContent:'space-between',
            position:'sticky',top:0,zIndex:20}}>
            <div>
              <div style={{fontSize:16,fontWeight:600}}>
                {{dashboard:'Inicio',resumen:'Resumen del mes',desempeno:'Desempeño',
                  historial:'Historial',auxiliares:'Auxiliares',qf:'QF Titulares',
                  qfc:'QF Complementarios',anticipos:'Anticipos',horas:'Horas Extra',
                  colaboradores:'Colaboradores',exportar:'Exportar',ajustes:'Ajustes'}[activeSection]}
              </div>
              <div style={{fontSize:11,color:'#9b9880'}}>BioCuba Farmacia</div>
            </div>
            <select value={mesActivo} onChange={e=>setMesActivo(e.target.value)}
              style={{fontSize:13,padding:'6px 10px',border:'1px solid #ccc9bc',
                borderRadius:6,fontFamily:'inherit',background:'#fff',color:'#1a1910'}}>
              {meses.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          {/* CONTENT */}
          <div style={{padding:'18px 22px'}}>

            {/* DASHBOARD */}
            {activeSection === 'dashboard' && (
              <div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:16}}>
                  {[
                    {label:'Bonos auxiliares',value:fmt(stats.bonosAux),color:'#1a1910'},
                    {label:'Bonos QF',value:fmt(stats.bonosQF),color:'#1a1910'},
                    {label:'Horas extra',value:stats.horas+' hrs',color:'#1a1910'},
                    {label:'Anticipos',value:fmt(stats.anticipos),color:'#8b1a1a'},
                    {label:'Colaboradores activos',value:colaboradores.filter(c=>c.estado==='activo').length,color:'#1a1910'},
                  ].map(s => (
                    <div key={s.label} style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:'12px 14px'}}>
                      <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.5,color:'#9b9880',marginBottom:4}}>{s.label}</div>
                      <div style={{fontSize:20,fontWeight:600,fontFamily:'DM Mono',color:s.color}}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:'16px 18px'}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>👥 Auxiliares — {mesActivo}</div>
                    {colaboradores.filter(c=>c.rol==='auxiliar'&&c.estado==='activo').map(c => {
                      const v = ventas.find(x=>x.colaborador_id===c.id)
                      return (
                        <div key={c.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid #e3e1d8'}}>
                          <div style={{width:8,height:8,borderRadius:'50%',background:v?'#2a5c3a':c.ausencia?'#7a4e00':'#ccc9bc',flexShrink:0}}></div>
                          <div style={{flex:1,fontSize:13}}>{c.nombre} {c.apellido}</div>
                          {v ? <span style={{fontSize:12,fontFamily:'DM Mono',color:'#2a5c3a'}}>{fmt(v.venta_neta)}</span>
                            : c.ausencia ? <span style={{fontSize:11,color:'#7a4e00'}}>{c.ausencia}</span>
                            : <span style={{fontSize:11,color:'#9b9880'}}>Sin ingresar</span>}
                        </div>
                      )
                    })}
                  </div>

                  <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:'16px 18px'}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>⚡ Acciones rápidas</div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {[
                        {label:'Ingresar venta auxiliar',sec:'auxiliares',color:'#2a5c3a',bg:'#e5f0e8',border:'#aed0b8'},
                        {label:'Ingresar bono QF',sec:'qf',color:'#1a1910',bg:'#fff',border:'#ccc9bc'},
                        {label:'Registrar anticipo',sec:'anticipos',color:'#1a1910',bg:'#fff',border:'#ccc9bc'},
                        {label:'Exportar para contadora',sec:'exportar',color:'#1c3a5e',bg:'#e4edf5',border:'#adc5de'},
                      ].map(a => (
                        <button key={a.sec} onClick={()=>setActiveSection(a.sec)}
                          style={{padding:'8px 14px',borderRadius:6,fontSize:13,cursor:'pointer',
                            border:`1px solid ${a.border}`,background:a.bg,color:a.color,
                            fontFamily:'inherit',textAlign:'left'}}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* COLABORADORES */}
            {activeSection === 'colaboradores' && (
              <div>
                <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:'16px 18px'}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Colaboradores registrados</div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                      <thead>
                        <tr>
                          {['Nombre','RUT','Local','Rol','Contrato','Estado'].map(h => (
                            <th key={h} style={{textAlign:'left',padding:'7px 10px',fontSize:10,fontWeight:600,
                              textTransform:'uppercase',letterSpacing:.5,color:'#9b9880',
                              borderBottom:'1px solid #e3e1d8',background:'#f0efe9'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {colaboradores.map(c => (
                          <tr key={c.id}>
                            <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8',fontWeight:500}}>{c.nombre} {c.apellido}</td>
                            <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8',fontFamily:'DM Mono',fontSize:11,color:'#6a6858'}}>{c.rut||'—'}</td>
                            <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8'}}>{c.local||'—'}</td>
                            <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8'}}>
                              <span style={{background:c.rol==='auxiliar'?'#e4edf5':'#ede8f5',
                                color:c.rol==='auxiliar'?'#1c3a5e':'#44277a',
                                padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500}}>
                                {c.rol==='auxiliar'?'Auxiliar':c.rol==='qf'?'QF titular':'QF compl.'}
                              </span>
                            </td>
                            <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8',fontSize:12}}>{c.contrato||'—'}</td>
                            <td style={{padding:'8px 10px',borderBottom:'1px solid #e3e1d8'}}>
                              <span style={{background:c.estado==='activo'?'#e5f0e8':'#fde8e8',
                                color:c.estado==='activo'?'#2a5c3a':'#8b1a1a',
                                padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500}}>
                                {c.estado==='activo'?'Activo':'Inactivo'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* AJUSTES */}
            {activeSection === 'ajustes' && (
              <div>
                <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:'16px 18px',marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>⚙️ Configuración</div>
                  <div style={{fontSize:13,color:'#6a6858',marginBottom:8}}>Base de datos: <strong>Supabase</strong> — conectada ✓</div>
                  <div style={{fontSize:13,color:'#6a6858'}}>Proyecto: <strong>biocuba-farmacias</strong></div>
                </div>
                <div style={{background:'#fde8e8',border:'1px solid #e8aaaa',borderRadius:10,padding:'16px 18px'}}>
                  <div style={{fontSize:13,fontWeight:600,color:'#8b1a1a',marginBottom:8}}>⚠️ Zona de peligro</div>
                  <div style={{fontSize:12,color:'#6a6858',marginBottom:12}}>Esta sección es solo para uso técnico con soporte.</div>
                  <a href={`https://supabase.com/dashboard/project/pvttkbweqgjbrhwvabnp`} target="_blank" rel="noreferrer"
                    style={{display:'inline-block',background:'#8b1a1a',color:'#fff',padding:'7px 14px',borderRadius:6,textDecoration:'none',fontSize:13}}>
                    Abrir panel Supabase →
                  </a>
                </div>
              </div>
            )}

            {/* SECCIÓN EN CONSTRUCCIÓN */}
            {!['dashboard','colaboradores','ajustes'].includes(activeSection) && (
              <div style={{background:'#fff',border:'1px solid #e3e1d8',borderRadius:10,padding:40,textAlign:'center'}}>
                <div style={{fontSize:32,marginBottom:12}}>🔧</div>
                <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>Módulo en migración</div>
                <div style={{fontSize:13,color:'#6a6858'}}>Este módulo está siendo migrado a la versión en la nube.<br/>Estará disponible en la próxima actualización.</div>
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  )
}
