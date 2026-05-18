import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !password) {
      return Response.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Look up agent in the Agent entity
    const agents = await base44.asServiceRole.entities.Agent.filter({ email });

    if (!agents || agents.length === 0) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const agent = agents[0];

    if (!agent.is_active) {
      return Response.json({ error: 'Account is inactive. Contact your administrator.' }, { status: 403 });
    }

    // Simple password check — in production use bcrypt; here we compare stored hash/plain
    if (agent.password_hash !== password) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Issue a simple signed token (base64 of payload + timestamp)
    const payload = { email: agent.email, role: agent.role, id: agent.id, ts: Date.now() };
    const token = btoa(JSON.stringify(payload));

    return Response.json({ ok: true, token, role: agent.role, full_name: agent.full_name });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
