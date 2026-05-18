// lib/gmail.js
// Helper para enviar correos al laboratorio (SMTP) y leer sus respuestas (IMAP)
// Configurar variables de entorno en Vercel:
//   GMAIL_USER     = contactobiocuba.rm@gmail.com
//   GMAIL_PASSWORD = (contraseña de aplicación de 16 caracteres)

import nodemailer from 'nodemailer'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_PASSWORD = process.env.GMAIL_PASSWORD

// ============================================================================
// SMTP — Enviar correos
// ============================================================================

function getTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_PASSWORD }
  })
}

export async function enviarCorreoReceta({ destinatarios, numero, paciente, medico, sucursal, fotoUrl, observaciones }) {
  const transporter = getTransporter()
  const asunto = `[${numero}] Cotización paciente: ${paciente}`
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;color:#1a1916">
      <h2 style="color:#1a4a8a;border-bottom:2px solid #e53030;padding-bottom:8px">BioCuba Farmacias — Sucursal ${sucursal}</h2>
      <p>Solicitamos cotización del siguiente preparado magistral:</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:6px 10px;background:#f0efe9;font-weight:600">N° Receta</td><td style="padding:6px 10px">${numero}</td></tr>
        <tr><td style="padding:6px 10px;background:#f0efe9;font-weight:600">Paciente</td><td style="padding:6px 10px">${paciente}</td></tr>
        <tr><td style="padding:6px 10px;background:#f0efe9;font-weight:600">Médico</td><td style="padding:6px 10px">${medico}</td></tr>
        <tr><td style="padding:6px 10px;background:#f0efe9;font-weight:600">Sucursal</td><td style="padding:6px 10px">${sucursal}</td></tr>
      </table>
      ${observaciones ? `<p><strong>Observaciones:</strong> ${observaciones}</p>` : ''}
      ${fotoUrl ? `<p><strong>Foto de la receta:</strong> <a href="${fotoUrl}">${fotoUrl}</a></p><img src="${fotoUrl}" style="max-width:100%;border:1px solid #ddd;border-radius:6px;margin-top:8px" />` : ''}
      <p style="margin-top:24px;color:#6b6860;font-size:12px">
        Por favor responda este correo con el precio del preparado. El sistema detectará la respuesta automáticamente.<br>
        BioCuba Farmacias · Sucursal ${sucursal}
      </p>
    </div>
  `
  const info = await transporter.sendMail({
    from: `"BioCuba Recetario" <${GMAIL_USER}>`,
    to: destinatarios.join(', '),
    subject: asunto,
    html,
    messageId: `<${numero}-${Date.now()}@biocubafarmacias.cl>`
  })
  return { messageId: info.messageId, asunto }
}

export async function enviarCorreoPagoConfirmado({ destinatarios, numero, paciente, monto, forma, boleta, sucursal }) {
  const transporter = getTransporter()
  const formaLabel = { efectivo: 'Efectivo', debito: 'Tarjeta débito', credito: 'Tarjeta crédito', transferencia: 'Transferencia' }[forma] || forma
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;color:#1a1916">
      <h2 style="color:#1a4a8a;border-bottom:2px solid #e53030;padding-bottom:8px">BioCuba Farmacias — Sucursal ${sucursal}</h2>
      <p style="color:#2a5c3a;font-weight:600;font-size:15px;margin:8px 0 14px">✓ Pago confirmado — pueden preparar</p>
      <p>El cliente confirmó el pago del preparado magistral. Pueden proceder con la preparación.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:6px 10px;background:#f0efe9;font-weight:600">N° Receta</td><td style="padding:6px 10px">${numero}</td></tr>
        <tr><td style="padding:6px 10px;background:#f0efe9;font-weight:600">Paciente</td><td style="padding:6px 10px">${paciente}</td></tr>
        <tr><td style="padding:6px 10px;background:#f0efe9;font-weight:600">Monto</td><td style="padding:6px 10px">$${(monto||0).toLocaleString('es-CL')}</td></tr>
        <tr><td style="padding:6px 10px;background:#f0efe9;font-weight:600">Forma</td><td style="padding:6px 10px">${formaLabel}</td></tr>
        <tr><td style="padding:6px 10px;background:#f0efe9;font-weight:600">N° boleta</td><td style="padding:6px 10px">${boleta}</td></tr>
      </table>
      <p style="margin-top:24px;color:#6b6860;font-size:12px">BioCuba Farmacias · Sucursal ${sucursal}</p>
    </div>
  `
  const messageId = `<${numero}-pago-${Date.now()}@biocubafarmacias.cl>`
  const info = await transporter.sendMail({
    from: `"BioCuba Recetario" <${GMAIL_USER}>`,
    to: destinatarios.join(', '),
    subject: `[${numero}] PAGO CONFIRMADO — ${paciente}`,
    html,
    messageId
  })
  return { messageId: info.messageId || messageId }
}

// ============================================================================
// IMAP — Leer respuestas del laboratorio
// ============================================================================

export async function leerRespuestasNuevas() {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_PASSWORD },
    logger: false
  })

  const respuestas = []
  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      // Buscar correos NO LEÍDOS de los últimos 7 días
      const seteDiasAtras = new Date(Date.now() - 7*24*60*60*1000)
      const uids = await client.search({ since: seteDiasAtras, seen: false })
      console.log("[CRON DEBUG] UIDs encontrados:", uids); if (!uids || uids.length === 0) return []

      for (const uid of uids) {
        try {
          const msg = await client.fetchOne(uid, { source: true, envelope: true })
          if (!msg) continue
          const parsed = await simpleParser(msg.source)

          // Extraer In-Reply-To y References para detectar a qué receta corresponde
          const inReplyTo = parsed.inReplyTo || ''
          const references = Array.isArray(parsed.references) ? parsed.references.join(' ') : (parsed.references || '')

          respuestas.push({
            uid,
            from: parsed.from?.text || '',
            subject: parsed.subject || '',
            text: parsed.text || '',
            html: parsed.html || '',
            inReplyTo,
            references,
            date: parsed.date,
            messageId: parsed.messageId
          })

          // Marcar como leído para no procesar dos veces
          await client.messageFlagsAdd(uid, ['\\Seen'])
        } catch (e) {
          console.error('Error parseando correo', uid, e.message)
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(()=>{})
  }
  return respuestas
}

// ============================================================================
// Helpers
// ============================================================================

export function reemplazarVars(texto, vars) {
  if (!texto) return ''
  return texto
    .replace(/\{nombre\}/g, vars.nombre || '')
    .replace(/\{paciente\}/g, vars.paciente || '')
    .replace(/\{monto\}/g, vars.monto ? '$'+vars.monto.toLocaleString('es-CL') : '')
    .replace(/\{sucursal\}/g, vars.sucursal || '')
}
