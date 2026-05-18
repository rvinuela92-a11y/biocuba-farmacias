// pages/api/recetario/subir-foto.js
// Recibe una imagen en base64 y la sube a Supabase Storage

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = {
  api: {
    bodyParser: { sizeLimit: '8mb' }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  try {
    const { dataUrl, tipo, receta_id, sucursal_id } = req.body
    if (!dataUrl) return res.status(400).json({ error: 'Falta dataUrl' })

    // Parsear dataURL "data:image/jpeg;base64,XXXXX"
    const match = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/)
    if (!match) return res.status(400).json({ error: 'dataUrl inválido' })
    const mimeType = match[1]
    const ext = mimeType.split('/')[1] || 'jpg'
    const base64 = match[2]
    const buffer = Buffer.from(base64, 'base64')

    // Nombre del archivo: receta/sucursal/timestamp.ext
    const carpeta = tipo === 'comprobante' ? 'comprobantes' : 'recetas'
    const sucursal = sucursal_id || 'general'
    const filename = `${carpeta}/${sucursal}/${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`

    // Subir a Supabase Storage
    const { data, error } = await supabaseAdmin
      .storage
      .from('recetario-fotos')
      .upload(filename, buffer, { contentType: mimeType, upsert: false })

    if (error) throw error

    // Obtener URL pública
    const { data: urlData } = supabaseAdmin
      .storage
      .from('recetario-fotos')
      .getPublicUrl(data.path)

    return res.status(200).json({ ok: true, url: urlData.publicUrl, path: data.path })

  } catch (e) {
    console.error('Error subir foto:', e)
    return res.status(500).json({ error: e.message })
  }
}
