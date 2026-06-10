# Cafe POS Backend API

## Auth

POST /auth/pin

## Seed

POST /seed/init

## Tables

GET /tables

## Table People

POST /tables/:tableId/people
POST /tables/:tableId/participants
POST /orders/:orderId/participants
GET /tables/:tableId/people
PATCH /people/:id

## Orders

POST /orders
POST /orders/:orderId/items
PATCH /orders/:orderId/items/:itemId
DELETE /orders/:orderId/items/:itemId

## Game

POST /tables/:tableId/game/start
POST /game/:sessionId/stop

## Settlement

GET /orders/:orderId/settlement

## Payments

POST /orders/:orderId/payments
