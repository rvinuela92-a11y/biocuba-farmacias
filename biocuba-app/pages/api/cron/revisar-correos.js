// pages/api/cron/revisar-correos.js
// Cron job que corre cada 1 minuto (configurado en vercel.json)
// Lee Gmail buscando respuestas del laboratorio y mueve las recetas al paso "Avisar precio"

import { createClient } from '@supabase/supabase-js'
import { leerRespuestasNuevas } from '../../../lib/gmail'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Intenta detectar un monto numérico en el texto del correo (en CLP)
// Acepta: "12500", "12.500", "$12.500", "$ 12500", "12,500", "12 500"
function extraerMonto(texto) {
  if (!texto) return null
  // Buscar patrones de número con $ o seguidos de "pesos"
  const patrones = [
    /\$\s*([\d.,\s]+)/g,                      // $12.500 ó $ 12500
    /([\d.]{3,})\s*pesos/gi,                  // 12500 pesos
    /total[:\s]+([\d.,]+)/gi,                 // total: 12500
    /precio[:\s]+([\d.,]+)/gi,                // precio: 12500
    /valor[:\s]+([\d.,]+)/gi,                 // valor: 12500
    /es de\s*\$?\s*([\d.,]+)/gi               // es de $12.500
  ]
  for (const pat of patrones) {
    const matches = [...texto.matchAll(pat)]
    for (const m of matches) {
      const numero = parseInt(m[1].replace(/[.,\s]/g, ''))
      if (numero >= 500 && numero <= 9999999) return numero
    }
  }
  return null
}

export default async function handler(req, res) {
  // Validar que la petición venga de Vercel Cron (o admite GET manual para testing)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    const respuestas = await leerRespuestasNuevas()
    if (respuestas.length === 0) {
      return res.status(200).json({ ok: true, procesadas: 0, mensaje: 'Sin correos nuevos' })
    }

    let procesadas = 0
    let actualizadas = 0
    const detalles = []

    for (const r of respuestas) {
      procesadas++
      const refs = (r.inReplyTo + ' ' + r.references).trim()
      const asunto = r.subject || ''

      // Traer recetas cotizadas para hacer matching
      const { data: recetas } = await supabaseAdmin
        .from('recetas_magistrales')
        .select('id, numero, estado, sucursal_id, correo_message_id, correo_pago_message_id')
        .or('correo_message_id.not.is.null,correo_pago_message_id.not.is.null')
        // filtro de estado removido para permitir reprocesar
        .limit(200)

      let recetaMatch = null
      let matchedBy = null

      // Estrategia 1: match por In-Reply-To/References (cuando responden bien)
      let tipoRespuesta = 'precio' // por defecto, respuesta de cotización
      if (refs) {
        for (const rec of (recetas || [])) {
          const msgId = rec.correo_message_id?.replace(/[<>]/g, '')
          if (msgId && refs.includes(msgId)) {
            recetaMatch = rec
            matchedBy = 'in-reply-to'
            tipoRespuesta = 'precio'
            break
          }
          const msgIdPago = rec.correo_pago_message_id?.replace(/[<>]/g, '')
          if (msgIdPago && refs.includes(msgIdPago)) {
            recetaMatch = rec
            matchedBy = 'in-reply-to-pago'
            tipoRespuesta = 'preparado'
            break
          }
        }
      }

      // Estrategia 2: match por número RX-YYYY-NNNN en el asunto (fallback)
      if (!recetaMatch) {
        const rxMatch = asunto.match(/RX[-\s]?\d{4}[-\s]?\d{3,5}/i)
        if (rxMatch) {
          const numeroBuscado = rxMatch[0].replace(/\s/g, '-').toUpperCase()
          for (const rec of (recetas || [])) {
            if (rec.numero && rec.numero.toUpperCase().replace(/\s/g, '-') === numeroBuscado) {
              recetaMatch = rec
              matchedBy = 'numero-en-asunto'
              // Detectar si es respuesta a correo de PAGO CONFIRMADO
              if (/pago\s*confirmado/i.test(asunto)) {
                tipoRespuesta = 'preparado'
              }
              break
            }
          }
        }
      }

      if (!recetaMatch) {
        detalles.push({ uid: r.uid, skip: 'no se encontró receta. asunto: ' + asunto + ' · refs: ' + refs })
        continue
      }

      // Intentar extraer monto del correo
      const monto = extraerMonto(r.text) || extraerMonto(r.html)
      const updates = {
        updated_at: new Date().toISOString()
      }
      if (tipoRespuesta === 'preparado') {
        // Respuesta al correo de pago = lab confirmó que va a preparar
        updates.estado = 'lista'
        updates.preparado_listo_ts = new Date().toISOString()
        updates.respuesta_laboratorio_preparado = (r.text || r.html || "").substring(0, 5000)
      } else {
        // Respuesta al correo de cotización = precio recibido
        updates.estado = 'precio'
        updates.precio_recibido_ts = new Date().toISOString()
        if (monto) updates.monto = monto
        updates.respuesta_laboratorio = (r.text || r.html || "").substring(0, 5000)
      }

      const { error: errUpd } = await supabaseAdmin
        .from('recetas_magistrales')
        .update(updates)
        .eq('id', recetaMatch.id)

      if (errUpd) {
        detalles.push({ uid: r.uid, error: errUpd.message })
        continue
      }

      // Registrar evento timeline
      await supabaseAdmin.from('recetas_eventos').insert({
        receta_id: recetaMatch.id,
        tipo: 'precio_recibido',
        texto: 'Precio recibido del recetario (automático)',
        detalle: monto
          ? `Detectado del correo · $${monto.toLocaleString('es-CL')}`
          : 'Detectado del correo · ingresa el monto manualmente',
        actor: 'sistema'
      })

      actualizadas++
      detalles.push({
        uid: r.uid,
        receta: recetaMatch.numero,
        monto_detectado: monto || null,
        matched_by: matchedBy
      })
    }

    return res.status(200).json({
      ok: true,
      procesadas,
      actualizadas,
      detalles
    })

  } catch (e) {
    console.error('Error cron revisar correos:', e)
    return res.status(500).json({ error: e.message, stack: e.stack })
  }
}
