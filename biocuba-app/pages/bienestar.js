import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { getSession, clearSession } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const CUPO = 50000
const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL')
const hoy = () => new Date().toISOString().split('T')[0]
const mes = () => new Date().toISOString().slice(0,7)
function normRut(r){ return r.replace(/[.\s]/g,'').toUpperCase() }

export default function Bienestar() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [tab, setTab] = useState('ventas')
  const [ventas, setVentas] = useState([])
  const [bloqueados, setBloqueados] = useState([])
  const [SOCIOS, setSOCIOS] = useState([])
  const [historialVentas, setHistorialVentas] = useState([])
  const [busqHist, setBusqHist] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [rutBloqueo, setRutBloqueo] = useState('')
  const [motivoBloqueo, setMotivoBloqueo] = useState('')
  const [resultBloqueo, setResultBloqueo] = useState(null)

  useEffect(()=>{
    const s = getSession()
    if(!s||s.rol!=='qf'){ router.replace('/login'); return }
    setSession(s)
    cargarDatos()
    import('../lib/socios').then(m=>setSOCIOS(m.SOCIOS))
  },[])

  async function cargarHistorial(s){
    const mesActual = new Date().toISOString().slice(0,7)
    const {data} = await supabase.from('bienestar_ventas').select('*').eq('sucursal_id',s.sucursal).order('fecha',{ascending:false}).limit(200)
    setHistorialVentas(data||[])
  }

  async function cargarDatos(){
    setLoading(true)
    const mesActual = mes()
    const [rV, rB] = await Promise.all([
      supabase.from('bienestar_ventas').select('*').eq('mes',mesActual).order('created_at',{ascending:false}),
      supabase.from('bienestar_bloqueados').select('*').eq('activo',true).order('nombre'),
    ])
    setVentas(rV.data||[])
    setBloqueados(rB.data||[])
    setLoading(false)
  }

  const usadoMap = {}
  ventas.forEach(v=>{ usadoMap[v.rut]=(usadoMap[v.rut]||0)+v.monto })
  const tMes = ventas.reduce((s,v)=>s+v.monto,0)
  const rutBloq = new Set(bloqueados.map(b=>normRut(b.rut)))

  async function buscarBloqueo(){
    const rut = rutBloqueo.trim().replace(/\./g,'').toUpperCase()
    if(!rut||rut.length<6){ alert('Ingresa un RUT válido'); return }
    const socio = SOCIOS.find(s=>normRut(s.rut)===normRut(rut))
    const bloq = bloqueados.find(b=>normRut(b.rut)===normRut(rut))
    if(bloq){ setResultBloqueo({yaBloqueado:true,...bloq}); return }
    if(!socio){ setResultBloqueo({noEncontrado:true,rut}); return }
    setResultBloqueo({ok:true,...socio})
  }

  async function bloquear(){
    if(!motivoBloqueo){ alert('Selecciona el motivo'); return }
    if(!resultBloqueo?.ok){ return }
    if(!confirm(`¿Bloquear a ${resultBloqueo.nombre}?\nMotivo: ${motivoBloqueo}`)){ return }
    const {error} = await supabase.from('bienestar_bloqueados').upsert({
      rut:resultBloqueo.rut, nombre:resultBloqueo.nombre,
      motivo:motivoBloqueo, quien:session.nombre,
      fecha:hoy(), activo:true
    },{onConflict:'rut'})
    if(error){ alert('Error: '+error.message); return }
    setRutBloqueo(''); setMotivoBloqueo(''); setResultBloqueo(null)
    cargarDatos()
  }

  async function desbloquear(rut){
    if(!confirm('¿Desbloquear este socio?')) return
    await supabase.from('bienestar_bloqueados').update({activo:false}).eq('rut',rut)
    cargarDatos()
  }

  const sociosFiltrados = SOCIOS.filter(s=>
    !busqueda||s.nombre.toLowerCase().includes(busqueda.toLowerCase())||normRut(s.rut).includes(normRut(busqueda))
  ).slice(0,100)

  const inp = {fontSize:14,padding:'9px 12px',border:'1.5px solid var(--bdr)',borderRadius:8,outline:'none',width:'100%',fontFamily:'var(--font)'}
  const lbl = {fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t2)',display:'block',marginBottom:4}

  return (
    <>
      <Head><title>Bienestar Municipal — BioCuba</title></Head>
      <header style={{background:'#fff',borderBottom:'2.5px solid var(--br)',padding:'0 20px',display:'flex',alignItems:'center',minHeight:54,gap:12,flexWrap:'wrap'}}>
        <img src="/logo.jpg" alt="BioCuba" style={{height:38,width:'auto'}} />
        <div style={{width:1,height:22,background:'var(--bdr)'}}></div>
        <span style={{fontSize:13,fontWeight:600,color:'var(--green)'}}>🏥 Bienestar Municipal</span>
        <span style={{fontSize:12,fontWeight:600,color:'#fff',background:'var(--blue)',padding:'3px 10px',borderRadius:20}}>{session?.sucursalNombre}</span>
        <a href="/qf" style={{marginLeft:'auto',fontSize:12,color:'var(--t2)',textDecoration:'none'}}>← Panel QF</a>
      </header>

      <main style={{padding:20,maxWidth:960,margin:'0 auto'}}>
        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
          {[
            {lbl:'Total del mes',val:fmt(tMes),color:'var(--blue)'},
            {lbl:'Socios con uso',val:Object.keys(usadoMap).length,color:'var(--green)'},
            {lbl:'Socios bloqueados',val:bloqueados.length,color:'var(--red)'},
            {lbl:'Socios activos',val:SOCIOS.length,color:'var(--t2)'},
          ].map((k,i)=>(
            <div key={i} style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:10,padding:'14px 16px'}}>
              <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>{k.lbl}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:700,color:k.color}}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--s2)',padding:4,borderRadius:10,width:'fit-content'}}>
          {[['ventas','Ventas del mes'],['socios','Socios'],['gestion','Gestión'],['exportar','Exportar']].map(([id,lbl])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:'7px 16px',borderRadius:7,border:'none',background:tab===id?'#fff':'transparent',fontWeight:tab===id?600:400,fontSize:13,color:tab===id?'var(--tx)':'var(--t2)',boxShadow:tab===id?'0 1px 4px rgba(0,0,0,.08)':'none'}}>{lbl}</button>
          ))}
        </div>

        {/* TAB VENTAS */}
        {tab==='ventas'&&(
          <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'14px 16px',borderBottom:'1px solid var(--bdr)',fontSize:13,fontWeight:600}}>Ventas del mes — {new Date().toLocaleString('es-CL',{month:'long',year:'numeric'})}</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:'var(--s2)'}}>
                  {['Fecha','RUT','Nombre','Folio','Monto','Obs','Registrado por'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'var(--t2)',whiteSpace:'nowrap'}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {loading?<tr><td colSpan={7} style={{padding:20,textAlign:'center',color:'var(--t3)'}}>Cargando...</td></tr>:
                  ventas.length===0?<tr><td colSpan={7} style={{padding:20,textAlign:'center',color:'var(--t3)'}}>Sin ventas este mes</td></tr>:
                  ventas.map((v,i)=>(
                    <tr key={v.id} style={{borderTop:'1px solid var(--bdr)',background:i%2===0?'#fff':'var(--s2)'}}>
                      <td style={{padding:'8px 12px',whiteSpace:'nowrap'}}>{v.fecha}</td>
                      <td style={{padding:'8px 12px',fontFamily:'var(--mono)',fontSize:11}}>{v.rut}</td>
                      <td style={{padding:'8px 12px',fontWeight:500}}>{v.nombre}</td>
                      <td style={{padding:'8px 12px',fontFamily:'var(--mono)'}}>{v.folio}</td>
                      <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right',fontWeight:600}}>{fmt(v.monto)}</td>
                      <td style={{padding:'8px 12px',color:'var(--t3)'}}>{v.obs}</td>
                      <td style={{padding:'8px 12px',color:'var(--t3)'}}>{v.usuario_nombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{padding:'12px 16px',borderTop:'1px solid var(--bdr)',display:'flex',justifyContent:'space-between',fontWeight:600,fontSize:13}}>
              <span>Total {ventas.length} venta{ventas.length!==1?'s':''}</span>
              <span style={{color:'var(--blue)'}}>{fmt(tMes)}</span>
            </div>
          </div>
        )}

        {/* TAB SOCIOS */}
        {tab==='socios'&&(
          <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'14px 16px',borderBottom:'1px solid var(--bdr)',display:'flex',gap:10,alignItems:'center'}}>
              <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar por nombre o RUT..." style={{...inp,width:'auto',flex:1}} />
              <span style={{fontSize:12,color:'var(--t3)',whiteSpace:'nowrap'}}>{SOCIOS.length} socios</span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:'var(--s2)'}}>
                  {['RUT','Nombre','Usado','Disponible','Estado'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'var(--t2)'}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {sociosFiltrados.map((s,i)=>{
                    const usado=usadoMap[s.rut]||0
                    const disp=CUPO-usado
                    const bloq=rutBloq.has(normRut(s.rut))
                    const bloqInfo=bloqueados.find(b=>normRut(b.rut)===normRut(s.rut))
                    return (
                      <tr key={s.rut} style={{borderTop:'1px solid var(--bdr)',background:bloq?'#fff8f8':i%2===0?'#fff':'var(--s2)',opacity:bloq?.6:1}}>
                        <td style={{padding:'8px 12px',fontFamily:'var(--mono)',fontSize:11}}>{s.rut}</td>
                        <td style={{padding:'8px 12px',fontWeight:500}}>{s.nombre}</td>
                        <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right',color:'var(--amber)'}}>{usado>0?fmt(usado):'—'}</td>
                        <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right',color:bloq?'var(--t3)':disp<=0?'var(--red)':disp<10000?'var(--amber)':'var(--green)'}}>{bloq?'—':fmt(Math.max(0,disp))}</td>
                        <td style={{padding:'8px 12px'}}>
                          {bloq?<span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'var(--rbg)',color:'var(--red)'}} title={bloqInfo?.motivo}>🚫 Bloqueado</span>:
                          disp<=0?<span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'var(--abg)',color:'var(--amber)'}}>Cupo agotado</span>:
                          usado>0?<span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'var(--gbg)',color:'var(--green)'}}>Con uso</span>:
                          <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'var(--s2)',color:'var(--t3)'}}>Sin uso</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB GESTIÓN */}
        {tab==='gestion'&&(
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:20}}>
              <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>Bloqueo de Socios</div>
              <div style={{fontSize:12,color:'var(--t3)',marginBottom:16}}>Bloquea socios cuando la Municipalidad avise que tienen restricción interna.</div>
              <div style={{display:'flex',gap:10,marginBottom:14}}>
                <input value={rutBloqueo} onChange={e=>setRutBloqueo(e.target.value)} placeholder="RUT del socio" style={{...inp,flex:1}} />
                <button onClick={buscarBloqueo} style={{padding:'9px 18px',borderRadius:8,border:'none',background:'var(--blue)',color:'#fff',fontSize:13,fontWeight:500}}>Buscar</button>
              </div>
              {resultBloqueo?.noEncontrado&&<div style={{background:'var(--rbg)',border:'1px solid var(--rbdr)',borderRadius:8,padding:12,fontSize:13,color:'var(--red)',marginBottom:12}}>RUT no encontrado en la nómina</div>}
              {resultBloqueo?.yaBloqueado&&<div style={{background:'var(--abg)',border:'1px solid var(--abdr)',borderRadius:8,padding:12,marginBottom:12}}>
                <div style={{fontSize:14,fontWeight:600,color:'var(--amber)'}}>⚠ Socio ya bloqueado</div>
                <div style={{fontSize:13,marginTop:4}}>{resultBloqueo.nombre}</div>
                <div style={{fontSize:12,color:'var(--t2)',marginTop:4}}>Motivo: {resultBloqueo.motivo}</div>
                <button onClick={()=>desbloquear(resultBloqueo.rut)} style={{marginTop:10,padding:'7px 14px',borderRadius:7,border:'none',background:'var(--green)',color:'#fff',fontSize:12,fontWeight:500}}>Desbloquear</button>
              </div>}
              {resultBloqueo?.ok&&<div style={{background:'var(--gbg)',border:'1px solid var(--gbdr)',borderRadius:8,padding:14,marginBottom:12}}>
                <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{resultBloqueo.nombre}</div>
                <div style={{fontSize:12,color:'var(--t2)',marginBottom:12}}>{resultBloqueo.rut}</div>
                <div style={{marginBottom:10}}>
                  <label style={lbl}>Motivo del bloqueo</label>
                  <select value={motivoBloqueo} onChange={e=>setMotivoBloqueo(e.target.value)} style={{...inp,background:'#fff'}}>
                    <option value="">Seleccionar motivo...</option>
                    <option>Bloqueo interno Municipalidad</option>
                    <option>Bloqueo por cupo excedido</option>
                    <option>Socio inactivo</option>
                    <option>Deuda pendiente con Municipalidad</option>
                    <option>Suspensión temporal</option>
                  </select>
                </div>
                <button onClick={bloquear} style={{padding:'9px 18px',borderRadius:7,border:'none',background:'var(--red)',color:'#fff',fontSize:13,fontWeight:500}}>🚫 Bloquear socio</button>
              </div>}
            </div>

            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:20}}>
              <div style={{fontSize:15,fontWeight:600,marginBottom:14}}>Socios bloqueados — <span style={{color:'var(--red)'}}>{bloqueados.length}</span></div>
              {bloqueados.length===0?<div style={{fontSize:13,color:'var(--t3)'}}>Sin socios bloqueados</div>:
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'var(--s2)'}}>
                    {['RUT','Nombre','Motivo','Bloqueado por','Fecha',''].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'var(--t2)'}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {bloqueados.map((b,i)=>(
                      <tr key={b.id} style={{borderTop:'1px solid var(--bdr)'}}>
                        <td style={{padding:'8px 12px',fontFamily:'var(--mono)',fontSize:11}}>{b.rut}</td>
                        <td style={{padding:'8px 12px',fontWeight:500}}>{b.nombre}</td>
                        <td style={{padding:'8px 12px',color:'var(--red)',fontSize:11}}>{b.motivo}</td>
                        <td style={{padding:'8px 12px',color:'var(--t2)'}}>{b.quien}</td>
                        <td style={{padding:'8px 12px',color:'var(--t3)'}}>{b.fecha}</td>
                        <td style={{padding:'8px 12px'}}><button onClick={()=>desbloquear(b.rut)} style={{fontSize:11,padding:'3px 8px',borderRadius:6,border:'1px solid var(--gbdr)',background:'var(--gbg)',color:'var(--green)',cursor:'pointer'}}>Desbloquear</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
            </div>
          </div>
        )}

        {/* TAB EXPORTAR */}
        {tab==='exportar'&&(
          <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:24,textAlign:'center'}}>
            <div style={{fontSize:36,marginBottom:12}}>📊</div>
            <div style={{fontSize:16,fontWeight:600,marginBottom:6}}>Planilla Municipalidad</div>
            <div style={{fontSize:13,color:'var(--t2)',marginBottom:20}}>{ventas.length} ventas · {fmt(tMes)} · {new Date().toLocaleString('es-CL',{month:'long',year:'numeric'})}</div>
            <button onClick={exportarExcel} style={{padding:'13px 28px',borderRadius:10,border:'none',background:'var(--green)',color:'#fff',fontSize:15,fontWeight:600}}>⬇ Descargar Planilla Excel (.xlsx)</button>
            <div style={{fontSize:11,color:'var(--t3)',marginTop:10}}>Formato listo para enviar a la Municipalidad de Maipú</div>
          </div>
        )}

        {/* TAB HISTORIAL */}
        {tab==='historial'&&(
          <div>
            <div style={{marginBottom:14}}>
              <input value={busqHist} onChange={e=>setBusqHist(e.target.value)} placeholder="Buscar por nombre, RUT o folio..." style={{fontSize:14,padding:'9px 12px',border:'1.5px solid var(--bdr)',borderRadius:8,outline:'none',width:'100%',fontFamily:'var(--font)',background:'#fff'}} />
            </div>
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'var(--s2)'}}>
                    {['Fecha','RUT','Nombre','Folio','Monto','Obs'].map(h=>(
                      <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'var(--t2)',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {historialVentas.filter(v=>!busqHist||v.nombre?.toLowerCase().includes(busqHist.toLowerCase())||v.rut?.includes(busqHist)||v.folio?.includes(busqHist)).map((v,i)=>(
                      <tr key={v.id||i} style={{borderTop:'1px solid var(--bdr)',background:i%2===0?'#fff':'var(--s2)'}}>
                        <td style={{padding:'8px 12px'}}>{v.fecha}</td>
                        <td style={{padding:'8px 12px',color:'var(--t2)'}}>{v.rut}</td>
                        <td style={{padding:'8px 12px',fontWeight:500}}>{v.nombre}</td>
                        <td style={{padding:'8px 12px',color:'var(--t2)'}}>{v.folio}</td>
                        <td style={{padding:'8px 12px',fontFamily:'var(--mono)',fontWeight:600,color:'var(--green)'}}>${(v.monto||0).toLocaleString('es-CL')}</td>
                        <td style={{padding:'8px 12px',color:'var(--t2)'}}>{v.obs||'—'}</td>
                      </tr>
                    ))}
                    {historialVentas.length===0&&<tr><td colSpan={6} style={{padding:20,textAlign:'center',color:'var(--t3)'}}>Sin ventas registradas</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )

  async function exportarExcel(){
    if(ventas.length===0){ alert('Sin ventas para exportar'); return }
    const XLSX = await import('xlsx').then(m=>m.default||m)
    const wb = XLSX.utils.book_new()
    const ventasRows = [['RUT','SOCIO','SALDO DISPONIBLE','MONTO','FOLIO','OBSERVACIONES']]
    const tOtras = ventas.filter(v=>v.obs?.toUpperCase().includes('DIFERENCIA')).reduce((s,v)=>s+v.monto,0)
    ventas.forEach(v=>ventasRows.push([v.rut,v.nombre,(CUPO-(usadoMap[v.rut]||0)),v.monto,v.folio,v.obs||'']))
    const ws1 = XLSX.utils.aoa_to_sheet(ventasRows)
    ws1['H2']={v:'TOTAL VENTAS',t:'s'}; ws1['I2']={v:tMes,t:'n',z:'#,##0'}
    ws1['H3']={v:'TOTAL VENTAS OTRAS FORMAS DE PAGO',t:'s'}; ws1['I3']={v:tOtras,t:'n',z:'#,##0'}
    ws1['H4']={v:'TOTAL VENTAS CONVENIO',t:'s'}; ws1['I4']={v:tMes-tOtras,t:'n',z:'#,##0'}
    ws1['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:ventas.length,c:8}})
    ws1['!cols']=[{wch:14},{wch:36},{wch:16},{wch:12},{wch:12},{wch:22},{wch:3},{wch:32},{wch:14}]
    XLSX.utils.book_append_sheet(wb,ws1,'VENTAS')
    const nominaRows=[['RUT','SOCIO','SALDO','TOTAL COMPRADO','DISPONIBLE']]
    SOCIOS.forEach(s=>nominaRows.push([s.rut,s.nombre,CUPO,usadoMap[s.rut]||0,CUPO-(usadoMap[s.rut]||0)]))
    const ws2=XLSX.utils.aoa_to_sheet(nominaRows)
    ws2['G1']={v:'SOCIOS BIENESTAR',t:'s'}; ws2['H1']={v:SOCIOS.length,t:'n'}
    XLSX.utils.book_append_sheet(wb,ws2,'NOMINA')
    const bloqUsoRows=[['RUT','','SOCIOS','FECHA DE BLOQUEO']]
    bloqueados.filter(b=>(usadoMap[b.rut]||0)>0).forEach(b=>bloqUsoRows.push([b.rut,'',b.nombre,b.fecha]))
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(bloqUsoRows),'BLOQUEADOS CON USO DE CUPO')
    const bloqSinRows=[['RUT','NOMBRE Y APELLIDO']]
    SOCIOS.filter(s=>!usadoMap[s.rut]).forEach(s=>bloqSinRows.push([s.rut,s.nombre]))
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(bloqSinRows),'BLOQUEADOS SIN USO DE CUPO')
    const mesNombre=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'][new Date().getMonth()]
    XLSX.writeFile(wb,`Bienestar_Maipu_${mesNombre}_${new Date().getFullYear()}.xlsx`)
  }
}
