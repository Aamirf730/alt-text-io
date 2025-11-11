# PayPal Subscription Product Form - Complete Field Values

Use these exact values when filling out the PayPal subscription product creation form.

## Step 1: Product Information Form

### Product Name
```
Alt Text Pro
```

### Product Description (256 characters max)
```
AI-powered alt-text generation service for WordPress and websites. Automatically generate professional, SEO-friendly alt-text for your images using advanced AI technology. Improve accessibility and search engine rankings with our powerful SaaS integration.
```

**Character count:** 195 characters (well under the 256 limit)

### Product ID
```
ALT_TEXT_PRO
```

**OR** leave this field **empty** and PayPal will auto-generate one (recommended if you're unsure).

### Product Type
Select from dropdown:
```
SERVICE
```
**OR**
```
SOFTWARE
```

Both work, but `SERVICE` is more appropriate for SaaS subscriptions.

### Industry Category
Select from dropdown:
```
SOFTWARE
```
**OR**
```
DIGITAL_SERVICES
```

**Note:** The form mentions "To get future insights for your business, select an industry category" - `SOFTWARE` is the most appropriate choice.

### Product Page URL
```
https://www.alt-text.pro
```

This is your main website URL where customers can learn about the service.

### Product Image URL
```
https://www.alt-text.pro/logo-alt-text-pro.png
```

**OR** if you don't have a logo hosted yet, you can:
- Leave this field empty (optional)
- Use a placeholder image URL
- Upload an image directly if PayPal allows it

**Note:** If you need to host the logo, you can:
1. Upload it to your website at `/logo-alt-text-pro.png`
2. Or use any publicly accessible image URL

## Step 2: After Creating the Product

After you click "Next" or "Save", PayPal will:
1. Create the product
2. Generate a Product ID (if you left it empty)
3. Show you the Product ID (starts with `PROD-`)

**IMPORTANT:** Copy this Product ID - you'll need it for Netlify environment variables as `PAYPAL_PRODUCT_ID`.

## Step 3: Create Plans (After Product is Created)

Once the product is created, you'll be able to create subscription plans. For each plan, use these values:

### Plan 1: Tier 1 ($12/month)

**Plan Name:**
```
Alt Text Pro - Tier 1
```

**Description:**
```
1,000 credits per month - Tier 1
```

**Billing Cycle:**
- Frequency: `Monthly`
- Interval: `1 month`
- Price: `$12.00 USD`

**Setup Fee:**
```
$0.00
```
**⚠️ IMPORTANT:** Must be $0.00 (zero)

**Trial Period:**
```
None
```

**Auto-renewal:**
```
Enabled
```

**Payment Failure Handling:**
```
Continue after 3 failures
```

**Copy the Plan ID** (starts with `P-`) for `PAYPAL_PLAN_TIER1`

---

### Plan 2: Tier 2 ($20/month)

**Plan Name:**
```
Alt Text Pro - Tier 2
```

**Description:**
```
2,500 credits per month - Tier 2
```

**Billing Cycle:**
- Frequency: `Monthly`
- Interval: `1 month`
- Price: `$20.00 USD`

**Setup Fee:**
```
$0.00
```
**⚠️ IMPORTANT:** Must be $0.00 (zero)

**Trial Period:**
```
None
```

**Auto-renewal:**
```
Enabled
```

**Payment Failure Handling:**
```
Continue after 3 failures
```

**Copy the Plan ID** (starts with `P-`) for `PAYPAL_PLAN_TIER2`

---

### Plan 3: Tier 3 ($40/month)

**Plan Name:**
```
Alt Text Pro - Tier 3
```

**Description:**
```
5,000 credits per month - Tier 3
```

**Billing Cycle:**
- Frequency: `Monthly`
- Interval: `1 month`
- Price: `$40.00 USD`

**Setup Fee:**
```
$0.00
```
**⚠️ IMPORTANT:** Must be $0.00 (zero)

**Trial Period:**
```
None
```

**Auto-renewal:**
```
Enabled
```

**Payment Failure Handling:**
```
Continue after 3 failures
```

**Copy the Plan ID** (starts with `P-`) for `PAYPAL_PLAN_TIER3`

## Quick Copy-Paste Reference

### Product Form:
```
Product Name: Alt Text Pro
Product Description: AI-powered alt-text generation service for WordPress and websites. Automatically generate professional, SEO-friendly alt-text for your images using advanced AI technology. Improve accessibility and search engine rankings with our powerful SaaS integration.
Product ID: ALT_TEXT_PRO (or leave empty)
Product Type: SERVICE
Industry Category: SOFTWARE
Product Page URL: https://www.alt-text.pro
Product Image URL: https://www.alt-text.pro/logo-alt-text-pro.png
```

### All Three Plans:
```
Plan Name: Alt Text Pro - Tier 1/2/3
Description: [1,000/2,500/5,000] credits per month - Tier [1/2/3]
Billing: Monthly, $12/$20/$40 USD
Setup Fee: $0.00 (MUST BE ZERO)
Trial: None
Auto-renewal: Enabled
Payment Failure: Continue after 3 failures
```

## After Setup - What to Collect

After creating everything, you'll need these IDs for Netlify:

1. **Product ID** → `PAYPAL_PRODUCT_ID` (e.g., `PROD-XXXXXXXXXXXXX`)
2. **Tier 1 Plan ID** → `PAYPAL_PLAN_TIER1` (e.g., `P-XXXXXXXXXXXXX`)
3. **Tier 2 Plan ID** → `PAYPAL_PLAN_TIER2` (e.g., `P-YYYYYYYYYYYYY`)
4. **Tier 3 Plan ID** → `PAYPAL_PLAN_TIER3` (e.g., `P-ZZZZZZZZZZZZZ`)

## Important Notes

1. **Setup Fee MUST be $0.00** - This is critical! If you set any other value, users will be charged extra on their first payment.

2. **Product ID** - You can either:
   - Use `ALT_TEXT_PRO` (custom ID)
   - Leave empty and let PayPal generate one (recommended)

3. **All plans must be associated with the same product** - Make sure you select "Alt Text Pro" as the product when creating each plan.

4. **Plans must be ACTIVE** - After creation, verify the status is "ACTIVE" in the PayPal dashboard.

5. **Copy IDs immediately** - PayPal shows the IDs right after creation. Copy them immediately as they're harder to find later.

