import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { setSession, getSession } from '../lib/auth'

const SUCURSALES = {
  maipu: { nombre: 'Maipú', pass: 'maipu2025', modulos: ['arqueo','bienestar','sindicato','magistral','fondo','cobros'], convenios: true },
  sanbernardo: { nombre: 'San Bernardo', pass: 'sb2025', modulos: ['arqueo','magistral','fondo','cobros'], convenios: false },
  providencia: { nombre: 'Providencia', pass: 'prov2025', modulos: ['arqueo','magistral','fondo','cobros'], convenios: false },
  florida: { nombre: 'La Florida', pass: 'florida2025', modulos: ['arqueo','magistral','fondo','cobros'], convenios: false },
}

export default function Login() {
  const router = useRouter()
  const { tipo } = router.query
  const esPos = tipo === 'pos'
  const [nombre, setNombre] = useState('')
  const [sucursal, setSucursal] = useState('')
  const [caja, setCaja] = useState('1')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const s = getSession()
    if (s) router.replace(s.rol === 'vendedor' ? '/pos' : '/qf')
  }, [])

  function handleLogin(e) {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) return setError('Ingresa tu nombre')
    if (!sucursal) return setError('Selecciona una sucursal')
    const cfg = SUCURSALES[sucursal]
    if (!cfg || password !== cfg.pass) return setError('Contraseña incorrecta')
    setSession({ nombre: nombre.trim(), sucursal, sucursalNombre: cfg.nombre, caja: esPos ? caja : null, rol: esPos ? 'vendedor' : 'qf', modulos: cfg.modulos, convenios: cfg.convenios, ts: Date.now() })
    router.replace(esPos ? '/pos' : '/qf')
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20,background:'var(--bg)'}}>
      <div style={{background:'#fff',border:'1px solid var(--bdr)',borderRadius:16,padding:32,width:'100%',maxWidth:400}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <img src="/logo.jpg" alt="BioCuba" style={{height:56,width:'auto'}} />
        </div>
        <div style={{fontSize:18,fontWeight:600,textAlign:'center',marginBottom:6}}>{esPos ? 'POS Vendedor' : 'Panel QF'}</div>
        <div style={{fontSize:13,color:'var(--t2)',textAlign:'center',marginBottom:24}}>Ingresa tus datos para continuar</div>
        <form onSubmit={handleLogin}>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t2)',display:'block',marginBottom:4}}>Tu nombre</label>
            <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="ej: María González" style={{fontSize:14,padding:'10px 12px',border:'1.5px solid var(--bdr)',borderRadius:8,outline:'none',width:'100%'}} />
          </div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t2)',display:'block',marginBottom:4}}>Sucursal</label>
            <select value={sucursal} onChange={e=>setSucursal(e.target.value)} style={{fontSize:14,padding:'10px 12px',border:'1.5px solid var(--bdr)',borderRadius:8,outline:'none',background:'#fff',width:'100%'}}>
              <option value="">Seleccionar...</option>
              {Object.entries(SUCURSALES).map(([id,s])=><option key={id} value={id}>{s.nombre}</option>)}
            </select>
          </div>
          {esPos && (
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t2)',display:'block',marginBottom:4}}>Caja</label>
              <select value={caja} onChange={e=>setCaja(e.target.value)} style={{fontSize:14,padding:'10px 12px',border:'1.5px solid var(--bdr)',borderRadius:8,outline:'none',background:'#fff',width:'100%'}}>
                <option value="1">Caja 1</option>
                <option value="2">Caja 2</option>
                <option value="3">Caja 3</option>
              </select>
            </div>
          )}
          <div style={{marginBottom:20}}>
            <label style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--t2)',display:'block',marginBottom:4}}>Contraseña de la sucursal</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{fontSize:14,padding:'10px 12px',border:'1.5px solid var(--bdr)',borderRadius:8,outline:'none',width:'100%'}} />
          </div>
          {error && <div style={{background:'var(--rbg)',border:'1px solid var(--rbdr)',borderRadius:8,padding:'10px 12px',fontSize:13,color:'var(--red)',marginBottom:14,textAlign:'center'}}>{error}</div>}
          <button type="submit" style={{width:'100%',padding:13,borderRadius:10,border:'none',background:'var(--blue)',color:'#fff',fontSize:15,fontWeight:600}}>Ingresar</button>
        </form>
        <div style={{marginTop:16,textAlign:'center'}}>
          <a href={esPos ? '/login' : '/login?tipo=pos'} style={{fontSize:12,color:'var(--t2)',textDecoration:'none'}}>{esPos ? '← Acceso QF' : 'Acceso POS Vendedor →'}</a>
        </div>
      </div>
    </div>
  )
}
