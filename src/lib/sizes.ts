/** The approved Felina size chart. Numeric sizes stay stable in stored orders. */
export const SIZE_LABELS: Readonly<Record<string, string>> = {
  "30": "S",
  "32": "M",
  "34": "L",
  "36": "XL",
  "38": "XXL",
  "40": "XXXL",
  "42": "4XL",
  "44": "5XL",
};

/** Show today's size convention without mutating historical order/invoice data. */
export function getSizeLabel(size: string): string {
  return SIZE_LABELS[size] || size;
}
