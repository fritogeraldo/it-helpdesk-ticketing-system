# IT Helpdesk Ticketing System

A full IT helpdesk ticketing system with:
- **Public submission portal** — users submit tickets without login
- **Ticket tracker** — users track their ticket via a secure token link
- **Admin dashboard** — agents manage, assign, and update tickets with email notifications
- **Gmail integration** — automatic email confirmation on submission & status updates

## Pages
| File | Description |
|------|-------------|
| `ticketing-app/src/index.html` | Public ticket submission form |
| `ticketing-app/src/ticket-status.html` | Ticket status tracker (token-based) |
| `ticketing-app/src/admin.html` | Admin dashboard (login required) |

## Backend Functions (Deno/Base44)
| Function | Description |
|----------|-------------|
| `submitTicket.ts` | Creates ticket + sends Gmail confirmation |
| `getTicketStatus.ts` | Returns ticket details (token-verified) |
| `adminLogin.ts` | Agent authentication |
| `adminGetTickets.ts` | Fetch all tickets (JWT-protected) |
| `adminUpdateTicket.ts` | Update status/assignment + email user |

## Data Schemas
- `entities/Ticket.json` — ticket fields
- `entities/Agent.json` — agent/admin accounts
- `entities/TicketNote.json` — internal notes per ticket

## Deployment
Hosted on Vercel (static HTML) + Base44 backend functions.
