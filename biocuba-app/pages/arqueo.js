import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL')
const hoy = () => new Date().toISOString().split('T')[0]
const mes = () => new Date().toISOString().slice(0,7)
const BILLETES = [20000,10000,5000,2000,1000,500,100,50,10]
const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const CATS_GASTO = {sencilla:'Fondo de cambio / Sencilla',limpieza:'Limpieza y Aseo',oficina:'Artículos de Oficina',mant_local:'Reparaciones y Mantención Local',mant_equipos:'Mantención de Equipos',otros:'Otros'}
const CAUSAS_DIF = ['Arrastre positivo — sobrante de dia anterior','Arrastre negativo — faltante de dia anterior','Sobrante — vuelto menor al cliente','Sobrante — error en medio de pago','Sobrante — causa desconocida','Faltante — error en vuelto al cliente','Faltante — billete falso','Faltante — gasto no registrado','Faltante — sencilla no registrada','Faltante — causa desconocida','Otro']

export default function Arqueo() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [tab, setTab] = useState('ingresar')
  const ayer = () => { const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0] }
  const [fecha, setFecha] = useState(ayer())
  
  // Golan
  const [golan, setGolan] = useState({ef:0,efBruto:0,deb:0,cred:0,transf:0,cheque:0,dev:0,totalVentas:0,vendedores:[]})
  const [golanCajas, setGolanCajas] = useState({c1:null,c2:null})
  const [golanCargado1, setGolanCargado1] = useState(false)
  const [golanCargado2, setGolanCargado2] = useState(false)
  
  // Cajas
  const [billetes1, setBilletes1] = useState({})
  const [billetes2, setBilletes2] = useState({})
  
  // SumUp y transferencias
  const [sumupReal, setSumupReal] = useState('')
  const [transfReal, setTransfReal] = useState('')
  
  // Convenios (solo Maipú)
  const [convBienestar, setConvBienestar] = useState(0)
  const [convSindicato, setConvSindicato] = useState(0)
  
  // CxC, gastos, devoluciones
  const [cxc, setCxc] = useState([])
  const [gastos, setGastos] = useState([])
  const [devs, setDevs] = useState([])
  
  // Motivo diferencia
  const [arrastre, setArrastre] = useState(0)
  const [arrastreObs, setArrastreObs] = useState('')
  const [difCausa, setDifCausa] = useState('')
  const [difResp, setDifResp] = useState('')
  const [difDet, setDifDet] = useState('')
  const [difDescontar, setDifDescontar] = useState(false)
  
  // Obs
  const [obs, setObs] = useState('')

  // Borrador automatico en localStorage
  const BORRADOR_KEY = 'bc_arqueo_borrador'
  useEffect(()=>{
    const b = localStorage.getItem(BORRADOR_KEY)
    if(b){
      try{
        const d = JSON.parse(b)
        // Solo mostrar si tiene datos reales (billetes o monto)
        const tieneDatos = d.billetes1 && Object.keys(d.billetes1).length>0
        if(d.fecha && tieneDatos && confirm('Hay un arqueo en borrador del '+d.fecha+'. Deseas recuperar billetes, SumUp, transferencias, CxC y gastos? (El CSV de Golan hay que volver a subirlo)')){
          if(d.fecha) setFecha(d.fecha)
          if(d.billetes1) setBilletes1(d.billetes1)
          if(d.billetes2) setBilletes2(d.billetes2)
          if(d.sumupReal) setSumupReal(d.sumupReal)
          if(d.transfReal) setTransfReal(d.transfReal)
          if(d.obs) setObs(d.obs)
          if(d.cxc) setCxc(d.cxc)
          if(d.gastos) setGastos(d.gastos)
          if(d.devs) setDevs(d.devs)
        }
      }catch(e){}
    }
  },[])

  // Guardar borrador cada vez que cambia algo
  useEffect(()=>{
    if(!fecha) return
    const b = {fecha,billetes1,billetes2,sumupReal,transfReal,obs,cxc,gastos,devs,ts:Date.now()}
    localStorage.setItem(BORRADOR_KEY, JSON.stringify(b))
  },[fecha,billetes1,billetes2,sumupReal,transfReal,obs,cxc,gastos,devs])
  
  // Historial
  const [historial, setHistorial] = useState([])
  const [histLoading, setHistLoading] = useState(false)
  
  // Depositos tab
  const [depositos, setDepositos] = useState([])
  const [seleccionados, setSeleccionados] = useState([])
  const [bancoDeposito, setBancoDeposito] = useState('')
  const [confirmandoDeposito, setConfirmandoDeposito] = useState(false)
  const [depHistorial, setDepHistorial] = useState([])
  const [depTab, setDepTab] = useState('pendientes')
  
  // Estado guardado
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [difPendientes, setDifPendientes] = useState([])

  useEffect(()=>{
    const s = getSession()
    if(!s||s.rol!=='qf'){ router.replace('/login'); return }
    setSession(s)
    cargarHistorial(s)
    verificarArqueoHoy(s)
    cargarDepositos(s)
    if(s.convenios) cargarConvenios(fecha)
    cargarDifPendientes(s)
  },[])

  useEffect(()=>{
    if(session?.convenios) cargarConvenios(fecha)
  },[fecha])

  async function cargarConvenios(f){
    const [rB,rS] = await Promise.all([
      supabase.from('bienestar_ventas').select('monto').eq('fecha',f).eq('sucursal_id','maipu'),
      supabase.from('sindicato_ventas').select('monto').eq('fecha',f).eq('sucursal_id','maipu'),
    ])
    setConvBienestar((rB.data||[]).reduce((s,v)=>s+v.monto,0))
    setConvSindicato((rS.data||[]).reduce((s,v)=>s+v.monto,0))
  }

  const [arqueoHoy, setArqueoHoy] = useState(null)
  const [editandoId, setEditandoId] = useState(null)

  async function cargarDepositos(s){
    const mesActual = new Date().toISOString().slice(0,7)
    const {data} = await supabase.from('depositos').select('*').eq('sucursal_id',s.sucursal).gte('fecha_dep',mesActual+'-01').lte('fecha_dep',mesActual+'-31').order('fecha_dep',{ascending:false})
    setDepositos(data||[])
  }

  async function verificarArqueoHoy(s){
    const {data} = await supabase.from('arqueos').select('id,ef_total,golan').eq('sucursal_id',s.sucursal).eq('fecha',hoy()).single()
    if(data) setArqueoHoy(data)
  }

  async function cargarHistorial(s){
    setHistLoading(true)
    const mesActual = mes()
    const {data} = await supabase.from('arqueos').select('*').eq('sucursal_id',s.sucursal).gte('fecha',mesActual+'-01').lte('fecha',mesActual+'-31').order('fecha',{ascending:false})
    setHistorial(data||[])
    setHistLoading(false)
  }

  const [arrastresAcum, setArrastresAcum] = useState([])
  const [totalArrastre, setTotalArrastre] = useState(0)

  async function cargarDifPendientes(s){
    const hoyDate = hoy()
    const {data} = await supabase.from('arqueos').select('fecha,dif_ef,dif_neta,motivo,arrastre').eq('sucursal_id',s.sucursal).lt('fecha',hoyDate).neq('dif_ef',0).gt('fecha',new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split('T')[0])
    const sinMotivo = (data||[]).filter(r=>!r.motivo?.causa)
    setDifPendientes(sinMotivo)
    // Calcular arrastre acumulado de todos los dias con diferencia sin netear
    // Excluir SOLO los dias donde dif_neta es EXACTAMENTE el numero 0
    const conDif = (data||[]).filter(r=> r.dif_neta !== 0)
    const acum = conDif.reduce((s,r)=>s+(r.dif_neta!==null&&r.dif_neta!==undefined ? r.dif_neta : (r.dif_ef||0)),0)
    setArrastresAcum(conDif)
    setTotalArrastre(acum)
    if(acum!==0) setArrastre(String(-acum))
  }

  async function parsearCSVMultiple(files, caja){
    let totalEf=0,totalEfBruto=0,totalDeb=0,totalCred=0,totalTransf=0,totalCheque=0,totalDev=0,totalVentas=0
    const vendMap = {}
    for(const file of files){
      const buf = await file.arrayBuffer()
      const txt = new TextDecoder('iso-8859-1').decode(buf)
      const lines = txt.replace(/\r/g,'').split('\n').filter(l=>l.trim())
      const pm = s => {
        s = (s||'').toString().replace(/[$]/g,'').replace(/\./g,'').replace(/,/g,'').replace(/[()]/g,'').trim()
        return Math.abs(parseFloat(s)||0)
      }
      const inc = (s,kw) => (s||'').toLowerCase().includes(kw.toLowerCase())
      lines.forEach(line=>{
        const c = line.split(',')
        // Vendedores — col[14] id numerico, col[15] nombre
        if(c.length>15){
          const vid = (c[14]||'').trim()
          const vnombre = (c[15]||'').trim()
          if(vid && /^\d+$/.test(vid) && vnombre.length>2 && !/^\d/.test(vnombre) && !inc(vnombre,'nombre') && !inc(vnombre,'tipo')){
            vendMap[vid]={id:vid,nombre:vnombre}
          }
        }
        // SECCION VENTAS: col[2]=tipo, col[8]=monto
        const tipo2 = (c[2]||'').trim()
        if(tipo2 && c.length>=9){
          const m = pm(c[8])
          if(m>0 && !inc(tipo2,'total') && !inc(tipo2,'tipo') && !inc(tipo2,'cantidad') && !inc(tipo2,'monto') && !inc(tipo2,'guia')){
            if(inc(tipo2,'efectivo')) totalEfBruto=Math.max(totalEfBruto,m)
            else if(inc(tipo2,'cheque')) totalCheque=Math.max(totalCheque,m)
            else if(inc(tipo2,'tarjeta') && inc(tipo2,'b')) totalDeb=Math.max(totalDeb,m)
            else if(inc(tipo2,'tarjeta') && inc(tipo2,'c')) totalCred=Math.max(totalCred,m)
            else if(inc(tipo2,'transfer')) totalTransf=Math.max(totalTransf,m)
          }
        }
        // SECCION TOTALES TIPO PAGO: col[12]=tipo, col[16]=monto neto
        const tipo12 = (c[12]||'').trim()
        if(tipo12 && c.length>=17){
          const m = pm(c[16])
          if(m>0){
            if(inc(tipo12,'efectivo')){
              totalEf=m
              // Devoluciones estan en col[7] de esta misma linea
              // NO leer dev aqui — las devoluciones estan en seccion separada
            }
            else if(inc(tipo12,'cheque')) totalCheque=m
            else if(inc(tipo12,'tarjeta') && inc(tipo12,'b')) totalDeb=m
            else if(inc(tipo12,'tarjeta') && inc(tipo12,'c')) totalCred=m
            else if(inc(tipo12,'transfer')) totalTransf=m
          }
        }
        // DEVOLUCIONES: Total Devoluciones en col[24] (formato con parentesis = negativo)
        // Formato: ,,,,,,,,,,,,,,,,,,,,Total Devoluciones,,,,$35.710,
        if(inc(line,'Total Devoluciones') || inc(line,'total devoluciones')){
          c.forEach(col=>{ const m=pm(col); if(m>0&&m<500000) totalDev=Math.max(totalDev,m) })
        }
        // TOTAL VENTAS: col[24]
        if(inc(line,'Total Ventas') && !inc(line,'abono') && !inc(line,'devoluci')){
          const m = pm(c[24])
          if(m>500000) totalVentas=Math.max(totalVentas,m)
        }
      })
    }
    // Si no encontramos efectivo neto, usar bruto
    if(totalEf===0) totalEf=totalEfBruto
    // Guardar datos de esta caja por separado
    // Extraer metadata de la caja: numero, cierre Z, horarios
    let nroCaja='', nroCierre='', apertura='', cierreHora='', fechaCSV=''
    lines.forEach(line=>{
      const c=line.split(',')
      if(c[0].trim().match(/^\d+$/) && c[3].trim().match(/^\d+$/)){
        nroCaja=c[0].trim(); nroCierre=c[3].trim()
        apertura=c[5]?.trim()||''; cierreHora=c[10]?.trim()||''
        if(apertura) fechaCSV=apertura.split(' ')[0]||''
      }
    })
    const datosCaja = {ef:totalEf,efBruto:totalEfBruto,deb:totalDeb,cred:totalCred,transf:totalTransf,cheque:totalCheque,dev:totalDev,totalVentas,vendedores:Object.values(vendMap),nroCaja,nroCierre,apertura,cierreHora,fechaCSV}
    setGolanCajas(prev=>({...prev,['c'+caja]:datosCaja}))
    setGolan(prev=>({
      ef: prev.ef+totalEf,
      efBruto: prev.efBruto+totalEfBruto,
      deb: prev.deb+totalDeb,
      cred: prev.cred+totalCred,
      transf: prev.transf+totalTransf,
      cheque: prev.cheque+totalCheque,
      dev: prev.dev+totalDev,
      totalVentas: prev.totalVentas+(totalVentas||totalEfBruto+totalDeb+totalCred+totalTransf+totalCheque),
      vendedores: [...(prev.vendedores||[]), ...Object.values(vendMap)]
    }))
        // Validar que la fecha del CSV coincide con la fecha del arqueo
    if(fechaCSV && fecha){
      const partes = fechaCSV.split('/')
      if(partes.length===3){
        const fechaCSViso = partes[2]+'-'+partes[1].padStart(2,'0')+'-'+partes[0].padStart(2,'0')
        if(fechaCSViso !== fecha){
          alert('Advertencia: el CSV de Caja '+caja+' corresponde al '+fechaCSV+' pero el arqueo es del '+fecha+'. Verifica que subiste el archivo correcto.')
        }
      }
    }
    if(caja===1) setGolanCargado1(true)
    if(caja===2) setGolanCargado2(true)
  }

  // Calculos
  const ef1 = BILLETES.reduce((s,b)=>s+(parseInt(billetes1[b]||0)*b),0)
  const ef2 = BILLETES.reduce((s,b)=>s+(parseInt(billetes2[b]||0)*b),0)
  const dep1 = ef1
  const dep2 = ef2
  const efTotal = ef1+ef2
  const efNeto = efTotal
  const difEf = efNeto - golan.ef
  const difNeta = difEf + (parseInt(arrastre)||0)
  const totalConv = convBienestar+convSindicato
  const difConv = golan.cheque - totalConv
  const totalCxC = cxc.reduce((s,c)=>s+(parseFloat(c.monto)||0),0)
  const totalGastos = gastos.reduce((s,g)=>s+(parseFloat(g.monto)||0),0)
  const totalDevs = devs.reduce((s,d)=>s+(parseFloat(d.monto)||0),0)
  const diaStr = fecha ? (() => { const d=new Date(fecha+'T12:00:00'); return DIAS[d.getDay()]+' '+d.getDate()+' de '+MESES[d.getMonth()] })() : ''

  async function guardar(){
    if(!golanCargado1&&!golanCargado2){ alert('Debes subir al menos un CSV de Golan'); return }
    if(efTotal===0){ alert('Ingresa el conteo de billetes'); return }
    if(difEf!==0&&!difCausa){ alert('Debes registrar el motivo de la diferencia en efectivo'); return }
    setGuardando(true)
    try {
      const payload = {
        id: String(fecha)+'_'+String(session.sucursal),
        fecha, sucursal_id: session.sucursal,
        usuario_nombre: session.nombre,
        golan,
        cajas: {c1:{billetes:billetes1,total:ef1},c2:{billetes:billetes2,total:ef2}},
        ef_total: efTotal, ef_neto: efNeto, dif_ef: difEf,
        sumup: parseFloat(sumupReal)||0,
        transf_real: parseFloat(transfReal)||0,
        gastos: gastos.filter(g=>g.monto),
        cxc: cxc.filter(c=>c.monto),
        devs: devs.filter(d=>d.monto),
        arrastre: parseInt(arrastre)||0,
        arrastre_obs: arrastreObs,
        dif_neta: difNeta,
        motivo: difEf!==0?{causa:difCausa,resp:difResp,det:difDet,descontar:difDescontar}:null,
        obs, ts: Date.now(),
        updated_at: new Date().toISOString()
      }
      // Si se edito y cambio la fecha, borrar el arqueo original
      if(editandoId && editandoId !== payload.id){
        await supabase.from('arqueos').delete().eq('id', editandoId)
        await supabase.from('depositos').delete().eq('id', 'dep_'+editandoId)
        setEditandoId(null)
      }
      const {error} = await supabase.from('arqueos').upsert(payload,{onConflict:'id'})
      if(error){ console.error('Supabase error:', error); throw new Error(error.message||'Error al guardar en Supabase') }
      // Si hay arrastre declarado, marcar dias anteriores como conciliados
      if(!error && (parseInt(arrastre)||0)!==0){
        const {data:diasPend} = await supabase.from('arqueos').select('id,dif_ef,dif_neta').eq('sucursal_id',session.sucursal).lt('fecha',fecha).neq('dif_ef',0)
        for(const d of (diasPend||[])){
          const neta = (d.dif_neta!==null&&d.dif_neta!==undefined) ? d.dif_neta : d.dif_ef
          if(neta!==0) await supabase.from('arqueos').update({dif_neta:0}).eq('id',d.id)
        }
      }
      localStorage.removeItem(BORRADOR_KEY)
      // Crear deposito pendiente automatico con el efectivo neto
      if(efNeto>0){
        await supabase.from('depositos').upsert({
          id: 'dep_'+String(fecha)+'_'+String(session.sucursal),
          sucursal_id: session.sucursal,
          fecha_dep: fecha,
          banco: '',
          monto: efNeto,
          obs: 'Efectivo arqueo del dia',
          pendiente: true,
          confirmado: false,
          ts: Date.now()
        },{onConflict:'id'})
        cargarDepositos(session)
      }
      setGuardado(true)
      cargarHistorial(session)
      setTimeout(()=>setGuardado(false),3000)
    } catch(e){ alert('Error al guardar: '+e.message) }
    finally { setGuardando(false) }
  }

  async function agregarDeposito(){
    setDepositos([...depositos,{id:Date.now(),banco:'',monto:'',obs:'',fecha:fecha,pendiente:true}])
  }

  const inp = {fontSize:14,padding:'9px 12px',border:'1.5px solid var(--bdr)',borderRadius:8,outline:'none',width:'100%',fontFamily:'var(--font)',background:'#fff'}
  const lbl = {fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t2)',display:'block',marginBottom:4}
  const sec = {background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:20,marginBottom:14}
  const paso = {background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,marginBottom:14,overflow:'hidden'}
  const pasoHdr = {padding:'14px 20px',borderBottom:'1px solid var(--bdr)',display:'flex',alignItems:'center',gap:12}
  const pasoBody = {padding:20}

  return (
    <>
      <Head><title>Arqueo de Caja - BioCuba</title></Head>
      <header style={{background:'#fff',borderBottom:'2.5px solid var(--br)',padding:'0 20px',display:'flex',alignItems:'center',minHeight:54,gap:12,flexWrap:'wrap'}}>
        <img src="/logo.jpg" alt="BioCuba" style={{height:38,width:'auto'}} />
        <div style={{width:1,height:22,background:'var(--bdr)'}}></div>
        <span style={{fontSize:13,fontWeight:600}}>Arqueo de Caja</span>
        <span style={{fontSize:12,fontWeight:600,color:'#fff',background:'var(--blue)',padding:'3px 10px',borderRadius:20}}>{session?.sucursalNombre}</span>
        <a href="/qf" style={{marginLeft:'auto',fontSize:12,color:'var(--t2)',textDecoration:'none'}}>Panel QF</a>
      </header>

      <main style={{padding:20,maxWidth:960,margin:'0 auto'}}>

        {/* ALERTA DIFERENCIAS PENDIENTES */}
        {difPendientes.length>0&&(
          <div style={{background:'#FCEBEB',border:'1px solid #F7C1C1',borderRadius:10,padding:'14px 16px',marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:600,color:'#791F1F',marginBottom:6}}>Hay diferencias de dias anteriores sin resolver</div>
            {difPendientes.map(d=>(
              <div key={d.fecha} style={{fontSize:12,color:'#A32D2D'}}>{d.fecha}: {fmt(d.dif_ef)}</div>
            ))}
            <div style={{fontSize:11,color:'#A32D2D',marginTop:6,paddingTop:6,borderTop:'1px solid #F09595'}}>Estas diferencias deben ser investigadas.</div>
          </div>
        )}

        {/* TABS */}
        <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--s2)',padding:4,borderRadius:10,overflowX:'auto'}}>
          {[['ingresar','Ingreso Diario'],['depositos','Depositos'],['fondo','Fondo de Caja'],['cobros','Cobros'],['historial','Historial del Mes']].map(([id,l])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:'7px 14px',borderRadius:7,border:'none',background:tab===id?'#fff':'transparent',fontWeight:tab===id?600:400,fontSize:13,color:tab===id?'var(--tx)':'var(--t2)',whiteSpace:'nowrap',flexShrink:0}}>
              {l}
            </button>
          ))}
        </div>

        {/* ===== TAB INGRESAR ===== */}
        {tab==='ingresar'&&(
          <div>
            {/* ARRASTRES PENDIENTES DE DIAS ANTERIORES */}
        {arrastresAcum.length>0&&(
          <div style={{background:'var(--abg)',border:'1px solid var(--abdr)',borderRadius:10,padding:'14px 16px',marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:600,color:'var(--amber)'}}>
                Diferencias acumuladas de dias anteriores
              </div>
              <div style={{fontFamily:'var(--mono)',fontSize:16,fontWeight:700,color:totalArrastre>0?'var(--green)':totalArrastre<0?'var(--red)':'var(--green)'}}>
                {totalArrastre>0?'+':''}{fmt(totalArrastre)}
              </div>
            </div>
            <div style={{fontSize:12,color:'var(--t2)',marginBottom:8}}>
              Considera este monto como arrastre al registrar el arqueo de hoy — ya fue pre-cargado en el campo de arrastre
            </div>
            <div style={{background:'rgba(0,0,0,.04)',borderRadius:8,padding:'8px 12px'}}>
              {arrastresAcum.map(a=>(
                <div key={a.id} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'3px 0',borderBottom:'1px solid rgba(0,0,0,.06)'}}>
                  <span style={{color:'var(--t2)'}}>{a.fecha}</span>
                  <span style={{fontFamily:'var(--mono)',fontWeight:600,color:(a.dif_neta||a.dif_ef||0)>0?'var(--green)':(a.dif_neta||a.dif_ef||0)<0?'var(--red)':'var(--green)'}}>
                    {(a.dif_neta||a.dif_ef||0)>0?'+':''}{fmt(a.dif_neta||a.dif_ef||0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AVISO ARQUEO YA GUARDADO */}
        {arqueoHoy&&(
          <div style={{background:'var(--gbg)',border:'2px solid var(--gbdr)',borderRadius:10,padding:'12px 16px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:'var(--green)'}}>Arqueo del dia ya registrado</div>
              <div style={{fontSize:12,color:'var(--t2)',marginTop:2}}>Efectivo: ${(arqueoHoy.ef_total||0).toLocaleString('es-CL')} · Ventas Golan: ${(arqueoHoy.golan?.totalVentas||0).toLocaleString('es-CL')}</div>
            </div>
            <button onClick={()=>setTab('historial')} style={{padding:'8px 16px',borderRadius:8,border:'none',background:'var(--green)',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer'}}>Ver Historial</button>
          </div>
        )}

        {/* CTRL BAR */}
            <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
              <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{...inp,width:'auto'}} />
              {diaStr&&<span style={{fontSize:13,color:'var(--t2)',background:'var(--s2)',padding:'5px 12px',borderRadius:20}}>{diaStr}</span>}
            </div>

            {/* KPIs */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
              {[
                {lbl:'Venta Total del Dia',val:fmt(golan.totalVentas),sub:'Segun cierre Z de Golan',color:'var(--blue)'},
                {lbl:'Efectivo a Depositar',val:fmt(efNeto),sub:'Total cajas menos fondos',color:'var(--green)'},
                {lbl:'Diferencia en Efectivo',val:difEf===0&&efTotal>0?'OK':efTotal===0?'—':fmt(difEf),sub:'Golan vs arqueo real',color:difEf===0&&efTotal>0?'var(--green)':difEf>0?'var(--amber)':'var(--red)'},
                ...(session?.convenios?[{lbl:'Convenios (Cheque)',val:fmt(golan.cheque),sub:'Bienestar + Sindicato',color:'var(--amber)'}]:[]),
              ].map((k,i)=>(
                <div key={i} style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:10,padding:'12px 14px'}}>
                  <div style={{fontSize:9,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:4}}>{k.lbl}</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:700,color:k.color}}>{k.val}</div>
                  <div style={{fontSize:10,color:'var(--t3)',marginTop:2}}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* PASO 1: GOLAN */}
            <div style={paso}>
              <div style={pasoHdr}>
                <div style={{width:28,height:28,borderRadius:'50%',background:'var(--blue)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0}}>{golanCargado1||golanCargado2?'✓':'1'}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:600}}>Registro de Ventas Golan</div>
                  <div style={{fontSize:11,color:'var(--t3)'}}>Importa el cierre Z — un archivo por caja</div>
                </div>
              </div>
              <div style={pasoBody}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                  {[1,2].map(n=>(
                    <div key={n} onClick={()=>document.getElementById('file-caja-'+n).click()}
                      style={{border:`2px dashed ${n===1?golanCargado1?'var(--gbdr)':'var(--bdr2)':golanCargado2?'var(--gbdr)':'var(--bdr2)'}`,borderRadius:10,padding:16,cursor:'pointer',background:n===1?golanCargado1?'var(--gbg)':'var(--s2)':golanCargado2?'var(--gbg)':'var(--s2)',textAlign:'center'}}>
                      <div style={{fontSize:24,marginBottom:6}}>{n===1?golanCargado1?'✓':'📄':golanCargado2?'✓':'📄'}</div>
                      <div style={{fontSize:13,fontWeight:500,color:n===1?golanCargado1?'var(--green)':'var(--t2)':golanCargado2?'var(--green)':'var(--t2)'}}>{n===1?golanCargado1?'Caja 1 cargada':'Importar Cierre Z - Caja 1':golanCargado2?'Caja 2 cargada':'Importar Cierre Z - Caja 2'}</div>
                      <div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>Puedes subir varios dias a la vez</div>
                      <input type="file" id={'file-caja-'+n} accept=".csv,.txt" multiple style={{display:'none'}} onChange={e=>parsearCSVMultiple(e.target.files,n)} />
                    </div>
                  ))}
                </div>
                {(golanCargado1||golanCargado2)&&(
                  <div>
                    {/* Desglose por caja */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                      {[1,2].filter(n=>golanCajas['c'+n]).map(n=>{
                        const c=golanCajas['c'+n]
                        return (
                          <div key={n} style={{background:'var(--s2)',borderRadius:10,padding:12,border:'1px solid var(--bdr)'}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                              <div style={{fontSize:12,fontWeight:600,color:'var(--blue)'}}>Caja {n}</div>
                              {c.nroCierre&&<div style={{fontSize:10,color:'var(--t3)'}}>Cierre Z #{c.nroCierre}</div>}
                            </div>

                            {[['Efectivo',c.ef],['Debito',c.deb],['Credito',c.cred],['Transferencia',c.transf],['Cheque 30 dias',c.cheque],['Devoluciones',c.dev],['Total',c.totalVentas]].filter(([,v])=>v>0).map(([l,v])=>(
                              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid var(--bdr)',fontSize:11}}>
                                <span style={{color:l==='Total'?'var(--tx)':'var(--t2)',fontWeight:l==='Total'?600:400}}>{l}</span>
                                <span style={{fontFamily:'var(--mono)',fontWeight:l==='Total'?700:500,color:l==='Devoluciones'?'var(--red)':l==='Total'?'var(--blue)':'var(--tx)'}}>${v.toLocaleString('es-CL')}</span>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                    <div style={{background:'var(--s2)',borderRadius:10,padding:16}}>
                    {[
                      ['Efectivo (neto)',golan.ef,'var(--tx)'],
                      ['Tarjeta Debito',golan.deb,'var(--tx)'],
                      ['Tarjeta Credito',golan.cred,'var(--tx)'],
                      ['Transferencias',golan.transf,'var(--tx)'],
                      ['Cheque 30 dias',golan.cheque,'var(--amber)'],
                      ['Devoluciones / NC',golan.dev,'var(--red)'],
                    ].map(([l,v,c])=>(
                      <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--bdr)'}}>
                        <span style={{fontSize:12,color:l==='Cheque 30 dias'||l==='Devoluciones / NC'?c:'var(--t2)',fontWeight:l==='Cheque 30 dias'?600:400}}>{l}</span>
                        <span style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:c}}>{fmt(v)}</span>
                      </div>
                    ))}
                    <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',fontWeight:700}}>
                      <span style={{fontSize:13}}>Total Venta del Dia</span>
                      <span style={{fontFamily:'var(--mono)',fontSize:16,color:'var(--blue)'}}>{fmt(golan.totalVentas)}</span>
                    </div>
                    {golan.vendedores?.length>0&&(
                      <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--bdr)'}}>
                        <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--t2)',marginBottom:6}}>Vendedores</div>
                        {golan.vendedores.map(v=><div key={v.id} style={{fontSize:12,color:'var(--t2)'}}>{v.nombre}</div>)}
                      </div>
                    )}
                  </div>
                  </div>
                )}
              </div>
            </div>

            {/* PASO 2: EFECTIVO POR CAJA */}
            <div style={paso}>
              <div style={pasoHdr}>
                <div style={{width:28,height:28,borderRadius:'50%',background:ef1+ef2>0?'var(--green)':'var(--blue)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0}}>{ef1+ef2>0?'✓':'2'}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:600}}>Arqueo de Efectivo por Caja</div>
                  <div style={{fontSize:11,color:'var(--t3)'}}>Cuenta el efectivo e ingresa la cantidad de cada denominacion</div>
                </div>
              </div>
              <div style={pasoBody}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                  {[{n:1,bs:billetes1,sb:setBilletes1,ef:ef1,dep:dep1},{n:2,bs:billetes2,sb:setBilletes2,ef:ef2,dep:dep2}].map(({n,bs,sb,ef,dep})=>(
                    <div key={n} style={{background:'var(--s2)',borderRadius:10,padding:14}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                        <span style={{fontSize:13,fontWeight:600}}>Caja {n}</span>
                        <span style={{fontFamily:'var(--mono)',fontSize:15,fontWeight:700,color:'var(--blue)'}}>{fmt(ef)}</span>
                      </div>
                      {BILLETES.map(b=>(
                        <div key={b} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                          <span style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,minWidth:55,color:'var(--blue)'}}>{fmt(b)}</span>
                          <span style={{color:'var(--t3)',fontSize:11}}>x</span>
                          <input type="number" min="0" value={bs[b]||''} onChange={e=>{const v={...bs};v[b]=e.target.value;sb(v)}}
                            placeholder="0" style={{...inp,width:60,textAlign:'center',padding:'5px 6px',fontSize:13,fontFamily:'var(--mono)'}} />
                          <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--t2)',marginLeft:'auto'}}>{fmt((parseInt(bs[b]||0)*b))}</span>
                        </div>
                      ))}
                      <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--bdr)'}}>
                        <div style={{fontSize:11,color:'var(--t3)',marginBottom:4}}>El fondo de caja se gestiona en el modulo Fondo de Caja</div>
                      </div>
                      <div style={{marginTop:10,display:'flex',justifyContent:'space-between',padding:'8px 0',fontWeight:600}}>
                        <span style={{fontSize:12,color:'var(--t2)'}}>Total a Depositar</span>
                        <span style={{fontFamily:'var(--mono)',fontSize:15,color:'var(--green)'}}>{fmt(dep)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comparacion Golan vs Arqueo */}
                <div style={{background:'var(--s2)',borderRadius:10,padding:14}}>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:10,color:'var(--t2)'}}>Comparacion Efectivo — Golan vs Arqueo Real</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                    {[['Golan dice',fmt(golan.ef),'var(--blue)'],['Arqueo real',fmt(efNeto),'var(--tx)'],['Diferencia',difEf===0&&efTotal>0?'OK':efTotal===0?'—':fmt(difEf),difEf===0&&efTotal>0?'var(--green)':difEf>0?'var(--amber)':'var(--red)']].map(([l,v,c])=>(
                      <div key={l} style={{textAlign:'center',background:'#fff',borderRadius:8,padding:10}}>
                        <div style={{fontSize:9,color:'var(--t3)',textTransform:'uppercase',marginBottom:4}}>{l}</div>
                        <div style={{fontFamily:'var(--mono)',fontSize:16,fontWeight:700,color:c}}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CONVENIOS - solo Maipu */}
                {session?.convenios&&(
                  <div style={{marginTop:14,background:Math.abs(difConv)>100?'var(--rbg)':'var(--gbg)',border:`1px solid ${Math.abs(difConv)>100?'var(--rbdr)':'var(--gbdr)'}`,borderRadius:10,padding:14}}>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--amber)',marginBottom:10}}>Convenios — Cheque 30 Dias</div>
                    {[
                      ['Cheque segun Golan',fmt(golan.cheque),'var(--amber)'],
                      ['Bienestar Municipal (registrado hoy)',fmt(convBienestar),'var(--green)'],
                      ['Sindicato Municipal (registrado hoy)',fmt(convSindicato),'var(--green)'],
                    ].map(([l,v,c])=>(
                      <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--bdr)'}}>
                        <span style={{fontSize:12,color:'var(--t2)'}}>{l}</span>
                        <span style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:c}}>{v}</span>
                      </div>
                    ))}
                    <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',fontWeight:700}}>
                      <span style={{fontSize:12}}>Diferencia convenios</span>
                      <span style={{fontFamily:'var(--mono)',fontSize:14,color:Math.abs(difConv)>100?'var(--red)':'var(--green)'}}>{difConv===0?'OK':fmt(difConv)}</span>
                    </div>
                    {Math.abs(difConv)<=100?
                      <div style={{fontSize:12,color:'var(--green)',fontWeight:500}}>Convenios cuadran perfectamente con Golan</div>:
                      <div style={{fontSize:12,color:'var(--red)',fontWeight:500}}>Los convenios no cuadran con Golan — revisa los registros</div>
                    }
                  </div>
                )}
              </div>
            </div>

            {/* PASO 3: MEDIOS ELECTRONICOS */}
            <div style={paso}>
              <div style={pasoHdr}>
                <div style={{width:28,height:28,borderRadius:'50%',background:'var(--blue)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0}}>3</div>
                <div>
                  <div style={{fontSize:14,fontWeight:600}}>Verificacion de Medios de Pago Electronicos</div>
                  <div style={{fontSize:11,color:'var(--t3)'}}>Confirma que SumUp y transferencias cuadren con Golan</div>
                </div>
              </div>
              <div style={pasoBody}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                  {[
                    {titulo:'SumUp — Debito y Credito',golanVal:golan.deb+golan.cred,real:sumupReal,setReal:setSumupReal,placeholder:'Total segun SumUp'},
                    {titulo:'Transferencias Bancarias',golanVal:golan.transf,real:transfReal,setReal:setTransfReal,placeholder:'Recibido en cuenta bancaria'},
                  ].map(({titulo,golanVal,real,setReal,placeholder})=>{
                    const dif = (parseFloat(real)||0) - golanVal
                    return (
                      <div key={titulo} style={{background:'var(--s2)',borderRadius:10,padding:14}}>
                        <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>{titulo}</div>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                          <span style={{fontSize:12,color:'var(--t2)'}}>Golan registro</span>
                          <span style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:600,color:'var(--blue)'}}>{fmt(golanVal)}</span>
                        </div>
                        <div style={{marginBottom:8}}>
                          <label style={{...lbl}}>Confirmar monto real</label>
                          <input type="number" value={real} onChange={e=>setReal(e.target.value)} placeholder={placeholder} style={inp} />
                        </div>
                        {real&&(
                          <div style={{display:'flex',justifyContent:'space-between'}}>
                            <span style={{fontSize:12,color:'var(--t2)'}}>Diferencia</span>
                            <span style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:600,color:Math.abs(dif)<100?'var(--green)':'var(--red)'}}>{Math.abs(dif)<100?'OK':fmt(dif)}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* CXC */}
            <div style={sec}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div>
                  <div style={{fontSize:14,fontWeight:600}}>Cuentas por Cobrar</div>
                  <div style={{fontSize:11,color:'var(--t3)',marginTop:2}}>Clientes que se llevaron productos y pagaran por transferencia</div>
                </div>
                {totalCxC>0&&<span style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--amber)',fontSize:15}}>{fmt(totalCxC)}</span>}
              </div>
              {cxc.map((c,i)=>(
                <div key={c.id||i} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto',gap:10,marginBottom:10,alignItems:'end'}}>
                  <div><label style={lbl}>Cliente</label><input value={c.cliente||''} onChange={e=>{const v=[...cxc];v[i]={...v[i],cliente:e.target.value};setCxc(v)}} placeholder="nombre cliente" style={inp} /></div>
                  <div><label style={lbl}>Concepto</label><input value={c.concepto||''} onChange={e=>{const v=[...cxc];v[i]={...v[i],concepto:e.target.value};setCxc(v)}} placeholder="ej: receta, cheque" style={inp} /></div>
                  <div><label style={lbl}>Monto</label><input type="number" value={c.monto||''} onChange={e=>{const v=[...cxc];v[i]={...v[i],monto:e.target.value};setCxc(v)}} placeholder="0" style={inp} /></div>
                  <button onClick={()=>setCxc(cxc.filter((_,j)=>j!==i))} style={{padding:'9px 10px',borderRadius:8,border:'1px solid var(--rbdr)',background:'var(--rbg)',color:'var(--red)',cursor:'pointer'}}>x</button>
                </div>
              ))}
              <button onClick={()=>setCxc([...cxc,{id:Date.now(),cliente:'',concepto:'',monto:''}])} style={{padding:'7px 14px',borderRadius:8,border:'1.5px dashed var(--bdr2)',background:'transparent',color:'var(--t2)',cursor:'pointer',fontSize:13}}>+ Agregar cuenta por cobrar</button>
            </div>

            {/* GASTOS */}
            <div style={sec}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontSize:14,fontWeight:600}}>Gastos del Local</div>
                {totalGastos>0&&<span style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--red)',fontSize:15}}>{fmt(totalGastos)}</span>}
              </div>
              {gastos.map((g,i)=>(
                <div key={g.id||i} style={{background:'var(--s2)',border:'1px solid var(--bdr)',borderRadius:8,padding:12,marginBottom:8}}>
                  <div style={{display:'grid',gridTemplateColumns:'auto 1fr auto auto',gap:10,alignItems:'end',marginBottom:8}}>
                    <div>
                      <label style={lbl}>Tipo</label>
                      <select value={g.tipo||'boleta'} onChange={e=>{const v=[...gastos];v[i]={...v[i],tipo:e.target.value};setGastos(v)}} style={{...inp,width:100,background:'#fff',fontSize:12}}>
                        <option value="sencilla">Sencilla</option>
                        <option value="boleta">Boleta</option>
                        <option value="factura">Factura</option>
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Categoria</label>
                      <select value={g.cat||''} onChange={e=>{const v=[...gastos];v[i]={...v[i],cat:e.target.value};setGastos(v)}} style={{...inp,background:'#fff',fontSize:12}}>
                        <option value="">Seleccionar...</option>
                        {Object.entries(CATS_GASTO).map(([k,l])=><option key={k} value={k}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Descripcion</label>
                      <input value={g.desc||''} onChange={e=>{const v=[...gastos];v[i]={...v[i],desc:e.target.value};setGastos(v)}} placeholder="detalle" style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Monto</label>
                      <input type="number" value={g.monto||''} onChange={e=>{const v=[...gastos];v[i]={...v[i],monto:e.target.value};setGastos(v)}} placeholder="0" style={inp} />
                    </div>
                    <button onClick={()=>setGastos(gastos.filter((_,j)=>j!==i))} style={{padding:'9px 10px',borderRadius:8,border:'1px solid var(--rbdr)',background:'var(--rbg)',color:'var(--red)',cursor:'pointer',alignSelf:'flex-end'}}>x</button>
                  </div>
                </div>
              ))}
              <button onClick={()=>setGastos([...gastos,{id:Date.now(),tipo:'boleta',cat:'',desc:'',monto:''}])} style={{padding:'7px 14px',borderRadius:8,border:'1.5px dashed var(--bdr2)',background:'transparent',color:'var(--t2)',cursor:'pointer',fontSize:13}}>+ Agregar gasto</button>
            </div>

            {/* DEVOLUCIONES EN EFECTIVO */}
            <div style={sec}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div style={{fontSize:14,fontWeight:600}}>Devoluciones en Efectivo</div>
                {totalDevs>0&&<span style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--red)',fontSize:15}}>{fmt(totalDevs)}</span>}
              </div>
              <div style={{fontSize:11,color:'var(--t3)',marginBottom:10}}>Devoluciones pagadas en efectivo por ventas originalmente con tarjeta. Estas reducen el efectivo a depositar.</div>
              {devs.map((d,i)=>(
                <div key={d.id||i} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:10,marginBottom:10,alignItems:'end'}}>
                  <div><label style={lbl}>Cliente / Motivo</label><input value={d.motivo||''} onChange={e=>{const v=[...devs];v[i]={...v[i],motivo:e.target.value};setDevs(v)}} placeholder="ej: cambio producto" style={inp} /></div>
                  <div><label style={lbl}>Monto</label><input type="number" value={d.monto||''} onChange={e=>{const v=[...devs];v[i]={...v[i],monto:e.target.value};setDevs(v)}} placeholder="0" style={inp} /></div>
                  <button onClick={()=>setDevs(devs.filter((_,j)=>j!==i))} style={{padding:'9px 10px',borderRadius:8,border:'1px solid var(--rbdr)',background:'var(--rbg)',color:'var(--red)',cursor:'pointer'}}>x</button>
                </div>
              ))}
              <button onClick={()=>setDevs([...devs,{id:Date.now(),motivo:'',monto:''}])} style={{padding:'7px 14px',borderRadius:8,border:'1.5px dashed var(--bdr2)',background:'transparent',color:'var(--t2)',cursor:'pointer',fontSize:13}}>+ Agregar devolucion</button>
            </div>

            {/* ARRASTRE DE DIA ANTERIOR */}
            {difEf!==0&&efTotal>0&&(
              <div style={{background:'#fff',border:'1px solid var(--bbdr)',borderRadius:12,padding:20,marginBottom:14}}>
                <div style={{fontSize:14,fontWeight:600,color:'var(--blue)',marginBottom:6}}>Arrastre de dia anterior</div>
                <div style={{fontSize:12,color:'var(--t2)',marginBottom:12}}>Si la diferencia de hoy se explica por un sobrante o faltante del dia anterior, ingresal aqui para netear y resolver la alerta.</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12,marginBottom:10}}>
                  <div>
                    <label style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t2)',display:'block',marginBottom:4}}>Monto arrastre</label>
                    <input type="number" value={arrastre} onChange={e=>setArrastre(e.target.value)} placeholder="ej: -5000 si faltaba ayer" style={{fontSize:14,padding:'9px 12px',border:'1.5px solid var(--bdr)',borderRadius:8,outline:'none',width:'100%',fontFamily:'var(--mono)',background:'#fff'}} />
                    <div style={{fontSize:10,color:'var(--t3)',marginTop:4}}>Positivo si sobro ayer, negativo si falto</div>
                  </div>
                  <div>
                    <label style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t2)',display:'block',marginBottom:4}}>Explicacion</label>
                    <input value={arrastreObs} onChange={e=>setArrastreObs(e.target.value)} placeholder="ej: sobrante del 14/05 que se recupero hoy" style={{fontSize:14,padding:'9px 12px',border:'1.5px solid var(--bdr)',borderRadius:8,outline:'none',width:'100%',fontFamily:'var(--font)',background:'#fff'}} />
                  </div>
                </div>
                {arrastre!==0&&(
                  <div style={{padding:'10px 14px',borderRadius:8,background:difNeta===0?'var(--gbg)':difNeta>0?'var(--abg)':'var(--rbg)',border:'1px solid '+(difNeta===0?'var(--gbdr)':difNeta>0?'var(--abdr)':'var(--rbdr)'),display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:13,fontWeight:600,color:difNeta===0?'var(--green)':difNeta>0?'var(--amber)':'var(--red)'}}>
                      {difNeta===0?'Diferencia neta: CERO — alerta resuelta':'Diferencia neta: '+fmt(difNeta)}
                    </span>
                    <span style={{fontFamily:'var(--mono)',fontSize:16,fontWeight:700,color:difNeta===0?'var(--green)':difNeta>0?'var(--amber)':'var(--red)'}}>{fmt(difNeta)}</span>
                  </div>
                )}
              </div>
            )}

            {/* MOTIVO DIFERENCIA */}
            {difEf!==0&&efTotal>0&&(
              <div style={{...sec,border:'1px solid var(--rbdr)',background:'var(--rbg)'}}>
                <div style={{fontSize:14,fontWeight:600,color:difEf>0?'var(--amber)':'var(--red)',marginBottom:6}}>{difEf>0?'Sobrante en Efectivo':'Faltante en Efectivo'}</div>
                <div style={{fontSize:12,color:difEf>0?'var(--amber)':'var(--red)',marginBottom:12}}>Hay {difEf>0?'un sobrante':'un faltante'} de {fmt(Math.abs(difEf))}. Debes registrar el motivo antes de guardar.</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:10}}>
                  <div>
                    <label style={lbl}>Causa</label>
                    <select value={difCausa} onChange={e=>setDifCausa(e.target.value)} style={{...inp,background:'#fff'}}>
                      <option value="">Seleccionar causa...</option>
                      {CAUSAS_DIF.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Vendedor responsable</label>
                    <select value={difResp} onChange={e=>setDifResp(e.target.value)} style={{...inp,background:'#fff'}}>
                      <option value="">Seleccionar...</option>
                      {golan.vendedores?.map(v=><option key={v.id} value={v.id}>{v.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={lbl}>Detalle</label>
                  <textarea value={difDet} onChange={e=>setDifDet(e.target.value)} rows={2} placeholder="Describe lo que ocurrio..." style={{...inp,resize:'vertical'}} />
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input type="checkbox" checked={difDescontar} onChange={e=>setDifDescontar(e.target.checked)} style={{width:16,height:16}} />
                  <label style={{fontSize:12,color:'var(--red)',fontWeight:500,cursor:'pointer'}}>Descontar del bono de asignacion de caja del colaborador</label>
                </div>
              </div>
            )}

            {/* OBSERVACIONES */}
            <div style={sec}>
              <label style={{...lbl,fontSize:12}}>Observaciones del Dia</label>
              <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={3} placeholder="Registra cualquier diferencia encontrada, error o novedad relevante del dia..." style={{...inp,resize:'vertical'}} />
            </div>

            {guardado&&<div style={{background:'var(--gbg)',border:'2px solid var(--gbdr)',borderRadius:10,padding:14,textAlign:'center',fontSize:14,fontWeight:600,color:'var(--green)',marginBottom:14}}>Arqueo guardado correctamente en Supabase</div>}

            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginBottom:20}}>
              <button onClick={()=>{ setGolan({ef:0,efBruto:0,deb:0,cred:0,transf:0,cheque:0,dev:0,totalVentas:0,vendedores:[]}); setGolanCargado1(false); setGolanCargado2(false); setBilletes1({}); setBilletes2({}); setFondo1(''); setFondo2(''); setSumupReal(''); setTransfReal(''); setCxc([]); setGastos([]); setDevs([]); setObs(''); setDifCausa(''); setDifResp(''); setDifDet(''); setDifDescontar(false); setGolanCargado1(false); setGolanCargado2(false) }}
                style={{padding:'10px 20px',borderRadius:9,border:'1px solid var(--bdr)',background:'transparent',color:'var(--t2)',cursor:'pointer',fontSize:13}}>Limpiar</button>
              <button onClick={guardar} disabled={guardando} style={{padding:'12px 28px',borderRadius:9,border:'none',background:'var(--blue)',color:'#fff',fontSize:15,fontWeight:600,opacity:guardando?.7:1,cursor:'pointer'}}>
                {guardando?'Guardando...':'Guardar Arqueo'}
              </button>
            </div>
          </div>
        )}

        {/* ===== TAB DEPOSITOS ===== */}
        {tab==='depositos'&&(
          <div>
            <div style={{fontSize:16,fontWeight:500,marginBottom:16}}>Depositos Bancarios</div>
            <div style={{display:'flex',gap:4,marginBottom:16,background:'var(--s2)',padding:4,borderRadius:10,width:'fit-content'}}>
              {[['pendientes','Pendientes'],['historial','Historial del Mes']].map(([id,l])=>(
                <button key={id} onClick={()=>setDepTab(id)} style={{padding:'6px 14px',borderRadius:7,border:'none',background:depTab===id?'#fff':'transparent',fontWeight:depTab===id?600:400,fontSize:12,color:depTab===id?'var(--tx)':'var(--t2)'}}>
                  {l}
                </button>
              ))}
            </div>
            {depTab==='pendientes'&&(
              <div>
                {/* Panel de confirmacion cuando hay seleccionados */}
                {seleccionados.length>=1&&(
                  <div style={{background:'var(--bbg)',border:'2px solid var(--bbdr)',borderRadius:12,padding:16,marginBottom:16}}>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--blue)',marginBottom:10}}>
                      Confirmar deposito — {seleccionados.length} dia(s) seleccionado(s)
                    </div>
                    <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:10,flexWrap:'wrap'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:10,color:'var(--t3)',marginBottom:4}}>BANCO</div>
                        <input list="bancos-dep" value={bancoDeposito} onChange={e=>setBancoDeposito(e.target.value)} placeholder="Seleccionar banco..." style={{fontSize:13,padding:'8px 12px',border:'1.5px solid var(--bdr)',borderRadius:8,outline:'none',width:'100%',fontFamily:'var(--font)'}} />
                        <datalist id="bancos-dep">
                          <option value="Banco de Chile" />
                          <option value="Banco Santander" />
                          <option value="Banco BICE" />
                          <option value="Scotiabank" />
                          <option value="Banco Itaú" />
                        </datalist>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:10,color:'var(--t3)',marginBottom:4}}>TOTAL A DEPOSITAR</div>
                        <div style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:700,color:'var(--blue)'}}>
                          {fmt(seleccionados.reduce((s,id)=>s+(depositos.find(d=>d.id===id)?.monto||0),0))}
                        </div>
                      </div>
                    </div>
                    <div style={{fontSize:11,color:'var(--t2)',marginBottom:10}}>
                      Dias incluidos: {seleccionados.map(id=>depositos.find(d=>d.id===id)?.fecha_dep).join(', ')}
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={async()=>{
                        if(!bancoDeposito){alert('Selecciona el banco antes de confirmar');return}
                        if(!confirm('Confirmar deposito de '+fmt(seleccionados.reduce((s,id)=>s+(depositos.find(d=>d.id===id)?.monto||0),0))+' en '+bancoDeposito+'?'))return
                        const diasInc=seleccionados.map(id=>depositos.find(d=>d.id===id)?.fecha_dep).filter(Boolean)
                        const grupoId='dep_grp_'+Date.now()
                        const montoTotal=seleccionados.reduce((s,id)=>s+(depositos.find(d=>d.id===id)?.monto||0),0)
                        for(const id of seleccionados){
                          await supabase.from('depositos').update({confirmado:true,banco:bancoDeposito,fecha_confirmacion:hoy(),dias_incluidos:diasInc,grupo_id:grupoId,monto_total_deposito:montoTotal}).eq('id',id)
                        }
                        setSeleccionados([])
                        setBancoDeposito('')
                        cargarDepositos(session)
                      }} style={{padding:'9px 20px',borderRadius:8,border:'none',background:'var(--green)',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                        Confirmar deposito
                      </button>
                      <button onClick={()=>{setSeleccionados([]);setBancoDeposito('')}} style={{padding:'9px 16px',borderRadius:8,border:'1px solid var(--bdr)',background:'transparent',color:'var(--t2)',fontSize:13,cursor:'pointer'}}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
                {depositos.filter(d=>!d.confirmado).length===0?
                  <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:24,textAlign:'center',color:'var(--t3)',fontSize:13}}>Sin depositos pendientes. Se generan automaticamente al guardar el arqueo diario.</div>:
                  depositos.filter(d=>!d.confirmado).map((dep,i)=>(
                    <div key={dep.id||i} style={{background:seleccionados.includes(dep.id)?'var(--bbg)':'#fff',border:`1px solid ${seleccionados.includes(dep.id)?'var(--bbdr)':'var(--abdr)'}`,borderRadius:12,padding:16,marginBottom:10}}>
                      <div style={{display:'grid',gridTemplateColumns:'auto 1fr auto auto',gap:10,alignItems:'center'}}>
                        <div style={{display:'flex',alignItems:'center',paddingBottom:2}}>
                          <input type="checkbox" checked={seleccionados.includes(dep.id)} onChange={e=>{
                            if(e.target.checked) setSeleccionados([...seleccionados,dep.id])
                            else setSeleccionados(seleccionados.filter(id=>id!==dep.id))
                          }} style={{width:18,height:18,cursor:'pointer'}} />
                        </div>
                        <div>
                          <div style={{fontSize:10,color:'var(--t3)',marginBottom:4}}>FECHA</div>
                          <div style={{fontSize:13,fontWeight:500}}>{dep.fecha_dep}</div>
                        </div>


                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                          <button onClick={async()=>{
                            if(!dep.banco){alert('Ingresa el banco antes de confirmar');return}
                            if(!confirm('Confirmar deposito de '+fmt(dep.monto)+' en '+dep.banco+'?'))return
                            await supabase.from('depositos').update({confirmado:true,fecha_confirmacion:new Date().toISOString().split('T')[0]}).eq('id',dep.id)
                            cargarDepositos(session)
                          }} style={{padding:'7px 12px',borderRadius:7,border:'none',background:'var(--green)',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
                            Confirmar
                          </button>
                          
                        </div>
                      </div>
                    </div>
                  ))
                }
                <datalist id="bancos-dep">
                  <option value="Banco de Chile" />
                  <option value="Banco Santander" />
                  <option value="Banco BICE" />
                  <option value="Scotiabank" />
                  <option value="Banco Itaú" />
                </datalist>
                <div style={{marginTop:14,padding:'12px 16px',background:'var(--bbg)',border:'1px solid var(--bbdr)',borderRadius:10,fontSize:12,color:'var(--blue)'}}>
                  Para agrupar varios dias en un deposito: selecciona los que vas a depositar juntos marcando el checkbox y luego confirmalos todos de una vez.
                </div>
                <button onClick={()=>setDepositos([...depositos,{id:'dep_nuevo_'+Date.now(),sucursal_id:session?.sucursal,fecha_dep:hoy(),banco:'',monto:'',obs:'',pendiente:true,confirmado:false,nuevo:true}])} style={{padding:'8px 16px',borderRadius:8,border:'1.5px dashed var(--bdr2)',background:'transparent',color:'var(--t2)',cursor:'pointer',fontSize:13,marginTop:10}}>
                  + Agregar deposito manual
                </button>
              </div>
            )}
            {depTab==='historial'&&(
              <div>
                {depositos.length===0?
                  <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:24,textAlign:'center',color:'var(--t3)',fontSize:13}}>Sin depositos registrados este mes</div>:
                  (()=>{
                    // Agrupar depositos confirmados por grupo_id
                    const grupos = {}
                    const sinGrupo = []
                    depositos.forEach(d=>{
                      if(!d.confirmado){ return }
                      if(d.grupo_id){
                        if(!grupos[d.grupo_id]) grupos[d.grupo_id]=[]
                        grupos[d.grupo_id].push(d)
                      } else {
                        sinGrupo.push(d)
                      }
                    })
                    const tarjetas = [
                      ...Object.values(grupos).map(grp=>({
                        ids: grp.map(d=>d.id),
                        banco: grp[0].banco,
                        fecha_confirmacion: grp[0].fecha_confirmacion,
                        monto_total: grp[0].monto_total_deposito || grp.reduce((s,d)=>s+d.monto,0),
                        dias: grp.map(d=>({fecha:d.fecha_dep,monto:d.monto})),
                        grupo_id: grp[0].grupo_id,
                        multiple: true
                      })),
                      ...sinGrupo.map(d=>({
                        ids:[d.id],banco:d.banco,fecha_confirmacion:d.fecha_confirmacion,
                        monto_total:d.monto,dias:[{fecha:d.fecha_dep,monto:d.monto}],
                        grupo_id:null,multiple:false
                      }))
                    ]
                    return tarjetas.map((t,i)=>(
                      <div key={t.grupo_id||t.ids[0]||i} style={{background:'var(--gbg)',border:'1px solid var(--gbdr)',borderRadius:12,padding:16,marginBottom:10}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:600,marginBottom:3}}>{t.banco||'Sin banco'}</div>
                            <div style={{fontSize:11,color:'var(--t2)'}}>Confirmado el {t.fecha_confirmacion||'—'}</div>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:700,color:'var(--green)'}}>{fmt(t.monto_total)}</div>
                            <div style={{fontSize:11,color:'var(--t3)'}}>Total depositado</div>
                          </div>
                        </div>
                        <div style={{background:'rgba(0,0,0,.04)',borderRadius:8,padding:'10px 12px',marginBottom:10}}>
                          <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t2)',marginBottom:6}}>
                            {t.multiple?'Dias incluidos en este deposito':'Dia del deposito'}
                          </div>
                          {t.dias.map(({fecha,monto})=>(
                            <div key={fecha} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0',borderBottom:'1px solid rgba(0,0,0,.06)'}}>
                              <span style={{color:'var(--t2)'}}>{fecha}</span>
                              <span style={{fontFamily:'var(--mono)',fontWeight:500}}>{fmt(monto)}</span>
                            </div>
                          ))}
                        </div>
                        <button onClick={async()=>{
                          if(!confirm('Desmarcar este deposito para poder editarlo?')) return
                          for(const id of t.ids){
                            await supabase.from('depositos').update({confirmado:false,banco:'',fecha_confirmacion:null,dias_incluidos:null,grupo_id:null}).eq('id',id)
                          }
                          cargarDepositos(session)
                        }} style={{padding:'6px 14px',borderRadius:7,border:'1px solid var(--rbdr)',background:'var(--rbg)',color:'var(--red)',fontSize:12,cursor:'pointer'}}>
                          Desmarcar y editar
                        </button>
                      </div>
                    ))
                  })()
                }
              </div>
            )}
          </div>
        )}

        {/* ===== TAB FONDO ===== */}
        {tab==='fondo'&&(
          <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:24,textAlign:'center',color:'var(--t2)',fontSize:13}}>
            <div style={{fontSize:36,marginBottom:12}}>💰</div>
            <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>Fondo de Caja</div>
            <div>Gestiona el fondo de caja desde el modulo dedicado</div>
            <a href="/fondo" style={{display:'inline-block',marginTop:16,padding:'10px 24px',borderRadius:9,border:'none',background:'var(--blue)',color:'#fff',fontSize:14,fontWeight:600,textDecoration:'none'}}>Ir a Fondo de Caja</a>
          </div>
        )}

        {/* ===== TAB COBROS ===== */}
        {tab==='cobros'&&(
          <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:24,textAlign:'center',color:'var(--t2)',fontSize:13}}>
            <div style={{fontSize:36,marginBottom:12}}>📋</div>
            <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>Cobros Pendientes</div>
            <div>Gestiona los cobros pendientes desde el modulo dedicado</div>
            <a href="/cobros" style={{display:'inline-block',marginTop:16,padding:'10px 24px',borderRadius:9,border:'none',background:'var(--blue)',color:'#fff',fontSize:14,fontWeight:600,textDecoration:'none'}}>Ir a Cobros</a>
          </div>
        )}

        {/* ===== TAB HISTORIAL ===== */}
        {tab==='historial'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
              {[
                {lbl:'Ventas del mes',val:fmt(historial.reduce((s,a)=>s+(a.golan?.totalVentas||0),0)),color:'var(--blue)'},
                {lbl:'Efectivo',val:fmt(historial.reduce((s,a)=>s+(a.golan?.ef||0),0)),color:'var(--green)'},
                {lbl:'Dias registrados',val:historial.length,color:'var(--t2)'},
                {lbl:'Dias con diferencia',val:historial.filter(a=>a.dif_neta!==0&&a.dif_neta!==null&&a.dif_neta!==undefined).length,color:'var(--red)'},
              ].map((k,i)=>(
                <div key={i} style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:10,padding:'14px 16px'}}>
                  <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>{k.lbl}</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:700,color:k.color}}>{k.val}</div>
                </div>
              ))}
            </div>
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'var(--s2)'}}>
                    {['Fecha','Ventas Golan','Efectivo','Debito/SumUp','Transferencia','Convenios','Diferencia','Guardado por','Obs','Estado'].map(h=>(
                      <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'var(--t2)',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {histLoading?<tr><td colSpan={8} style={{padding:20,textAlign:'center',color:'var(--t3)'}}>Cargando...</td></tr>:
                    historial.length===0?<tr><td colSpan={8} style={{padding:20,textAlign:'center',color:'var(--t3)'}}>Sin arqueos este mes</td></tr>:
                    historial.map((a,i)=>{
                      const dif=a.dif_neta!==null&&a.dif_neta!==undefined ? a.dif_neta : (a.dif_ef||0)
                      return (
                        <tr key={a.id} style={{borderTop:'1px solid var(--bdr)',background:dif!==0&&dif!==null?'var(--rbg)':i%2===0?'#fff':'var(--s2)'}}>
                          <td style={{padding:'8px 12px',fontWeight:500}}>{a.fecha}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt(a.golan?.totalVentas||0)}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt(a.golan?.ef||0)}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt((a.golan?.deb||0)+(a.sumup||0))}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt(a.transf_real||0)}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt(a.golan?.cheque||0)}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right',fontWeight:600,color:dif!==0?(dif>0?'var(--amber)':'var(--red)'):'var(--green)'}}>{dif===0?'OK':dif>0?'+'+fmt(dif):fmt(dif)}</td>
                          <td style={{padding:'8px 12px',color:'var(--t2)'}}>{a.usuario_nombre}</td>
                          <td style={{padding:'8px 12px',color:'var(--t2)',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.obs||'—'}</td>
                          <td style={{padding:'8px 12px',display:'flex',gap:6,alignItems:'center'}}>
                            <button onClick={()=>{
                              if(!confirm('Editar el arqueo del '+a.fecha+'? Podras corregir los datos y volver a guardar.')) return
                              setFecha(a.fecha)
                              // Guardar id original para borrarlo si cambia la fecha
                              setEditandoId(a.id)
                              setObs(a.obs||'')
                              setSumupReal(String(a.sumup||''))
                              setTransfReal(String(a.transf_real||''))
                              setArrastre(String(a.arrastre||0))
                              setArrastreObs(a.arrastre_obs||'')
                              setCxc(a.cxc||[])
                              setGastos(a.gastos||[])
                              setDevs(a.devs||[])
                              // Restaurar golan desde los datos guardados
                              if(a.golan) setGolan(a.golan)
                              setGolanCargado1(!!a.golan)
                              setGolanCargado2(!!a.golan)
                              // Restaurar billetes desde cajas guardadas
                              if(a.cajas?.c1?.billetes) setBilletes1(a.cajas.c1.billetes)
                              if(a.cajas?.c2?.billetes) setBilletes2(a.cajas.c2.billetes)
                              setTab('ingresar')
                              window.scrollTo(0,0)
                            }} style={{padding:'3px 8px',borderRadius:6,border:'1px solid var(--bdr)',background:'var(--s2)',color:'var(--t2)',fontSize:11,cursor:'pointer'}}>
                              Editar
                            </button>
                            <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:dif!==0?'var(--rbg)':'var(--gbg)',color:dif!==0?'var(--red)':'var(--green)'}}>
                              {dif!==0?'Con diferencia':'Cuadrado'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>
    </>
  )
}
// cache bust Fri May 15 14:10:42 -04 2026
