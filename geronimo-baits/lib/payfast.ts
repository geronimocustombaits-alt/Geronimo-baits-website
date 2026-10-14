import { createHash } from "crypto";

// PayFast helpers, following PayFast's own integration guide.

export function isSandbox(): boolean {
  return process.env.PAYFAST_SANDBOX === "true";
}

export function payfastHost(): string {
  return isSandbox() ? "sandbox.payfast.co.za" : "www.payfast.co.za";
}

// PayFast signs values the way PHP's urlencode() does: spaces become "+",
// and ! ' ( ) * ~ are percent-encoded with upper-case hex.
export function pfEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

// key=value&key=value... in the order given, without the signature field.
export function buildParamString(
  pairs: [string, string][],
  { skipEmpty }: { skipEmpty: boolean }
): string {
  return pairs
    .filter(([key]) => key !== "signature")
    .filter(([, value]) => !skipEmpty || value.trim() !== "")
    .map(([key, value]) => `${key}=${pfEncode(value.trim())}`)
    .join("&");
}

// MD5 signature, with the passphrase appended if one is set on the account.
export function signParamString(paramString: string): string {
  const passphrase = process.env.PAYFAST_PASSPHRASE?.trim();
  const toSign = passphrase
    ? `${paramString}&passphrase=${pfEncode(passphrase)}`
    : paramString;
  return createHash("md5").update(toSign).digest("hex");
}

// Builds the signed PayFast checkout link for an order.
// Field order matters for the signature: this is PayFast's documented order.
export function createPaymentUrl(order: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  amount: number;
}): string {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  if (!merchantId || !merchantKey) throw new Error("Missing PayFast merchant details");

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const fields: [string, string][] = [
    ["merchant_id", merchantId],
    ["merchant_key", merchantKey],
    ["return_url", `${baseUrl}/payment-success`],
    ["cancel_url", `${baseUrl}/payment-cancelled`],
    ["notify_url", `${baseUrl}/api/payfast-itn`],
    ["name_first", order.customerName],
    ["email_address", order.customerEmail],
    ["m_payment_id", order.orderNumber],
    ["amount", order.amount.toFixed(2)],
    ["item_name", `Geronimo Baits Order ${order.orderNumber}`],
  ];

  const paramString = buildParamString(fields, { skipEmpty: true });
  return `https://${payfastHost()}/eng/process?${paramString}&signature=${signParamString(paramString)}`;
}

// Asks PayFast's server to confirm the notification really came from them.
export async function confirmWithPayfast(paramString: string): Promise<boolean> {
  const response = await fetch(`https://${payfastHost()}/eng/query/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: paramString,
    cache: "no-store",
  });
  const text = (await response.text()).trim();
  return text === "VALID";
}
