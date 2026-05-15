import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { clearSession } from '../lib/auth'

export default function Logout() {
  const router = useRouter()
  useEffect(() => {
    clearSession()
    const { next } = router.query
    router.replace(next || '/login')
  }, [])
  return null
}
