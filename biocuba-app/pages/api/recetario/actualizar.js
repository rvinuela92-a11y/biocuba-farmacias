// pages/api/recetario/actualizar.js
// Actualiza el estado de una receta: precio recibido, pago confirmado, lista para retiro, retirada o rechazada

import { createClient } from '@supabase/supabase-js'
import { enviarCorreoPagoConfirmado } from '../../../lib/gmail'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  try {
    const { receta_id, accion, payload, actor } = req.body

    if (!receta_id || !accion) {
      return res.status(400).json({ error: 'Faltan receta_id o accion' })
    }

    const { data: receta, error: errFind } = await supabaseAdmin
      .from('recetas_magistrales')
      .select('*, recetas_productos(*)')
      .eq('id', receta_id)
      .single()
    if (errFind || !receta) return res.status(404).json({ error: 'Receta no encontrada' })

    let updates = { updated_at: new Date().toISOString() }
    let evento = null

    switch (accion) {

      case 'precio_manual': {
        // Solo si la detección automática falló y el vendedor lo ingresa a mano
        const monto = parseInt(payload?.monto)
        if (!monto || monto < 1) return res.status(400).json({ error: 'Monto inválido' })
        updates.estado = 'precio'
        updates.monto = monto
        updates.precio_recibido_ts = new Date().toISOString()
        evento = { tipo: 'precio_manual', texto: 'Precio ingresado manualmente', detalle: `${monto.toLocaleString('es-CL')}`, actor }
        break
      }

      case 'avisar_precio': {
        const { error } = await supabaseAdmin
          .from('recetas_magistrales')
          .update({ estado: 'esperando_pago', updated_at: new Date().toISOString() })
          .eq('id', receta_id)
        if (error) return res.status(500).json({ error: error.message })
        await supabaseAdmin.from('recetas_eventos').insert({
          receta_id, tipo: 'avisado_precio',
          texto: 'Vendedor avisó precio al cliente por WhatsApp',
          actor
        })
        break
      }

      case 'rechazar_lab': {
        // El laboratorio rechazó (NO HAY, RECETA MALA, RECETA VENCIDA)
        if (!payload?.motivo) return res.status(400).json({ error: 'Falta motivo' })
        updates.estado = 'retirada'
        updates.rechazada = true
        updates.motivo_rechazo = payload.motivo
        evento = { tipo: 'rechazada_lab', texto: 'Rechazada por el laboratorio', detalle: payload.motivo, actor }
        break
      }

      case 'rechazar_cliente': {
        // El cliente no aceptó (NO QUIERE, NO RESPONDE)
        if (!payload?.motivo) return res.status(400).json({ error: 'Falta motivo' })
        updates.estado = 'retirada'
        updates.rechazada = true
        updates.motivo_rechazo = payload.motivo
        evento = { tipo: 'rechazada_cliente', texto: 'Cliente no acepta', detalle: payload.motivo, actor }
        break
      }

      case 'confirmar_pago': {
        const { forma, folio, comprobante_url, obs } = payload || {}
        if (!forma || !folio) return res.status(400).json({ error: 'Faltan forma de pago o folio' })
        if (forma === 'transferencia' && !comprobante_url) {
          return res.status(400).json({ error: 'Falta comprobante de transferencia' })
        }
        updates.estado = 'confirmada'
        updates.pago_forma = forma
        updates.pago_folio = folio
        updates.pago_comprobante_url = comprobante_url || null
        updates.pago_obs = obs || null
        updates.pago_ts = new Date().toISOString()
        evento = { tipo: 'pago_confirmado', texto: 'Cliente pagó', detalle: `${forma} · Boleta ${folio}`, actor }

        // Enviar correo al laboratorio: "pueden preparar"
        try {
          const { data: config } = await supabaseAdmin
            .from('config_recetario')
            .select('correos_laboratorio')
            .eq('sucursal_id', receta.sucursal_id)
            .single()
          const destinatarios = config?.correos_laboratorio || []
          if (destinatarios.length > 0) {
            const paciente = receta.vet ? receta.mascota_nombre : `${receta.cliente_nombres} ${receta.cliente_apaterno}`
            const correoPago = await enviarCorreoPagoConfirmado({
              destinatarios,
              numero: receta.numero,
              paciente,
              monto: receta.monto,
              forma,
              boleta: folio,
              sucursal: receta.sucursal_id
            })
            if (correoPago?.messageId) {
              await supabaseAdmin
                .from('recetas_magistrales')
                .update({ correo_pago_message_id: correoPago.messageId })
                .eq('id', receta_id)
            }
          }
        } catch (e) {
          console.error('Error correo pago:', e.message)
        }
        break
      }

      case 'preparado_llego': {
        updates.estado = 'lista'
        evento = { tipo: 'preparado_llego', texto: 'Preparado llegó a la farmacia', detalle: '', actor }
        break
      }

      case 'cliente_retiro': {
        updates.estado = 'retirada'
        evento = { tipo: 'cliente_retiro', texto: 'Cliente retiró', detalle: '', actor }
        break
      }

      case 'agregar_producto': {
        const { nombre, precio } = payload || {}
        if (!nombre || !precio) return res.status(400).json({ error: 'Faltan nombre o precio' })
        const orden = (receta.recetas_productos || []).length
        await supabaseAdmin.from('recetas_productos').insert({
          receta_id, nombre, precio: parseInt(precio), orden
        })
        return res.status(200).json({ ok: true })
      }

      case 'quitar_producto': {
        const { producto_id } = payload || {}
        if (!producto_id) return res.status(400).json({ error: 'Falta producto_id' })
        await supabaseAdmin.from('recetas_productos').delete().eq('id', producto_id)
        return res.status(200).json({ ok: true })
      }

      default:
        return res.status(400).json({ error: 'Acción no reconocida: ' + accion })
    }

    // Aplicar actualización
    const { error: errUpd } = await supabaseAdmin
      .from('recetas_magistrales')
      .update(updates)
      .eq('id', receta_id)
    if (errUpd) throw errUpd

    // Registrar evento
    if (evento) {
      await supabaseAdmin.from('recetas_eventos').insert({ receta_id, ...evento })
    }

    return res.status(200).json({ ok: true })

  } catch (e) {
    console.error('Error actualizar receta:', e)
    return res.status(500).json({ error: e.message })
  }
}
