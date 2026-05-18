import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function verifyToken(authHeader: string | null): { email: string; role: string } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token));
    // Token expires after 8 hours
    if (Date.now() - payload.ts > 8 * 60 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const agent = verifyToken(req.headers.get('Authorization'));
    if (!agent) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tickets = await base44.asServiceRole.entities.Ticket.list();
    // Sort by created_date desc
    tickets.sort((a: any, b: any) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());

    return Response.json({ ok: true, tickets });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
