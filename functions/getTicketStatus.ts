import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { ticket_id, token } = body;

    if (!ticket_id || !token) {
      return Response.json({ error: 'ticket_id and token required' }, { status: 400 });
    }

    const tickets = await base44.asServiceRole.entities.Ticket.filter({ ticket_id });
    if (!tickets || tickets.length === 0) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const ticket = tickets[0];

    // Verify token matches
    if (ticket.token !== token) {
      return Response.json({ error: 'Invalid token' }, { status: 403 });
    }

    // Return ticket without internal_notes and token for security
    const { token: _t, internal_notes: _n, ...safeTicket } = ticket;
    return Response.json({ ok: true, ticket: safeTicket });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
