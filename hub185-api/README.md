# HUB 185 API (Node + Postgres) — Render

## O que isso faz
- Cria HOLD (pré-reserva) no Postgres com expiração (10 min)
- Impede dupla-reserva (constraint no banco)
- Endpoint de disponibilidade
- Webhook Asaas (MVP) para marcar PAID

## 1) Banco (Render Postgres)
Abra seu banco no Render e rode `migrations.sql`.

## 2) Subir no Render (Web Service)
1. Crie um repositório no GitHub.
2. Faça upload/push desta pasta.
3. No Render: New + -> Web Service -> conecte o repo.
4. Build: `npm install`
5. Start: `npm start`
6. Environment:
   - DATABASE_URL = (External Database URL do Render)
   - PGSSL = true
   - ASAAS_WEBHOOK_TOKEN = (opcional)

## 3) Testar API
- Health: GET /health
- Disponibilidade:
  GET /availability?resource=PC1&start=2026-02-17T12:00:00-03:00&end=2026-02-17T14:00:00-03:00
- Criar HOLD:
  POST /bookings/hold
  Body:
  {
    "resource":"PC1",
    "startAt":"2026-02-17T12:00:00-03:00",
    "minutes":120,
    "email":"cliente@exemplo.com"
  }
