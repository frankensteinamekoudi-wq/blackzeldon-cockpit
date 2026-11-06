import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';

process.env.BZ_PERSIST = 'false';
const { handleGetJournal, handlePostJournal } = await import('./journal.js');

function responseFor(userId?: string) {
  return {
    statusCode: 200,
    payload: undefined as unknown,
    locals: { userId },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
}

function entry(key: string, pair: string) {
  return {
    key,
    client: 'attacker-supplied-client',
    pair,
    timeframe: '5min',
    direction: 'BUY',
    score: 70,
    probability: 0.55,
    entry: 1.1,
    sl: 1.099,
    tp1: 1.101,
    tp2: 1.102,
    tp3: 1.103,
    result: 'pending',
    rMultiple: 1,
    exitPrice: null,
    timestamp: Date.now(),
    closedAt: null,
    quality: 'test',
  };
}

test('journal refuses requests without a signed-in owner', () => {
  const get = responseFor();
  handleGetJournal({ query: {} } as Request, get as unknown as Response);
  assert.equal(get.statusCode, 401);

  const post = responseFor();
  handlePostJournal({ body: { entries: [entry('unauthenticated', 'EUR/USD')] } } as Request, post as unknown as Response);
  assert.equal(post.statusCode, 401);
});

test('journal reads and writes are isolated by authenticated owner', () => {
  const ownerA = `user_a_${Date.now()}`;
  const ownerB = `user_b_${Date.now()}`;
  const key = `shared_key_${Date.now()}`;

  const postA = responseFor(ownerA);
  handlePostJournal({
    body: { client: ownerB, entries: [entry(key, 'EUR/USD')] },
  } as unknown as Request, postA as unknown as Response);
  assert.equal(postA.statusCode, 200);

  const postB = responseFor(ownerB);
  handlePostJournal({
    body: { client: ownerA, entries: [entry(key, 'GBP/USD')] },
  } as unknown as Request, postB as unknown as Response);
  assert.equal(postB.statusCode, 200);

  const readA = responseFor(ownerA);
  handleGetJournal({ query: { client: ownerB, days: '60' } } as unknown as Request, readA as unknown as Response);
  const entriesA = (readA.payload as { entries: Array<{ client: string; pair: string }> }).entries;
  assert.deepEqual(entriesA.map(({ client, pair }) => ({ client, pair })), [{ client: ownerA, pair: 'EUR/USD' }]);

  const readB = responseFor(ownerB);
  handleGetJournal({ query: { client: ownerA, days: '60' } } as unknown as Request, readB as unknown as Response);
  const entriesB = (readB.payload as { entries: Array<{ client: string; pair: string }> }).entries;
  assert.deepEqual(entriesB.map(({ client, pair }) => ({ client, pair })), [{ client: ownerB, pair: 'GBP/USD' }]);
});
