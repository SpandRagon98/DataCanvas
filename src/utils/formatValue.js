/**
 * formatValue — apply number-format settings to a raw number.
 *
 * numFormat shape:
 *   { type: "number"|"whole"|"decimal"|"percent"|"currency"|"compact",
 *     decimals: 2, prefix: "", suffix: "", currencySymbol: "₹" }
 */
export function formatValue(value, numFormat = {}) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (isNaN(num)) return String(value);

  const {
    type       = "number",
    decimals   = 2,
    prefix     = "",
    suffix     = "",
    currencySymbol = "₹",
  } = numFormat;

  const d = Math.max(0, Math.min(20, +decimals));
  let fmt;

  switch (type) {
    case "whole":
      fmt = Math.round(num).toLocaleString();
      break;
    case "decimal":
      fmt = num.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
      break;
    case "percent":
      fmt = num.toFixed(d) + "%";
      break;
    case "currency":
      fmt =
        currencySymbol +
        num.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
      break;
    case "compact": {
      const abs = Math.abs(num);
      if (abs >= 1e9)      fmt = (num / 1e9).toFixed(1) + "B";
      else if (abs >= 1e6) fmt = (num / 1e6).toFixed(1) + "M";
      else if (abs >= 1e3) fmt = (num / 1e3).toFixed(1) + "K";
      else                 fmt = num.toFixed(d);
      break;
    }
    default:
      fmt = num.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  return prefix + fmt + suffix;
}

/** Shorthand — format with compact notation, no extra config. */
export function compactNumber(value) {
  return formatValue(value, { type: "compact", decimals: 1 });
}
