import "dotenv/config";
import express from "express";
import cors from "cors";
import { query } from "./db.js";

const app = express();
app.use(express.json());

// CORS: permite o webapp (demo) chamar a API do navegador
app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type","x-webhook-token"] }));
app.options("*", cors());

const HOLD_MINUTES = 10;

app.get("/health", (_, res) => res.json({ ok: true }));

async function expireHolds() {
  await query(
    `UPDATE bookings
     SET status='EXPIRED'
     WHERE status='HOLD' AND expires_at IS NOT NULL AND expires_at < now()`
  );
}

app.get("/availability", async (req, res) => {
  const { resource, start, end } = req.query;
  if (!resource || !start || !end) return res.status(400).json({ error: "missing params" });

  const startAt = new Date(start);
  const endAt = new Date(end);

  const r = await query(
    `SELECT COUNT(*)::int AS conflicts
     FROM bookings
     WHERE resource_id=$1
       AND status IN ('HOLD','PAID')
       AND tstzrange(start_at, end_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')`,
    [resource, startAt.toISOString(), endAt.toISOString()]
  );

  res.json({ available: r.rows[0].conflicts === 0 });
});

app.post("/bookings/hold", async (req, res) => {
  const { resource, startAt, minutes, email } = req.body;
  if (!resource || !startAt || !minutes) return res.status(400).json({ error: "missing fields" });

  await expireHolds();

  const s = new Date(startAt);
  const e = new Date(s.getTime() + Number(minutes) * 60 * 1000);
  const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);

  try {
    const r = await query(
      `INSERT INTO bookings (resource_id, customer_email, status, start_at, end_at, expires_at)
       VALUES ($1,$2,'HOLD',$3,$4,$5)
       RETURNING id, status, resource_id, start_at, end_at, expires_at`,
      [resource, email || null, s.toISOString(), e.toISOString(), expiresAt.toISOString()]
    );
    res.json({ booking: r.rows[0] });
  } catch (err) {
    return res.status(409).json({ error: "slot_unavailable" });
  }
});

// Webhook Asaas (MVP). Para produção, valide assinatura/segredo do Asaas.
app.post("/webhooks/asaas", async (req, res) => {
  const token = process.env.ASAAS_WEBHOOK_TOKEN || "";
  if (token) {
    const got = req.header("x-webhook-token") || "";
    if (got !== token) return res.status(401).json({ error: "unauthorized" });
  }

  const event = req.body;
  const paymentId = event?.payment?.id;
  const status = event?.payment?.status;

  if (!paymentId) return res.status(400).json({ error: "missing payment id" });

  const paidStatuses = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
  if (!paidStatuses.has(status)) return res.json({ ok: true });

  await query(
    `UPDATE bookings
     SET status='PAID'
     WHERE asaas_payment_id=$1`,
    [paymentId]
  );

  res.json({ ok: true });
});


// Erros: garante resposta JSON e ajuda a debugar no Render
app.use((err, req, res, next) => {
  console.error("API error:", err);
  res.status(500).json({ error: "internal_error" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("hub185-api listening on", port));
