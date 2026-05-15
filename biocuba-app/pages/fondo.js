import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL')
const hoy = () => new Date().toISOString().split('T')[0]
const mes = () => new Date().toISOString().slice(0,7)

export default function Fondo() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [config, setConfig] = useState({monto:0})
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    const s = getSession()
    if(!s||s.rol!=='qf'){ router.replace('/login'); return }
    setSession(s)
    cargarDatos(s)
  },[])

  async function cargarDatos(s){
    setLoading(true)
    const mesActual = mes()
    const [rC, rM] = await Promise.all([
      supabase.from('fondo_config').select('*').eq('sucursal_id',s.sucursal).single(),
      supabase.from('fondo_movimientos').select('*').eq('sucursal_id',s.sucursal).gte('fecha',mesActual+'-01').lte('fecha',mesActual+'-31').order('fecha',{ascending:false}),
    ])
    if(rC.data) setConfig(rC.data)
    setMovimientos(rM.data||[])
    setLoading(false)
  }

  const saldoActual = config.monto + movimientos.reduce((s,m)=>s+(m.tipo==='entrada'?m.monto:m.tipo==='salida'?-m.monto:m.monto),0)

  return (
    <>
      <Head><title>Fondo de Caja — BioCuba</title></Head>
      <header style={{background:'#fff',borderBottom:'2.5px solid var(--br)',padding:'0 20px',display:'flex',alignItems:'center',minHeight:54,gap:12,flexWrap:'wrap'}}>
        <img src="/logo.jpg" alt="BioCuba" style={{height:38,width:'auto'}} />
        <div style={{width:1,height:22,background:'var(--bdr)'}}></div>
        <span style={{fontSize:13,fontWeight:600}}>💰 Fondo de Caja</span>
        <span style={{fontSize:12,fontWeight:600,color:'#fff',background:'var(--blue)',padding:'3px 10px',borderRadius:20}}>{session?.sucursalNombre}</span>
        <a href="/qf" style={{marginLeft:'auto',fontSize:12,color:'var(--t2)',textDecoration:'none'}}>← Panel QF</a>
      </header>

      <main style={{padding:20,maxWidth:960,margin:'0 auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
          {[
            {lbl:'Fondo asignado',val:fmt(config.monto),color:'var(--blue)'},
            {lbl:'Saldo actual',val:fmt(saldoActual),color:saldoActual<config.monto*0.5?'var(--red)':'var(--green)'},
            {lbl:'Movimientos del mes',val:movimientos.length,color:'var(--t2)'},
          ].map((k,i)=>(
            <div key={i} style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:10,padding:'14px 16px'}}>
              <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>{k.lbl}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:700,color:k.color}}>{k.val}</div>
            </div>
          ))}
        </div>

        <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid var(--bdr)',fontSize:13,fontWeight:600}}>
            Movimientos del mes — {new Date().toLocaleString('es-CL',{month:'long',year:'numeric'})}
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'var(--s2)'}}>
                {['Fecha','Tipo','Motivo','Responsable','Monto','Saldo'].map(h=>(
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
                        {m.tipo==='entrada'?'↑ Entrada':m.tipo==='salida'?'↓ Salida':'⟳ Ajuste'}
                      </span>
                    </td>
                    <td style={{padding:'8px 12px'}}>{m.motivo}</td>
                    <td style={{padding:'8px 12px',color:'var(--t2)'}}>{m.responsable}</td>
                    <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right',fontWeight:600,color:m.tipo==='entrada'?'var(--green)':m.tipo==='salida'?'var(--red)':'var(--blue)'}}>
                      {m.tipo==='salida'?'-':''}{fmt(m.monto)}
                    </td>
                    <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right'}}>{fmt(m.saldo_despues||0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{marginTop:16,background:'var(--bbg)',border:'1px solid var(--bbdr)',borderRadius:10,padding:'12px 16px',fontSize:12,color:'var(--blue)'}}>
          ℹ Los movimientos del fondo se registran desde el módulo de Arqueo de Caja. El fondo asignado se configura desde el panel del administrador.
        </div>
      </main>
    </>
  )
}
