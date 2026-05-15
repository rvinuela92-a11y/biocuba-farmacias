import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL')
const mes = () => new Date().toISOString().slice(0,7)

const PAGOS = { efectivo:'Efectivo', transferencia:'Transferencia', debito:'Débito', credito:'Crédito' }

export default function Magistral() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    const s = getSession()
    if(!s||s.rol!=='qf'){ router.replace('/login'); return }
    setSession(s)
    cargarDatos(s)
  },[])

  async function cargarDatos(s){
    setLoading(true)
    const {data} = await supabase.from('magistral_ventas').select('*').eq('mes',mes()).eq('sucursal_id',s.sucursal).order('created_at',{ascending:false})
    setVentas(data||[])
    setLoading(false)
  }

  const tMes = ventas.reduce((s,v)=>s+v.monto,0)
  const tPorPago = {}
  ventas.forEach(v=>{ tPorPago[v.pago]=(tPorPago[v.pago]||0)+v.monto })

  return (
    <>
      <Head><title>Recetario Magistral — BioCuba</title></Head>
      <header style={{background:'#fff',borderBottom:'2.5px solid var(--br)',padding:'0 20px',display:'flex',alignItems:'center',minHeight:54,gap:12,flexWrap:'wrap'}}>
        <img src="/logo.jpg" alt="BioCuba" style={{height:38,width:'auto'}} />
        <div style={{width:1,height:22,background:'var(--bdr)'}}></div>
        <span style={{fontSize:13,fontWeight:600,color:'var(--blue)'}}>⚗️ Recetario Magistral</span>
        <span style={{fontSize:12,fontWeight:600,color:'#fff',background:'var(--blue)',padding:'3px 10px',borderRadius:20}}>{session?.sucursalNombre}</span>
        <a href="/qf" style={{marginLeft:'auto',fontSize:12,color:'var(--t2)',textDecoration:'none'}}>← Panel QF</a>
      </header>
      <main style={{padding:20,maxWidth:960,margin:'0 auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
          {[
            {lbl:'Total del mes',val:fmt(tMes),color:'var(--blue)'},
            {lbl:'Efectivo',val:fmt(tPorPago.efectivo||0),color:'var(--green)'},
            {lbl:'Transferencia',val:fmt(tPorPago.transferencia||0),color:'var(--amber)'},
            {lbl:'Preparados',val:ventas.length,color:'var(--t2)'},
          ].map((k,i)=>(
            <div key={i} style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:10,padding:'14px 16px'}}>
              <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>{k.lbl}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:700,color:k.color}}>{k.val}</div>
            </div>
          ))}
        </div>

        <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid var(--bdr)',fontSize:13,fontWeight:600}}>
            Preparados del mes — {new Date().toLocaleString('es-CL',{month:'long',year:'numeric'})}
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'var(--s2)'}}>
                {['Fecha','Paciente','RUT','Folio','Descripción','Pago','Monto','Registrado por'].map(h=>(
                  <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'var(--t2)',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading?<tr><td colSpan={8} style={{padding:20,textAlign:'center',color:'var(--t3)'}}>Cargando...</td></tr>:
                ventas.length===0?<tr><td colSpan={8} style={{padding:20,textAlign:'center',color:'var(--t3)'}}>Sin preparados este mes</td></tr>:
                ventas.map((v,i)=>(
                  <tr key={v.id} style={{borderTop:'1px solid var(--bdr)',background:i%2===0?'#fff':'var(--s2)'}}>
                    <td style={{padding:'8px 12px',whiteSpace:'nowrap'}}>{v.fecha}</td>
                    <td style={{padding:'8px 12px',fontWeight:500}}>{v.paciente}</td>
                    <td style={{padding:'8px 12px',fontFamily:'var(--mono)',fontSize:11}}>{v.rut||'—'}</td>
                    <td style={{padding:'8px 12px',fontFamily:'var(--mono)'}}>{v.folio}</td>
                    <td style={{padding:'8px 12px',color:'var(--t2)',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.descripcion||'—'}</td>
                    <td style={{padding:'8px 12px'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'var(--bbg)',color:'var(--blue)'}}>{PAGOS[v.pago]||v.pago}</span></td>
                    <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right',fontWeight:600}}>{fmt(v.monto)}</td>
                    <td style={{padding:'8px 12px',color:'var(--t3)'}}>{v.usuario_nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{padding:'12px 16px',borderTop:'1px solid var(--bdr)',display:'flex',justifyContent:'space-between',fontWeight:600,fontSize:13}}>
            <span>Total {ventas.length} preparado{ventas.length!==1?'s':''}</span>
            <span style={{color:'var(--blue)'}}>{fmt(tMes)}</span>
          </div>
        </div>
      </main>
    </>
  )
}
