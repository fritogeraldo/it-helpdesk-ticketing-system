import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createMimeMessage } from 'npm:mimetext@3.0.20';

async function sendStatusUpdateEmail(accessToken: string, ticket: any, previousStatus: string) {
  const appUrl = 'https://agent-orange-c809ca9b.base44.app';
  const trackingUrl = `${appUrl}/ticket-status?id=${ticket.ticket_id}&token=${ticket.token}`;

  const statusColors: Record<string, string> = {
    'Open': '#dcfce7',
    'In Progress': '#fef9c3',
    'Resolved': '#dbeafe',
    'Closed': '#f1f5f9',
  };
  const statusTextColors: Record<string, string> = {
    'Open': '#166534',
    'In Progress': '#854d0e',
    'Resolved': '#1e40af',
    'Closed': '#475569',
  };

  const msg = createMimeMessage();
  msg.setSender({ name: 'IT Helpdesk', addr: 'me' });
  msg.setRecipient(ticket.email);
  msg.setSubject(`[${ticket.ticket_id}] Status Update: ${ticket.subject}`);
  msg.addMessage({
    contentType: 'text/html',
    data: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">IT Helpdesk Support</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
          <p style="font-size: 16px; color: #1e293b;">Hello <strong>${ticket.name}</strong>,</p>
          <p style="color: #475569;">Your ticket status has been updated:</p>
          
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #64748b; width: 40%;">Ticket ID:</td><td style="padding: 8px 0; font-weight: bold; color: #1e293b;">${ticket.ticket_id}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Subject:</td><td style="padding: 8px 0; color: #1e293b;">${ticket.subject}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Previous Status:</td><td style="padding: 8px 0; color: #94a3b8;">${previousStatus}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">New Status:</td><td style="padding: 8px 0;"><span style="background: ${statusColors[ticket.status] || '#f1f5f9'}; color: ${statusTextColors[ticket.status] || '#475569'}; padding: 2px 8px; border-radius: 4px; font-size: 14px;">${ticket.status}</span></td></tr>
              ${ticket.assigned_to ? `<tr><td style="padding: 8px 0; color: #64748b;">Assigned To:</td><td style="padding: 8px 0; color: #1e293b;">${ticket.assigned_to}</td></tr>` : ''}
            </table>
          </div>
          
          <a href="${trackingUrl}" style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 10px 0;">View Ticket Status</a>
          
          <p style="color: #94a3b8; font-size: 13px; margin-top: 30px;">— IT Helpdesk Team</p>
        </div>
      </div>
    `
  });

  const raw = msg.asEncoded();
  await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { ticket_db_id, status, assigned_to, internal_notes, previous_status } = body;

    if (!ticket_db_id) {
      return Response.json({ error: 'Missing ticket_db_id' }, { status: 400 });
    }

    const updateData: Record<string, any> = {};
    if (status) updateData.status = status;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
    if (internal_notes !== undefined) updateData.internal_notes = internal_notes;

    const updated = await base44.asServiceRole.entities.Ticket.update(ticket_db_id, updateData);

    // Send status update email if status changed
    if (status && status !== previous_status && updated.email) {
      try {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
        await sendStatusUpdateEmail(accessToken, updated, previous_status || 'Unknown');
      } catch (emailErr) {
        console.error('Status email failed:', emailErr.message);
      }
    }

    return Response.json({ ok: true, ticket: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
