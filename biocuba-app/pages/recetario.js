import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { getSession, clearSession } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const SUC_NOMBRES = { maipu:'Maipú', providencia:'Providencia', sanbernardo:'San Bernardo', florida:'La Florida' }
const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL')
const hoy = () => new Date().toISOString().split('T')[0]
const TECLA_PASTE = (typeof navigator!=='undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)) ? '⌘ V' : 'Ctrl+V' 
function formatRutStr(v){
  v=v.replace(/[^0-9kK]/g,'').toUpperCase()
  if(v.length>1) v=v.slice(0,-1)+'-'+v.slice(-1)
  if(v.length>5) v=v.slice(0,-5)+'.'+v.slice(-5)
  if(v.length>9) v=v.slice(0,-9)+'.'+v.slice(-9)
  return v
}
function horaTexto(ts){
  if(!ts) return ''
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
function tiempoRelativo(ts){
  if(!ts) return '—'
  const min = Math.floor((Date.now() - new Date(ts).getTime())/60000)
  if(min < 1) return 'hace un momento'
  if(min < 60) return `${min} min`
  const h = Math.floor(min/60); const m = min%60
  return `${h}h ${m}min`
}

const TABS = [
  { id:'cotizando',  num:'1', titulo:'Cotizando',     color:'gris' },
  { id:'precio',     num:'2', titulo:'Avisar precio', color:'amber' },
  { id:'esperando',  num:'3', titulo:'Esperando pago', color:'amber' },
  { id:'preparando', num:'4', titulo:'Preparando',    color:'azul' },
  { id:'retiro',     num:'5', titulo:'Avisar retiro', color:'amber' },
  { id:'historial',  num:'',  titulo:'Historial',     color:'gris' },
]

export default function Recetario(){
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [config, setConfig] = useState(null)
  const [tab, setTab] = useState('cotizando')
  const [recetas, setRecetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  // Form nueva receta
  const [verNueva, setVerNueva] = useState(false)
  const [canal, setCanal] = useState('')
  const [fRut, setFRut] = useState('')
  const [fNombres, setFNombres] = useState('')
  const [fApaterno, setFApaterno] = useState('')
  const [fAmaterno, setFAmaterno] = useState('')
  const [fTel, setFTel] = useState('')
  const [fPrefijo, setFPrefijo] = useState('+569')
  const [fExtranjero, setFExtranjero] = useState(false)
  const [fVet, setFVet] = useState(false)
  const [fMascotaNombre, setFMascotaNombre] = useState('')
  const [fMascotaTipo, setFMascotaTipo] = useState('Perro')
  const [fMedNombre, setFMedNombre] = useState('')
  const [fMedRut, setFMedRut] = useState('')
  const [fFoto, setFFoto] = useState(null) // dataURL
  const [verCamara, setVerCamara] = useState(false)
  const [camaraError, setCamaraError] = useState(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [productosForm, setProductosForm] = useState([])
  const [savingNew, setSavingNew] = useState(false)

  // Detalle de receta abierta
  const [recetaSel, setRecetaSel] = useState(null)

  // Modal pago
  const [verPago, setVerPago] = useState(false)
  const [pagoForma, setPagoForma] = useState('efectivo')
  const [pagoFolio, setPagoFolio] = useState('')
  const [pagoComp, setPagoComp] = useState(null)
  const [pagoObs, setPagoObs] = useState('')

  // Modal rechazo
  const [verRechazo, setVerRechazo] = useState(null) // 'lab' | 'cliente'
  const [motivoRechazo, setMotivoRechazo] = useState('')

  // Modal producto adicional
  const [verProd, setVerProd] = useState(false)
  const [prodNombre, setProdNombre] = useState('')
  const [prodPrecio, setProdPrecio] = useState('')

  // Lightbox imagen
  const [lightbox, setLightbox] = useState(null)

  // Toast
  const [toast, setToast] = useState(null)
  function showToast(msg, tipo='ok'){
    setToast({msg, tipo})
    setTimeout(()=>setToast(null), 3500)
  }

  useEffect(()=>{
    const s = getSession()
    if(!s){ router.replace('/login?tipo=pos'); return }
    if(s.rol !== 'vendedor'){ router.replace('/qf'); return }
    setSession(s)
    cargar(s)
    const id = setInterval(()=>cargar(s, true), 30000)
    return () => clearInterval(id)
  },[])

  // Auto-activar cámara cuando se abre el modal de Nueva receta (si todavía no hay foto)
  useEffect(()=>{
    if(verNueva && !fFoto && !verCamara){
      // Pequeño delay para que el modal se renderice primero
      const t = setTimeout(()=>{ if(verNueva && !fFoto) abrirCamara() }, 250)
      return () => clearTimeout(t)
    }
  }, [verNueva, fFoto])

  // Paste (Ctrl/Cmd+V) y drag&drop para foto en modal Nueva receta
  useEffect(()=>{
    if(!verNueva || fFoto) return
    function onPaste(e){
      const items = e.clipboardData?.items || []
      for(const it of items){
        if(it.type.indexOf('image') !== -1){
          const file = it.getAsFile()
          if(file) onFotoChange(file)
          e.preventDefault()
          return
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [verNueva, fFoto])

  // Barra espaciadora para tomar foto cuando la cámara está activa
  useEffect(()=>{
    if(!verCamara) return
    function onKey(e){
      // Solo si no estamos escribiendo en un input
      const tag = (e.target?.tagName || '').toLowerCase()
      if(tag === 'input' || tag === 'textarea') return
      if(e.code === 'Space'){
        e.preventDefault()
        tomarFoto()
      } else if(e.code === 'Escape'){
        e.preventDefault()
        cerrarCamara()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [verCamara])

  // Paste para comprobante de pago
  useEffect(()=>{
    if(!verPago || pagoComp || pagoForma !== 'transferencia') return
    function onPaste(e){
      const items = e.clipboardData?.items || []
      for(const it of items){
        if(it.type.indexOf('image') !== -1){
          const file = it.getAsFile()
          if(file){
            const r = new FileReader()
            r.onload = ev => setPagoComp(ev.target.result)
            r.readAsDataURL(file)
          }
          e.preventDefault()
          return
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [verPago, pagoComp, pagoForma])

  async function cargar(s, silent=false){
    if(!silent) setLoading(true)
    try {
      const {data: cfg} = await supabase.from('config_recetario').select('*').eq('sucursal_id', s.sucursal).single()
      setConfig(cfg)
      if(!cfg || !cfg.activo){
        if(!silent) setLoading(false)
        return
      }
      const {data: rcts} = await supabase
        .from('recetas_magistrales')
        .select('*, recetas_productos(*)')
        .eq('sucursal_id', s.sucursal)
        .order('created_at', { ascending: false })
        .limit(300)
      setRecetas(rcts || [])
    } catch(e) { console.error(e) }
    finally { if(!silent) setLoading(false) }
  }

  // ====== FORM NUEVA RECETA ======

  function resetForm(){
    setCanal('')
    setFRut(''); setFNombres(''); setFApaterno(''); setFAmaterno('')
    setFTel(''); setFPrefijo('+569'); setFExtranjero(false)
    setFVet(false); setFMascotaNombre(''); setFMascotaTipo('Perro')
    setFMedNombre(''); setFMedRut('')
    setFFoto(null); setProductosForm([])
    cerrarCamara()
  }

  async function buscarClientePorRut(rutFmt){
    const rut = rutFmt.replace(/[.\s]/g,'').toUpperCase()
    if(rut.length < 6) return
    const {data} = await supabase.from('clientes_magistral').select('*').eq('rut', rut).single()
    if(data){
      setFNombres(data.nombres||'')
      setFApaterno(data.apaterno||'')
      setFAmaterno(data.amaterno||'')
      setFTel(data.tel||'')
      setFPrefijo(data.prefijo||'+569')
      setFExtranjero(!!data.extranjero)
      showToast('✓ Cliente encontrado: '+data.nombres+' '+data.apaterno)
    }
  }

  function onFotoChange(file){
    if(!file) return
    if(file.size > 7*1024*1024){ alert('La foto es muy grande (máx 7MB)'); return }
    const r = new FileReader()
    r.onload = e => setFFoto(e.target.result)
    r.readAsDataURL(file)
  }

  async function abrirCamara(){
    setCamaraError(null)
    setVerCamara(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          advanced: [
            { focusMode: 'continuous' },
            { whiteBalanceMode: 'continuous' },
            { exposureMode: 'continuous' }
          ]
        },
        audio: false
      })
      streamRef.current = stream
      if(videoRef.current){
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch(e) {
      setCamaraError('No se puede acceder a la cámara: ' + e.message)
    }
  }

  function cerrarCamara(){
    if(streamRef.current){
      streamRef.current.getTracks().forEach(t=>t.stop())
      streamRef.current = null
    }
    setVerCamara(false)
    setCamaraError(null)
  }

  function tomarFoto(){
    if(!videoRef.current) return
    const v = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setFFoto(dataUrl)
    cerrarCamara()
  }

  async function comprimirImagen(dataUrl, maxWidth = 1200, calidad = 0.7){
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const ratio = Math.min(1, maxWidth / img.width)
        const w = Math.round(img.width * ratio)
        const h = Math.round(img.height * ratio)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', calidad))
      }
      img.onerror = reject
      img.src = dataUrl
    })
  }

  async function subirFoto(dataUrl, tipo){
    // Comprimir antes de subir (achica 5MB+ a ~200KB)
    let dataUrlOptimizada = dataUrl
    if (dataUrl && dataUrl.startsWith('data:image')) {
      try { dataUrlOptimizada = await comprimirImagen(dataUrl) } catch(e){ console.warn('No se pudo comprimir, subiendo original') }
    }
    const res = await fetch('/api/recetario/subir-foto', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ dataUrl: dataUrlOptimizada, tipo, sucursal_id: session.sucursal })
    })
    const j = await res.json()
    if(!res.ok) throw new Error(j.error||'Error subiendo foto')
    return j.url
  }

  async function enviarReceta(){
    // Validaciones
    if(!canal){ alert('Selecciona el canal (Presencial / Remota)'); return }
    if(!fNombres.trim() || !fApaterno.trim()){ alert('Ingresa nombres y apellido paterno del cliente'); return }
    if(!fTel.trim()){ alert('Ingresa el teléfono del cliente'); return }
    if(!fMedNombre.trim() || !fMedRut.trim()){ alert('Ingresa nombre y RUT del médico'); return }
    if(!fFoto){ alert('Adjunta la foto de la receta'); return }
    if(fVet && !fMascotaNombre.trim()){ alert('Ingresa el nombre de la mascota'); return }

    setSavingNew(true)
    try {
      // 1) Subir la foto
      const fotoUrl = await subirFoto(fFoto, 'recetas')

      // 2) Crear receta + enviar correo
      const res = await fetch('/api/recetario/crear', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          sucursal_id: session.sucursal,
          cliente_rut: fRut.replace(/[.\s]/g,'').toUpperCase(),
          cliente_nombres: fNombres.trim(),
          cliente_apaterno: fApaterno.trim(),
          cliente_amaterno: fAmaterno.trim(),
          cliente_tel: fTel.replace(/\s/g,''),
          cliente_prefijo: fPrefijo,
          extranjero: fExtranjero,
          vet: fVet,
          mascota_nombre: fVet ? fMascotaNombre.trim() : null,
          mascota_tipo: fVet ? fMascotaTipo : null,
          medico_nombre: fMedNombre.trim(),
          medico_rut: fMedRut.trim(),
          canal,
          foto_receta_url: fotoUrl,
          productos_adic: productosForm,
          vendedor_id: session.nombre
        })
      })
      const j = await res.json()
      if(!res.ok) throw new Error(j.error || 'Error al crear receta')

      if(j.warning) showToast('⚠ '+j.warning, 'amber')
      else showToast('✓ Receta '+j.receta.numero+' enviada al laboratorio')

      resetForm()
      setVerNueva(false)
      await cargar(session)
    } catch(e) {
      alert('Error: '+e.message)
    } finally {
      setSavingNew(false)
    }
  }

  // ====== ACCIONES SOBRE RECETA ======

  async function accion(receta_id, accion, payload={}){
    try {
      const res = await fetch('/api/recetario/actualizar', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ receta_id, accion, payload, actor: session.nombre })
      })
      const j = await res.json()
      if(!res.ok) throw new Error(j.error || 'Error en la acción')
      return j
    } catch(e) {
      alert('Error: '+e.message)
      throw e
    }
  }

  async function ingresarPrecioManual(){
    const monto = prompt('Monto del magistral cotizado por el laboratorio (CLP):')
    if(!monto) return
    const n = parseInt(monto.replace(/[^0-9]/g,''))
    if(!n || n < 500){ alert('Monto inválido'); return }
    await accion(recetaSel.id, 'precio_manual', { monto: n })
    showToast('✓ Precio ingresado: '+fmt(n))
    await cargar(session)
    const upd = await supabase.from('recetas_magistrales').select('*, recetas_productos(*)').eq('id', recetaSel.id).single()
    setRecetaSel(upd.data)
  }


  async function avisarPrecio(r){
    await accion(r.id, 'avisar_precio', {})
  }
  async function confirmarPago(){
    if(!pagoFolio.trim()){ alert('Ingresa el número de boleta'); return }
    if(pagoForma === 'transferencia' && !pagoComp){ alert('Adjunta el comprobante de transferencia'); return }
    try {
      let compUrl = null
      if(pagoComp) compUrl = await subirFoto(pagoComp, 'comprobante')
      await accion(recetaSel.id, 'confirmar_pago', {
        forma: pagoForma, folio: pagoFolio.trim(),
        comprobante_url: compUrl, obs: pagoObs
      })
      showToast('✓ Pago confirmado · Recetario notificado')
      setVerPago(false); setPagoFolio(''); setPagoComp(null); setPagoObs(''); setPagoForma('efectivo')
      await cargar(session)
      const upd = await supabase.from('recetas_magistrales').select('*, recetas_productos(*)').eq('id', recetaSel.id).single()
      setRecetaSel(upd.data)
    } catch(e){ /* ya se mostró el error */ }
  }

  async function rechazar(){
    if(!motivoRechazo){ alert('Selecciona un motivo'); return }
    const acc = verRechazo === 'lab' ? 'rechazar_lab' : 'rechazar_cliente'
    await accion(recetaSel.id, acc, { motivo: motivoRechazo })
    showToast('Receta marcada como '+motivoRechazo)
    setVerRechazo(null); setMotivoRechazo('')
    setRecetaSel(null)
    await cargar(session)
  }

  async function preparadoLlego(){
    await accion(recetaSel.id, 'preparado_llego', {})
    showToast('✓ Preparado registrado como recibido')
    await cargar(session)
    const upd = await supabase.from('recetas_magistrales').select('*, recetas_productos(*)').eq('id', recetaSel.id).single()
    setRecetaSel(upd.data)
  }

  async function clienteRetiro(){
    if(!confirm('¿Confirmar que el cliente retiró el preparado?')) return
    await accion(recetaSel.id, 'cliente_retiro', {})
    showToast('✓ Receta cerrada')
    setRecetaSel(null)
    await cargar(session)
  }

  async function agregarProducto(){
    const nombre = prodNombre.trim(); const precio = parseInt(prodPrecio)
    if(!nombre || !precio){ alert('Completa nombre y precio'); return }
    await accion(recetaSel.id, 'agregar_producto', { nombre, precio })
    setProdNombre(''); setProdPrecio(''); setVerProd(false)
    const upd = await supabase.from('recetas_magistrales').select('*, recetas_productos(*)').eq('id', recetaSel.id).single()
    setRecetaSel(upd.data)
  }

  async function quitarProducto(producto_id){
    if(!confirm('¿Quitar este producto?')) return
    await accion(recetaSel.id, 'quitar_producto', { producto_id })
    const upd = await supabase.from('recetas_magistrales').select('*, recetas_productos(*)').eq('id', recetaSel.id).single()
    setRecetaSel(upd.data)
  }

  // ====== Filtrado de recetas según tab ======

  function recetasFiltradas(){
    let arr = recetas
    if(tab === 'cotizando')  arr = arr.filter(r => r.estado === 'cotizada' && !r.rechazada)
    else if(tab === 'precio')     arr = arr.filter(r => r.estado === 'precio' && !r.rechazada)
    else if(tab === 'esperando')  arr = arr.filter(r => r.estado === 'esperando_pago' && !r.rechazada)
    else if(tab === 'preparando') arr = arr.filter(r => r.estado === 'confirmada' && !r.rechazada)
    else if(tab === 'retiro')     arr = arr.filter(r => r.estado === 'lista' && !r.rechazada)
    else if(tab === 'historial')  arr = arr.filter(r => r.estado === 'retirada' || r.rechazada)
    if(busqueda){
      const q = busqueda.toLowerCase()
      arr = arr.filter(r =>
        (r.cliente_nombres||'').toLowerCase().includes(q) ||
        (r.cliente_apaterno||'').toLowerCase().includes(q) ||
        (r.cliente_amaterno||'').toLowerCase().includes(q) ||
        (r.cliente_rut||'').toLowerCase().includes(q) ||
        (r.numero||'').toLowerCase().includes(q) ||
        (r.mascota_nombre||'').toLowerCase().includes(q) ||
        (r.medico_nombre||'').toLowerCase().includes(q) ||
        (r.pago_folio||'').toLowerCase().includes(q) ||
        (r.cliente_tel||'').toLowerCase().includes(q)
      )
    }
    return arr
  }

  function contarPorEstado(){
    return {
      cotizando:  recetas.filter(r => r.estado === 'cotizada' && !r.rechazada).length,
      precio:     recetas.filter(r => r.estado === 'precio' && !r.rechazada).length,
      esperando:  recetas.filter(r => r.estado === 'esperando_pago' && !r.rechazada).length,
      preparando: recetas.filter(r => r.estado === 'confirmada' && !r.rechazada).length,
      retiro:     recetas.filter(r => r.estado === 'lista' && !r.rechazada).length,
    }
  }

  // ====== Estilos compartidos ======
  const inp = {fontSize:14,padding:'9px 11px',border:'1.5px solid var(--bdr)',borderRadius:8,outline:'none',width:'100%',fontFamily:'var(--font)',background:'#fff'}
  const lbl = {fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t2)',display:'block',marginBottom:4}
  const fld = {marginBottom:11}
  const btnSec = {padding:'8px 14px',borderRadius:7,border:'1.5px solid var(--bdr)',background:'#fff',color:'var(--t2)',fontSize:12,fontWeight:600,cursor:'pointer'}
  const btnPri = {padding:'10px 16px',borderRadius:8,border:'none',background:'var(--blue)',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}

  if(!session) return null

  // ====== Pantalla cuando módulo no activado en esta sucursal ======
  if(config && !config.activo){
    return (
      <>
        <Head><title>Recetario Magistral — BioCuba</title></Head>
        <HeaderRec session={session} router={router} />
        <main style={{padding:20,maxWidth:580,margin:'0 auto'}}>
          <div style={{background:'var(--abg)',border:'1.5px solid var(--abdr)',borderRadius:12,padding:24,textAlign:'center',marginTop:30}}>
            <div style={{fontSize:32,marginBottom:8}}>⚙️</div>
            <div style={{fontSize:16,fontWeight:600,color:'var(--amber)',marginBottom:6}}>Módulo en configuración</div>
            <div style={{fontSize:13,color:'var(--t2)',lineHeight:1.5}}>
              El Recetario Magistral aún no está activo para <strong>{SUC_NOMBRES[session.sucursal]}</strong>.<br/>
              La QF puede activarlo desde su Panel.
            </div>
          </div>
        </main>
      </>
    )
  }

  const counts = contarPorEstado()
  const recetasView = recetasFiltradas()

  return (
    <>
      <Head><title>Recetario Magistral — BioCuba</title></Head>
      <HeaderRec session={session} router={router} />

      <main style={{padding:14,maxWidth:580,margin:'0 auto'}}>

        {/* Volver al POS */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
          <button onClick={()=>router.push('/pos')} style={{fontSize:12,padding:'6px 12px',borderRadius:7,border:'1px solid var(--bdr)',background:'#fff',color:'var(--t2)',cursor:'pointer'}}>← Volver</button>
          <span style={{fontSize:13,fontWeight:600,color:'var(--blue)',display:'flex',alignItems:'center',gap:6}}>
            <img src="/icono-recetario.png" alt="" style={{width:20,height:20,borderRadius:'50%'}}/>
            Recetario Magistral
          </span>
        </div>

        {/* Botón + Nueva receta */}
        <button onClick={()=>setVerNueva(true)} style={{width:'100%',padding:'14px 16px',borderRadius:12,border:'none',background:'var(--blue)',color:'#fff',fontSize:15,fontWeight:600,marginBottom:14,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <span style={{fontSize:18}}>+</span> Nueva receta
        </button>

        {/* Tabs */}
        <div style={{display:'flex',gap:4,background:'var(--s2)',padding:4,borderRadius:10,marginBottom:12,overflowX:'auto'}}>
          {TABS.map(t => {
            const activo = tab === t.id
            const count = counts[t.id]
            return (
              <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:'0 0 auto',padding:'8px 12px',borderRadius:7,border:'none',background:activo?'#fff':'transparent',fontFamily:'var(--font)',fontWeight:activo?600:500,fontSize:11,color:activo?'var(--tx)':'var(--t2)',cursor:'pointer',whiteSpace:'nowrap',display:'flex',alignItems:'center',justifyContent:'center',gap:4,boxShadow:activo?'0 1px 3px rgba(0,0,0,.08)':'none'}}>
                {t.num && <span style={{fontSize:10,fontWeight:700,color:'var(--t3)'}}>{t.num}</span>}
                {t.titulo}
                {count > 0 && <span style={{fontSize:9,padding:'1px 5px',borderRadius:10,background:activo?'var(--red)':'var(--rbg)',color:activo?'#fff':'var(--red)',fontWeight:700}}>{count}</span>}
              </button>
            )
          })}
        </div>

        {/* Buscador */}
        {tab === 'historial' && (
          <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="🔍 Buscar por nombre, RUT, boleta, mascota, médico, teléfono..." style={{...inp,marginBottom:12}} />
        )}

        {/* Lista */}
        {loading ? (
          <div style={{textAlign:'center',padding:30,color:'var(--t3)'}}>Cargando...</div>
        ) : recetasView.length === 0 ? (
          <div style={{textAlign:'center',padding:30,color:'var(--t3)',fontSize:13}}>
            {tab === 'cotizando' && 'No hay recetas en cotización'}
            {tab === 'precio' && 'No hay precios por avisar'}
            {tab === 'esperando' && 'No hay pagos pendientes'}
            {tab === 'preparando' && 'No hay preparados en curso'}
            {tab === 'retiro' && 'No hay retiros por avisar'}
            {tab === 'historial' && (busqueda?'No se encontraron resultados':'Historial vacío')}
          </div>
        ) : (
          <div>
            {recetasView.map(r => <FilaReceta key={r.id} r={r} onClick={()=>setRecetaSel(r)} />)}
          </div>
        )}
      </main>

      {/* ============ MODAL NUEVA RECETA ============ */}
      {verNueva && (
        <Modal cerrar={()=>{ if(!savingNew) setVerNueva(false) }}>
          <div style={{padding:'18px 20px 20px'}}>
            <div style={{fontSize:16,fontWeight:600,marginBottom:14}}>Nueva receta magistral</div>

            {/* Canal */}
            <div style={fld}>
              <label style={lbl}>Canal de ingreso</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <button onClick={()=>setCanal('presencial')} style={{padding:'12px 14px',borderRadius:10,border:`2px solid ${canal==='presencial'?'var(--blue)':'var(--bdr)'}`,background:canal==='presencial'?'var(--bbg)':'#fff',cursor:'pointer',textAlign:'center'}}>
                  <div style={{fontSize:20,marginBottom:3}}>🏪</div>
                  <div style={{fontSize:12,fontWeight:600,color:canal==='presencial'?'var(--blue)':'var(--t2)'}}>Presencial</div>
                  <div style={{fontSize:10,color:'var(--t3)',marginTop:1}}>Cliente en el mesón</div>
                </button>
                <button onClick={()=>setCanal('remota')} style={{padding:'12px 14px',borderRadius:10,border:`2px solid ${canal==='remota'?'var(--blue)':'var(--bdr)'}`,background:canal==='remota'?'var(--bbg)':'#fff',cursor:'pointer',textAlign:'center'}}>
                  <div style={{fontSize:20,marginBottom:3}}>💬</div>
                  <div style={{fontSize:12,fontWeight:600,color:canal==='remota'?'var(--blue)':'var(--t2)'}}>Remota</div>
                  <div style={{fontSize:10,color:'var(--t3)',marginTop:1}}>Foto por WhatsApp</div>
                </button>
              </div>
            </div>

            {/* Veterinaria */}
            <div style={{...fld,display:'flex',alignItems:'center',gap:8,padding:'10px 12px',background:fVet?'var(--bbg)':'var(--s2)',borderRadius:8}}>
              <input type="checkbox" id="vet" checked={fVet} onChange={e=>setFVet(e.target.checked)} style={{width:16,height:16}} />
              <label htmlFor="vet" style={{fontSize:13,cursor:'pointer',userSelect:'none'}}>🐾 Es una receta veterinaria</label>
            </div>

            {/* Mascota (si veterinaria) */}
            {fVet && (
              <div style={{background:'var(--bbg)',borderRadius:8,padding:12,marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>DATOS DE LA MASCOTA</div>
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:8}}>
                  <div><label style={lbl}>Nombre mascota *</label><input value={fMascotaNombre} onChange={e=>setFMascotaNombre(e.target.value)} placeholder="ej: Coffee" style={inp}/></div>
                  <div><label style={lbl}>Tipo</label><select value={fMascotaTipo} onChange={e=>setFMascotaTipo(e.target.value)} style={inp}><option>Perro</option><option>Gato</option><option>Ave</option><option>Otro</option></select></div>
                </div>
                <div style={{fontSize:10,color:'var(--blue)',marginTop:8,lineHeight:1.4}}>👇 Datos del dueño:</div>
              </div>
            )}

            {/* RUT */}
            <div style={fld}>
              <label style={lbl}>RUT {fVet?'del dueño':'cliente'} (opcional)</label>
              <input value={fRut} onChange={e=>{const v=formatRutStr(e.target.value); setFRut(v); buscarClientePorRut(v)}} placeholder="ej: 12.345.678-9" style={inp}/>
            </div>

            {/* Nombres */}
            <div style={fld}>
              <label style={lbl}>Nombres *</label>
              <input value={fNombres} onChange={e=>setFNombres(e.target.value)} placeholder="ej: María Camila" style={inp}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:11}}>
              <div><label style={lbl}>Apellido paterno *</label><input value={fApaterno} onChange={e=>setFApaterno(e.target.value)} placeholder="González" style={inp}/></div>
              <div><label style={lbl}>Apellido materno</label><input value={fAmaterno} onChange={e=>setFAmaterno(e.target.value)} placeholder="Pérez" style={inp}/></div>
            </div>

            {/* Teléfono */}
            <div style={fld}>
              <label style={lbl}>Teléfono * {fExtranjero && <span style={{color:'var(--blue)'}}>(extranjero)</span>}</label>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <button onClick={()=>setFExtranjero(!fExtranjero)} title={fExtranjero?'Cliente chileno':'Cliente extranjero'} style={{padding:'9px 10px',borderRadius:8,border:'1.5px solid var(--bdr)',background:fExtranjero?'var(--bbg)':'#fff',cursor:'pointer',fontSize:14}}>🌎</button>
                {fExtranjero ? (
                  <input value={fPrefijo} onChange={e=>setFPrefijo(e.target.value)} placeholder="+54" style={{...inp,width:80,fontFamily:'var(--mono)'}} />
                ) : (
                  <span style={{padding:'9px 11px',background:'var(--s2)',borderRadius:8,fontSize:13,fontFamily:'var(--mono)',color:'var(--t2)',fontWeight:600}}>+569</span>
                )}
                <input value={fTel} onChange={e=>setFTel(e.target.value)} placeholder="9876 5432" style={{...inp,flex:1,fontFamily:'var(--mono)'}}/>
              </div>
            </div>

            {/* Médico */}
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:8,marginBottom:11}}>
              <div><label style={lbl}>Médico tratante *</label><input value={fMedNombre} onChange={e=>setFMedNombre(e.target.value)} placeholder="Dr. Juan Pérez" style={inp}/></div>
              <div><label style={lbl}>RUT médico *</label><input value={fMedRut} onChange={e=>setFMedRut(formatRutStr(e.target.value))} placeholder="11.111.111-1" style={inp}/></div>
            </div>

            {/* Foto */}
            <div style={fld}>
              <label style={lbl}>Foto de la receta *</label>
              {!fFoto ? (
                <>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:6}}>
                    <button type="button" onClick={abrirCamara} style={{padding:'12px 10px',border:'none',borderRadius:10,background:'var(--blue)',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                      <span style={{fontSize:16}}>📷</span> Abrir cámara
                    </button>
                    <label style={{padding:'12px 10px',border:'1.5px solid var(--bdr)',borderRadius:10,background:'#fff',color:'var(--t2)',fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                      <input type="file" accept="image/*" onChange={e=>onFotoChange(e.target.files[0])} style={{display:'none'}} />
                      <span style={{fontSize:16}}>📁</span> Elegir archivo
                    </label>
                  </div>
                  <div
                    onDragOver={e=>{e.preventDefault();e.currentTarget.style.background='var(--bbg)';e.currentTarget.style.borderColor='var(--blue)'}}
                    onDragLeave={e=>{e.currentTarget.style.background='var(--s2)';e.currentTarget.style.borderColor='var(--bdr)'}}
                    onDrop={e=>{e.preventDefault();e.currentTarget.style.background='var(--s2)';e.currentTarget.style.borderColor='var(--bdr)';const f=e.dataTransfer.files[0];if(f)onFotoChange(f)}}
                    style={{padding:'12px 14px',border:'2px dashed var(--bdr)',borderRadius:10,textAlign:'center',background:'var(--s2)',transition:'all .15s',fontSize:11,color:'var(--t3)'}}>
                    También puedes pegar con {TECLA_PASTE} o arrastrar la imagen aquí
                  </div>
                </>
              ) : (
                <div style={{position:'relative'}}>
                  <img src={fFoto} alt="Receta" style={{width:'100%',maxHeight:200,objectFit:'contain',border:'1px solid var(--bdr)',borderRadius:8,background:'var(--s2)'}}/>
                  <button onClick={()=>setFFoto(null)} style={{position:'absolute',top:6,right:6,background:'rgba(0,0,0,.7)',color:'#fff',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer'}}>×</button>
                </div>
              )}
            </div>

            {/* Productos adicionales (solo Remota) */}
            {canal === 'remota' && (
              <div style={{background:'var(--abg)',borderRadius:8,padding:12,marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--amber)',textTransform:'uppercase',letterSpacing:'.06em'}}>🛒 Otros productos cotizados</div>
                  <button onClick={()=>{
                    const nombre = prompt('Nombre del producto:'); if(!nombre) return
                    const precio = prompt('Precio:'); const p = parseInt(precio); if(!p) return
                    setProductosForm([...productosForm, {nombre, precio:p}])
                  }} style={{fontSize:11,padding:'3px 8px',borderRadius:6,border:'1px solid var(--abdr)',background:'#fff',color:'var(--amber)',fontWeight:600,cursor:'pointer'}}>+ Agregar</button>
                </div>
                {productosForm.length === 0 ? (
                  <div style={{fontSize:11,color:'var(--t3)'}}>Si el cliente consultó por otros productos (no magistral), agrégalos acá. <strong>No suman al recetario.</strong></div>
                ) : (
                  <div>
                    {productosForm.map((p,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:12}}>
                        <span>{p.nombre}</span>
                        <span style={{display:'flex',gap:6,alignItems:'center'}}>
                          <span style={{fontFamily:'var(--mono)',fontWeight:600}}>{fmt(p.precio)}</span>
                          <button onClick={()=>setProductosForm(productosForm.filter((_,j)=>j!==i))} style={{background:'transparent',border:'none',color:'var(--red)',cursor:'pointer',padding:0,fontSize:14}}>×</button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Botones */}
            <div style={{display:'flex',gap:8,marginTop:14}}>
              <button onClick={()=>{ if(!savingNew){ resetForm(); setVerNueva(false) } }} disabled={savingNew} style={{...btnSec,flex:'0 0 90px'}}>Cancelar</button>
              <button onClick={enviarReceta} disabled={savingNew} style={{...btnPri,flex:1,opacity:savingNew?0.6:1}}>{savingNew?'Enviando...':'✓ Enviar al recetario'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============ MODAL DETALLE RECETA ============ */}
      {recetaSel && (
        <Modal cerrar={()=>setRecetaSel(null)}>
          <DetalleReceta
            r={recetaSel}
            config={config}
            session={session}
            onAmpliar={src=>setLightbox(src)}
            onAccionPrecio={ingresarPrecioManual} onAvisarPrecio={avisarPrecio}
            onConfirmarPago={()=>setVerPago(true)}
            onRechazarLab={()=>setVerRechazo('lab')}
            onRechazarCliente={()=>setVerRechazo('cliente')}
            onPreparadoLlego={preparadoLlego}
            onClienteRetiro={clienteRetiro}
            onAgregarProducto={()=>setVerProd(true)}
            onQuitarProducto={quitarProducto}
          />
        </Modal>
      )}

      {/* ============ MODAL PAGO ============ */}
      {verPago && recetaSel && (
        <Modal cerrar={()=>setVerPago(false)} z={120}>
          <div style={{padding:20}}>
            <div style={{fontSize:15,fontWeight:600,marginBottom:14}}>Confirmar pago del cliente</div>

            <div style={fld}>
              <label style={lbl}>Forma de pago</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {[
                  {id:'efectivo',l:'💵 Efectivo'},
                  {id:'debito',l:'💳 Tarjeta débito'},
                  {id:'credito',l:'💳 Tarjeta crédito'},
                  {id:'transferencia',l:'🏦 Transferencia'},
                ].map(o=>(
                  <button key={o.id} onClick={()=>setPagoForma(o.id)} style={{padding:'9px 10px',borderRadius:7,border:`1.5px solid ${pagoForma===o.id?'var(--blue)':'var(--bdr)'}`,background:pagoForma===o.id?'var(--bbg)':'#fff',fontSize:12,fontWeight:pagoForma===o.id?600:400,color:pagoForma===o.id?'var(--blue)':'var(--t2)',cursor:'pointer'}}>{o.l}</button>
                ))}
              </div>
            </div>

            <div style={fld}>
              <label style={lbl}>N° boleta *</label>
              <input value={pagoFolio} onChange={e=>setPagoFolio(e.target.value)} placeholder="ej: 1115223" style={{...inp,fontFamily:'var(--mono)'}}/>
            </div>

            {pagoForma === 'transferencia' && (
              <div style={fld}>
                <label style={lbl}>Comprobante de transferencia *</label>
                {!pagoComp ? (
                  <label
                    onDragOver={e=>{e.preventDefault();e.currentTarget.style.background='var(--bbg)';e.currentTarget.style.borderColor='var(--blue)'}}
                    onDragLeave={e=>{e.currentTarget.style.background='var(--s2)';e.currentTarget.style.borderColor='var(--bdr)'}}
                    onDrop={e=>{e.preventDefault();e.currentTarget.style.background='var(--s2)';e.currentTarget.style.borderColor='var(--bdr)';const f=e.dataTransfer.files[0];if(f){const r=new FileReader();r.onload=ev=>setPagoComp(ev.target.result);r.readAsDataURL(f)}}}
                    style={{display:'block',padding:'18px 12px',border:'2px dashed var(--bdr)',borderRadius:8,textAlign:'center',cursor:'pointer',background:'var(--s2)',transition:'all .15s'}}>
                    <input type="file" accept="image/*" onChange={e=>{
                      const f = e.target.files[0]; if(!f) return
                      const r = new FileReader(); r.onload=ev=>setPagoComp(ev.target.result); r.readAsDataURL(f)
                    }} style={{display:'none'}}/>
                    <div style={{fontSize:18}}>📎</div>
                    <div style={{fontSize:11,fontWeight:600,color:'var(--blue)',marginBottom:3}}>Adjuntar comprobante</div>
                    <div style={{fontSize:10,color:'var(--t3)'}}>{TECLA_PASTE} o arrastrar archivo</div>
                  </label>
                ) : (
                  <div style={{position:'relative'}}>
                    <img src={pagoComp} style={{width:'100%',maxHeight:130,objectFit:'contain',border:'1px solid var(--bdr)',borderRadius:6}}/>
                    <button onClick={()=>setPagoComp(null)} style={{position:'absolute',top:4,right:4,background:'rgba(0,0,0,.7)',color:'#fff',border:'none',borderRadius:'50%',width:24,height:24,cursor:'pointer',fontSize:14}}>×</button>
                  </div>
                )}
              </div>
            )}

            <div style={fld}>
              <label style={lbl}>Observación (opcional)</label>
              <input value={pagoObs} onChange={e=>setPagoObs(e.target.value)} placeholder="ej: paga con vuelto" style={inp}/>
            </div>

            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button onClick={()=>setVerPago(false)} style={{...btnSec,flex:'0 0 90px'}}>Cancelar</button>
              <button onClick={confirmarPago} style={{...btnPri,flex:1,background:'var(--green)'}}>✓ Confirmar pago</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============ MODAL RECHAZO ============ */}
      {verRechazo && (
        <Modal cerrar={()=>{setVerRechazo(null); setMotivoRechazo('')}} z={120}>
          <div style={{padding:20}}>
            <div style={{fontSize:15,fontWeight:600,marginBottom:14,color:'var(--red)'}}>
              {verRechazo==='lab'?'Rechazo del laboratorio':'Cliente no acepta'}
            </div>
            <div style={fld}>
              <label style={lbl}>Motivo</label>
              <select value={motivoRechazo} onChange={e=>setMotivoRechazo(e.target.value)} style={inp}>
                <option value="">— Selecciona un motivo —</option>
                {verRechazo === 'lab' ? (
                  <>
                    <option value="NO HAY INSUMOS">NO HAY INSUMOS</option>
                    <option value="RECETA MALA">RECETA MALA</option>
                    <option value="RECETA VENCIDA">RECETA VENCIDA</option>
                    <option value="OTROS">OTROS</option>
                  </>
                ) : (
                  <>
                    <option value="NO QUIERE POR PRECIO">NO QUIERE POR PRECIO</option>
                    <option value="CAMBIÓ DE OPINIÓN">CAMBIÓ DE OPINIÓN</option>
                    <option value="NO RESPONDE">NO RESPONDE</option>
                    <option value="OTROS">OTROS</option>
                  </>
                )}
              </select>
            </div>
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button onClick={()=>{setVerRechazo(null); setMotivoRechazo('')}} style={{...btnSec,flex:'0 0 90px'}}>Cancelar</button>
              <button onClick={rechazar} style={{...btnPri,flex:1,background:'var(--red)'}}>Rechazar receta</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============ MODAL PRODUCTO ADICIONAL ============ */}
      {verProd && (
        <Modal cerrar={()=>{setVerProd(false); setProdNombre(''); setProdPrecio('')}} z={120}>
          <div style={{padding:20}}>
            <div style={{fontSize:15,fontWeight:600,marginBottom:14}}>Agregar producto cotizado aparte</div>
            <div style={fld}>
              <label style={lbl}>Nombre del producto</label>
              <input value={prodNombre} onChange={e=>setProdNombre(e.target.value)} placeholder="ej: Paracetamol 500mg x20" style={inp}/>
            </div>
            <div style={fld}>
              <label style={lbl}>Precio</label>
              <input type="number" value={prodPrecio} onChange={e=>setProdPrecio(e.target.value)} placeholder="0" style={{...inp,fontFamily:'var(--mono)'}}/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button onClick={()=>{setVerProd(false); setProdNombre(''); setProdPrecio('')}} style={{...btnSec,flex:'0 0 90px'}}>Cancelar</button>
              <button onClick={agregarProducto} style={{...btnPri,flex:1}}>✓ Agregar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============ LIGHTBOX ============ */}
      {lightbox && (
        <div onClick={()=>setLightbox(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.9)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20,cursor:'zoom-out'}}>
          <img src={lightbox} style={{maxWidth:'95%',maxHeight:'90vh',background:'#fff',borderRadius:8}}/>
        </div>
      )}

      {/* ============ MODAL CÁMARA ============ */}
      {verCamara && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.95)',zIndex:250,display:'flex',alignItems:'center',justifyContent:'center',padding:'10px 10px 20px',flexDirection:'column',gap:14}}>
          <div style={{fontSize:13,color:'#fff',opacity:.7,marginTop:5}}>Encuadra la receta verticalmente</div>
          {camaraError ? (
            <div style={{padding:30,background:'#fff',color:'var(--red)',fontSize:14,textAlign:'center',borderRadius:12,maxWidth:480}}>
              <div style={{fontSize:24,marginBottom:10}}>⚠</div>
              {camaraError}
              <div style={{fontSize:12,color:'var(--t2)',marginTop:10}}>Asegúrate de tener una cámara conectada y dar permiso al navegador.</div>
            </div>
          ) : (
            <div style={{background:'#000',borderRadius:12,overflow:'hidden',position:'relative',height:'70vh',aspectRatio:'3/4',maxWidth:'95vw'}}>
              <video ref={videoRef} autoPlay playsInline style={{width:'100%',height:'100%',display:'block',background:'#000',objectFit:'cover'}} />
              {/* Marco guía vertical */}
              <div style={{position:'absolute',inset:24,border:'2px dashed rgba(255,255,255,.4)',borderRadius:8,pointerEvents:'none'}}></div>
            </div>
          )}
          <div style={{display:'flex',gap:10}}>
            <button onClick={cerrarCamara} style={{padding:'14px 22px',borderRadius:10,border:'1px solid #fff',background:'rgba(0,0,0,.5)',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer'}}>Cancelar</button>
            {!camaraError && (
              <button onClick={tomarFoto} style={{padding:'14px 32px',borderRadius:10,border:'none',background:'var(--blue)',color:'#fff',fontSize:15,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:20}}>📸</span> Tomar foto
                <span style={{fontSize:10,opacity:.7,background:'rgba(255,255,255,.2)',padding:'3px 7px',borderRadius:4,marginLeft:4}}>ESPACIO</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============ TOAST ============ */}
      {toast && (
        <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',background:toast.tipo==='amber'?'var(--amber)':'var(--green)',color:'#fff',padding:'10px 18px',borderRadius:24,fontSize:13,fontWeight:600,zIndex:300,boxShadow:'0 4px 12px rgba(0,0,0,.2)'}}>{toast.msg}</div>
      )}
    </>
  )
}

// ====== HEADER ======
function HeaderRec({session, router}){
  return (
    <header style={{background:'#fff',borderBottom:'2.5px solid var(--br)',padding:'0 16px',display:'flex',alignItems:'center',minHeight:54,gap:10,flexWrap:'wrap'}}>
      <img src="/logo.jpg" alt="BioCuba" style={{height:34,width:'auto'}} />
      <div style={{width:1,height:22,background:'var(--bdr)'}}></div>
      <img src="/icono-recetario.png" alt="Recetario" style={{width:28,height:28,borderRadius:'50%'}}/>
      <span style={{fontSize:13,fontWeight:600,color:'var(--blue)'}}>Recetario Magistral</span>
      {session && <span style={{fontSize:11,fontWeight:600,color:'#fff',background:'var(--blue)',padding:'2px 8px',borderRadius:20}}>{session.sucursalNombre} · Caja {session.caja}</span>}
      <button onClick={()=>{clearSession();router.replace('/login?tipo=pos')}} style={{marginLeft:'auto',fontSize:11,padding:'4px 10px',borderRadius:6,border:'1px solid var(--bdr)',background:'transparent',color:'var(--t2)',cursor:'pointer'}}>Salir</button>
    </header>
  )
}

// ====== FILA RECETA EN LISTA ======
function FilaReceta({r, onClick}){
  const paciente = r.vet ? r.mascota_nombre : `${r.cliente_nombres} ${r.cliente_apaterno}`
  const dueno = r.vet ? `${r.cliente_nombres} ${r.cliente_apaterno}` : null
  let badgeBg='var(--s2)', badgeColor='var(--t2)', badgeText='—'
  if(r.rechazada){ badgeBg='var(--rbg)'; badgeColor='var(--red)'; badgeText=r.motivo_rechazo||'Rechazada' }
  else if(r.estado==='cotizada')  { badgeText='Cotizando' }
  else if(r.estado==='precio')    { badgeBg='var(--abg)'; badgeColor='var(--amber)'; badgeText='Avisar precio' }
  else if(r.estado==='confirmada'){ badgeBg='var(--bbg)'; badgeColor='var(--blue)'; badgeText='Preparando' }
  else if(r.estado==='lista')     { badgeBg='var(--abg)'; badgeColor='var(--amber)'; badgeText='Avisar retiro' }
  else if(r.estado==='retirada')  { badgeBg='var(--gbg)'; badgeColor='var(--green)'; badgeText='Retirada' }
  return (
    <div onClick={onClick} style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:10,padding:'12px 14px',marginBottom:8,cursor:'pointer'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:4}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            {paciente}
            {r.vet && <span style={{background:'var(--bbg)',color:'var(--blue)',fontSize:10,padding:'1px 6px',borderRadius:8,fontWeight:600}}>🐾 {r.mascota_tipo}</span>}
          </div>
          {dueno && <div style={{fontSize:11,color:'var(--t3)'}}>Dueño: {dueno}</div>}
          <div style={{fontSize:11,color:'var(--t3)',marginTop:2}}>{r.numero} · {tiempoRelativo(r.created_at)} · {r.canal==='presencial'?'🏪 Presencial':'💬 Remota'}</div>
        </div>
        <span style={{fontSize:10,padding:'3px 9px',borderRadius:20,background:badgeBg,color:badgeColor,fontWeight:600,textTransform:'uppercase',letterSpacing:'.03em',whiteSpace:'nowrap'}}>{badgeText}</span>
      </div>
      {r.monto > 0 && <div style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'var(--blue)',marginTop:2}}>{fmt(r.monto)}</div>}
    </div>
  )
}

// ====== MODAL CONTENEDOR ======
function Modal({cerrar, z=100, children}){
  return (
    <div onClick={e=>{if(e.target===e.currentTarget) cerrar()}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:z,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'20px 12px',overflowY:'auto'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',width:'100%',maxWidth:556,borderRadius:14,position:'relative'}}>
        <button onClick={cerrar} style={{position:'absolute',top:10,right:12,background:'transparent',border:'none',fontSize:22,cursor:'pointer',color:'var(--t2)',width:30,height:30,borderRadius:'50%'}}>×</button>
        {children}
      </div>
    </div>
  )
}

// ====== DETALLE DE RECETA (modal) ======
function DetalleReceta({r, config, session, onAmpliar, onAccionPrecio, onAvisarPrecio, onConfirmarPago, onRechazarLab, onRechazarCliente, onPreparadoLlego, onClienteRetiro, onAgregarProducto, onQuitarProducto}){
  const paciente = r.vet ? r.mascota_nombre : `${r.cliente_nombres} ${r.cliente_apaterno} ${r.cliente_amaterno||''}`.trim()
  const dueno = r.vet ? `${r.cliente_nombres} ${r.cliente_apaterno} ${r.cliente_amaterno||''}`.trim() : null
  const productos = r.recetas_productos || []
  const totalProductos = productos.reduce((s,p)=>s+(p.precio||0), 0)
  const totalCobrar = (r.monto||0) + totalProductos

  function buildWhatsAppPrecio(){
    const headerIntocable = `*Receta ${r.numero} · BioCuba ${SUC_NOMBRES[session.sucursal]}*\n\n`
    let texto = (config?.texto_precio || '').replace(/\{paciente\}/g, paciente).replace(/\{monto\}/g, fmt(r.monto)).replace(/\{sucursal\}/g, SUC_NOMBRES[session.sucursal]).replace(/\{nombre\}/g, r.cliente_nombres).replace(/\{numero\}/g, r.numero)
    if(productos.length > 0){
      const detalles = productos.map(p=>`• ${p.nombre} — ${fmt(p.precio)}`).join('\n')
      texto = texto.replace(/\$[\d.,]+/, fmt(r.monto)) + `\n\nAdemás los productos que consultaste:\n${detalles}\n\nTotal: ${fmt(totalCobrar)}`
    }
    return headerIntocable + texto
  }
  function buildWhatsAppRetiro(){
    const headerIntocable = `*Receta ${r.numero} · BioCuba ${SUC_NOMBRES[session.sucursal]}*\n\n`
    const texto = (config?.texto_retiro || '').replace(/\{nombre\}/g, r.cliente_nombres).replace(/\{sucursal\}/g, SUC_NOMBRES[session.sucursal]).replace(/\{paciente\}/g, paciente).replace(/\{numero\}/g, r.numero)
    return headerIntocable + texto
  }
  function abrirWA(texto){
    const tel = (r.cliente_prefijo+r.cliente_tel).replace(/[^0-9+]/g,'')
    const url = `https://wa.me/${tel.replace('+','')}?text=${encodeURIComponent(texto)}`
    window.open(url, 'biocuba_whatsapp')
  }

  let estadoBadge = null
  if(r.rechazada) estadoBadge = {bg:'var(--rbg)',color:'var(--red)',text:r.motivo_rechazo}
  else if(r.estado==='cotizada')  estadoBadge = {bg:'var(--s2)',color:'var(--t2)',text:'COTIZANDO'}
  else if(r.estado==='precio')    estadoBadge = {bg:'var(--abg)',color:'var(--amber)',text:'AVISAR PRECIO'}
  else if(r.estado==='confirmada')estadoBadge = {bg:'var(--bbg)',color:'var(--blue)',text:'PREPARANDO'}
  else if(r.estado==='lista')     estadoBadge = {bg:'var(--abg)',color:'var(--amber)',text:'AVISAR RETIRO'}
  else if(r.estado==='retirada')  estadoBadge = {bg:'var(--gbg)',color:'var(--green)',text:'RETIRADA'}

  return (
    <div style={{padding:'18px 18px 20px'}}>
      <div style={{paddingRight:30,marginBottom:14}}>
        <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.06em',fontWeight:600,marginBottom:3}}>Receta {r.numero}</div>
        <div style={{fontSize:18,fontWeight:700,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          {paciente}
          {r.vet && <span style={{background:'var(--bbg)',color:'var(--blue)',fontSize:10,padding:'2px 7px',borderRadius:10,fontWeight:600}}>🐾 {r.mascota_tipo}</span>}
        </div>
        {dueno && <div style={{fontSize:12,color:'var(--t3)',marginTop:1}}>Dueño: {dueno}</div>}
        <div style={{fontSize:11,color:'var(--t3)',marginTop:5,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          {tiempoRelativo(r.created_at)} · Registrada por {r.vendedor_id}
          {estadoBadge && <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:estadoBadge.bg,color:estadoBadge.color,fontWeight:600,letterSpacing:'.03em'}}>{estadoBadge.text}</span>}
        </div>
      </div>

      {/* Info paciente + médico */}
      <div style={{background:'var(--s2)',borderRadius:10,padding:11,marginBottom:11,fontSize:12}}>
        {r.cliente_rut && <Row k="RUT" v={r.cliente_rut} mono/>}
        <Row k="Teléfono" v={`${r.cliente_prefijo} ${r.cliente_tel}`} mono/>
        <Row k="Médico" v={r.medico_nombre}/>
        <Row k="RUT médico" v={r.medico_rut} mono last/>
      </div>

      {/* Foto receta */}
      {r.foto_receta_url && (
        <div style={{marginBottom:11}}>
          <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4,fontWeight:600}}>📋 Foto de la receta</div>
          <img src={r.foto_receta_url} onClick={()=>onAmpliar(r.foto_receta_url)} style={{width:'100%',maxHeight:180,objectFit:'contain',background:'var(--s2)',border:'1px solid var(--bdr)',borderRadius:8,cursor:'zoom-in'}}/>
        </div>
      )}

      {/* Respuesta del laboratorio */}
      {r.respuesta_laboratorio && (
        <div style={{marginBottom:11,background:'var(--abg)',border:'1px solid var(--amber)',borderRadius:8,padding:11}}>
          <div style={{fontSize:10,color:'var(--amber)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6,fontWeight:700}}>💬 Respuesta del laboratorio</div>
          <div style={{fontSize:13,whiteSpace:'pre-wrap',color:'var(--t1)',lineHeight:1.45,fontFamily:'var(--mono)'}}>{r.respuesta_laboratorio.split('\n').filter(l=>!l.trim().startsWith('>')&&!l.includes('escribió:')).join('\n').trim()}</div>
        </div>
      )}

      {/* === Estado: COTIZANDO === */}
      {r.estado === 'cotizada' && !r.rechazada && (
        <>
          <div style={{background:'var(--abg)',border:'1px solid var(--abdr)',borderRadius:10,padding:14,marginBottom:10,textAlign:'center'}}>
            <div style={{fontSize:18,marginBottom:4}}>⏳</div>
            <div style={{fontSize:13,fontWeight:600,color:'var(--amber)',marginBottom:3}}>El laboratorio está cotizando</div>
            <div style={{fontSize:11,color:'var(--amber)',lineHeight:1.5}}>No necesitas hacer nada.<br/>El sistema te avisará automáticamente cuando llegue el precio.</div>
          </div>
          <div style={{marginBottom:10}}>
            <button onClick={onAccionPrecio} style={{width:'100%',padding:10,borderRadius:8,border:'1.5px dashed var(--bdr)',background:'#fff',color:'var(--t2)',fontSize:12,cursor:'pointer'}}>¿Ya tienes el precio? Ingrésalo manualmente</button>
          </div>
          <button onClick={onRechazarLab} style={{width:'100%',padding:10,borderRadius:8,border:'1.5px solid var(--rbdr)',background:'#fff',color:'var(--red)',fontSize:12,fontWeight:600,cursor:'pointer'}}>✗ Receta no se puede preparar</button>
        </>
      )}

      {/* === Estado: PRECIO RECIBIDO (avisar precio al cliente) === */}
      {r.estado === 'precio' && !r.rechazada && (
        <>
          <button onClick={onRechazarLab} style={{width:'100%',padding:11,borderRadius:8,border:'1.5px solid var(--rbdr)',background:'var(--rbg)',color:'var(--red)',fontSize:13,fontWeight:700,cursor:'pointer',marginBottom:12}}>⚠️ Laboratorio no cuenta con materia prima</button>

          {(!r.monto || r.monto < 1) && (
            <div style={{background:'#fff',border:'1.5px solid var(--blue)',borderRadius:8,padding:12,marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--blue)',marginBottom:8}}>📝 Ingresá el precio cotizado por el laboratorio</div>
              <button onClick={()=>onAccionPrecio(r)} style={{width:'100%',padding:11,borderRadius:8,border:'none',background:'var(--blue)',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>Ingresar precio</button>
            </div>
          )}

          <div style={{fontSize:10,fontWeight:700,color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Paso 1 · Avisa al cliente con el precio</div>

          {/* Productos adicionales (solo Remota) */}
          {r.canal === 'remota' && (
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:8,padding:11,marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div style={{fontSize:10,fontWeight:700,color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.06em'}}>🛒 Productos adicionales</div>
                <button onClick={onAgregarProducto} style={{fontSize:11,padding:'3px 9px',borderRadius:6,border:'1px solid var(--bdr)',background:'#fff',color:'var(--blue)',fontWeight:600,cursor:'pointer'}}>+ Agregar</button>
              </div>
              {productos.length === 0 ? (
                <div style={{fontSize:11,color:'var(--t3)'}}>Sin productos. Click en "+ Agregar" si el cliente preguntó por algo más.</div>
              ) : (
                <>
                  {productos.map(p=>(
                    <div key={p.id} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:12,borderBottom:'1px solid var(--bdr)'}}>
                      <span>{p.nombre}</span>
                      <span style={{display:'flex',gap:6,alignItems:'center'}}>
                        <span style={{fontFamily:'var(--mono)',fontWeight:600}}>{fmt(p.precio)}</span>
                        <button onClick={()=>onQuitarProducto(p.id)} style={{background:'transparent',border:'none',color:'var(--red)',cursor:'pointer',fontSize:14}}>🗑</button>
                      </span>
                    </div>
                  ))}
                  <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0 2px',fontSize:11,color:'var(--t3)'}}>
                    <span>Subtotal magistral</span>
                    <span className="mono">{fmt(r.monto)}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',padding:'2px 0',fontSize:11,color:'var(--t3)'}}>
                    <span>Subtotal productos</span>
                    <span className="mono">{fmt(totalProductos)}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0 0',fontSize:14,fontWeight:700,color:'var(--blue)'}}>
                    <span>Total a cobrar</span>
                    <span style={{fontFamily:'var(--mono)'}}>{fmt(totalCobrar)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <div style={{background:'var(--gbg)',border:'1px solid var(--gbdr)',borderRadius:8,padding:11,marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:'var(--green)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>📱 MENSAJE WHATSAPP LISTO</div>
            <div style={{fontSize:12,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{buildWhatsAppPrecio()}</div>
          </div>
          <button onClick={()=>{abrirWA(buildWhatsAppPrecio()); onAvisarPrecio(r);}} style={{width:'100%',padding:12,borderRadius:8,border:'none',background:'var(--green)',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:12}}>📱 Abrir WhatsApp con el cliente</button>

          
        </>
      )}

      {/* === Estado: ESPERANDO_PAGO === */}
      {r.estado === 'esperando_pago' && !r.rechazada && (
        <>
          <div style={{background:'var(--abg)',border:'1px solid var(--abdr)',borderRadius:10,padding:11,marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:'var(--amber)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>⏳ Esperando pago del cliente</div>
            <div style={{fontSize:12,color:'var(--t2)',lineHeight:1.4}}>Ya avisaste el precio por WhatsApp. Cuando el cliente envíe el comprobante, registralo aquí.</div>
            {r.monto > 0 && (
              <div style={{marginTop:8,fontSize:13,fontFamily:'var(--mono)',fontWeight:700,color:'var(--amber)'}}>Monto cotizado: {fmt(r.monto)}</div>
            )}
          </div>

          <button onClick={onConfirmarPago} style={{width:'100%',padding:12,borderRadius:8,border:'none',background:'var(--green)',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:8}}>💳 Cliente envió comprobante</button>
          <button onClick={onRechazarCliente} style={{width:'100%',padding:11,borderRadius:8,border:'1.5px solid var(--rbdr)',background:'#fff',color:'var(--red)',fontSize:12,fontWeight:600,cursor:'pointer'}}>✗ Cliente no acepta</button>
        </>
      )}

      {/* === Estado: CONFIRMADA (esperando preparado) === */}
      {r.estado === 'confirmada' && !r.rechazada && (
        <>
          <div style={{background:'var(--gbg)',border:'1px solid var(--gbdr)',borderRadius:10,padding:11,marginBottom:10,fontSize:12}}>
            <div style={{fontSize:10,fontWeight:700,color:'var(--green)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>✓ PAGO REGISTRADO</div>
            <Row k="Forma" v={({efectivo:'Efectivo',debito:'Tarjeta débito',credito:'Tarjeta crédito',transferencia:'Transferencia'})[r.pago_forma]||r.pago_forma}/>
            <Row k="Boleta" v={r.pago_folio} mono/>
            <Row k="Monto" v={fmt(totalCobrar)} mono last/>
          </div>
          {r.pago_comprobante_url && (
            <div style={{marginBottom:11}}>
              <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4,fontWeight:600}}>🧾 Comprobante de transferencia</div>
              <img src={r.pago_comprobante_url} onClick={()=>onAmpliar(r.pago_comprobante_url)} style={{width:'100%',maxHeight:160,objectFit:'contain',background:'var(--s2)',border:'1px solid var(--bdr)',borderRadius:8,cursor:'zoom-in'}}/>
            </div>
          )}
          <div style={{background:'var(--bbg)',border:'1px solid var(--bbdr)',borderRadius:10,padding:14,marginBottom:8,textAlign:'center'}}>
            <div style={{fontSize:18,marginBottom:4}}>⏳</div>
            <div style={{fontSize:13,fontWeight:600,color:'var(--blue)',marginBottom:3}}>El laboratorio está preparando</div>
            <div style={{fontSize:11,color:'var(--blue)',lineHeight:1.5}}>Cuando el preparado llegue a la farmacia,<br/>marca el botón de abajo.</div>
          </div>
          <button onClick={onPreparadoLlego} style={{width:'100%',padding:12,borderRadius:8,border:'none',background:'var(--blue)',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>📦 El preparado llegó a la farmacia</button>
        </>
      )}

      {/* === Estado: LISTA (avisar retiro) === */}
      {r.estado === 'lista' && !r.rechazada && (
        <>
          <div style={{background:'var(--gbg)',border:'1px solid var(--gbdr)',borderRadius:10,padding:11,marginBottom:10,fontSize:12}}>
            <div style={{fontSize:10,fontWeight:700,color:'var(--green)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>✓ PAGO REGISTRADO</div>
            <Row k="Forma" v={({efectivo:'Efectivo',debito:'Tarjeta débito',credito:'Tarjeta crédito',transferencia:'Transferencia'})[r.pago_forma]||r.pago_forma}/>
            <Row k="Boleta" v={r.pago_folio} mono/>
            <Row k="Monto" v={fmt(totalCobrar)} mono last/>
          </div>
          <div style={{fontSize:10,fontWeight:700,color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Avisa al cliente que puede retirar</div>
          <div style={{background:'var(--gbg)',border:'1px solid var(--gbdr)',borderRadius:8,padding:11,marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:'var(--green)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>📱 MENSAJE WHATSAPP LISTO</div>
            <div style={{fontSize:12,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{buildWhatsAppRetiro()}</div>
          </div>
          <button onClick={()=>abrirWA(buildWhatsAppRetiro())} style={{width:'100%',padding:12,borderRadius:8,border:'none',background:'var(--green)',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:10}}>📱 Abrir WhatsApp con el cliente</button>
          <button onClick={onClienteRetiro} style={{width:'100%',padding:11,borderRadius:8,border:'1.5px solid var(--bdr)',background:'#fff',color:'var(--blue)',fontSize:12,fontWeight:600,cursor:'pointer'}}>✓ Cliente ya retiró</button>
        </>
      )}

      {/* === Estado: RETIRADA o RECHAZADA === */}
      {(r.estado === 'retirada' || r.rechazada) && (
        <>
          {r.rechazada ? (
            <div style={{background:'var(--rbg)',border:'1px solid var(--rbdr)',borderRadius:10,padding:11,marginBottom:10,fontSize:12,textAlign:'center'}}>
              <div style={{fontSize:18,marginBottom:4}}>✗</div>
              <div style={{fontWeight:600,color:'var(--red)',marginBottom:2}}>Receta rechazada</div>
              <div style={{fontSize:11,color:'var(--red)'}}>Motivo: {r.motivo_rechazo}</div>
            </div>
          ) : (
            <>
              <div style={{background:'var(--gbg)',border:'1px solid var(--gbdr)',borderRadius:10,padding:11,marginBottom:10,fontSize:12}}>
                <div style={{fontSize:10,fontWeight:700,color:'var(--green)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>✓ PAGO REGISTRADO</div>
                <Row k="Forma" v={({efectivo:'Efectivo',debito:'Tarjeta débito',credito:'Tarjeta crédito',transferencia:'Transferencia'})[r.pago_forma]||r.pago_forma}/>
                <Row k="Boleta" v={r.pago_folio} mono/>
                <Row k="Monto cobrado" v={fmt(totalCobrar)} mono last/>
              </div>
              {r.pago_comprobante_url && (
                <div style={{marginBottom:11}}>
                  <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4,fontWeight:600}}>🧾 Comprobante</div>
                  <img src={r.pago_comprobante_url} onClick={()=>onAmpliar(r.pago_comprobante_url)} style={{width:'100%',maxHeight:160,objectFit:'contain',background:'var(--s2)',border:'1px solid var(--bdr)',borderRadius:8,cursor:'zoom-in'}}/>
                </div>
              )}
              <div style={{background:'var(--gbg)',border:'1px solid var(--gbdr)',borderRadius:8,padding:11,textAlign:'center',fontSize:12,color:'var(--green)',fontWeight:600}}>✓ Cliente retiró el preparado</div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Row({k, v, mono, last}){
  return (
    <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:last?'none':'1px dashed var(--bdr)',fontSize:12}}>
      <span style={{color:'var(--t2)'}}>{k}</span>
      <span style={mono?{fontFamily:'var(--mono)',fontWeight:600}:{fontWeight:500}}>{v}</span>
    </div>
  )
}
