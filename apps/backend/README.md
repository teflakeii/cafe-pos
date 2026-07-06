# Cafe POS Backend

NestJS backend for Cafe POS. It owns authentication, RBAC, table sessions, menu management, orders, payment allocation, shift closeout, audit logs, expense tracking, and reporting.

## Stack

- NestJS
- Prisma
- JWT authentication
- PostgreSQL-compatible schema
- Jest and Supertest

## Commands

```bash
pnpm --filter @cafe/backend build
pnpm --filter @cafe/backend lint
pnpm --filter @cafe/backend test
pnpm --filter @cafe/backend test:e2e
```

## Environment

Set runtime configuration through environment variables. At minimum:

- `DATABASE_URL`
- `JWT_SECRET`
- `SEED_OWNER_PASSWORD`
- `SEED_MANAGER_PASSWORD`
- `SEED_CASHIER_PASSWORD`
- `SEED_ACCOUNTANT_PASSWORD`

Do not commit `.env` files or real credentials.
