import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL')
const mes = () => new Date().toISOString().slice(0,7)

export default function Cobros() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [cobros, setCobros] = useState([])
  const [loading, setLoading] = useState(true)

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
      .select('fecha, cxc, sucursal_id')
      .eq('sucursal_id', s.sucursal)
      .gte('fecha', mesActual+'-01')
      .lte('fecha', mesActual+'-31')
      .order('fecha', {ascending:false})
    const todos = []
    ;(data||[]).forEach(a=>{
      ;(a.cxc||[]).forEach(c=>{
        todos.push({...c, fecha_arqueo: a.fecha})
      })
    })
    setCobros(todos)
    setLoading(false)
  }

  const pendientes = cobros.filter(c=>!c.pagado)
  const pagados = cobros.filter(c=>c.pagado)
  const tPend = pendientes.reduce((s,c)=>s+c.monto,0)
  const tPag = pagados.reduce((s,c)=>s+c.monto,0)

  return (
    <>
      <Head><title>Cobros Pendien
cat > ~/Desktop/biocuba-farmacias/biocuba-app/pages/cobros.js << 'ENDOFFILE'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL')
const mes = () => new Date().toISOString().slice(0,7)

export default function Cobros() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [cobros, setCobros] = useState([])
  const [loading, setLoading] = useState(true)

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
      .select('fecha, cxc, sucursal_id')
      .eq('sucursal_id', s.sucursal)
      .gte('fecha', mesActual+'-01')
      .lte('fecha', mesActual+'-31')
      .order('fecha', {ascending:false})
    const todos = []
    ;(data||[]).forEach(a=>{
      ;(a.cxc||[]).forEach(c=>{
        todos.push({...c, fecha_arqueo: a.fecha})
      })
    })
    setCobros(todos)
    setLoading(false)
  }

  const pendientes = cobros.filter(c=>!c.pagado)
  const pagados = cobros.filter(c=>c.pagado)
  const tPend = pendientes.reduce((s,c)=>s+c.monto,0)
  const tPag = pagados.reduce((s,c)=>s+c.monto,0)

  return (
    <>
      <Head><title>Cobros Pendientes — BioCuba</title></Head>
      <header style={{background:'#fff',borderBottom:'2.5px solid var(--br)',padding:'0 20px',display:'flex',alignItems:'center',minHeight:54,gap:12,flexWrap:'wrap'}}>
        <img src="/logo.jpg" alt="BioCuba" style={{height:38,width:'auto'}} />
        <div style={{width:1,height:22,background:'var(--bdr)'}}></div>
        <span style={{fontSize:13,fontWeight:600}}>📋 Cobros Pendientes</span>
        <span style={{fontSize:12,fontWeight:600,color:'#fff',background:'var(--blue)',padding:'3px 10px',borderRadius:20}}>{session?.sucursalNombre}</span>
        <a href="/qf" style={{marginLeft:'auto',fontSize:12,color:'var(--t2)',textDecoration:'none'}}>← Panel QF</a>
      </header>
      <main style={{padding:20,maxWidth:960,margin:'0 auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
          {[
            {lbl:'Pendiente de cobro',val:fmt(tPend),color:tPend>0?'var(--amber)':'var(--green)'},
            {lbl:'Cobrado este mes',val:fmt(tPag),color:'var(--green)'},
            {lbl:'Total registrado',val:fmt(tPend+tPag),color:'var(--blue)'},
          ].map((k,i)=>(
            <div key={i} style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:10,padding:'14px 16px'}}>
              <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>{k.lbl}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:700,color:k.color}}>{k.val}</div>
            </div>
          ))}
        </div>

        <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,overflow:'hidden',marginBottom:14}}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid var(--bdr)',fontSize:13,fontWeight:600,color:'var(--amber)'}}>
            ⏳ Pendientes de cobro — {pendientes.length}
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'var(--s2)'}}>
                {['Fecha','Cliente','Concepto','Monto','Forma de pago'].map(h=>(
                  <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'var(--t2)',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading?<tr><td colSpan={5} style={{padding:20,textAlign:'center',color:'var(--t3)'}}>Cargando...</td></tr>:
                pendientes.length===0?<tr><td colSpan={5} style={{padding:20,textAlign:'center',color:'var(--green)'}}>✓ Sin cobros pendientes</td></tr>:
                pendientes.map((c,i)=>(
                  <tr key={i} style={{borderTop:'1px solid var(--bdr)',background:'var(--abg)'}}>
                    <td style={{padding:'8px 12px'}}>{c.fecha_arqueo}</td>
                    <td style={{padding:'8px 12px',fontWeight:500}}>{c.cliente||'—'}</td>
                    <td style={{padding:'8px 12px',color:'var(--t2)'}}>{c.concepto||'—'}</td>
                    <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right',fontWeight:600,color:'var(--amber)'}}>{fmt(c.monto)}</td>
                    <td style={{padding:'8px 12px'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'var(--bbg)',color:'var(--blue)'}}>{c.forma||'Transferencia'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {pagados.length>0&&(
          <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'14px 16px',borderBottom:'1px solid var(--bdr)',fontSize:13,fontWeight:600,color:'var(--green)'}}>
              ✓ Cobrados este mes — {pagados.length}
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:'var(--s2)'}}>
                  {['Fecha','Cliente','Concepto','Monto'].map(h=>(
                    <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'var(--t2)',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {pagados.map((c,i)=>(
                    <tr key={i} style={{borderTop:'1px solid var(--bdr)',background:'var(--gbg)'}}>
                      <td style={{padding:'8px 12px'}}>{c.fecha_arqueo}</td>
                      <td style={{padding:'8px 12px',fontWeight:500}}>{c.cliente||'—'}</td>
                      <td style={{padding:'8px 12px',color:'var(--t2)'}}>{c.concepto||'—'}</td>
                      <td style={{padding:'8px 12px',fontFamily:'var(--mono)',textAlign:'right',fontWeight:600,color:'var(--green)'}}>{fmt(c.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{marginTop:16,background:'var(--bbg)',border:'1px solid var(--bbdr)',borderRadius:10,padding:'12px 16px',fontSize:12,color:'var(--blue)'}}>
          ℹ Los cobros se registran desde el arqueo de caja. El seguimiento detallado de cobros pendientes está disponible en el panel del administrador.
        </div>
      </main>
    </>
  )
}
