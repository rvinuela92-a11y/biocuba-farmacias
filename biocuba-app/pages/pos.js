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
function formatRutStr(v){
  v=v.replace(/[^0-9kK]/g,'').toUpperCase()
  if(v.length>1) v=v.slice(0,-1)+'-'+v.slice(-1)
  if(v.length>5) v=v.slice(0,-5)+'.'+v.slice(-5)
  if(v.length>9) v=v.slice(0,-9)+'.'+v.slice(-9)
  return v
}

export default function POS() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [modulo, setModulo] = useState(null)
  const [resumen, setResumen] = useState({b:0,s:0,m:0})
  const [okMsg, setOkMsg] = useState(null)
  const [SOCIOS, setSOCIOS] = useState([])
  const [rutB, setRutB] = useState('')
  const [socioActual, setSocioActual] = useState(null)
  const [resultadoB, setResultadoB] = useState(null)
  const [folioB, setFolioB] = useState('')
  const [montoB, setMontoB] = useState('')
  const [obsB, setObsB] = useState('')
  const [nombreS, setNombreS] = useState('')
  const [rutS, setRutS] = useState('')
  const [folioS, setFolioS] = useState('')
  const [montoS, setMontoS] = useState('')
  const [pacienteM, setPacienteM] = useState('')
  const [rutM, setRutM] = useState('')
  const [folioM, setFolioM] = useState('')
  const [descM, setDescM] = useState('')
  const [pagoM, setPagoM] = useState('efectivo')
  const [montoM, setMontoM] = useState('')

  useEffect(()=>{
    const s = getSession()
    if(!s){ router.replace('/login?tipo=pos'); return }
    setSession(s)
    cargarResumen(s)
    import('../lib/socios').then(m=>setSOCIOS(m.SOCIOS))
  },[])

  async function cargarResumen(s){
    const fecha=hoy(), suc=s.sucursal, mesActual=mes()
    const [rB,rS,rM] = await Promise.all([
      supabase.from('bienestar_ventas').select('monto').eq('sucursal_id',suc).eq('fecha',fecha),
      supabase.from('sindicato_ventas').select('monto').eq('sucursal_id',suc).eq('fecha',fecha),
      supabase.from('magistral_ventas').select('monto').eq('sucursal_id',suc).eq('fecha',fecha),
    ])
    setResumen({
      b:(rB.data||[]).reduce((s,v)=>s+v.monto,0),
      s:(rS.data||[]).reduce((s,v)=>s+v.monto,0),
      m:(rM.data||[]).reduce((s,v)=>s+v.monto,0),
    })
  }

  async function buscarSocio(){
    const rut=normRut(rutB)
    if(!rut||rut.length<6||!rut.includes('-')){ setResultadoB({error:'RUT inválido — ejemplo: 12.345.678-9'}); return }
    const {data:bloqs} = await supabase.from('bienestar_bloqueados').select('*').eq('activo',true)
    const bloq=(bloqs||[]).find(b=>normRut(b.rut)===rut)
    if(bloq){ setResultadoB({bloqueado:true,nombre:bloq.nombre,motivo:bloq.motivo}); return }
    const socio=SOCIOS.find(s=>normRut(s.rut)===rut)
    if(!socio){ setResultadoB({noEncontrado:true,rut}); return }
    const {data:ventas,error:errV} = await supabase.from('bienestar_ventas').select('monto').eq('rut',socio.rut).eq('mes',mes())
    const usado=(ventas||[]).reduce((s,v)=>s+v.monto,0)
    const disponible = CUPO - usado
    if(disponible<=0){
      setSocioActual(null)
      setResultadoB({bloqueado:true,nombre:socio.nombre,motivo:'Cupo mensual agotado — ha utilizado $'+usado.toLocaleString('es-CL')+' de $'+CUPO.toLocaleString('es-CL')})
      return
    }
    setSocioActual({...socio,usado,disponible})
    setResultadoB({ok:true})
    setFolioB(''); setMontoB('')
  }

  async function registrarBienestar(){
    if(!socioActual) return
    if(!folioB.trim()){ alert('Ingresa el folio'); return }
    const monto=parseFloat(montoB)||0
    if(!monto||monto<=0){ alert('Monto inválido'); return }
    if(monto>500000&&!confirm(`Monto: ${fmt(monto)}. ¿Es correcto?`)) return
    const {error} = await supabase.from('bienestar_ventas').insert({
      id:Date.now()+'_'+socioActual.rut,
      sucursal_id:session.sucursal, rut:socioActual.rut, nombre:socioActual.nombre,
      folio:folioB.trim(), monto, obs:obsB, fecha:hoy(), mes:mes(),
      usuario_nombre:session.nombre, ts:Date.now()
    })
    if(error){ alert('Error: '+error.message); return }
    setOkMsg({titulo:'✓ Venta Bienestar registrada', detalle:`${socioActual.nombre} · ${fmt(monto)} · Folio ${folioB}`})
    setSocioActual(null); setResultadoB(null); setRutB(''); cargarResumen(session); setModulo('ok')
  }

  async function registrarSindicato(){
    if(!nombreS.trim()){ alert('Ingresa el nombre'); return }
    if(!folioS.trim()){ alert('Ingresa el folio'); return }
    const monto=parseFloat(montoS)||0
    if(!monto||monto<=0){ alert('Monto inválido'); return }
    if(monto>500000&&!confirm(`Monto: ${fmt(monto)}. ¿Es correcto?`)) return
    const {error} = await supabase.from('sindicato_ventas').insert({
      id:Date.now()+'_sind', sucursal_id:session.sucursal,
      nombre:nombreS.trim(), rut:rutS.trim(), folio:folioS.trim(),
      monto, fecha:hoy(), mes:mes(), usuario_nombre:session.nombre, ts:Date.now()
    })
    if(error){ alert('Error: '+error.message); return }
    setOkMsg({titulo:'✓ Venta Sindicato registrada', detalle:`${nombreS} · ${fmt(monto)} · Folio ${folioS}`})
    setNombreS(''); setRutS(''); setFolioS(''); setMontoS(''); cargarResumen(session); setModulo('ok')
  }

  async function registrarMagistral(){
    if(!pacienteM.trim()){ alert('Ingresa el nombre del paciente'); return }
    if(!folioM.trim()){ alert('Ingresa el folio'); return }
    const monto=parseFloat(montoM)||0
    if(!monto||monto<=0){ alert('Monto inválido'); return }
    if(monto>500000&&!confirm(`Monto: ${fmt(monto)}. ¿Es correcto?`)) return
    const {error} = await supabase.from('magistral_ventas').insert({
      id:Date.now()+'_mag', sucursal_id:session.sucursal,
      paciente:pacienteM.trim(), rut:rutM.trim(), folio:folioM.trim(),
      descripcion:descM, pago:pagoM, monto, estado:'pendiente',
      fecha:hoy(), mes:mes(), usuario_nombre:session.nombre, ts:Date.now()
    })
    if(error){ alert('Error: '+error.message); return }
    setOkMsg({titulo:'✓ Preparado Magistral registrado', detalle:`${pacienteM} · ${fmt(monto)} · Folio ${folioM}`})
    setPacienteM(''); setRutM(''); setFolioM(''); setDescM(''); setMontoM(''); cargarResumen(session); setModulo('ok')
  }

  const inp = {fontSize:15,padding:'10px 12px',border:'1.5px solid var(--bdr)',borderRadius:8,outline:'none',width:'100%',fontFamily:'var(--font)'}
  const lbl = {fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t2)',display:'block',marginBottom:4}
  const fld = {marginBottom:12}

  return (
    <>
      <Head><title>POS Vendedor — BioCuba</title></Head>
      <header style={{background:'#fff',borderBottom:'2.5px solid var(--br)',padding:'0 16px',display:'flex',alignItems:'center',minHeight:50,gap:10,flexWrap:'wrap'}}>
        <img src="/logo.jpg" alt="BioCuba" style={{height:34,width:'auto'}} />
        <div style={{width:1,height:20,background:'var(--bdr)'}}></div>
        <span style={{fontSize:13,fontWeight:500}}>POS Vendedor</span>
        {session&&<span style={{fontSize:11,fontWeight:600,color:'#fff',background:'var(--blue)',padding:'2px 8px',borderRadius:20}}>{session.sucursalNombre} · Caja {session.caja}</span>}
        <button onClick={()=>{clearSession();router.replace('/login?tipo=pos')}} style={{marginLeft:'auto',fontSize:11,padding:'4px 10px',borderRadius:6,border:'1px solid var(--bdr)',background:'transparent',color:'var(--t2)'}}>Salir</button>
      </header>
      <main style={{padding:16,maxWidth:580,margin:'0 auto'}}>

        {modulo==='ok'&&okMsg&&(
          <div style={{background:'var(--gbg)',border:'2px solid var(--gbdr)',borderRadius:14,padding:24,textAlign:'center',marginBottom:14}}>
            <div style={{fontSize:36,marginBottom:8}}>✓</div>
            <div style={{fontSize:18,fontWeight:700,color:'var(--green)',marginBottom:6}}>{okMsg.titulo}</div>
            <div style={{fontSize:13,color:'var(--t2)',marginBottom:16,lineHeight:1.6}}>{okMsg.detalle}</div>
            <button onClick={()=>{setModulo(null);setOkMsg(null)}} style={{padding:'11px 24px',borderRadius:10,border:'none',background:'var(--blue)',color:'#fff',fontSize:14,fontWeight:600}}>Atender siguiente cliente</button>
          </div>
        )}

        {!modulo&&(
          <>
            <div style={{fontSize:13,color:'var(--t2)',marginBottom:14,textAlign:'center'}}>Selecciona el tipo de venta</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:20}}>
              {[
                {id:'bienestar',icon:'🏥',titulo:'Bienestar',sub:'Municipalidad',total:resumen.b,bg:'var(--gbg)',color:'var(--green)'},
                {id:'sindicato',icon:'🤝',titulo:'Sindicato',sub:'Municipal',total:resumen.s,bg:'var(--abg)',color:'var(--amber)'},
                {id:'magistral',icon:'⚗️',titulo:'Magistral',sub:'Preparados',total:resumen.m,bg:'var(--bbg)',color:'var(--blue)'},
              ].map(m=>(
                <div key={m.id} onClick={()=>setModulo(m.id)} style={{background:'#fff',border:'2px solid var(--bdr)',borderRadius:14,padding:16,cursor:'pointer',textAlign:'center'}}>
                  <div style={{fontSize:28,marginBottom:8}}>{m.icon}</div>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{m.titulo}</div>
                  <div style={{fontSize:10,color:'var(--t3)',marginBottom:8}}>{m.sub}</div>
                  <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,background:m.bg,color:m.color}}>{fmt(m.total)} hoy</span>
                </div>
              ))}
            </div>
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:16}}>
              <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--t2)',marginBottom:10}}>Resumen del día</div>
              {[['Bienestar',resumen.b,'var(--green)'],['Sindicato',resumen.s,'var(--amber)'],['Recetario Magistral',resumen.m,'var(--blue)']].map(([l,v,c])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--bdr)'}}>
                  <span style={{fontSize:13,color:c}}>{l}</span>
                  <span style={{fontFamily:'var(--mono)',fontWeight:600,color:c}}>{fmt(v)}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',fontWeight:600}}>
                <span style={{fontSize:13}}>Total del día</span>
                <span style={{fontFamily:'var(--mono)',fontSize:16}}>{fmt(resumen.b+resumen.s+resumen.m)}</span>
              </div>
            </div>
          </>
        )}

        {modulo==='bienestar'&&(
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
              <button onClick={()=>{setModulo(null);setSocioActual(null);setResultadoB(null);setRutB('')}} style={{fontSize:12,padding:'6px 12px',borderRadius:7,border:'1px solid var(--bdr)',background:'#fff',color:'var(--t2)'}}>← Volver</button>
              <span style={{fontSize:14,fontWeight:600,color:'var(--green)'}}>🏥 Bienestar Municipal</span>
            </div>
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:20,marginBottom:14}}>
              <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>Buscar socio por RUT</div>
              <div style={{display:'flex',gap:10,marginBottom:12}}>
                <input value={rutB} onChange={e=>setRutB(formatRutStr(e.target.value))} onKeyDown={e=>e.key==='Enter'&&buscarSocio()} placeholder="12.345.678-9" style={{...inp,fontFamily:'var(--mono)',fontSize:20,fontWeight:700,textAlign:'center',flex:1}} />
                <button onClick={buscarSocio} style={{padding:'10px 18px',borderRadius:8,border:'none',background:'var(--blue)',color:'#fff',fontSize:13,fontWeight:600}}>Verificar</button>
              </div>
            </div>
            {resultadoB?.error&&<div style={{background:'var(--rbg)',border:'1px solid var(--rbdr)',borderRadius:10,padding:14,marginBottom:14,color:'var(--red)',fontSize:13}}>{resultadoB.error}</div>}
            {resultadoB?.noEncontrado&&<div style={{background:'var(--rbg)',border:'1px solid var(--rbdr)',borderRadius:10,padding:14,marginBottom:14,color:'var(--red)',fontSize:13}}>RUT {resultadoB.rut} no está en la nómina activa</div>}
            {resultadoB?.bloqueado&&<div style={{background:'var(--abg)',border:'2px solid var(--abdr)',borderRadius:10,padding:14,marginBottom:14}}><div style={{fontSize:15,fontWeight:700,color:'var(--amber)'}}>🚫 Socio bloqueado</div><div style={{fontSize:13,marginTop:4}}>{resultadoB.nombre}</div><div style={{fontSize:12,color:'var(--t2)',marginTop:6}}>Motivo: {resultadoB.motivo}</div></div>}
            {resultadoB?.ok&&socioActual&&(
              <>
                <div style={{background:socioActual.disponible<=0?'var(--abg)':'var(--gbg)',border:`2px solid ${socioActual.disponible<=0?'var(--abdr)':'var(--gbdr)'}`,borderRadius:10,padding:16,marginBottom:14}}>
                  <div style={{fontSize:18,fontWeight:700,marginBottom:3}}>{socioActual.nombre}</div>
                  <div style={{fontSize:12,color:'var(--t2)',marginBottom:12}}>{socioActual.rut}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                    {[['Cupo',fmt(CUPO),'var(--blue)'],['Usado',fmt(socioActual.usado),'var(--amber)'],['Disponible',fmt(Math.max(0,socioActual.disponible)),socioActual.disponible<=0?'var(--red)':socioActual.disponible<10000?'var(--amber)':'var(--green)']].map(([l,v,c])=>(
                      <div key={l} style={{background:'#fff',borderRadius:8,padding:10,textAlign:'center'}}>
                        <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--t3)',marginBottom:3}}>{l}</div>
                        <div style={{fontFamily:'var(--mono)',fontSize:16,fontWeight:700,color:c}}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {socioActual.disponible<=0&&<div style={{marginTop:10,fontSize:13,fontWeight:600,color:'var(--amber)'}}>⚠ Cupo agotado — el socio puede pagar la diferencia en efectivo o tarjeta</div>}
                </div>
                <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:20}}>
                  <div style={{fontSize:14,fontWeight:600,marginBottom:14,color:'var(--green)'}}>Registrar venta</div>
                  <div style={fld}><label style={lbl}>Folio boleta</label><input value={folioB} onChange={e=>setFolioB(e.target.value)} placeholder="ej: 1114745" style={inp} /></div>
                  <div style={fld}><label style={lbl}>Monto</label><input type="number" value={montoB} onChange={e=>setMontoB(e.target.value)} placeholder="0" style={{...inp,fontFamily:'var(--mono)',fontSize:22,fontWeight:700,textAlign:'center'}} /></div>
                  {montoB&&parseFloat(montoB)>socioActual.disponible&&<div style={{background:'var(--abg)',border:'1px solid var(--abdr)',borderRadius:7,padding:'8px 12px',fontSize:12,color:'var(--amber)',marginBottom:10}}>Supera el cupo en {fmt(parseFloat(montoB)-socioActual.disponible)}. El socio paga la diferencia.</div>}
                  <div style={fld}><label style={lbl}>Observación (opcional)</label><input value={obsB} onChange={e=>setObsB(e.target.value)} placeholder="ej: paga diferencia en efectivo" style={inp} /></div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={registrarBienestar} style={{flex:1,padding:13,borderRadius:10,border:'none',background:'var(--green)',color:'#fff',fontSize:15,fontWeight:600}}>✓ Registrar venta</button>
                    <button onClick={()=>{setSocioActual(null);setResultadoB(null);setRutB('')}} style={{padding:'13px 16px',borderRadius:10,border:'1.5px solid var(--bdr)',background:'transparent',color:'var(--t2)',fontSize:13}}>Cancelar</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {modulo==='sindicato'&&(
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <button onClick={()=>setModulo(null)} style={{fontSize:12,padding:'6px 12px',borderRadius:7,border:'1px solid var(--bdr)',background:'#fff',color:'var(--t2)'}}>← Volver</button>
              <span style={{fontSize:14,fontWeight:600,color:'var(--amber)'}}>🤝 Sindicato Municipal</span>
            </div>
            <div style={{background:'var(--abg)',border:'1px solid var(--abdr)',borderRadius:10,padding:12,marginBottom:14,fontSize:12,color:'var(--amber)'}}>⚠ Verificar cotización timbrada antes de emitir.</div>
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:20}}>
              <div style={fld}><label style={lbl}>Nombre del funcionario</label><input value={nombreS} onChange={e=>setNombreS(e.target.value)} placeholder="Nombre completo" style={inp} /></div>
              <div style={fld}><label style={lbl}>RUT</label><input value={rutS} onChange={e=>setRutS(formatRutStr(e.target.value))} placeholder="ej: 12.345.678-9" style={inp} /></div>
              <div style={fld}><label style={lbl}>N° Folio boleta</label><input value={folioS} onChange={e=>setFolioS(e.target.value)} placeholder="ej: 1114745" style={inp} /></div>
              <div style={fld}><label style={lbl}>Monto</label><input type="number" value={montoS} onChange={e=>setMontoS(e.target.value)} placeholder="0" style={{...inp,fontFamily:'var(--mono)',fontSize:22,fontWeight:700,textAlign:'center'}} /></div>
              <button onClick={registrarSindicato} style={{width:'100%',padding:13,borderRadius:10,border:'none',background:'var(--amber)',color:'#fff',fontSize:15,fontWeight:600}}>✓ Registrar venta Sindicato</button>
            </div>
          </div>
        )}

        {modulo==='magistral'&&(
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <button onClick={()=>setModulo(null)} style={{fontSize:12,padding:'6px 12px',borderRadius:7,border:'1px solid var(--bdr)',background:'#fff',color:'var(--t2)'}}>← Volver</button>
              <span style={{fontSize:14,fontWeight:600,color:'var(--blue)'}}>⚗️ Recetario Magistral</span>
            </div>
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:20}}>
              <div style={fld}><label style={lbl}>Nombre del paciente</label><input value={pacienteM} onChange={e=>setPacienteM(e.target.value)} placeholder="Nombre completo" style={inp} /></div>
              <div style={fld}><label style={lbl}>RUT (opcional)</label><input value={rutM} onChange={e=>setRutM(formatRutStr(e.target.value))} placeholder="ej: 12.345.678-9" style={inp} /></div>
              <div style={fld}><label style={lbl}>N° Folio boleta</label><input value={folioM} onChange={e=>setFolioM(e.target.value)} placeholder="ej: 1114745" style={inp} /></div>
              <div style={fld}><label style={lbl}>Descripción del preparado</label><input value={descM} onChange={e=>setDescM(e.target.value)} placeholder="ej: Crema hidratante 100g" style={inp} /></div>
              <div style={fld}><label style={lbl}>Forma de pago</label><select value={pagoM} onChange={e=>setPagoM(e.target.value)} style={{...inp,background:'#fff'}}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="debito">Débito</option><option value="credito">Crédito</option></select></div>
              <div style={fld}><label style={lbl}>Monto</label><input type="number" value={montoM} onChange={e=>setMontoM(e.target.value)} placeholder="0" style={{...inp,fontFamily:'var(--mono)',fontSize:22,fontWeight:700,textAlign:'center'}} /></div>
              <button onClick={registrarMagistral} style={{width:'100%',padding:13,borderRadius:10,border:'none',background:'var(--blue)',color:'#fff',fontSize:15,fontWeight:600}}>✓ Registrar preparado</button>
            </div>
          </div>
        )}

      </main>
    </>
  )
}
