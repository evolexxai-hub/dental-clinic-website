# Dentica Dental Clinic — website

Static, self-contained clinic website. No build step: open `index.html`, or serve the folder.

```bash
python -m http.server 8123 --bind 127.0.0.1
# http://127.0.0.1:8123/index.html
```

Deployed on Vercel from this repo — every push to `main` redeploys.

## What's in it

| | |
|---|---|
| **Brand** | gold `#D4A017` on black `#0B0B0B`, Sora (Latin) + Cairo (Arabic) |
| **Themes** | light / dark, remembered per visitor (`localStorage`) |
| **Languages** | English + Arabic with full RTL, 252 translated strings |
| **Booking** | multi-step engine: service → date & time → details → confirmation |

## Structure

```
index.html  about.html  service.html  blog.html      main pages
privacy / terms / cookies / licenses / 404.html      legal + error
assets/css/dentica-base.css     layout & components (design system)
assets/css/dentica.css          theme switch, Arabic/RTL, booking UI
assets/js/dentica-ui.js         theme + language controller
assets/js/dentica-i18n.js       Arabic dictionary — edit copy here
assets/js/dentica-booking.js    booking engine + all its settings
n8n/                            backend workflow + setup guide
```

## URL parameters

| | |
|---|---|
| `?theme=dark` / `?theme=light` | force a theme (handy for sharing a preview) |
| `?lang=ar` / `?lang=en` | force a language |
| `#book` or `?book=1` | open the booking flow straight away — use it for ads, bio links, a reception QR code |

## Booking

Runs in **demo mode** until an n8n webhook is configured: the booking is kept in the browser and
WhatsApp opens prefilled, so it demos fully offline. Set `webhookUrl` at the top of
`assets/js/dentica-booking.js` to go live — see [`n8n/README.md`](n8n/README.md).

Working hours, break, slot length, lead time and the service list all live in that same config block.

## Still placeholder

Phone `+20 100 000 0000`, email `info@denticadental.com`, receptionist WhatsApp, and the stock
practice photography.
