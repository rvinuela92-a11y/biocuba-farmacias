import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL')
const hoy = () => new Date().toISOString().split('T')[0]
const mes = () => new Date().toISOString().slice(0,7)
const BILLETES = [20000,10000,5000,1000,500,100,50,10]

export default function Fondo() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [tab, setTab] = useState('conteo')
  const [config, setConfig] = useState({monto:0})
  const [billetes, setBilletes] = useState({})
  const [obs, setObs] = useState('')
  const [movimientos, setMovimientos] = useState([])
  const [movTipo, setMovTipo] = useState('salida')
  const [movMotivo, setMovMotivo] = useState('')
  const [movMonto, setMovMonto] = useState('')
  const [movResp, setMovResp] = useState('')
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [conteos, setConteos] = useState([])

  useEffect(()=>{
    const s = getSession()
    if(!s||s.rol!=='qf'){ router.replace('/login'); return }
    setSession(s)
    cargarDatos(s)
  },[])

  async function cargarDatos(s){
    setLoading(true)
    const mesActual = mes()
    const [rC,rM,rCo] = await Promise.all([
      supabase.from('fondo_config').select('*').eq('sucursal_id',s.sucursal).single(),
      supabase.from('fondo_movimientos').select('*').eq('sucursal_id',s.sucursal).gte('fecha',mesActual+'-01').lte('fecha',mesActual+'-31').order('fecha',{ascending:false}),
      supabase.from('fondo_conteos').select('*').eq('sucursal_id',s.sucursal).gte('fecha',mesActual+'-01').lte('fecha',mesActual+'-31').order('fecha',{ascending:false}).limit(10),
    ])
    if(rC.data) setConfig(rC.data)
    setMovimientos(rM.data||[])
    setConteos(rCo.data||[])
    setLoading(false)
  }

  const efBilletes = BILLETES.reduce((s,b)=>s+(parseInt(billetes[b]||0)*b),0)
  const difFondo = efBilletes - config.monto

  async function guardarConteo(){
    if(efBilletes===0){ alert('Ingresa el conteo de billetes'); return }
    setGuardando(true)
    try {
      const {error} = await supabase.from('fondo_conteos').insert({
        id: Date.now()+'_'+session.sucursal,
        sucursal_id: session.sucursal,
        fecha: hoy(),
        asignado: config.monto,
        conteo: efBilletes,
        dif: difFondo,
        billetes,
        obs,
        ts: Date.now()
      })
      if(error) throw error
      setGuardado(true)
      setBilletes({})
      setObs('')
      cargarDatos(session)
      setTimeout(()=>setGuardado(false),3000)
    } catch(e){ alert('Error: '+e.message) }
    finally { setGuardando(false) }
  }

  async function guardarMovimiento(){
    if(!movMotivo.trim()){ alert('Ingresa el motivo'); return }
    const monto = parseFloat(movMonto)||0
    if(!monto||monto<=0){ alert('Ingresa un monto válido'); return }
    setGuardando(true)
    try {
      const saldoActual = config.monto + movimientos.reduce((s,m)=>s+(m.tipo==='entrada'?m.monto:m.tipo==='salida'?-m.monto:0),0)
      const saldoNuevo = movTipo==='entrada'?saldoActual+monto:movTipo==='salida'?saldoActual-monto:saldoActual
      const {error} = await supabase.from('fondo_movimientos').insert({
        id: Date.now()+'_'+session.sucursal,
        sucursal_id: session.sucursal,
        fecha: hoy(),
        tipo: movTipo,
        motivo: movMotivo,
        responsable: movResp||session.nombre,
        monto,
        saldo_antes: saldoActual,
        saldo_despues: saldoNuevo,
        ts: Date.now()
      })
      if(error) throw error
      setMovMotivo(''); setMovMonto(''); setMovResp('')
      cargarDatos(session)
    } catch(e){ alert('Error: '+e.message) }
    finally { setGuardando(false) }
  }

  async function actualizarMonto(nuevoMonto){
    const {error} = await supabase.from('fondo_config').upsert({sucursal_id:session.sucursal,monto:nuevoMonto,updated_at:new Date().toISOString()})
    if(!error) setConfig({...config,monto:nuevoMonto})
  }

  const inp = {fontSize:14,padding:'9px 12px',border:'1.5px solid var(--bdr)',borderRadius:8,outline:'none',width:'100%',fontFamily:'var(--font)',background:'#fff'}
  const lbl = {fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t2)',display:'block',marginBottom:4}
  const sec = {background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:20,marginBottom:14}

  return (
    <>
      <Head><title>Fondo de Caja - BioCuba</title></Head>
      <header style={{background:'#fff',borderBottom:'2.5px solid var(--br)',padding:'0 20px',display:'flex',alignItems:'center',minHeight:54,gap:12,flexWrap:'wrap'}}>
        <img src="/logo.jpg" alt="BioCuba" style={{height:38,width:'auto'}} />
        <div style={{width:1,height:22,background:'var(--bdr)'}}></div>
        <span style={{fontSize:13,fontWeight:600}}>Fondo de Caja</span>
        <span style={{fontSize:12,fontWeight:600,color:'#fff',background:'var(--blue)',padding:'3px 10px',borderRadius:20}}>{session?.sucursalNombre}</span>
        <a href="/qf" style={{marginLeft:'auto',fontSize:12,color:'var(--t2)',textDecoration:'none'}}>Panel QF</a>
      </header>

      <main style={{padding:20,maxWidth:960,margin:'0 auto'}}>
        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
          {[
            {lbl:'Fondo asignado',val:fmt(config.monto),color:'var(--blue)'},
            {lbl:'Ultimo conteo',val:conteos.length>0?fmt(conteos[0].conteo):'Sin conteo',color:conteos.length>0&&conteos[0].dif!==0?'var(--red)':'var(--green)'},
            {lbl:'Diferencia ultimo conteo',val:conteos.length>0?fmt(conteos[0].dif):'—',color:conteos.length>0&&conteos[0].dif!==0?'var(--red)':'var(--green)'},
          ].map((k,i)=>(
            <div key={i} style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:10,padding:'14px 16px'}}>
              <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>{k.lbl}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:700,color:k.color}}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--s2)',padding:4,borderRadius:10,width:'fit-content'}}>
          {[['conteo','Conteo de Fondo'],['movimientos','Movimientos'],['config','Configuracion']].map(([id,l])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:'7px 14px',borderRadius:7,border:'none',background:tab===id?'#fff':'transparent',fontWeight:tab===id?600:400,fontSize:13,color:tab===id?'var(--tx)':'var(--t2)'}}>
              {l}
            </button>
          ))}
        </div>

        {/* TAB CONTEO */}
        {tab==='conteo'&&(
          <div>
            <div style={sec}>
              <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>Conteo del fondo de caja</div>
              <div style={{fontSize:12,color:'var(--t3)',marginBottom:16}}>Cuenta los billetes y monedas del fondo de cambio al inicio o cierre del dia</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                {BILLETES.map(b=>(
                  <div key={b} style={{display:'flex',alignItems:'center',gap:8,background:'var(--s2)',borderRadius:8,padding:'8px 12px'}}>
                    <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,minWidth:60,color:'var(--blue)'}}>{fmt(b)}</span>
                    <span style={{color:'var(--t3)',fontSize:11}}>x</span>
                    <input type="number" min="0" value={billetes[b]||''} onChange={e=>{const v={...billetes};v[b]=e.target.value;setBilletes(v)}}
                      placeholder="0" style={{...inp,width:65,textAlign:'center',padding:'5px 6px',fontSize:13,fontFamily:'var(--mono)'}} />
                    <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--t2)',marginLeft:'auto'}}>{fmt((parseInt(billetes[b]||0)*b))}</span>
                  </div>
                ))}
              </div>
              <div style={{padding:'12px 16px',background:difFondo!==0&&efBilletes>0?'var(--rbg)':'var(--bbg)',borderRadius:8,marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:13,color:'var(--t2)'}}>Total contado</span>
                  <span style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:700}}>{fmt(efBilletes)}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:13,color:'var(--t2)'}}>Fondo asignado</span>
                  <span style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:700,color:'var(--blue)'}}>{fmt(config.monto)}</span>
                </div>
                {efBilletes>0&&(
                  <div style={{display:'flex',justifyContent:'space-between',paddingTop:8,borderTop:'1px solid var(--bdr)'}}>
                    <span style={{fontSize:13,fontWeight:600,color:difFondo!==0?'var(--red)':'var(--green)'}}>
                      {difFondo===0?'Fondo cuadra correctamente':difFondo>0?'Fondo tiene exceso':'Fondo tiene faltante'}
                    </span>
                    <span style={{fontFamily:'var(--mono)',fontSize:16,fontWeight:700,color:difFondo!==0?'var(--red)':'var(--green)'}}>{difFondo===0?'OK':fmt(difFondo)}</span>
                  </div>
                )}
              </div>
              <div style={{marginBottom:14}}>
                <label style={lbl}>Observaciones</label>
                <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2} placeholder="ej: se encontro billete falso, faltante de sencilla..." style={{...inp,resize:'vertical'}} />
              </div>
              {guardado&&<div style={{background:'var(--gbg)',border:'2px solid var(--gbdr)',borderRadius:8,padding:12,textAlign:'center',fontSize:13,fontWeight:600,color:'var(--green)',marginBottom:12}}>Conteo guardado correctamente</div>}
              <button onClick={guardarConteo} disabled={guardando} style={{width:'100%',padding:13,borderRadius:10,border:'none',background:'var(--blue)',color:'#fff',fontSize:14,fontWeight:600,opacity:guardando?.7:1}}>
                {guardando?'Guardando...':'Guardar Conteo'}
              </button>
            </div>

            {/* Historial de conteos */}
            {conteos.length>0&&(
              <div style={sec}>
                <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>Conteos recientes</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead><tr style={{background:'var(--s2)'}}>
                      {['Fecha','Fondo asignado','Conteo','Diferencia','Estado'].map(h=>(
                        <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'var(--t2)'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {conteos.map((c,i)=>(
                        <tr key={c.id} style={{borderTop:'1px solid var(--bdr)',background:c.dif!==0?'var(--rbg)':i%2===0?'#fff':'var(--s2)'}}>
                          <td style={{padding:'8px 12px'}}>{c.fecha}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt(c.asignado)}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt(c.conteo)}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right',fontWeight:600,color:c.dif!==0?'var(--red)':'var(--green)'}}>{c.dif!==0?fmt(c.dif):'OK'}</td>
                          <td style={{padding:'8px 12px'}}>
                            <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:c.dif!==0?'var(--rbg)':'var(--gbg)',color:c.dif!==0?'var(--red)':'var(--green)'}}>
                              {c.dif!==0?'Con diferencia':'Cuadrado'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB MOVIMIENTOS */}
        {tab==='movimientos'&&(
          <div>
            <div style={sec}>
              <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>Registrar movimiento de fondo</div>
              <div style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr 1fr',gap:12,alignItems:'end',marginBottom:14}}>
                <div>
                  <label style={lbl}>Tipo</label>
                  <select value={movTipo} onChange={e=>setMovTipo(e.target.value)} style={{...inp,width:120,background:'#fff'}}>
                    <option value="entrada">Entrada</option>
                    <option value="salida">Salida</option>
                    <option value="ajuste">Ajuste</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Motivo</label>
                  <input value={movMotivo} onChange={e=>setMovMotivo(e.target.value)} placeholder="ej: reposicion sencilla, retiro diferencia" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Responsable</label>
                  <input value={movResp} onChange={e=>setMovResp(e.target.value)} placeholder={session?.nombre||'nombre'} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Monto</label>
                  <input type="number" value={movMonto} onChange={e=>setMovMonto(e.target.value)} placeholder="0" style={inp} />
                </div>
              </div>
              <button onClick={guardarMovimiento} style={{padding:'10px 20px',borderRadius:9,border:'none',background:'var(--blue)',color:'#fff',fontSize:13,fontWeight:600}}>
                Registrar movimiento
              </button>
            </div>

            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,overflow:'hidden'}}>
              <div style={{padding:'14px 16px',borderBottom:'1px solid var(--bdr)',fontSize:13,fontWeight:600}}>
                Movimientos del mes
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'var(--s2)'}}>
                    {['Fecha','Tipo','Motivo','Responsable','Monto','Saldo tras movimiento'].map(h=>(
                      <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'var(--t2)',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {loading?<tr><td colSpan={6} style={{padding:20,textAlign:'center',color:'var(--t3)'}}>Cargando...</td></tr>:
                    movimientos.length===0?<tr><td colSpan={6} style={{padding:20,textAlign:'center',color:'var(--t3)'}}>Sin movimientos este mes</td></tr>:
                    movimientos.map((m,i)=>(
                      <tr key={m.id} style={{borderTop:'1px solid var(--bdr)',background:i%2===0?'#fff':'var(--s2)'}}>
                        <td style={{padding:'8px 12px'}}>{m.fecha}</td>
                        <td style={{padding:'8px 12px'}}>
                          <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:m.tipo==='entrada'?'var(--gbg)':m.tipo==='salida'?'var(--rbg)':'var(--bbg)',color:m.tipo==='entrada'?'var(--green)':m.tipo==='salida'?'var(--red)':'var(--blue)'}}>
                            {m.tipo==='entrada'?'Entrada':m.tipo==='salida'?'Salida':'Ajuste'}
                          </span>
                        </td>
                        <td style={{padding:'8px 12px'}}>{m.motivo}</td>
                        <td style={{padding:'8px 12px',color:'var(--t2)'}}>{m.responsable}</td>
                        <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right',fontWeight:600,color:m.tipo==='salida'?'var(--red)':'var(--green)'}}>{m.tipo==='salida'?'-':''}{fmt(m.monto)}</td>
                        <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt(m.saldo_despues||0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONFIG */}
        {tab==='config'&&(
          <div style={sec}>
            <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>Monto asignado al fondo</div>
            <div style={{fontSize:12,color:'var(--t3)',marginBottom:16}}>Este es el monto que debe haber en el fondo de cambio al inicio de cada dia</div>
            <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
              <div style={{flex:1}}>
                <label style={lbl}>Monto del fondo</label>
                <input type="number" defaultValue={config.monto} onBlur={e=>actualizarMonto(parseFloat(e.target.value)||0)} style={{...inp,fontFamily:'var(--mono)',fontSize:20,fontWeight:700}} />
              </div>
              <button onClick={()=>actualizarMonto(config.monto)} style={{padding:'10px 20px',borderRadius:9,border:'none',background:'var(--green)',color:'#fff',fontSize:13,fontWeight:600}}>
                Guardar
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
