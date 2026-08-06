import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const fetchMock = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', fetchMock);

const {
  reserveUserCredit,
  finalizeUserCreditReservation,
  releaseUserCreditReservation,
} = require('./api-key-validator.js');

const repoRoot = path.resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const migrationPath = path.join(
  repoRoot,
  'supabase/migrations/20260806143048_reserve_credits_before_ai_generation.sql'
);

describe('credit reservation RPC adapters', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('reserves a credit with the user-scoped RPC', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      reservation_id: 'reservation_1',
      credit_source: 'plan',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(reserveUserCredit('user_1')).resolves.toMatchObject({
      success: true,
      reservation_id: 'reservation_1',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/rest/v1/rpc/reserve_credit');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      user_uuid: 'user_1',
      credits_to_reserve: 1,
    });
  });

  it('finalizes a reservation with the generated content and context', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      credits_remaining: 29,
      total_processed: 1,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(
      finalizeUserCreditReservation('reservation_1', 'A city skyline.', 'homepage hero')
    ).resolves.toMatchObject({ success: true, credits_remaining: 29 });
    expect(fetchMock.mock.calls[0][0]).toContain('/rest/v1/rpc/finalize_credit_reservation');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      p_reservation_id: 'reservation_1',
      p_alt_text: 'A city skyline.',
      p_context: 'homepage hero',
    });
  });

  it('returns a safe failure when release cannot reach the database', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      code: '42501',
      message: 'permission denied',
      details: '',
      hint: '',
    }), { status: 403, headers: { 'Content-Type': 'application/json' } }));

    await expect(releaseUserCreditReservation('reservation_1')).resolves.toMatchObject({
      success: false,
      requiresDatabaseFix: true,
    });
  });
});

describe('M3 reservation migration and generation order', () => {
  const migration = fs.readFileSync(migrationPath, 'utf8');
  const generationSource = fs.readFileSync(
    path.join(repoRoot, 'netlify-functions/generate-alt-text.js'),
    'utf8'
  );

  it('serializes reservations and provides finalize/release paths', () => {
    expect(migration).toContain('create table if not exists public.credit_reservations');
    expect(migration).toContain('for update');
    expect(migration).toContain("r.status = 'reserved'");
    expect(migration).toContain('active_plan_reservations');
    expect(migration).toContain('create or replace function public.reserve_credit(');
    expect(migration).toContain('create or replace function public.finalize_credit_reservation(');
    expect(migration).toContain('create or replace function public.release_credit_reservation(');
    expect(migration).toContain("r.expires_at <= now()");
    expect(migration).toContain("r.credit_source = 'plan'");
    expect(migration).toContain('create or replace function public.renew_monthly_credits()');
    expect(migration).toContain('create or replace function public.renew_paid_monthly_credits()');
    expect(migration).toContain('grant execute on function public.reserve_credit(uuid, integer)');
  });

  it('reserves before Gemini and no longer uses the post-generation deduction path', () => {
    const reserveIndex = generationSource.indexOf('reserveUserCredit(user.id, 1)');
    const generateIndex = generationSource.indexOf('generateAltTextWithGemini(image_base64, context)');
    const finalizeIndex = generationSource.indexOf('finalizeUserCreditReservation(');

    expect(reserveIndex).toBeGreaterThan(-1);
    expect(generateIndex).toBeGreaterThan(reserveIndex);
    expect(finalizeIndex).toBeGreaterThan(generateIndex);
    expect(generationSource).not.toContain('updateUserCredits(user.id, 1, altText');
    expect(generationSource).toContain('releaseReservedCredit');
  });
});
