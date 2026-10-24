type UnknownRecord = Record<string, unknown>;

export type PolarBillingSnapshot = {
  paymentAmount: number;
  // Tax included in paymentAmount. Revenue reporting subtracts it.
  taxAmount: number;
  discountAmount: number;
  currency: string;
  productId: string | null;
  productName: string;
  discountId: string | null;
  discountCode: string | null;
  discountName: string | null;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function getFirstString(record: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getFirstNumber(record: UnknownRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function centsToDecimal(cents: number | null): number {
  if (cents === null) return 0;
  return Number((cents / 100).toFixed(2));
}

export function extractPolarBillingSnapshot(payload: unknown): PolarBillingSnapshot {
  const record = isRecord(payload) ? payload : {};
  const product = isRecord(record.product) ? record.product : {};
  const discount = isRecord(record.discount) ? record.discount : {};

  const currency =
    (getFirstString(record, ["currency"]) || getFirstString(discount, ["currency"]) || "USD").toUpperCase();

  const totalAmountCents = getFirstNumber(record, ["totalAmount", "total_amount", "amount"]);
  const taxAmountCents = getFirstNumber(record, ["taxAmount", "tax_amount"]);
  const discountAmountCents =
    getFirstNumber(record, ["discountAmount", "discount_amount"]) ?? getFirstNumber(discount, ["amount"]);

  return {
    paymentAmount: centsToDecimal(totalAmountCents),
    taxAmount: centsToDecimal(taxAmountCents),
    discountAmount: centsToDecimal(discountAmountCents),
    currency,
    productId: getFirstString(record, ["productId", "product_id"]) || getFirstString(product, ["id"]),
    productName: getFirstString(product, ["name"]) || getFirstString(record, ["productName", "product_name"]) || "",
    discountId: getFirstString(record, ["discountId", "discount_id"]) || getFirstString(discount, ["id"]),
    discountCode: getFirstString(discount, ["code"]),
    discountName: getFirstString(discount, ["name"]),
  };
}
