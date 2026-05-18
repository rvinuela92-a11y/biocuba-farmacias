import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { getSession, clearSession } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const SUC_NOMBRES = { maipu:'Maipú', providencia:'Providencia', sanbernardo:'San Bernardo', florida:'La Florida' }
const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL')
function tiempoRelativo(ts){
  if(!ts) return '—'
  const min = Math.floor((Date.now() - new Date(ts).getTime())/60000)
  if(min < 1) return 'hace un momento'
  if(min < 60) return `${min} min`
  const h = Math.floor(min/60); const m = min%60
  return `${h}h ${m}min`
}
function minutosDesde(ts){
  if(!ts) return 0
  return Math.floor((Date.now() - new Date(ts).getTime())/60000)
}

const ESTADOS_FILTRO = [
  {id:'todas',      label:'Todas',         badge:null},
  {id:'cotizada',   label:'Cotizando',     badge:'gris'},
  {id:'precio',     label:'Avisar precio', badge:'amber'},
  {id:'confirmada', label:'Preparando',    badge:'azul'},
  {id:'lista',      label:'Avisar retiro', badge:'amber'},
]

const MES_NOMBRES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export default function MagistralQF(){
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [config, setConfig] = useState(null)
  const [tab, setTab] = useState('pendientes')
  const [recetas, setRecetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todas')
  const [busquedaHist, setBusquedaHist] = useState('')
  const [mesHist, setMesHist] = useState(new Date().toISOString().slice(0,7))
  const [recetaSel, setRecetaSel] = useState(null)
  const [lightbox, setLightbox] = useState(null)

  // Config editable
  const [editCorreos, setEditCorreos] = useState([])
  const [editNuevoCorreo, setEditNuevoCorreo] = useState('')
  const [editTextoAP, setEditTextoAP] = useState('')
  const [editTextoAR, setEditTextoAR] = useState('')
  const [editTextoP, setEditTextoP] = useState('')
  const [editTextoRet, setEditTextoRet] = useState('')
  const [editAmber, setEditAmber] = useState(15)
  const [editRojo, setEditRojo] = useState(30)
  // Textos editables nuevos
  const [editCorreoCotiz, setEditCorreoCotiz] = useState('')
  const [editCorreoPago, setEditCorreoPago] = useState('')
  const [editRechazoLab, setEditRechazoLab] = useState('')
  // Umbrales por paso (en minutos)
  const [umCot, setUmCot] = useState(30)
  const [umPre, setUmPre] = useState(15)
  const [umEsp, setUmEsp] = useState(60)
  const [umPrep, setUmPrep] = useState(2880)
  const [umRet, setUmRet] = useState(15)
  const [editActivo, setEditActivo] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const configCargada = useRef(false)

  const [toast, setToast] = useState(null)
  function showToast(msg, tipo='ok'){ setToast({msg,tipo}); setTimeout(()=>setToast(null), 3500) }

  useEffect(()=>{
    const s = getSession()
    if(!s || s.rol !== 'qf'){ router.replace('/login'); return }
    setSession(s)
    cargar(s)
    const id = setInterval(()=>cargar(s, true), 30000)
    return () => clearInterval(id)
  },[])

  async function cargar(s, silent=false){
    if(!silent) setLoading(true)
    try {
      const {data: cfg} = await supabase.from('config_recetario').select('*').eq('sucursal_id', s.sucursal).single()
      setConfig(cfg)
      // Solo cargar los campos editables UNA VEZ al inicio absoluto, para no pisar ediciones del usuario
      if(cfg && !configCargada.current){
        setEditCorreos(cfg.correos_laboratorio || [])
        setEditTextoAP(cfg.texto_acuse_presencial || '')
        setEditTextoAR(cfg.texto_acuse_remota || '')
        setEditTextoP(cfg.texto_precio || '')
        setEditTextoRet(cfg.texto_retiro || '')
        setEditAmber(cfg.umbral_amarillo_min || 15)
        setEditRojo(cfg.umbral_rojo_min || 30)
        setEditActivo(!!cfg.activo)
        // Nuevos textos y umbrales
        setEditCorreoCotiz(cfg.texto_correo_cotizacion || '')
        setEditCorreoPago(cfg.texto_correo_confirmacion || '')
        setEditRechazoLab(cfg.texto_rechazo_lab || '')
        setUmCot(cfg.umbral_cotizando_min || 30)
        setUmPre(cfg.umbral_precio_min || 15)
        setUmEsp(cfg.umbral_esperando_min || 60)
        setUmPrep(cfg.umbral_preparando_min || 2880)
        setUmRet(cfg.umbral_retiro_min || 15)
        configCargada.current = true
      }
      const {data: rcts} = await supabase
        .from('recetas_magistrales')
        .select('*, recetas_productos(*)')
        .eq('sucursal_id', s.sucursal)
        .order('created_at', { ascending: false })
        .limit(500)
      setRecetas(rcts || [])
    } catch(e){ console.error(e) }
    finally { if(!silent) setLoading(false) }
  }

  // ====== Cálculos ======

  function recetasPendientes(){
    return recetas.filter(r => !r.rechazada && ['cotizada','precio','confirmada','lista'].includes(r.estado))
  }
  function recetasHistorico(){
    return recetas.filter(r =>
      (r.estado === 'retirada' || r.rechazada) &&
      r.created_at.startsWith(mesHist)
    )
  }
  function statsEstados(){
    const p = recetasPendientes()
    return {
      cotizando: p.filter(r=>r.estado==='cotizada').length,
      precio: p.filter(r=>r.estado==='precio').length,
      preparando: p.filter(r=>r.estado==='confirmada').length,
      retiro: p.filter(r=>r.estado==='lista').length,
    }
  }
  function statsHistorico(){
    const hs = recetasHistorico()
    const retiradas = hs.filter(r => r.estado==='retirada' && !r.rechazada)
    const rechazadas = hs.filter(r => r.rechazada)
    const totalCobrado = retiradas.reduce((s,r)=>s+(r.monto||0), 0)
    const tiempos = retiradas.filter(r=>r.correo_enviado_ts && r.precio_recibido_ts).map(r => (new Date(r.precio_recibido_ts) - new Date(r.correo_enviado_ts))/60000)
    const promLab = tiempos.length>0 ? Math.round(tiempos.reduce((a,b)=>a+b,0)/tiempos.length) : 0
    const promH = Math.floor(promLab/60); const promM = promLab%60
    return {
      totalCobrado,
      preparados: retiradas.length,
      tiempoPromLab: promLab>0 ? (promH>0?`${promH}h ${promM}m`:`${promM} min`) : '—',
      rechazos: rechazadas.length,
      rechazosPct: hs.length>0 ? Math.round(rechazadas.length/hs.length*100) : 0,
      totalRecetasMes: hs.length + recetasPendientes().filter(r=>r.created_at.startsWith(mesHist)).length
    }
  }
  function recetasAtascadas(){
    return recetas.filter(r => !r.rechazada && r.estado==='cotizada' && minutosDesde(r.created_at) >= editRojo)
  }

  // ====== Acciones QF ======

  async function notificarVendedores(){
    if(!confirm('¿Avisar a los vendedores que hay recetas atascadas?')) return
    const atas = recetasAtascadas()
    const nombres = atas.map(r => r.vet ? r.mascota_nombre : `${r.cliente_nombres} ${r.cliente_apaterno}`).join(', ')
    await supabase.from('notificaciones_pos').insert({
      sucursal_id: session.sucursal,
      tipo: 'recetario_atascada',
      mensaje: `${atas.length} receta(s) magistral(es) atascada(s) con el laboratorio (+${editRojo}min). Llama por teléfono para verificar. Pacientes: ${nombres}`,
      link: '/recetario'
    })
    showToast('✓ Vendedores notificados en /pos')
  }

  async function guardarConfig(){
    setSavingConfig(true)
    try {
      // Si el input de nuevo correo tiene contenido pendiente, agregarlo antes de guardar
      let correosToSave = editCorreos
      const pendiente = editNuevoCorreo.trim().toLowerCase()
      if(pendiente && pendiente.includes('@') && !editCorreos.includes(pendiente)){
        correosToSave = [...editCorreos, pendiente]
        setEditCorreos(correosToSave)
        setEditNuevoCorreo('')
      }
      const {error} = await supabase.from('config_recetario').update({
        activo: editActivo,
        correos_laboratorio: correosToSave,
        texto_acuse_presencial: editTextoAP,
        texto_acuse_remota: editTextoAR,
        texto_precio: editTextoP,
        texto_retiro: editTextoRet,
        umbral_amarillo_min: parseInt(editAmber)||15,
        umbral_rojo_min: parseInt(editRojo)||30,
        // Nuevos textos editables
        texto_correo_cotizacion: editCorreoCotiz,
        texto_correo_confirmacion: editCorreoPago,
        texto_rechazo_lab: editRechazoLab,
        // Umbrales por paso
        umbral_cotizando_min: parseInt(umCot)||30,
        umbral_precio_min: parseInt(umPre)||15,
        umbral_esperando_min: parseInt(umEsp)||60,
        umbral_preparando_min: parseInt(umPrep)||2880,
        umbral_retiro_min: parseInt(umRet)||15,
        updated_at: new Date().toISOString()
      }).eq('sucursal_id', session.sucursal)
      if(error) throw error
      showToast('✓ Configuración guardada')
    } catch(e){
      alert('Error: '+e.message)
    } finally {
      setSavingConfig(false)
    }
  }

  function agregarCorreo(){
    const c = editNuevoCorreo.trim().toLowerCase()
    if(!c || !c.includes('@')) return alert('Correo inválido')
    if(editCorreos.includes(c)) return alert('Ya está en la lista')
    setEditCorreos([...editCorreos, c])
    setEditNuevoCorreo('')
  }

  function exportarExcel(){
    const arr = recetasHistorico()
    const headers = ['Numero','Fecha','Paciente','RUT cliente','Telefono','Canal','Estado','Motivo rechazo','Forma pago','Boleta','Monto magistral','Productos adic','Total cobrado','Vendedor','Medico']
    const filas = arr.map(r => {
      const paciente = r.vet ? r.mascota_nombre : `${r.cliente_nombres} ${r.cliente_apaterno} ${r.cliente_amaterno||''}`.trim()
      const prods = (r.recetas_productos||[])
      const totalProd = prods.reduce((s,p)=>s+(p.precio||0),0)
      const totalCobr = (r.monto||0) + totalProd
      const prodTexto = prods.map(p=>`${p.nombre} (${p.precio})`).join(' / ')
      return [
        r.numero || '',
        r.created_at.slice(0,10),
        paciente,
        r.cliente_rut||'',
        (r.cliente_prefijo||'')+(r.cliente_tel||''),
        r.canal,
        r.rechazada?'Rechazada':r.estado,
        r.motivo_rechazo||'',
        r.pago_forma||'',
        r.pago_folio||'',
        r.monto||0,
        prodTexto,
        totalCobr,
        r.vendedor_id||'',
        r.medico_nombre||''
      ]
    })
    const csv = [headers, ...filas].map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recetario-${session.sucursal}-${mesHist}.csv`
    a.click()
  }

  // ====== Estilos ======
  const inp = {fontSize:13,padding:'8px 12px',border:'1.5px solid var(--bdr)',borderRadius:7,outline:'none',width:'100%',fontFamily:'var(--font)',background:'#fff'}
  const lblS = {fontSize:11,fontWeight:600,color:'var(--t2)',marginBottom:4,display:'block'}

  if(!session) return null

  const counts = statsEstados()
  const totalPendientes = counts.cotizando + counts.precio + counts.preparando + counts.retiro
  const atascadas = recetasAtascadas()
  const stats = statsHistorico()

  const pendFiltradas = filtroEstado === 'todas'
    ? recetasPendientes()
    : recetasPendientes().filter(r => r.estado === filtroEstado)

  let histFiltradas = recetasHistorico()
  if(busquedaHist){
    const q = busquedaHist.toLowerCase()
    histFiltradas = histFiltradas.filter(r =>
      (r.cliente_nombres||'').toLowerCase().includes(q) ||
      (r.cliente_apaterno||'').toLowerCase().includes(q) ||
      (r.cliente_rut||'').toLowerCase().includes(q) ||
      (r.numero||'').toLowerCase().includes(q) ||
      (r.mascota_nombre||'').toLowerCase().includes(q) ||
      (r.pago_folio||'').toLowerCase().includes(q)
    )
  }

  return (
    <>
      <Head><title>Recetario Magistral — Panel QF</title></Head>
      <header style={{background:'#fff',borderBottom:'2.5px solid var(--br)',padding:'0 20px',display:'flex',alignItems:'center',minHeight:54,gap:12,flexWrap:'wrap'}}>
        <img src="/logo.jpg" alt="BioCuba" style={{height:38,width:'auto'}} />
        <div style={{width:1,height:22,background:'var(--bdr)'}}></div>
        <img src="/icono-recetario.png" alt="" style={{width:28,height:28,borderRadius:'50%'}}/>
        <span style={{fontSize:13,fontWeight:600,color:'var(--blue)'}}>Recetario Magistral</span>
        <span style={{fontSize:12,fontWeight:600,color:'#fff',background:'var(--blue)',padding:'3px 10px',borderRadius:20}}>{session?.sucursalNombre}</span>
        <a href="/qf" style={{marginLeft:'auto',fontSize:12,color:'var(--t2)',textDecoration:'none',padding:'6px 10px',borderRadius:6}}>← Panel QF</a>
      </header>

      <main style={{padding:20,maxWidth:960,margin:'0 auto'}}>

        {/* Aviso si módulo está inactivo */}
        {config && !config.activo && tab !== 'config' && (
          <div style={{background:'var(--abg)',border:'1.5px solid var(--abdr)',borderRadius:10,padding:'14px 18px',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:18}}>⚙️</span>
            <div style={{flex:1,fontSize:13,color:'var(--amber)'}}>
              <strong>El recetario magistral aún no está activo para esta sucursal.</strong> Ve a Configuración para activarlo.
            </div>
            <button onClick={()=>setTab('config')} style={{padding:'7px 14px',borderRadius:7,border:'1.5px solid var(--abdr)',background:'#fff',color:'var(--amber)',fontSize:12,fontWeight:600,cursor:'pointer'}}>Ir a Configuración →</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{display:'flex',gap:4,background:'var(--s2)',padding:4,borderRadius:10,marginBottom:18}}>
          {[
            {id:'pendientes', label:'⏳ Pendientes', badge:totalPendientes},
            {id:'historico',  label:'📊 Histórico mensual'},
            {id:'config',     label:'⚙ Configuración'}
          ].map(t => {
            const activo = tab === t.id
            return (
              <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:'9px 12px',borderRadius:7,border:'none',background:activo?'#fff':'transparent',fontFamily:'var(--font)',fontWeight:activo?600:500,fontSize:13,color:activo?'var(--tx)':'var(--t2)',cursor:'pointer',whiteSpace:'nowrap',boxShadow:activo?'0 1px 3px rgba(0,0,0,.08)':'none',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                {t.label}
                {t.badge > 0 && <span style={{fontSize:10,padding:'1px 6px',borderRadius:10,background:activo?'var(--red)':'var(--rbg)',color:activo?'#fff':'var(--red)',fontWeight:700}}>{t.badge}</span>}
              </button>
            )
          })}
        </div>

        {/* ============ TAB PENDIENTES ============ */}
        {tab === 'pendientes' && (
          <>
            {atascadas.length > 0 && (
              <div style={{background:'var(--rbg)',border:'1px solid var(--rbdr)',borderRadius:10,padding:'12px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:18}}>⚠</span>
                <div style={{flex:1,fontSize:13,color:'var(--red)'}}>
                  <div style={{fontWeight:600}}>{atascadas.length} receta(s) lleva(n) más de {editRojo} min sin respuesta del laboratorio</div>
                  <div style={{fontSize:11,marginTop:2,color:'#8a4040'}}>{atascadas.map(r=>r.vet?r.mascota_nombre:`${r.cliente_nombres} ${r.cliente_apaterno}`).join(' · ')}</div>
                </div>
                <button onClick={notificarVendedores} style={{background:'#fff',border:'1px solid var(--rbdr)',color:'var(--red)',fontSize:12,padding:'7px 14px',borderRadius:7,cursor:'pointer',fontWeight:600,whiteSpace:'nowrap'}}>Notificar vendedores</button>
              </div>
            )}

            {/* KPIs por estado */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:18}}>
              {[
                {lbl:'1 · Cotizando',     val:counts.cotizando,  color:counts.cotizando>0&&atascadas.length>0?'var(--red)':'var(--t2)'},
                {lbl:'2 · Avisar precio', val:counts.precio,     color:counts.precio>0?'var(--red)':'var(--t2)'},
                {lbl:'3 · Preparando',    val:counts.preparando, color:'var(--t2)'},
                {lbl:'4 · Avisar retiro', val:counts.retiro,     color:counts.retiro>0?'var(--red)':'var(--t2)'},
              ].map((k,i)=>(
                <div key={i} style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:10,padding:'14px 16px'}}>
                  <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5,fontWeight:600}}>{k.lbl}</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:700,color:k.color}}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Filtros chip */}
            <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
              {ESTADOS_FILTRO.map(f=>{
                const n = f.id==='todas' ? totalPendientes : (f.id==='cotizada'?counts.cotizando:f.id==='precio'?counts.precio:f.id==='confirmada'?counts.preparando:counts.retiro)
                const activo = filtroEstado === f.id
                return (
                  <button key={f.id} onClick={()=>setFiltroEstado(f.id)} style={{background:activo?'var(--blue)':'#fff',color:activo?'#fff':'var(--t2)',border:`1px solid ${activo?'var(--blue)':'var(--bdr)'}`,borderRadius:20,padding:'5px 12px',fontSize:12,fontFamily:'var(--font)',fontWeight:500,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:5}}>
                    {f.label}
                    {n > 0 && <span style={{background:activo?'rgba(255,255,255,.25)':'var(--bdr)',color:activo?'#fff':'var(--t2)',fontSize:10,padding:'1px 6px',borderRadius:10,fontWeight:700}}>{n}</span>}
                  </button>
                )
              })}
            </div>

            {/* Tabla pendientes */}
            <CardTabla>
              <CardTablaHead titulo={`Recetas activas — ${pendFiltradas.length}`} extra={<span style={{fontSize:11,color:'var(--t3)'}}>Click en cada fila para ver el detalle completo</span>}/>
              {loading ? <Loading/> : pendFiltradas.length===0 ? <Vacio msg="No hay recetas en este estado"/> : (
                <Tabla
                  cols={['Paciente','Estado','Espera','Canal','Vendedor','Monto']}
                  filas={pendFiltradas.map(r => {
                    const paciente = r.vet ? r.mascota_nombre : `${r.cliente_nombres} ${r.cliente_apaterno}`
                    const min = minutosDesde(r.created_at)
                    const colorT = (r.estado==='cotizada'&&min>=editRojo)?'rojo':(r.estado==='cotizada'&&min>=editAmber)?'amber':'normal'
                    const bgRow = colorT==='rojo'?'var(--rbg)':colorT==='amber'?'var(--abg)':null
                    return {
                      onClick: ()=>setRecetaSel(r),
                      bg: bgRow,
                      cells: [
                        <span>{paciente}{r.vet && <span style={{background:'var(--bbg)',color:'var(--blue)',fontSize:10,padding:'1px 6px',borderRadius:8,marginLeft:5,fontWeight:600}}>🐾</span>}</span>,
                        <Badge estado={r.estado}/>,
                        <Tiempo color={colorT} texto={tiempoRelativo(r.created_at)}/>,
                        r.canal==='presencial'?'🏪 Presencial':'💬 Remota',
                        <span style={{color:'var(--t2)'}}>{r.vendedor_id||'—'}</span>,
                        <span style={{fontFamily:'var(--mono)',fontWeight:600,color:r.monto?'var(--tx)':'var(--t3)'}}>{r.monto?fmt(r.monto):'—'}</span>
                      ]
                    }
                  })}
                />
              )}
            </CardTabla>
          </>
        )}

        {/* ============ TAB HISTÓRICO ============ */}
        {tab === 'historico' && (
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:18}}>
              {[
                {lbl:'Total mes',        val:fmt(stats.totalCobrado), color:'var(--blue)'},
                {lbl:'Preparados',       val:stats.preparados, color:'var(--t2)'},
                {lbl:'Tiempo prom. lab', val:stats.tiempoPromLab, color:'var(--t2)', size:18},
                {lbl:'Rechazos',         val:stats.rechazos>0?`${stats.rechazos} (${stats.rechazosPct}%)`:'0', color:stats.rechazos>0?'var(--red)':'var(--t2)', size:18},
              ].map((k,i)=>(
                <div key={i} style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:10,padding:'14px 16px'}}>
                  <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5,fontWeight:600}}>{k.lbl}</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:k.size||22,fontWeight:700,color:k.color}}>{k.val}</div>
                </div>
              ))}
            </div>

            <CardTabla>
              <CardTablaHead
                titulo={`Histórico — ${histFiltradas.length} receta${histFiltradas.length===1?'':'s'}`}
                extra={
                  <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                    <select value={mesHist} onChange={e=>setMesHist(e.target.value)} style={{...inp,width:170,cursor:'pointer'}}>
                      {(()=>{ const opts=[]; const now=new Date(); for(let i=0;i<12;i++){ const d=new Date(now.getFullYear(), now.getMonth()-i, 1); const v=d.toISOString().slice(0,7); opts.push(<option key={v} value={v}>{MES_NOMBRES[d.getMonth()].charAt(0).toUpperCase()+MES_NOMBRES[d.getMonth()].slice(1)} {d.getFullYear()}</option>) } return opts })()}
                    </select>
                    <input value={busquedaHist} onChange={e=>setBusquedaHist(e.target.value)} placeholder="🔍 Buscar..." style={{...inp,width:200}}/>
                    <button onClick={exportarExcel} style={{padding:'8px 12px',borderRadius:7,border:'1px solid var(--bdr)',background:'#fff',color:'var(--t2)',fontSize:12,fontWeight:600,cursor:'pointer'}}>⬇ Exportar CSV</button>
                  </div>
                }
              />
              {loading ? <Loading/> : histFiltradas.length===0 ? <Vacio msg={busquedaHist?'Sin resultados':'Sin recetas este mes'}/> : (
                <Tabla
                  cols={['Fecha','Paciente','Estado final','Boleta','Pago','Vendedor','Monto']}
                  filas={histFiltradas.map(r=>{
                    const paciente = r.vet ? r.mascota_nombre : `${r.cliente_nombres} ${r.cliente_apaterno}`
                    return {
                      onClick: ()=>setRecetaSel(r),
                      cells: [
                        r.created_at.slice(8,10)+'/'+r.created_at.slice(5,7),
                        <span>{paciente}{r.vet && <span style={{background:'var(--bbg)',color:'var(--blue)',fontSize:10,padding:'1px 6px',borderRadius:8,marginLeft:5,fontWeight:600}}>🐾 {r.mascota_nombre}</span>}</span>,
                        r.rechazada ? <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'var(--rbg)',color:'var(--red)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.03em'}}>{r.motivo_rechazo||'Rechazada'}</span> : <Badge estado={r.estado}/>,
                        <span style={{fontFamily:'var(--mono)'}}>{r.pago_folio || '—'}</span>,
                        r.pago_forma ? ({efectivo:'Efectivo',debito:'Débito',credito:'Crédito',transferencia:'Transferencia'})[r.pago_forma]||r.pago_forma : <span style={{color:'var(--t3)'}}>—</span>,
                        <span style={{color:'var(--t2)'}}>{r.vendedor_id||'—'}</span>,
                        <span style={{fontFamily:'var(--mono)',fontWeight:600,color:r.monto?'var(--tx)':'var(--t3)'}}>{r.monto?fmt(r.monto):'—'}</span>
                      ]
                    }
                  })}
                />
              )}
            </CardTabla>
          </>
        )}

        {/* ============ TAB CONFIGURACIÓN ============ */}
        {tab === 'config' && (
          <>
            {/* Activación del módulo */}
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:'16px 20px',marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:14}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:3}}>Recetario Magistral en {session?.sucursalNombre}</div>
                  <div style={{fontSize:12,color:'var(--t2)'}}>Cuando esté activo, los vendedores podrán registrar recetas desde el POS.</div>
                </div>
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                  <input type="checkbox" checked={editActivo} onChange={e=>setEditActivo(e.target.checked)} style={{width:18,height:18}}/>
                  <span style={{fontSize:13,fontWeight:600,color:editActivo?'var(--green)':'var(--t2)'}}>{editActivo?'Activo':'Inactivo'}</span>
                </label>
              </div>
            </div>

            {/* Correos laboratorio */}
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:'18px 20px',marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>✉ Correos del laboratorio</div>
              <div style={{fontSize:12,color:'var(--t2)',marginBottom:12,lineHeight:1.5}}>Cada vez que se registre una receta, se enviará automáticamente un correo a estos destinatarios con la foto adjunta.</div>
              {editCorreos.length === 0 && (
                <div style={{background:'var(--abg)',border:'1px solid var(--abdr)',borderRadius:7,padding:'10px 12px',fontSize:12,color:'var(--amber)',marginBottom:10}}>⚠ No hay correos configurados. Agrega al menos uno antes de activar el módulo.</div>
              )}
              {editCorreos.map((c,i)=>(
                <div key={i} style={{display:'flex',gap:8,marginBottom:6,alignItems:'center'}}>
                  <input value={c} onChange={e=>setEditCorreos(editCorreos.map((x,j)=>j===i?e.target.value:x))} style={{...inp,fontFamily:'var(--mono)'}}/>
                  <button onClick={()=>setEditCorreos(editCorreos.filter((_,j)=>j!==i))} style={{padding:'7px 11px',background:'transparent',border:'1px solid var(--bdr)',borderRadius:6,color:'var(--red)',cursor:'pointer'}}>🗑</button>
                </div>
              ))}
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <input value={editNuevoCorreo} onChange={e=>setEditNuevoCorreo(e.target.value)} onKeyDown={e=>e.key==='Enter'&&agregarCorreo()} placeholder="correo@laboratorio.cl" style={inp}/>
                <button onClick={agregarCorreo} style={{padding:'8px 16px',borderRadius:7,border:'none',background:'var(--blue)',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>+ Agregar</button>
              </div>
            </div>

            {/* Textos WhatsApp */}
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:'18px 20px',marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>📱 Textos de WhatsApp al cliente</div>
              <div style={{background:'var(--bbg)',border:'1px solid var(--bbdr)',borderRadius:7,padding:'10px 12px',fontSize:11,color:'var(--blue)',marginBottom:14,lineHeight:1.5}}>
                <strong>ℹ Todos los clientes reciben WhatsApp</strong> durante el proceso, sin importar si su receta entró presencial o remota. Son 3 momentos: acuse de recibo, aviso de precio, aviso de retiro.
              </div>

              <div style={{background:'var(--s2)',padding:'8px 12px',borderRadius:6,fontSize:11,fontWeight:600,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>1️⃣ ACUSE DE RECIBO</div>
              <label style={lblS}>Cliente entregó receta en el mesón (Presencial)</label>
              <textarea value={editTextoAP} onChange={e=>setEditTextoAP(e.target.value)} style={{...inp,minHeight:80,resize:'vertical',marginBottom:12}}/>
              <label style={lblS}>Cliente envió foto por WhatsApp (Remota)</label>
              <textarea value={editTextoAR} onChange={e=>setEditTextoAR(e.target.value)} style={{...inp,minHeight:80,resize:'vertical',marginBottom:14}}/>

              <div style={{background:'var(--s2)',padding:'8px 12px',borderRadius:6,fontSize:11,fontWeight:600,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>2️⃣ AVISO DE PRECIO (mismo para ambos canales)</div>
              <textarea value={editTextoP} onChange={e=>setEditTextoP(e.target.value)} style={{...inp,minHeight:110,resize:'vertical',marginBottom:14}}/>

              <div style={{background:'var(--s2)',padding:'8px 12px',borderRadius:6,fontSize:11,fontWeight:600,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>3️⃣ AVISO DE RETIRO (mismo para ambos canales)</div>
              <textarea value={editTextoRet} onChange={e=>setEditTextoRet(e.target.value)} style={{...inp,minHeight:60,resize:'vertical',marginBottom:8}}/>

              <div style={{background:'var(--gbg)',borderRadius:7,padding:'10px 12px',fontSize:11,color:'var(--green)',lineHeight:1.5}}>
                <strong>Variables disponibles:</strong> {'{nombre}'} (nombres del cliente), {'{paciente}'} (nombre completo paciente o mascota), {'{monto}'} (precio del magistral), {'{sucursal}'} (Maipú/SB/Providencia/Florida), {'{numero}'} (N° de receta RX-YYYY-NNNN)
              </div>

              <div style={{borderTop:'1px solid var(--bdr)',marginTop:18,paddingTop:14}}>
                <div style={{fontSize:12,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:10}}>📧 Correos al laboratorio</div>

                <label style={lblS}>Correo cuando se envía cotización al laboratorio</label>
                <textarea value={editCorreoCotiz} onChange={e=>setEditCorreoCotiz(e.target.value)} placeholder="Texto que va en el cuerpo del correo de cotización (después del header BioCuba)" style={{...inp,minHeight:90,resize:'vertical',marginBottom:12,fontFamily:'var(--font)'}}/>

                <label style={lblS}>Correo cuando el cliente paga (avisar al laboratorio que puede preparar)</label>
                <textarea value={editCorreoPago} onChange={e=>setEditCorreoPago(e.target.value)} placeholder="Texto que va en el cuerpo del correo de pago confirmado" style={{...inp,minHeight:80,resize:'vertical',marginBottom:14,fontFamily:'var(--font)'}}/>
              </div>

              <div style={{borderTop:'1px solid var(--bdr)',marginTop:14,paddingTop:14}}>
                <div style={{fontSize:12,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:10}}>📱 WhatsApp adicional</div>

                <label style={lblS}>WhatsApp al cliente cuando el laboratorio NO tiene materia prima</label>
                <textarea value={editRechazoLab} onChange={e=>setEditRechazoLab(e.target.value)} placeholder="Ej: Hola {nombre}, te informamos que el laboratorio no cuenta con la materia prima para preparar tu receta {numero}..." style={{...inp,minHeight:80,resize:'vertical',marginBottom:8,fontFamily:'var(--font)'}}/>
              </div>
            </div>

            {/* Umbrales alerta */}
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:'18px 20px',marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:10}}>⏱ Umbrales de alerta por paso del flujo</div>
              <div style={{fontSize:11,color:'var(--t3)',marginBottom:12,lineHeight:1.5}}>Tiempo máximo que una receta puede quedar en cada paso antes de mostrar alerta roja en /recetario y /magistral.</div>

              {[
                {lbl:'1 · Cotizando (sin respuesta del laboratorio)', val:umCot, set:setUmCot},
                {lbl:'2 · Avisar precio (sin avisar al cliente)', val:umPre, set:setUmPre},
                {lbl:'3 · Esperando pago (cliente sin comprobante)', val:umEsp, set:setUmEsp},
                {lbl:'4 · Preparando (lab sin confirmar preparado)', val:umPrep, set:setUmPrep},
                {lbl:'5 · Avisar retiro (sin avisar al cliente)', val:umRet, set:setUmRet}
              ].map((u,i,arr)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:14,padding:'8px 0',borderBottom:i<arr.length-1?'1px solid var(--bdr)':'none'}}>
                  <span style={{fontSize:12,color:'var(--t2)',flex:1}}>{u.lbl}</span>
                  <input type="number" value={u.val} onChange={e=>u.set(e.target.value)} style={{...inp,width:80,textAlign:'center',fontFamily:'var(--mono)'}}/>
                  <span style={{fontSize:11,color:'var(--t3)',width:50}}>min</span>
                </div>
              ))}
            </div>

            <button onClick={guardarConfig} disabled={savingConfig} style={{width:'100%',padding:13,borderRadius:10,border:'none',background:'var(--blue)',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',opacity:savingConfig?0.6:1}}>{savingConfig?'Guardando...':'Guardar configuración'}</button>
          </>
        )}
      </main>

      {/* Modal detalle */}
      {recetaSel && (
        <DetalleQF r={recetaSel} session={session} onClose={()=>setRecetaSel(null)} onAmpliar={src=>setLightbox(src)}/>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={()=>setLightbox(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.9)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20,cursor:'zoom-out'}}>
          <img src={lightbox} style={{maxWidth:'95%',maxHeight:'90vh',background:'#fff',borderRadius:8}}/>
        </div>
      )}

      {toast && (
        <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',background:toast.tipo==='amber'?'var(--amber)':'var(--green)',color:'#fff',padding:'10px 18px',borderRadius:24,fontSize:13,fontWeight:600,zIndex:300,boxShadow:'0 4px 12px rgba(0,0,0,.2)'}}>{toast.msg}</div>
      )}
    </>
  )
}

// ====== Componentes auxiliares ======

function CardTabla({children}){
  return <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,overflow:'hidden'}}>{children}</div>
}
function CardTablaHead({titulo, extra}){
  return (
    <div style={{padding:'14px 16px',borderBottom:'1px solid var(--bdr)',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
      <span style={{fontSize:13,fontWeight:600}}>{titulo}</span>
      {extra}
    </div>
  )
}
function Tabla({cols, filas}){
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead style={{background:'var(--s2)'}}>
          <tr>{cols.map((c,i)=><th key={i} style={{padding:'10px 12px',textAlign:i===cols.length-1?'right':'left',fontWeight:600,color:'var(--t2)',fontSize:11,textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap'}}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((f,i)=>(
            <tr key={i} onClick={f.onClick} style={{borderTop:'1px solid var(--bdr)',cursor:'pointer',background:f.bg||'transparent'}}>
              {f.cells.map((c,j)=><td key={j} style={{padding:'10px 12px',textAlign:j===f.cells.length-1?'right':'left'}}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
function Loading(){ return <div style={{padding:30,textAlign:'center',color:'var(--t3)',fontSize:13}}>Cargando...</div> }
function Vacio({msg}){ return <div style={{padding:30,textAlign:'center',color:'var(--t3)',fontSize:13}}>{msg}</div> }

function Badge({estado}){
  const cfg = {
    cotizada:   {bg:'var(--s2)',  color:'var(--t2)',    text:'Cotizando'},
    precio:     {bg:'var(--abg)', color:'var(--amber)', text:'Avisar precio'},
    confirmada: {bg:'var(--bbg)', color:'var(--blue)',  text:'Preparando'},
    lista:      {bg:'var(--abg)', color:'var(--amber)', text:'Avisar retiro'},
    retirada:   {bg:'var(--gbg)', color:'var(--green)', text:'Retirada'},
  }[estado] || {bg:'var(--s2)',color:'var(--t2)',text:estado}
  return <span style={{fontSize:10,padding:'3px 9px',borderRadius:20,background:cfg.bg,color:cfg.color,fontWeight:600,textTransform:'uppercase',letterSpacing:'.03em',whiteSpace:'nowrap'}}>{cfg.text}</span>
}
function Tiempo({color, texto}){
  const c = color==='rojo'?'var(--red)':color==='amber'?'var(--amber)':'var(--t2)'
  const bg = color==='rojo'?'var(--red)':color==='amber'?'var(--amber)':'var(--bdr)'
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:6,color:c,fontWeight:color==='rojo'?700:color==='amber'?600:400}}>
      <span style={{width:7,height:7,borderRadius:'50%',background:bg,display:'inline-block'}}/>{texto}
    </span>
  )
}

// ====== DETALLE DESDE QF ======
function DetalleQF({r, session, onClose, onAmpliar}){
  const paciente = r.vet ? r.mascota_nombre : `${r.cliente_nombres} ${r.cliente_apaterno} ${r.cliente_amaterno||''}`.trim()
  const dueno = r.vet ? `${r.cliente_nombres} ${r.cliente_apaterno} ${r.cliente_amaterno||''}`.trim() : null
  const productos = r.recetas_productos || []
  const totalProductos = productos.reduce((s,p)=>s+(p.precio||0), 0)
  const totalCobrar = (r.monto||0) + totalProductos

  return (
    <div onClick={e=>{if(e.target===e.currentTarget) onClose()}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:100,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'30px 16px',overflowY:'auto'}}>
      <div style={{background:'#fff',width:'100%',maxWidth:720,borderRadius:14,padding:24,position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:14,right:14,background:'transparent',border:'none',fontSize:22,cursor:'pointer',color:'var(--t2)',width:32,height:32,borderRadius:'50%'}}>×</button>

        {/* Encabezado */}
        <div style={{paddingRight:30,marginBottom:18}}>
          <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.06em',fontWeight:600,marginBottom:3}}>Receta {r.numero}</div>
          <div style={{fontSize:20,fontWeight:700}}>{paciente}</div>
          {dueno && <div style={{fontSize:12,color:'var(--t3)',marginTop:2}}>Dueño: {dueno}</div>}
          <div style={{fontSize:12,color:'var(--t2)',marginTop:5,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            {new Date(r.created_at).toLocaleString('es-CL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · Registrada por {r.vendedor_id||'—'}
            <span style={{background:r.canal==='presencial'?'var(--bbg)':'var(--abg)',color:r.canal==='presencial'?'var(--blue)':'var(--amber)',padding:'2px 8px',borderRadius:10,fontWeight:600,fontSize:11}}>{r.canal==='presencial'?'🏪 Presencial':'💬 Remota'}</span>
            <Badge estado={r.rechazada?'rechazada':r.estado}/>
          </div>
        </div>

        {/* Info en columnas */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:18}}>
          <div style={{background:'var(--s2)',borderRadius:10,padding:'12px 14px'}}>
            <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.06em',fontWeight:600,marginBottom:8}}>Paciente</div>
            {r.cliente_rut && <DRow k="RUT" v={r.cliente_rut} mono/>}
            <DRow k="Teléfono" v={`${r.cliente_prefijo} ${r.cliente_tel}`} mono/>
            <DRow k="Médico" v={r.medico_nombre}/>
            <DRow k="RUT médico" v={r.medico_rut} mono last/>
          </div>
          {r.pago_forma ? (
            <div style={{background:'var(--gbg)',borderRadius:10,padding:'12px 14px',border:'1px solid var(--gbdr)'}}>
              <div style={{fontSize:10,color:'var(--green)',textTransform:'uppercase',letterSpacing:'.06em',fontWeight:600,marginBottom:8}}>✓ Pago registrado</div>
              <DRow k="Forma" v={({efectivo:'Efectivo',debito:'Tarjeta débito',credito:'Tarjeta crédito',transferencia:'Transferencia'})[r.pago_forma]||r.pago_forma}/>
              <DRow k="N° boleta" v={r.pago_folio} mono/>
              <DRow k="Monto cobrado" v={fmt(totalCobrar)} mono c="var(--green)"/>
              <DRow k="Hora pago" v={r.pago_ts ? new Date(r.pago_ts).toLocaleString('es-CL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—'} last/>
            </div>
          ) : r.rechazada ? (
            <div style={{background:'var(--rbg)',borderRadius:10,padding:'12px 14px',border:'1px solid var(--rbdr)',display:'flex',flexDirection:'column',justifyContent:'center'}}>
              <div style={{fontSize:10,color:'var(--red)',textTransform:'uppercase',letterSpacing:'.06em',fontWeight:600,marginBottom:4}}>Rechazo</div>
              <div style={{fontSize:13,fontWeight:600,color:'var(--red)'}}>{r.motivo_rechazo}</div>
            </div>
          ) : (
            <div style={{background:'var(--abg)',borderRadius:10,padding:'12px 14px',border:'1px solid var(--abdr)',display:'flex',flexDirection:'column',justifyContent:'center'}}>
              <div style={{fontSize:10,color:'var(--amber)',textTransform:'uppercase',letterSpacing:'.06em',fontWeight:600,marginBottom:4}}>Estado</div>
              <div style={{fontSize:13,fontWeight:600,color:'var(--amber)'}}>Aún sin pago confirmado</div>
              {r.monto>0 && <div style={{fontSize:12,marginTop:5,color:'var(--amber)'}}>Cotizado en {fmt(r.monto)}</div>}
            </div>
          )}
        </div>

        {/* Productos adicionales */}
        {productos.length > 0 && (
          <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:10,padding:'12px 14px',marginBottom:18}}>
            <div style={{fontSize:10,color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.06em',fontWeight:600,marginBottom:8}}>🛒 Productos adicionales (NO suman al recetario, son venta normal)</div>
            {productos.map(p=>(
              <div key={p.id} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:12}}>
                <span>{p.nombre}</span>
                <span style={{fontFamily:'var(--mono)',fontWeight:600}}>{fmt(p.precio)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Documentos */}
        {(r.foto_receta_url || r.pago_comprobante_url) && (
          <>
            <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--blue)',marginBottom:10}}>📎 Documentos</div>
            <div style={{display:'grid',gridTemplateColumns:r.foto_receta_url&&r.pago_comprobante_url?'1fr 1fr':'1fr',gap:10,marginBottom:18}}>
              {r.foto_receta_url && (
                <div>
                  <div style={{fontSize:10,color:'var(--t3)',marginBottom:4,fontWeight:600}}>📋 Foto de la receta</div>
                  <img src={r.foto_receta_url} onClick={()=>onAmpliar(r.foto_receta_url)} style={{width:'100%',maxHeight:200,objectFit:'contain',background:'var(--s2)',border:'1px solid var(--bdr)',borderRadius:8,cursor:'zoom-in'}}/>
                </div>
              )}
              {r.pago_comprobante_url && (
                <div>
                  <div style={{fontSize:10,color:'var(--t3)',marginBottom:4,fontWeight:600}}>🧾 Comprobante de transferencia</div>
                  <img src={r.pago_comprobante_url} onClick={()=>onAmpliar(r.pago_comprobante_url)} style={{width:'100%',maxHeight:200,objectFit:'contain',background:'var(--s2)',border:'1px solid var(--bdr)',borderRadius:8,cursor:'zoom-in'}}/>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DRow({k, v, mono, last, c}){
  return (
    <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:last?'none':'1px dashed var(--bdr)',fontSize:12}}>
      <span style={{color:'var(--t2)'}}>{k}</span>
      <span style={{...(mono?{fontFamily:'var(--mono)'}:{}), fontWeight:600, color:c||'var(--tx)'}}>{v}</span>
    </div>
  )
}
