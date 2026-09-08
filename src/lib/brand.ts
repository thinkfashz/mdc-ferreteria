export const MDC_STORE_URL = "https://mdc-tienda.vercel.app";
export const MDC_LOGO_URL = "https://res.cloudinary.com/disghf6xc/image/upload/f_auto,q_auto,w_620/v1788685244/mdc-premium-logo.png";
export const MDC_TRUCK_URL = "https://res.cloudinary.com/disghf6xc/image/upload/f_auto,q_auto,w_360/v1788685315/mdc-truck.png";

export function resolveProductImageUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  const clean = raw.replace(/^\.\//, "").replace(/^\//, "");
  return `${MDC_STORE_URL}/${clean}`;
}
