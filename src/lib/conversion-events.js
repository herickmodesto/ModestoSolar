import { track } from '@vercel/analytics';

// Only event names and generic source labels. Never send answers or contact data.
const allowed = new Set(['simulation_started', 'simulation_completed', 'ev_included', 'contact_started', 'contact_reviewed', 'whatsapp_clicked']);
export function trackConversion(name, source) {
  if (!allowed.has(name)) return;
  window.dispatchEvent(new CustomEvent('modesto:conversion', { detail: { name, source } }));
  if (import.meta.env.PROD) track(name, { source });
}
