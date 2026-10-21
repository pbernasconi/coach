// Form (TSB) zones, the common reading of the Performance Management Chart. Shared by the server (stat tile, the
// app API) and the load chart (client). Pure: node --test can import it.
export const FORM_ZONES = [
  { from: 5, to: Infinity, label: 'Fresh', shade: true },
  { from: -10, to: 5, label: 'Neutral', shade: false },
  { from: -30, to: -10, label: 'Productive', shade: true },
  { from: -Infinity, to: -30, label: 'Overreaching', shade: false },
];

/** @param {number} tsb */
export const zoneOf = (tsb) => FORM_ZONES.find((z) => tsb >= z.from && tsb < z.to)?.label ?? '';
