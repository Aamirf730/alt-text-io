# PayPal Plans - Quick Reference Card

## TIER 1 - Monthly
**Plan Name:** `Alt Text Pro - Tier 1`
**Description:** `1,000 credits per month - Tier 1`
**Settings:**
- Billing Cycle: **Monthly** (1 month)
- Price: **$12.00 USD**
- Setup Fee: **$0.00** ⚠️
- Auto-renewal: **Enabled**
**Plan ID Variable:** `PAYPAL_PLAN_TIER1`

## TIER 1 - Annual (Save 10%)
**Plan Name:** `Alt Text Pro - Tier 1 (Annual)`
**Description:** `1,000 credits per month billed annually - Tier 1`
**Settings:**
- Billing Cycle: **Yearly** (1 year)
- Price: **$129.60 USD**
- Setup Fee: **$0.00** ⚠️
- Auto-renewal: **Enabled**
**Plan ID Variable:** `PAYPAL_PLAN_TIER1_ANNUAL`

---

## TIER 2 - Monthly
**Plan Name:** `Alt Text Pro - Tier 2`
**Description:** `2,500 credits per month - Tier 2`
**Settings:**
- Billing Cycle: **Monthly** (1 month)
- Price: **$20.00 USD**
- Setup Fee: **$0.00** ⚠️
- Auto-renewal: **Enabled**
**Plan ID Variable:** `PAYPAL_PLAN_TIER2`

## TIER 2 - Annual (Save 10%)
**Plan Name:** `Alt Text Pro - Tier 2 (Annual)`
**Description:** `2,500 credits per month billed annually - Tier 2`
**Settings:**
- Billing Cycle: **Yearly** (1 year)
- Price: **$216.00 USD**
- Setup Fee: **$0.00** ⚠️
- Auto-renewal: **Enabled**
**Plan ID Variable:** `PAYPAL_PLAN_TIER2_ANNUAL`

---

## TIER 3 - Monthly
**Plan Name:** `Alt Text Pro - Tier 3`
**Description:** `5,000 credits per month - Tier 3`
**Settings:**
- Billing Cycle: **Monthly** (1 month)
- Price: **$40.00 USD**
- Setup Fee: **$0.00** ⚠️
- Auto-renewal: **Enabled**
**Plan ID Variable:** `PAYPAL_PLAN_TIER3`

## TIER 3 - Annual (Save 10%)
**Plan Name:** `Alt Text Pro - Tier 3 (Annual)`
**Description:** `5,000 credits per month billed annually - Tier 3`
**Settings:**
- Billing Cycle: **Yearly** (1 year)
- Price: **$432.00 USD**
- Setup Fee: **$0.00** ⚠️
- Auto-renewal: **Enabled**
**Plan ID Variable:** `PAYPAL_PLAN_TIER3_ANNUAL`

---

## Checklist After Creating Each Plan

- [ ] Plan Status is **ACTIVE** (not Draft)
- [ ] Setup Fee is exactly **$0.00** (not blank/null)
- [ ] Copied Plan ID (starts with `P-`)
- [ ] Verified plan is linked to Product `PROD-89T43770P6349820G` (or your new product)

---

## After All Plans Created

Update Netlify Environment Variables:

```
PAYPAL_PLAN_TIER1=P-XXXXXXXXXXXXX
PAYPAL_PLAN_TIER1_ANNUAL=P-XXXXXXXXXXXXX

PAYPAL_PLAN_TIER2=P-XXXXXXXXXXXXX
PAYPAL_PLAN_TIER2_ANNUAL=P-XXXXXXXXXXXXX

PAYPAL_PLAN_TIER3=P-XXXXXXXXXXXXX
PAYPAL_PLAN_TIER3_ANNUAL=P-XXXXXXXXXXXXX
```

Then **redeploy** your Netlify site.
