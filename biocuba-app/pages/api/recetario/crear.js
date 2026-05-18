// pages/api/recetario/crear.js
// Crea una nueva receta y envía correo automático al laboratorio

import { createClient } from '@supabase/supabase-js'
import { enviarCorreoReceta } from '../../../lib/gmail'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const SUC_NOMBRES = { maipu: 'Maipú', providencia: 'Providencia', san_bernardo: 'San Bernardo', florida: 'La Florida' }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  try {
    const {
      sucursal_id,
      cliente_rut, cliente_nombres, cliente_apaterno, cliente_amaterno,
      cliente_tel, cliente_prefijo, extranjero,
      vet, mascota_nombre, mascota_tipo,
      medico_nombre, medico_rut,
      canal,
      foto_receta_url,
      productos_adic,
      vendedor_id
    } = req.body

    // 1) Validaciones básicas
    if (!sucursal_id || !cliente_nombres || !cliente_apaterno || !medico_nombre) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' })
    }

    // 2) Generar número de receta correlativo
    const year = new Date().getFullYear()
    const { count } = await supabaseAdmin
      .from('recetas_magistrales')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01`)
    const numero = `RX-${year}-${String((count || 0) + 1).padStart(4, '0')}`

    // 3) Insertar la receta
    const { data: receta, error: errIns } = await supabaseAdmin
      .from('recetas_magistrales')
      .insert({
        numero,
        sucursal_id,
        estado: 'cotizada',
        cliente_rut, cliente_nombres, cliente_apaterno, cliente_amaterno,
        cliente_tel, cliente_prefijo: cliente_prefijo || '+569', extranjero: !!extranjero,
        vet: !!vet, mascota_nombre: vet ? mascota_nombre : null, mascota_tipo: vet ? mascota_tipo : null,
        medico_nombre, medico_rut,
        canal,
        foto_receta_url,
        vendedor_id
      })
      .select()
      .single()
    if (errIns) throw errIns

    // 4) Insertar productos adicionales si los hay
    if (Array.isArray(productos_adic) && productos_adic.length > 0) {
      const productos = productos_adic.map((p, i) => ({
        receta_id: receta.id, nombre: p.nombre, precio: p.precio, orden: i
      }))
      await supabaseAdmin.from('recetas_productos').insert(productos)
    }

    // 5) Guardar/actualizar cliente en clientes_magistral (autocompletado)
    if (cliente_rut) {
      await supabaseAdmin
        .from('clientes_magistral')
        .upsert({
          rut: cliente_rut,
          nombres: cliente_nombres,
          apaterno: cliente_apaterno,
          amaterno: cliente_amaterno,
          tel: cliente_tel,
          prefijo: cliente_prefijo || '+569',
          extranjero: !!extranjero,
          ultima_receta: new Date().toISOString()
        }, { onConflict: 'rut' })
    }

    // 6) Evento timeline
    await supabaseAdmin.from('recetas_eventos').insert({
      receta_id: receta.id,
      tipo: 'creada',
      texto: 'Cotización enviada',
      detalle: vendedor_id || '',
      actor: vendedor_id || 'sistema'
    })

    // 7) Enviar correo al laboratorio
    const { data: config } = await supabaseAdmin
      .from('config_recetario')
      .select('correos_laboratorio')
      .eq('sucursal_id', sucursal_id)
      .single()

    const destinatarios = config?.correos_laboratorio || []
    if (destinatarios.length === 0) {
      return res.status(200).json({
        ok: true,
        receta,
        warning: 'Receta creada pero no hay correos del laboratorio configurados en /magistral.'
      })
    }

    const paciente = vet ? mascota_nombre : `${cliente_nombres} ${cliente_apaterno} ${cliente_amaterno || ''}`.trim()
    try {
      const { messageId, asunto } = await enviarCorreoReceta({
        destinatarios,
        numero,
        paciente,
        medico: `${medico_nombre} (RUT ${medico_rut})`,
        sucursal: SUC_NOMBRES[sucursal_id] || sucursal_id,
        fotoUrl: foto_receta_url
      })

      // Guardar el message-id para detectar la respuesta después
      await supabaseAdmin
        .from('recetas_magistrales')
        .update({
          correo_message_id: messageId,
          correo_enviado_ts: new Date().toISOString()
        })
        .eq('id', receta.id)

      await supabaseAdmin.from('recetas_eventos').insert({
        receta_id: receta.id,
        tipo: 'correo_enviado',
        texto: 'Correo al recetario',
        detalle: `${destinatarios.length} destinatarios · ${asunto}`,
        actor: 'sistema'
      })

      return res.status(200).json({ ok: true, receta, messageId })
    } catch (errMail) {
      console.error('Error enviando correo:', errMail)
      return res.status(200).json({
        ok: true,
        receta,
        warning: 'Receta creada pero falló el envío de correo: ' + errMail.message
      })
    }

  } catch (e) {
    console.error('Error crear receta:', e)
    return res.status(500).json({ error: e.message })
  }
}
