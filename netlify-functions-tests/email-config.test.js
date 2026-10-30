import { afterEach, describe, expect, it } from 'vitest';
import emailConfig from '../netlify-functions/utils/email-config.js';

const { getCustomerEmailFrom } = emailConfig;
const saved = { EMAIL_FROM: process.env.EMAIL_FROM, EMAIL_USER: process.env.EMAIL_USER };

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('getCustomerEmailFrom', () => {
  it('adds the Alt Text Pro name to a bare address', () => {
    process.env.EMAIL_FROM = 'help@alt-text.pro';
    expect(getCustomerEmailFrom()).toBe('"Alt Text Pro" <help@alt-text.pro>');
  });

  it('keeps a sender that already has a display name', () => {
    process.env.EMAIL_FROM = 'Support <help@alt-text.pro>';
    expect(getCustomerEmailFrom()).toBe('Support <help@alt-text.pro>');
  });

  it('falls back to the default address', () => {
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_USER;
    expect(getCustomerEmailFrom()).toBe('"Alt Text Pro" <help@alt-text.pro>');
  });
});
