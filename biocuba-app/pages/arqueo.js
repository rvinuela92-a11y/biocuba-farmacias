import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL')
const hoy = () => new Date().toISOString().split('T')[0]
const mes = () => new Date().toISOString().slice(0,7)

export default function Arqueo() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [arqueos, setArqueos] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('historial')

  useEffect(()=>{
    const s = getSession()
    if(!s||s.rol!=='qf'){ router.replace('/login'); return }
    setSession(s)
    cargarArqueos(s)
  },[])

  async function cargarArqueos(s){
    setLoading(true)
    const mesActual = mes()
    const {data} = await supabase
      .from('arqueos')
      .select('*')
      .eq('sucursal_id', s.sucursal)
      .gte('fecha', mesActual+'-01')
      .lte('fecha', mesActual+'-31')
      .order('fecha', {ascending:false})
    setArqueos(data||[])
    setLoading(false)
  }

  const tVentas = arqueos.reduce((s,a)=>s+(a.golan?.totalVentas||0),0)
  const tEf = arqueos.reduce((s,a)=>s+(a.ef_neto||0),0)
  const tDif = arqueos.reduce((s,a)=>s+(a.dif_ef||0),0)
  const diasCon = arqueos.length
  const diasDif = arqueos.filter(a=>(a.dif_ef||0)!==0).length

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
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
          {[
            {lbl:'Ventas del mes',val:fmt(tVentas),color:'var(--blue)'},
            {lbl:'Efectivo neto',val:fmt(tEf),color:'var(--green)'},
            {lbl:'Días registrados',val:diasCon,color:'var(--t2)'},
            {lbl:'Días con diferencia',val:diasDif,color:diasDif>0?'var(--red)':'var(--green)'},
          ].map((k,i)=>(
            <div key={i} style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:10,padding:'14px 16px'}}>
              <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>{k.lbl}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:700,color:k.color}}>{k.val}</div>
            </div>
          ))}
        </div>

        <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid var(--bdr)',fontSize:13,fontWeight:600}}>
            Historial del mes — {new Date().toLocaleString('es-CL',{month:'long',year:'numeric'})}
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'var(--s2)'}}>
                {['Fecha','Ventas Golan','Efectivo','Dif. Efectivo','SumUp','Estado'].map(h=>(
                  <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'var(--t2)',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading?<tr><td colSpan={6} style={{padding:20,textAlign:'center',color:'var(--t3)'}}>Cargando...</td></tr>:
                arqueos.length===0?<tr><td colSpan={6} style={{padding:20,textAlign:'center',color:'var(--t3)'}}>Sin arqueos este mes</td></tr>:
                arqueos.map((a,i)=>{
                  const dif = a.dif_ef||0
                  return (
                    <tr key={a.id} style={{borderTop:'1px solid var(--bdr)',background:dif!==0?'var(--rbg)':i%2===0?'#fff':'var(--s2)'}}>
                      <td style={{padding:'8px 12px',fontWeight:500}}>{a.fecha}</td>
                      <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt(a.golan?.totalVentas||0)}</td>
                      <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt(a.ef_neto||0)}</td>
                      <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right',color:dif!==0?'var(--red)':'var(--green)',fontWeight:600}}>{dif!==0?fmt(dif):'✓ OK'}</td>
                      <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt(a.sumup||0)}</td>
                      <td style={{padding:'8px 12px'}}>
                        {dif!==0
                          ? <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'var(--rbg)',color:'var(--red)'}}>Con diferencia</span>
                          : <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'var(--gbg)',color:'var(--green)'}}>Cuadrado</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {tDif!==0&&(
            <div style={{padding:'12px 16px',borderTop:'1px solid var(--bdr)',display:'flex',justifyContent:'space-between',fontSize:13}}>
              <span style={{color:'var(--red)',fontWeight:600}}>⚠ Diferencia acumulada del mes</span>
              <span style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--red)'}}>{fmt(tDif)}</span>
            </div>
          )}
        </div>

        <div style={{marginTop:16,background:'var(--bbg)',border:'1px solid var(--bbdr)',borderRadius:10,padding:'12px 16px',fontSize:12,color:'var(--blue)'}}>
          ℹ El registro del arqueo diario se hace desde los computadores de caja usando el archivo HTML. En próximas versiones estará disponible directamente desde esta pantalla.
        </div>
      </main>
    </>
  )
}
