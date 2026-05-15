import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../lib/auth'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const s = getSession()
    if (s) router.replace(s.rol === 'vendedor' ? '/pos' : '/qf')
    else router.replace('/login')
  }, [])
  return null
}
