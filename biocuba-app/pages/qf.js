import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { getSession, clearSession } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL')
const hoy = () => new Date().toISOString().split('T')[0]
const mes = () => new Date().toISOString().slice(0,7)

const MODULOS_DEF = {
  arqueo:    { icon:'📊', titulo:'Arqueo de Caja',      sub:'Cierre diario de cajas',           href:'/arqueo'    },
  bienestar: { icon:'🏥', titulo:'Bienestar Municipal', sub:'Convenio Municipalidad Maipú',     href:'/bienestar' },
  sindicato: { icon:'🤝', titulo:'Sindicato Municipal', sub:'Convenio Sindicato',               href:'/sindicato' },
  magistral: { iconImg:'/icono-recetario.png', titulo:'Recetario Magistral',sub:'Preparados farmacéuticos del mes', href:'/magistral' },
  fondo:     { icon:'💰', titulo:'Fondo de Caja',       sub:'Control del fondo de cambio',      href:'/fondo'     },
  cobros:    { icon:'📋', titulo:'Cobros Pendientes',   sub:'Cuentas por cobrar pendientes',    href:'/cobros'    },
}

const COLORES = { green:'#e5f0e8', amber:'#fef8ec', red:'#fde8e8', blue:'#eef3fc', gray:'#f0efe9' }
const COLORES_TX = { green:'#2a5c3a', amber:'#7a5100', red:'#c0392b', blue:'#1a4a8a', gray:'#6b6860' }

