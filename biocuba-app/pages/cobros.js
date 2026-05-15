import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL')
const hoy = () => new Date().toISOString().split('T')[0]
const mes = () => new Date().toISOString().slice(0,7)

export default function Cobros() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [cobros, setCobros] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pendientes')

  useEffect(()=>{
    const s = getSession()
    if(!s||s.rol!=='qf'){ router.replace('/login'); return }
    setSession(s)
    cargarCobros(s)
  },[])

  async function cargarCobros(s){
    setLoading(true)
    const mesActual = mes()
    const {data} = await supabase
      .from('arqueos')
      .select('fecha,cxc,sucursal_id')
      .eq('sucursal_id', s.sucursal)
      .order('fecha',{ascending:false})
    const todos = []
    ;(data||[]).forEach(a=>{
      ;(a.cxc||[]).forEach(c=>{
        if(c.monto) todos.push({...c, fecha_arqueo:a.fecha, sucursal_id:a.sucursal_id})
      })
    })
    setCobros(todos)
    setLoading(false)
  }

  async function marcarPagado(idx){
    if(!confirm('Marcar este cobro como recibido?')) return
    const nuevo = [...cobros]
    nuevo[idx] = {...nuevo[idx], pagado:true, fecha_pago:hoy()}
    setCobros(nuevo)
  }

  const pendientes = cobros.filter(c=>!c.pagado)
  const pagados = cobros.filter(c=>c.pagado)
  const tPend = pendientes.reduce((s,c)=>s+(parseFloat(c.monto)||0),0)
  const tPag = pagados.reduce((s,c)=>s+(parseFloat(c.monto)||0),0)

  const inp = {fontSize:14,padding:'9px 12px',border:'1.5px solid var(--bdr)',borderRadius:8,outline:'none',width:'100%',fontFamily:'var(--font)',background:'#fff'}

  return (
    <>
      <Head><title>Cobros Pendientes - BioCuba</title></Head>
      <header style={{background:'#fff',borderBottom:'2.5px solid var(--br)',padding:'0 20px',display:'flex',alignItems:'center',minHeight:54,gap:12,flexWrap:'wrap'}}>
        <img src="/logo.jpg" alt="BioCuba" style={{height:38,width:'auto'}} />
        <div style={{width:1,height:22,background:'var(--bdr)'}}></div>
        <span style={{fontSize:13,fontWeight:600}}>Cobros Pendientes</span>
        <span style={{fontSize:12,fontWeight:600,color:'#fff',background:'var(--blue)',padding:'3px 10px',borderRadius:20}}>{session?.sucursalNombre}</span>
        <a href="/qf" style={{marginLeft:'auto',fontSize:12,color:'var(--t2)',textDecoration:'none'}}>Panel QF</a>
      </header>

      <main style={{padding:20,maxWidth:960,margin:'0 auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
          {[
            {lbl:'Pendiente de cobro',val:fmt(tPend),color:tPend>0?'var(--amber)':'var(--green)'},
            {lbl:'Cobrado',val:fmt(tPag),color:'var(--green)'},
            {lbl:'Total registrado',val:fmt(tPend+tPag),color:'var(--blue)'},
          ].map((k,i)=>(
            <div key={i} style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:10,padding:'14px 16px'}}>
              <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>{k.lbl}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:700,color:k.color}}>{k.val}</div>
            </div>
          ))}
        </div>

        <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--s2)',padding:4,borderRadius:10,width:'fit-content'}}>
          {[['pendientes','Pendientes'],['cobrados','Cobrados']].map(([id,l])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:'7px 14px',borderRadius:7,border:'none',background:tab===id?'#fff':'transparent',fontWeight:tab===id?600:400,fontSize:13,color:tab===id?'var(--tx)':'var(--t2)'}}>
              {l} {id==='pendientes'&&pendientes.length>0?'('+pendientes.length+')':''}
            </button>
          ))}
        </div>

        {tab==='pendientes'&&(
          <div>
            {loading?<div style={{padding:20,textAlign:'center',color:'var(--t3)'}}>Cargando...</div>:
            pendientes.length===0?
              <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:24,textAlign:'center',color:'var(--green)',fontSize:13,fontWeight:500}}>
                Sin cobros pendientes
              </div>:
            pendientes.map((c,i)=>(
              <div key={i} style={{background:'#fff',border:'1px solid var(--abdr)',borderRadius:12,padding:16,marginBottom:10,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:3}}>{c.cliente||'Sin nombre'}</div>
                  <div style={{fontSize:12,color:'var(--t2)',marginBottom:3}}>{c.concepto||'Sin concepto'}</div>
                  <div style={{fontSize:11,color:'var(--t3)'}}>Registrado el {c.fecha_arqueo}</div>
                </div>
                <div style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:700,color:'var(--amber)'}}>{fmt(c.monto)}</div>
                <button onClick={()=>marcarPagado(cobros.indexOf(c))} style={{padding:'8px 16px',borderRadius:8,border:'none',background:'var(--green)',color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>
                  Marcar como recibido
                </button>
              </div>
            ))}
          </div>
        )}

        {tab==='cobrados'&&(
          <div>
            {pagados.length===0?
              <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,padding:24,textAlign:'center',color:'var(--t3)',fontSize:13}}>
                Sin cobros marcados como recibidos
              </div>:
            pagados.map((c,i)=>(
              <div key={i} style={{background:'var(--gbg)',border:'1px solid var(--gbdr)',borderRadius:12,padding:16,marginBottom:10,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:3}}>{c.cliente||'Sin nombre'}</div>
                  <div style={{fontSize:12,color:'var(--t2)',marginBottom:3}}>{c.concepto||'Sin concepto'}</div>
                  <div style={{fontSize:11,color:'var(--t3)'}}>Registrado el {c.fecha_arqueo} · Cobrado el {c.fecha_pago||'—'}</div>
                </div>
                <div style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:700,color:'var(--green)'}}>{fmt(c.monto)}</div>
                <span style={{fontSize:11,padding:'4px 10px',borderRadius:20,background:'var(--gbg)',color:'var(--green)',border:'1px solid var(--gbdr)'}}>Recibido</span>
              </div>
            ))}
          </div>
        )}

        <div style={{marginTop:16,background:'var(--bbg)',border:'1px solid var(--bbdr)',borderRadius:10,padding:'12px 16px',fontSize:12,color:'var(--blue)'}}>
          Los cobros se registran desde el arqueo de caja diario. Aqui puedes marcar los pagos recibidos.
        </div>
      </main>
    </>
  )
}
