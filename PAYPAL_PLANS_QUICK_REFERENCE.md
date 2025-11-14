# PayPal Plans - Quick Reference Card

## TIER 1 - Copy & Paste

**Plan Name:**
```
Alt Text Pro - Tier 1
```

**Description:**
```
1,000 credits per month - Tier 1
```

**Settings:**
- Billing Cycle: **Monthly** (1 month)
- Price: **$12.00 USD**
- Setup Fee: **$0.00** ⚠️
- Trial Period: **None**
- Auto-renewal: **Enabled**
- Payment Failure: **Continue after 3 failures**

**Plan ID Variable:** `PAYPAL_PLAN_TIER1`

---

## TIER 2 - Copy & Paste

**Plan Name:**
```
Alt Text Pro - Tier 2
```

**Description:**
```
2,500 credits per month - Tier 2
```

**Settings:**
- Billing Cycle: **Monthly** (1 month)
- Price: **$20.00 USD**
- Setup Fee: **$0.00** ⚠️
- Trial Period: **None**
- Auto-renewal: **Enabled**
- Payment Failure: **Continue after 3 failures**

**Plan ID Variable:** `PAYPAL_PLAN_TIER2`

---

## TIER 3 - Copy & Paste

**Plan Name:**
```
Alt Text Pro - Tier 3
```

**Description:**
```
5,000 credits per month - Tier 3
```

**Settings:**
- Billing Cycle: **Monthly** (1 month)
- Price: **$40.00 USD**
- Setup Fee: **$0.00** ⚠️
- Trial Period: **None**
- Auto-renewal: **Enabled**
- Payment Failure: **Continue after 3 failures**

**Plan ID Variable:** `PAYPAL_PLAN_TIER3`

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
PAYPAL_PLAN_TIER2=P-XXXXXXXXXXXXX
PAYPAL_PLAN_TIER3=P-XXXXXXXXXXXXX
```

Then **redeploy** your Netlify site.

