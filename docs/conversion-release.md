# Homepage: conversion and performance

The public flow is residential simulation → optional EV demand → generation analysis → reviewed WhatsApp draft. Contact answers are never included in analytics events. A WhatsApp click is not evidence that the visitor sent a message.

## Production configuration

- On Vercel, the build uses `VERCEL_PROJECT_PRODUCTION_URL` automatically for the canonical, absolute sharing image and `sitemap.xml`. `VITE_SITE_URL` can override it with an explicit HTTPS origin. Local builds without either value intentionally omit domain-dependent metadata. Preview deployments receive `noindex,nofollow`.
- Keep Google browser keys restricted to the authorized production origins and required APIs.
- Vercel serves `api/news.js`; `vite preview` only serves the static build. News falls back to explicitly labeled source links if the API is unavailable.
- Web Analytics must be enabled on the deployment to receive existing page views and new conversion events. Custom event availability depends on the account plan.
- Speed Insights is wired but disabled by default. Activate it in the project dashboard, review the plan limits and then set `VITE_ENABLE_SPEED_INSIGHTS=true` to collect real-user Web Vitals.
- Submit `/sitemap.xml` in Search Console after setting the real domain. No indexation or ranking is guaranteed by the metadata.

## Honest project evidence

The references strip links to the company's existing Instagram and offers direct contact. Replace or extend it with actual installation photos and authorized testimonials when supplied. Do not label the illustrative hero or 3D models as completed customer projects.

## Verification

- `npm run lint`
- `npm run build`
- Run the production preview on port 5174, then `node scripts/conversion-smoke.mjs` against an isolated Chromium instance with its debugging port set to 9223.
- The smoke script covers mobile navigation, property/bill selection, EV demand transfer, result persistence, prefilled contact answers and the final WhatsApp URL. It blocks WhatsApp requests so no test message or draft reaches that service.
- Visual checks should include 320/390/768/1366 px, actual Android touch input and desktop keyboard navigation. Browser emulation does not replace testing a physical phone.
- The large Three.js modules are lazy-loaded. An optimized hero image and click-to-load model previews reduce initial requests; offscreen scene loops pause.

## Content and model licensing

Existing attribution identifies the BYD model as CC BY-NC-SA 4.0. Confirm permission for commercial use or replace that asset before commercial publication. Other supplied model credits are preserved. This implementation does not establish a commercial license.
