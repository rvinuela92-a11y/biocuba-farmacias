import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL')
const hoy = () => new Date().toISOString().split('T')[0]
const mes = () => new Date().toISOString().slice(0,7)

const BILLETES = [20000,10000,5000,1000,500,100,50,10]

export default function Arqueo() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [tab, setTab] = useState('arqueo')
  const [fecha, setFecha] = useState(hoy())
  const [golan, setGolan] = useState(null)
  const [billetes, setBilletes] = useState({})
  const [sumup, setSumup] = useState('')
  const [transfReal, setTransfReal] = useState('')
  const [obs, setObs] = useState('')
  const [difMotivo, setDifMotivo] = useState('')
  const [difResp, setDifResp] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    const s = getSession()
    if(!s||s.rol!=='qf'){ router.replace('/login'); return }
    setSession(s)
    cargarHistorial(s)
  },[])

  async function cargarHistorial(s){
    setLoading(true)
    const mesActual = mes()
    const {data} = await supabase.from('arqueos').select('*').eq('sucursal_id',s.sucursal).gte('fecha',mesActual+'-01').lte('fecha',mesActual+'-31').order('fecha',{ascending:false})
    setHistorial(data||[])
    setLoading(false)
  }

  // Parsear CSV Golan
  async function parsearCSV(file){
    if(!file) return
    const buf = await file.arrayBuffer()
    const txt = new TextDecoder('iso-8859-1').decode(buf)
    const lines = txt.replace(/\r/g,'').split('\n').filter(l=>l.trim())
    let totalVentas=0, totalEfectivo=0, totalTarjeta=0, totalTransferencia=0
    const vendedores = {}
    lines.forEach(line=>{
      const cols = line.split(';')
      if(cols.length < 16) return
      const monto = parseFloat(cols[4]?.replace(/[^0-9.-]/g,''))||0
      const tipo = cols[5]?.trim()
      const vid = cols[14]?.trim()
      const vnombre = cols[15]?.trim()
      if(monto<=0) return
      totalVentas += monto
      if(tipo==='Efectivo') totalEfectivo+=monto
      else if(tipo==='Tarjeta') totalTarjeta+=monto
      else if(tipo==='Transferencia') totalTransferencia+=monto
      if(vid&&vnombre) vendedores[vid]={id:vid,nombre:vnombre}
    })
    setGolan({totalVentas,totalEfectivo,totalTarjeta,totalTransferencia,vendedores:Object.values(vendedores)})
  }

  // Calcular totales
  const efBilletes = BILLETES.reduce((s,b)=>s+(parseInt(billetes[b]||0)*b),0)
  const sumaGolan = golan?.totalVentas||0
  const efNeto = efBilletes - (parseFloat(sumup)||0)
  const difEf = efNeto - (golan?.totalEfectivo||0)

  async function guardar(){
    if(!golan){ alert('Debes subir el CSV de Golan primero'); return }
    if(!fecha){ alert('Selecciona la fecha'); return }
    if(efBilletes===0){ alert('Ingresa el conteo de billetes'); return }
    setGuardando(true)
    try {
      const payload = {
        id: fecha+'_'+session.sucursal,
        fecha,
        sucursal_id: session.sucursal,
        usuario_nombre: session.nombre,
        golan: golan,
        ef_total: efBilletes,
        ef_neto: efNeto,
        dif_ef: difEf,
        sumup: parseFloat(sumup)||0,
        transf_real: parseFloat(transfReal)||0,
        motivo: difEf!==0&&difMotivo?{causa:difMotivo,resp:difResp}:null,
        obs,
        ts: Date.now(),
        updated_at: new Date().toISOString()
      }
      const {error} = await supabase.from('arqueos').upsert(payload,{onConflict:'id'})
      if(error) throw error
      setGuardado(true)
      cargarHistorial(session)
      setTimeout(()=>setGuardado(false),3000)
    } catch(e) {
      alert('Error al guardar: '+e.message)
    } finally {
      setGuardando(false)
    }
  }

  const inp = {fontSize:15,padding:'10px 12px',border:'1.5px solid var(--bdr)',borderRadius:8,outline:'none',width:'100%',fontFamily:'var(--font)',background:'#fff'}
  const lbl = {fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t2)',display:'block',marginBottom:4}

  return (
    <>
      <Head><title>Arqueo de Caja — BioCuba</title></Head>
      <header style={{background:'#fff',borderBottom:'2.5px solid var(--br)',padding:'0 20px',display:'flex',alignItems:'center',minHeight:54,gap:12,flexWrap:'wrap'}}>
        <img src="/logo.jpg" alt="BioCuba" style={{height:38,width:'auto'}} />
        <div style={{width:1,height:22,background:'var(--bdr)'}}></div>
        <span style={{fontSize:13,fontWeight:600}}>📊 Arqueo de Caja</span>
        <span style={{fontSize:12,fontWeight:600,color:'#fff',background:'var(--blue)',padding:'3px 10px',borderRadius:20}}>{session?.sucursalNombre}</span>
        <a href="/qf" style={{marginLeft:'auto',fontSize:12,color:'var(--t2)',textDecoration:'none'}}>← Panel QF</a>
      </header>

      <main style={{padding:20,maxWidth:960,margin:'0 auto'}}>
        {/* TABS */}
        <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--s2)',padding:4,borderRadius:10,width:'fit-content'}}>
          {[['arqueo','📊 Registrar Arqueo'],['historial','📋 Historial']].map(([id,lbl])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:'7px 16px',borderRadius:7,border:'none',background:tab===id?'#fff':'transparent',fontWeight:tab===id?600:400,fontSize:13,color:tab===id?'var(--tx)':'var(--t2)',boxShadow:tab===id?'0 1px 4px rgba(0,0,0,.08)':'none'}}>{lbl}</button>
          ))}
        </div>

        {/* TAB ARQUEO */}
        {tab==='arqueo'&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>

            {/* FECHA */}
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:20}}>
              <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>Fecha del arqueo</div>
              <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{...inp,width:'auto'}} />
            </div>

            {/* GOLAN CSV */}
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:20}}>
              <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>Archivo CSV Golan</div>
              <div style={{fontSize:12,color:'var(--t3)',marginBottom:14}}>Sube el archivo de cierre Z del día (codificación latin1)</div>
              <input type="file" accept=".csv,.txt" onChange={e=>parsearCSV(e.target.files[0])} style={{fontSize:13,marginBottom:12}} />
              {golan&&(
                <div style={{background:'var(--gbg)',border:'1px solid var(--gbdr)',borderRadius:8,padding:14,marginTop:8}}>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--green)',marginBottom:8}}>✓ CSV cargado correctamente</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                    {[['Total Ventas',golan.totalVentas],['Efectivo',golan.totalEfectivo],['Tarjeta/SumUp',golan.totalTarjeta]].map(([l,v])=>(
                      <div key={l} style={{background:'#fff',borderRadius:7,padding:10,textAlign:'center'}}>
                        <div style={{fontSize:9,textTransform:'uppercase',color:'var(--t3)',marginBottom:3}}>{l}</div>
                        <div style={{fontFamily:'var(--mono)',fontSize:15,fontWeight:700}}>{fmt(v)}</div>
                      </div>
                    ))}
                  </div>
                  {golan.vendedores?.length>0&&(
                    <div style={{marginTop:10,fontSize:12,color:'var(--t2)'}}>Vendedores: {golan.vendedores.map(v=>v.nombre).join(', ')}</div>
                  )}
                </div>
              )}
            </div>

            {/* BILLETES */}
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:20}}>
              <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>Conteo de billetes y monedas</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {BILLETES.map(b=>(
                  <div key={b} style={{display:'flex',alignItems:'center',gap:10,background:'var(--s2)',borderRadius:8,padding:'8px 12px'}}>
                    <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,minWidth:60,color:'var(--blue)'}}>{fmt(b)}</span>
                    <span style={{color:'var(--t3)',fontSize:12}}>×</span>
                    <input type="number" min="0" value={billetes[b]||''} onChange={e=>{const v={...billetes};v[b]=e.target.value;setBilletes(v)}}
                      placeholder="0" style={{...inp,width:70,textAlign:'center',padding:'6px 8px',fontSize:14,fontFamily:'var(--mono)'}} />
                    <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--t2)',marginLeft:'auto'}}>{fmt((parseInt(billetes[b]||0)*b))}</span>
                  </div>
                ))}
              </div>
              <div style={{marginTop:14,padding:'12px 16px',background:'var(--bbg)',borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:13,fontWeight:600,color:'var(--blue)'}}>Total efectivo contado</span>
                <span style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:700,color:'var(--blue)'}}>{fmt(efBilletes)}</span>
              </div>
            </div>

            {/* SUMUP Y TRANSFERENCIAS */}
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:20}}>
              <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>Otras formas de pago</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={lbl}>SumUp (tarjeta)</label>
                  <input type="number" value={sumup} onChange={e=>setSumup(e.target.value)} placeholder="0" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Transferencias recibidas</label>
                  <input type="number" value={transfReal} onChange={e=>setTransfReal(e.target.value)} placeholder="0" style={inp} />
                </div>
              </div>
            </div>

            {/* RESUMEN */}
            {golan&&(
              <div style={{background:'#fff',border:`2px solid ${Math.abs(difEf)>0?'var(--rbdr)':'var(--gbdr)'}`,borderRadius:12,padding:20}}>
                <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>Resumen del arqueo</div>
                {[
                  ['Ventas Golan',fmt(sumaGolan),'var(--blue)'],
                  ['Efectivo Golan',fmt(golan.totalEfectivo),'var(--t2)'],
                  ['Efectivo contado',fmt(efBilletes),'var(--t2)'],
                  ['SumUp',fmt(parseFloat(sumup)||0),'var(--t2)'],
                  ['Efectivo neto',fmt(efNeto),'var(--blue)'],
                ].map(([l,v,c])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--bdr)'}}>
                    <span style={{fontSize:13,color:'var(--t2)'}}>{l}</span>
                    <span style={{fontFamily:'var(--mono)',fontWeight:600,color:c}}>{v}</span>
                  </div>
                ))}
                <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',marginTop:4}}>
                  <span style={{fontSize:14,fontWeight:700,color:difEf!==0?'var(--red)':'var(--green)'}}>
                    {difEf===0?'✓ Cuadrado':'⚠ Diferencia en efectivo'}
                  </span>
                  <span style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:700,color:difEf!==0?'var(--red)':'var(--green)'}}>{fmt(difEf)}</span>
                </div>
                {difEf!==0&&(
                  <div style={{marginTop:10,padding:14,background:'var(--rbg)',borderRadius:8}}>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--red)',marginBottom:10}}>Explica la diferencia</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                      <div>
                        <label style={lbl}>Motivo</label>
                        <input value={difMotivo} onChange={e=>setDifMotivo(e.target.value)} placeholder="ej: vuelto incorrecto" style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>Responsable</label>
                        <input value={difResp} onChange={e=>setDifResp(e.target.value)} placeholder="nombre del vendedor" style={inp} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* OBSERVACIONES */}
            <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:20}}>
              <label style={lbl}>Observaciones (opcional)</label>
              <textarea value={obs} onChange={e=>setObs(e.target.value)} placeholder="Notas del día..." rows={3} style={{...inp,resize:'vertical'}} />
            </div>

            {/* GUARDAR */}
            {guardado&&(
              <div style={{background:'var(--gbg)',border:'2px solid var(--gbdr)',borderRadius:10,padding:16,textAlign:'center',fontSize:14,fontWeight:600,color:'var(--green)'}}>
                ✓ Arqueo guardado correctamente en Supabase
              </div>
            )}
            <button onClick={guardar} disabled={guardando} style={{padding:16,borderRadius:12,border:'none',background:'var(--blue)',color:'#fff',fontSize:16,fontWeight:600,opacity:guardando?.7:1}}>
              {guardando?'Guardando...':'✓ Guardar Arqueo'}
            </button>
          </div>
        )}

        {/* TAB HISTORIAL */}
        {tab==='historial'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
              {[
                {lbl:'Ventas del mes',val:fmt(historial.reduce((s,a)=>s+(a.golan?.totalVentas||0),0)),color:'var(--blue)'},
                {lbl:'Efectivo neto',val:fmt(historial.reduce((s,a)=>s+(a.ef_neto||0),0)),color:'var(--green)'},
                {lbl:'Días registrados',val:historial.length,color:'var(--t2)'},
                {lbl:'Días con diferencia',val:historial.filter(a=>(a.dif_ef||0)!==0).length,color:'var(--red)'},
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
                    {['Fecha','Ventas Golan','Ef. Golan','Ef. Contado','Diferencia','SumUp','Estado'].map(h=>(
                      <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'var(--t2)',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {loading?<tr><td colSpan={7} style={{padding:20,textAlign:'center',color:'var(--t3)'}}>Cargando...</td></tr>:
                    historial.length===0?<tr><td colSpan={7} style={{padding:20,textAlign:'center',color:'var(--t3)'}}>Sin arqueos este mes</td></tr>:
                    historial.map((a,i)=>{
                      const dif=a.dif_ef||0
                      return (
                        <tr key={a.id} style={{borderTop:'1px solid var(--bdr)',background:dif!==0?'var(--rbg)':i%2===0?'#fff':'var(--s2)'}}>
                          <td style={{padding:'8px 12px',fontWeight:500}}>{a.fecha}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt(a.golan?.totalVentas||0)}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt(a.golan?.totalEfectivo||0)}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt(a.ef_total||0)}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right',fontWeight:600,color:dif!==0?'var(--red)':'var(--green)'}}>{dif!==0?fmt(dif):'✓'}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt(a.sumup||0)}</td>
                          <td style={{padding:'8px 12px'}}>
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
