import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createMimeMessage } from 'npm:mimetext@3.0.20';

function verifyToken(authHeader: string | null): { email: string; role: string } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token));
    if (Date.now() - payload.ts > 8 * 60 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

async function sendStatusUpdateEmail(accessToken: string, ticket: any, appUrl: string) {
  const trackingUrl = `${appUrl}/ticket-status.html?id=${ticket.ticket_id}&token=${ticket.token}`;
  const statusColors: Record<string, string[]> = {
    'Open':        ['#dcfce7', '#166534'],
    'In Progress': ['#fef9c3', '#854d0e'],
    'Resolved':    ['#dbeafe', '#1e40af'],
    'Closed':      ['#f1f5f9', '#475569'],
  };
  const [bgColor, textColor] = statusColors[ticket.status] || ['#f1f5f9', '#475569'];

  const msg = createMimeMessage();
  msg.setSender({ name: 'IT Helpdesk', addr: 'me' });
  msg.setRecipient(ticket.email);
  msg.setSubject(`[${ticket.ticket_id}] Status Update: ${ticket.status} — ${ticket.subject}`);
  msg.addMessage({
    contentType: 'text/html',
    data: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1e40af;padding:20px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:20px;">IT Helpdesk Support</h1>
        </div>
        <div style="background:#f8fafc;padding:30px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
          <p style="font-size:16px;color:#1e293b;">Hello <strong>${ticket.name}</strong>,</p>
          <p style="color:#475569;">Your support ticket has been updated.</p>
          <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;color:#64748b;width:40%;">Ticket ID:</td><td style="padding:8px 0;font-weight:bold;color:#1e293b;">${ticket.ticket_id}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b;">Subject:</td><td style="padding:8px 0;color:#1e293b;">${ticket.subject}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b;">Assigned To:</td><td style="padding:8px 0;color:#1e293b;">${ticket.assigned_to || 'Unassigned'}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b;">New Status:</td><td style="padding:8px 0;">
                <span style="background:${bgColor};color:${textColor};padding:2px 8px;border-radius:4px;font-size:14px;">${ticket.status}</span>
              </td></tr>
            </table>
          </div>
          <p style="color:#475569;">You can track your ticket anytime:</p>
          <a href="${trackingUrl}" style="display:inline-block;background:#1e40af;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">View Ticket Status</a>
          <p style="color:#94a3b8;font-size:13px;margin-top:30px;">— IT Helpdesk Team</p>
        </div>
      </div>
    `
  });

  const raw = msg.asEncoded();
  await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const agent = verifyToken(req.headers.get('Authorization'));
    if (!agent) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { ticket_id, status, assigned_to, internal_notes } = body;

    if (!ticket_id || !status) {
      return Response.json({ error: 'ticket_id and status are required' }, { status: 400 });
    }

    const tickets = await base44.asServiceRole.entities.Ticket.filter({ ticket_id });
    if (!tickets || tickets.length === 0) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const ticket = tickets[0];
    const updates: any = { status };
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (internal_notes !== undefined) updates.internal_notes = internal_notes;

    await base44.asServiceRole.entities.Ticket.update(ticket.id, updates);
    const updatedTicket = { ...ticket, ...updates };

    // Send email notification to user
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
      const appUrl = req.headers.get('origin') || 'https://agent-orange-c809ca9b.base44.app';
      await sendStatusUpdateEmail(accessToken, updatedTicket, appUrl);
    } catch (emailErr) {
      console.error('Email notification failed:', emailErr.message);
    }

    return Response.json({ ok: true, ticket: updatedTicket });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
