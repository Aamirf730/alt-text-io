import { describe, expect, it } from "vitest";

import { extractPolarBillingSnapshot } from "./polar-billing";

describe("extractPolarBillingSnapshot", () => {
  it("extracts discount and product details from order.paid-style payloads", () => {
    expect(
      extractPolarBillingSnapshot({
        total_amount: 3000,
        discount_amount: 500,
        currency: "usd",
        product_id: "prod_standard_monthly",
        product: {
          id: "prod_standard_monthly",
          name: "Standard Monthly",
        },
        discount_id: "disc_launch",
        discount: {
          id: "disc_launch",
          code: "XYZ",
          name: "Launch Promo",
        },
      })
    ).toEqual({
      paymentAmount: 30,
      taxAmount: 0,
      discountAmount: 5,
      currency: "USD",
      productId: "prod_standard_monthly",
      productName: "Standard Monthly",
      discountId: "disc_launch",
      discountCode: "XYZ",
      discountName: "Launch Promo",
    });
  });

  it("falls back to camelCase subscription fields when totalAmount is absent", () => {
    expect(
      extractPolarBillingSnapshot({
        amount: 8600,
        currency: "eur",
        product: {
          id: "prod_pro_annual",
          name: "Pro Annual",
        },
        discount: {
          amount: 1400,
          code: "SAVE14",
          name: "Partner Deal",
        },
      })
    ).toEqual({
      paymentAmount: 86,
      taxAmount: 0,
      discountAmount: 14,
      currency: "EUR",
      productId: "prod_pro_annual",
      productName: "Pro Annual",
      discountId: null,
      discountCode: "SAVE14",
      discountName: "Partner Deal",
    });
  });

  it("returns stable defaults when no discount exists", () => {
    expect(
      extractPolarBillingSnapshot({
        totalAmount: 500,
        productName: "Small Pack",
      })
    ).toEqual({
      paymentAmount: 5,
      taxAmount: 0,
      discountAmount: 0,
      currency: "USD",
      productId: null,
      productName: "Small Pack",
      discountId: null,
      discountCode: null,
      discountName: null,
    });
  });

  it("records the tax included in the order total", () => {
    expect(
      extractPolarBillingSnapshot({ totalAmount: 1452, taxAmount: 252, currency: "eur" }),
    ).toMatchObject({ paymentAmount: 14.52, taxAmount: 2.52, currency: "EUR" });
  });
});