export default function QF() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [stats, setStats] = useState({})
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const s = getSession()
    if (!s || s.rol !== 'qf') { router.replace('/login'); return }
    setSession(s)
    cargarDatos(s)
  }, [])

  async function cargarDatos(s) {
    try {
      const fecha = hoy(), mesActual = mes(), suc = s.sucursal
      const [rArqueo, rB, rS, rM] = await Promise.all([
        supabase.from('arqueos').select('*').eq('sucursal_id',suc).eq('fecha',fecha).single(),
        supabase.from('bienestar_ventas').select('monto').eq('sucursal_id',suc).eq('fecha',fecha),
        supabase.from('sindicato_ventas').select('monto').eq('sucursal_id',suc).eq('mes',mesActual),
        supabase.from('recetas_magistrales').select('monto').eq('sucursal_id',suc).eq('estado','retirada').gte('created_at', mesActual+'-01'),
      ])
      const arqueoHoy = rArqueo.data
      // Depositos pendientes no confirmados
    const {data:deps} = await supabase.from('depositos').select('monto,confirmado').eq('sucursal_id',s.sucursal).gte('fecha_dep',mesActual+'-01')
    const depPendiente = (deps||[]).filter(d=>!d.confirmado).reduce((s,d)=>s+(d.monto||0),0)

    const tB = (rB.data||[]).reduce((s,v)=>s+v.monto,0)
      const tS = (rS.data||[]).reduce((s,v)=>s+v.monto,0)
      const tM = (rM.data||[]).reduce((s,v)=>s+(v.monto||0),0)
      setStats({ arqueoHoy, tB, tS, tM, depPendiente })
      const als = []
      if (!arqueoHoy && new Date().getHours()>=14) als.push({tipo:'amber',msg:'📋 El arqueo de hoy aún no ha sido registrado'})
      else if (arqueoHoy && (arqueoHoy.dif_ef||0)!==0) als.push({tipo:'red',msg:`⚠ Diferencia en efectivo hoy: ${fmt(arqueoHoy.dif_ef)}`})
      if (als.length===0) als.push({tipo:'green',msg:'✓ Todo en orden — sin alertas pendientes'})
      setAlertas(als)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  function getStatModulo(mod) {
    const { arqueoHoy, tB, tS, tM } = stats||{}
    if (mod==='arqueo') {
      if (!arqueoHoy) return {texto:'⏳ Pendiente hoy', color:'amber'}
      return (arqueoHoy.dif_ef||0)===0 ? {texto:'✓ Arqueo completo', color:'green'} : {texto:`⚠ Dif: ${fmt(arqueoHoy.dif_ef)}`, color:'red'}
    }
    if (mod==='bienestar') return tB>0 ? {texto:fmt(tB)+' hoy', color:'green'} : {texto:'Sin ventas hoy', color:'gray'}
    if (mod==='sindicato') return tS>0 ? {texto:fmt(tS)+' este mes', color:'green'} : {texto:'Sin ventas este mes', color:'gray'}
    if (mod==='magistral') return tM>0 ? {texto:fmt(tM)+' este mes', color:'blue'} : {texto:'Sin ventas este mes', color:'gray'}
    return {texto:'Ver módulo', color:'gray'}
  }

  if (loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{textAlign:'center',color:'var(--t2)'}}>Cargando...</div></div>

  const now = new Date()
  const dias=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
  const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

  return (
    <>
      <Head><title>Panel QF — BioCuba</title></Head>
      <header style={{background:'#fff',borderBottom:'2.5px solid var(--br)',padding:'0 20px',display:'flex',alignItems:'center',minHeight:54,gap:12,flexWrap:'wrap'}}>
        <img src="/logo.jpg" alt="BioCuba" style={{height:38,width:'auto'}} />
        <div style={{width:1,height:22,background:'var(--bdr)'}}></div>
        <span style={{fontSize:13,fontWeight:500}}>Panel QF</span>
        <span style={{fontSize:12,fontWeight:600,color:'#fff',background:'var(--blue)',padding:'3px 10px',borderRadius:20}}>{session?.sucursalNombre}</span>
        <span style={{fontSize:11,color:'var(--t3)',marginLeft:'auto'}}>{dias[now.getDay()]} {now.getDate()} de {meses[now.getMonth()]}</span>
        <span style={{fontSize:12,color:'var(--t2)'}}>{session?.nombre}</span>
        <button onClick={()=>{clearSession();router.replace('/login')}} style={{fontSize:11,padding:'5px 12px',borderRadius:6,border:'1px solid var(--bdr)',background:'transparent',color:'var(--t2)'}}>Salir</button>
      </header>
      <main style={{padding:20,maxWidth:960,margin:'0 auto'}}>
        <div style={{marginBottom:16}}>
          {alertas.map((a,i)=>(
            <div key={i} style={{background:COLORES[a.tipo],border:'1px solid',borderColor:a.tipo==='green'?'#aed0b8':a.tipo==='red'?'#e8aaaa':'#e8d5a3',borderRadius:10,padding:'12px 16px',marginBottom:8,fontSize:13,color:COLORES_TX[a.tipo]}}>{a.msg}</div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
          {[
            {lbl:'Venta Golan hoy', val:stats.arqueoHoy?fmt(stats.arqueoHoy.golan?.totalVentas||0):'—', color:'var(--blue)'},
            {lbl:'Efectivo a depositar', val:stats.depPendiente!==undefined?fmt(stats.depPendiente):'—', color:'var(--green)'},
            {lbl:'Convenios del día', val:fmt((stats.tB||0)+(stats.tS||0)), color:'var(--amber)'},
            {lbl:'Magistral este mes', val:fmt(stats.tM||0), color:'var(--blue)'},
          ].map((k,i)=>(
            <div key={i} style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:10,padding:'14px 16px'}}>
              <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>{k.lbl}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:600,color:k.color}}>{k.val}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--t2)',marginBottom:12}}>Módulos de la sucursal</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
          {(session?.modulos||[]).map(mod=>{
            const def=MODULOS_DEF[mod]; if(!def) return null
            const stat=getStatModulo(mod)
            return (
              <a key={mod} href={def.href} style={{background:stat.color==='red'?'var(--rbg)':stat.color==='amber'?'var(--abg)':'#fff',border:`1.5px solid ${stat.color==='red'?'var(--rbdr)':stat.color==='amber'?'var(--abdr)':'var(--bdr)'}`,borderRadius:14,padding:20,textDecoration:'none',display:'block'}}>
                {def.iconImg ? (
                  <img src={def.iconImg} alt="" style={{width:38,height:38,borderRadius:'50%',marginBottom:10,display:'block'}}/>
                ) : (
                  <div style={{fontSize:28,marginBottom:10}}>{def.icon}</div>
                )}
                <div style={{fontSize:14,fontWeight:600,marginBottom:4,color:'var(--tx)'}}>{def.titulo}</div>
                <div style={{fontSize:11,color:'var(--t3)',lineHeight:1.4,marginBottom:10}}>{def.sub}</div>
                <span style={{fontSize:11,fontWeight:500,padding:'3px 10px',borderRadius:20,background:COLORES[stat.color],color:COLORES_TX[stat.color]}}>{stat.texto}</span>
              </a>
            )
          })}
        </div>
        {session?.convenios && (
          <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:16}}>
            <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--t2)',marginBottom:12}}>Convenios del día</div>
            {[['Bienestar Municipal',stats.tB||0,'var(--green)'],['Sindicato Municipal',stats.tS||0,'var(--amber)'],['Total convenios',(stats.tB||0)+(stats.tS||0),null]].map(([lbl,val,col],i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:i<2?'1px solid var(--bdr)':'none'}}>
                <span style={{fontSize:13,color:'var(--t2)',fontWeight:i===2?600:400}}>{lbl}</span>
                <span style={{fontFamily:'var(--mono)',fontSize:i===2?18:15,fontWeight:600,color:col||'var(--tx)'}}>{fmt(val)}</span>
              </div>
            ))}
          </div>
        )}
      </main>
      <style>{`@media(max-width:700px){main>div:nth-child(2){grid-template-columns:1fr 1fr!important}main>div:nth-child(3){grid-template-columns:1fr 1fr!important}}`}</style>
    </>
  )
}
