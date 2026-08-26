# Dentica Booking Engine — n8n setup

The website ships a full booking flow that works **offline in demo mode**. To make it real you
connect one n8n workflow. 10 minutes of work.

## 1. Import the workflow
n8n → **Workflows → Import from File** → `dentica-booking-workflow.json`.

It contains two independent webhook flows:

| Flow | Method | Path | Does |
|---|---|---|---|
| Booking | `POST` | `/webhook/dentica-booking` | normalizes → appends a Google Sheets row → WhatsApps the receptionist → WhatsApps the patient → responds `{ok:true, ref}` |
| Free slots | `GET` | `/webhook/dentica-slots?date=YYYY-MM-DD` | reads the sheet → responds `{taken:["09:00","10:30"]}` so booked times disappear from the calendar |

## 2. Create the Google Sheet
One sheet named **`Bookings`** with this exact header row:

```
Ref | Created At | Name | Phone | Email | Service | Duration | Date | Time | Notes | First Visit | Language | Source | Status
```

Copy the spreadsheet ID from its URL and replace **`PUT_YOUR_GOOGLE_SHEET_ID_HERE`** in both
Google Sheets nodes. Attach your Google Sheets OAuth2 credential.

## 3. Wire Evolution API (WhatsApp)
In both HTTP Request nodes replace:

- `EVOLUTION_HOST` → your Evolution instance host (e.g. `evolution.yourdomain.com`)
- `EVOLUTION_INSTANCE` → the instance name
- `PUT_YOUR_EVOLUTION_API_KEY` → the API key (header `apikey`)
- in **WhatsApp — Receptionist**, `number: '201000000000'` → the receptionist's real WhatsApp

The patient-confirmation node is set to `continueRegularOutput`, so a wrong patient number can never
block the booking or the receptionist alert.

## 4. Activate and copy the URLs
Activate the workflow, then copy the two **Production** URLs and paste them into
`assets/js/dentica-booking.js` (top of the file):

```js
webhookUrl: 'https://your-n8n.com/webhook/dentica-booking',
slotsUrl:   'https://your-n8n.com/webhook/dentica-slots',
receptionistWhatsapp: '201XXXXXXXXX',
```

The moment `webhookUrl` is set, the demo banner disappears and bookings go to the sheet.

## 5. Everything else lives in that same config block
Working hours per weekday, lunch break, slot length, lead time, how far ahead the calendar opens,
and the service list (id / English / Arabic / duration). Change them there — no other file to touch.

```js
hours: { 0:['09:30','17:30'], 1:['08:00','17:00'], … },   // 0 = Sunday, null = closed
breakTime: ['13:00','14:00'],
slotStep: 30,        // minutes between slot starts
leadTimeHours: 2,    // no booking closer than 2h from now
daysAhead: 45,
```

## Payload the site sends

```json
{
  "ref": "DEN-726240-24", "name": "Ahmed Khaled", "phone": "01012345678",
  "email": "", "notes": "ألم في الضرس", "firstVisit": true,
  "serviceId": "preventive", "serviceName": "الطب الوقائي", "serviceEn": "Preventive dentistry",
  "duration": 30, "date": "2026-08-28", "time": "08:00", "startsAt": "2026-08-28T08:00:00",
  "lang": "ar", "source": "index.html", "createdAt": "2026-08-26T…Z"
}
```

## Failure behaviour (deliberate)
If n8n is unreachable the widget shows an error **and opens a prefilled WhatsApp to the
receptionist with the full booking details** — a lead is never lost because a server is down.

## Ideas for later
- A `Status` column already exists: `New → Confirmed → Done → Cancelled`. Cancelled rows are
  ignored by the slots endpoint, so freeing a slot is one cell edit.
- Add a Schedule Trigger that reads tomorrow's rows and sends WhatsApp reminders 24h ahead.
- Swap Google Sheets for Supabase when volume grows — only the two sheet nodes change.
