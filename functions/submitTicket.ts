import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createMimeMessage } from 'npm:mimetext@3.0.20';

function generateTicketId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'TKT-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function sendConfirmationEmail(accessToken: string, ticket: any, appUrl: string) {
  const trackingUrl = `${appUrl}/ticket-status?id=${ticket.ticket_id}&token=${ticket.token}`;

  const msg = createMimeMessage();
  msg.setSender({ name: 'IT Helpdesk', addr: 'me' });
  msg.setRecipient(ticket.email);
  msg.setSubject(`[${ticket.ticket_id}] Ticket Received: ${ticket.subject}`);
  msg.addMessage({
    contentType: 'text/html',
    data: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">IT Helpdesk Support</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
          <p style="font-size: 16px; color: #1e293b;">Hello <strong>${ticket.name}</strong>,</p>
          <p style="color: #475569;">We've received your support request. Here are your ticket details:</p>
          
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #64748b; width: 40%;">Ticket ID:</td><td style="padding: 8px 0; font-weight: bold; color: #1e293b;">${ticket.ticket_id}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Subject:</td><td style="padding: 8px 0; color: #1e293b;">${ticket.subject}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Category:</td><td style="padding: 8px 0; color: #1e293b;">${ticket.category}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Priority:</td><td style="padding: 8px 0; color: #1e293b;">${ticket.priority}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Status:</td><td style="padding: 8px 0;"><span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 14px;">Open</span></td></tr>
            </table>
          </div>
          
          <p style="color: #475569;">You can track your ticket status anytime using the link below:</p>
          <a href="${trackingUrl}" style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 10px 0;">Track My Ticket</a>
          
          <p style="color: #94a3b8; font-size: 13px; margin-top: 30px;">Our team will respond within 24 hours for Medium priority tickets. You'll receive email updates whenever your ticket status changes.</p>
          <p style="color: #94a3b8; font-size: 13px;">— IT Helpdesk Team</p>
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
    const body = await req.json().catch(() => ({}));

    const { name, email, subject, category, priority, description, attachment_url } = body;

    if (!name || !email || !subject || !description) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const ticket_id = generateTicketId();
    const token = generateToken();

    const ticketData = {
      ticket_id,
      token,
      name,
      email,
      subject,
      category: category || 'General',
      priority: priority || 'Medium',
      description,
      status: 'Open',
      assigned_to: '',
      internal_notes: '',
      attachment_url: attachment_url || '',
    };

    await base44.asServiceRole.entities.Ticket.create(ticketData);

    // Send confirmation email via Gmail
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
      const appUrl = req.headers.get('origin') || 'https://agent-orange-c809ca9b.base44.app';
      await sendConfirmationEmail(accessToken, ticketData, appUrl);
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
    }

    return Response.json({ ok: true, ticket_id, token });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
