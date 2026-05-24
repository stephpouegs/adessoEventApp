#!/usr/bin/env python3
"""Update adessoEventApp Confluence documentation to reflect current implementation state."""

import json
import os
import sys
import urllib.request
import urllib.parse
import urllib.error

BASE_URL = "https://confluence.adesso.de"
TOKEN = os.environ.get("CONFLUENCE_TOKEN", "")
if not TOKEN:
    print("ERROR: CONFLUENCE_TOKEN environment variable is not set.")
    print("  Set it with: $env:CONFLUENCE_TOKEN='your-token'  (PowerShell)")
    sys.exit(1)
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}
PARENT_ID = "1072933230"

PAGE_IDS = {
    "brief": "1072933231",
    "prd":   "1072933232",
    "arch":  "1072933234",
    "ux":    "1072933242",
}


def api(method: str, path: str, body: dict | None = None):
    url = BASE_URL + path
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code} on {method} {path}: {e.read().decode()[:300]}")
        return None


def get_version(page_id: str) -> int:
    d = api("GET", f"/rest/api/content/{page_id}?expand=version")
    return d["version"]["number"] if d else 1


def update_page(page_id: str, title: str, body_html: str):
    v = get_version(page_id)
    payload = {
        "id": page_id,
        "type": "page",
        "title": title,
        "version": {"number": v + 1},
        "body": {"storage": {"value": body_html, "representation": "storage"}},
    }
    result = api("PUT", f"/rest/api/content/{page_id}", payload)
    if result:
        print(f"  OK Updated '{title}' -> version {v + 1}")
    else:
        print(f"  FAILED to update '{title}'")


def create_page(parent_id: str, title: str, body_html: str):
    payload = {
        "type": "page",
        "title": title,
        "ancestors": [{"id": parent_id}],
        "space": {"key": "IT"},
        "body": {"storage": {"value": body_html, "representation": "storage"}},
    }
    result = api("POST", "/rest/api/content", payload)
    if result:
        print(f"  OK Created '{title}' (ID: {result['id']})")
    else:
        print(f"  FAILED to create '{title}'")


def find_page_by_title(space_key: str, title: str) -> str | None:
    """Return the page ID if a page with this title exists in the space, else None."""
    encoded_title = urllib.parse.quote(title)
    result = api("GET", f"/rest/api/content?spaceKey={space_key}&title={encoded_title}&expand=version")
    if result and result.get("results"):
        return result["results"][0]["id"]
    return None


def create_or_update_page(parent_id: str, space_key: str, title: str, body_html: str):
    """Update the page if it already exists, otherwise create it."""
    existing_id = find_page_by_title(space_key, title)
    if existing_id:
        print(f"  Page '{title}' already exists (ID: {existing_id}) — updating instead.")
        update_page(existing_id, title, body_html)
    else:
        create_page(parent_id, title, body_html)


# ─── Page content ─────────────────────────────────────────────────────────────

BRIEF_HTML = """
<h1>adessoEventApp &ndash; Project Brief v1.3</h1>
<p><em>Erstellt von: Mary (Business Analyst) &bull; Zuletzt aktualisiert: 21.05.2026</em></p>

<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p><strong>&#x1F680; Live-Demo:</strong> <a href="https://adesso-event-app.vercel.app">https://adesso-event-app.vercel.app</a><br/>
    Login mit <code>demo@adesso.de</code> &bull; <code>organizer@adesso.de</code> &bull; <code>admin@adesso.de</code></p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>1. Problemstellung</h2>
<p>adesso SE hat deutschlandweit ~10.000 Mitarbeiter verteilt auf &uuml;ber 30 Standorte. Events (Sport, Meetings, Freizeit, Training, Company Events) werden per E-Mail oder Teams-Nachrichten angek&uuml;ndigt und gehen regelm&auml;&szlig;ig unter. Es fehlt eine zentrale, mobile-freundliche Plattform, die Mitarbeiter aktiv mit relevanten Events verbindet.</p>

<h2>2. L&ouml;sungsansatz</h2>
<p>Eine Tinder-inspirierte Event-App, bei der Mitarbeiter Events per Swipe-Geste entdecken, ablehnen oder annehmen. KI-basierte Personalisierung sorgt daf&uuml;r, dass relevante Events bevorzugt angezeigt werden.</p>

<h2>3. Zielgruppe &amp; Rollen</h2>
<table>
  <tr><th>Rolle</th><th>Beschreibung</th></tr>
  <tr><td><strong>USER</strong></td><td>Normaler Mitarbeiter &ndash; entdeckt und nimmt an Events teil</td></tr>
  <tr><td><strong>ORGANIZER</strong></td><td>Berechtigung vom Admin erteilt &ndash; erstellt und verwaltet Events</td></tr>
  <tr><td><strong>ADMIN</strong></td><td>Verwaltung von Nutzern, Standorten, Systembetrieb</td></tr>
</table>

<h2>4. MVP-Kernfunktionen (implementiert)</h2>
<ul>
  <li>&#x2705; JWT-Authentifizierung (adesso-E-Mail) &ndash; SSO-ready</li>
  <li>&#x2705; Tinder-Swipe-Feed mit Stapelansicht (bis zu 3 Karten)</li>
  <li>&#x2705; KI-Scoring-Engine (aktiviert nach 5 Swipes)</li>
  <li>&#x2705; Standortbasierte Filterung (alle adesso-Gesch&auml;ftsstellen)</li>
  <li>&#x2705; Event-Detail-Modal (Bottom Sheet)</li>
  <li>&#x2705; Erstellen / Bearbeiten / Absagen von Events (Organizer/Admin)</li>
  <li>&#x2705; Admin-Dashboard (Nutzerverwaltung, Rollen, Standorte)</li>
  <li>&#x2705; Mehrsprachigkeit DE/EN (react-i18next)</li>
  <li>&#x2705; Onboarding: Standortauswahl beim ersten Login</li>
  <li>&#x2705; Zielgruppen-Targeting: Alle / Standort(e) / Business Line / CC / Bestimmte adessi</li>
  <li>&#x2705; Profil: Business Line &amp; Competence Center einstellbar</li>
  <li>&#x2705; Admin: Event-Moderationsansicht (alle Events unabh&auml;ngig vom Feed)</li>
  <li>&#x2705; 8 Standorte (inkl. M&uuml;nster mit 4 lokalen Aktivit&auml;ten)</li>
</ul>

<h2>5. Technische Rahmenbedingungen</h2>
<ul>
  <li>Nur adesso-Mitarbeiter (adesso-E-Mail-Pflicht)</li>
  <li>React 18 + TypeScript (Frontend), Node.js 20 + Express (Backend)</li>
  <li>SQLite (Entwicklung), PostgreSQL via Supabase (Produktion)</li>
  <li>DSGVO-konform: KI-Opt-in, keine externen Tracking-Dienste</li>
  <li>Skalierbar auf 10.000 Nutzer / ~1.000 gleichzeitig</li>
</ul>

<h2>6. Produktions-Deployment</h2>
<table>
  <tr><th>Dienst</th><th>Plattform</th><th>URL</th></tr>
  <tr><td>Frontend</td><td>Vercel (kostenlos)</td><td><a href="https://adesso-event-app.vercel.app">adesso-event-app.vercel.app</a></td></tr>
  <tr><td>Backend API</td><td>Render (Free Tier)</td><td>onrender.com (automatisch)</td></tr>
  <tr><td>Datenbank</td><td>Supabase PostgreSQL (kostenlos)</td><td>supabase.com</td></tr>
  <tr><td>Quellcode</td><td>GitHub</td><td><a href="https://github.com/stephpouegs/adessoEventApp">github.com/stephpouegs/adessoEventApp</a></td></tr>
</table>
"""

PRD_HTML = """
<h1>adessoEventApp &ndash; Product Requirements Document v1.2</h1>
<p><em>Erstellt von: John (Product Manager) &bull; Zuletzt aktualisiert: 21.05.2026</em></p>
<p><strong>Status-Legende:</strong> &#x2705; Implementiert &nbsp; &#x1F504; In Arbeit &nbsp; &#x23F3; Geplant</p>

<h2>Epic 1: Authentifizierung &amp; Nutzerprofil</h2>
<table>
  <tr><th>ID</th><th>User Story</th><th>Status</th><th>Akzeptanzkriterien</th></tr>
  <tr>
    <td><strong>US-001</strong></td>
    <td>Als Mitarbeiter m&ouml;chte ich mich mit meiner adesso-E-Mail anmelden, um auf die App zuzugreifen.</td>
    <td>&#x2705;</td>
    <td>JWT-Login implementiert; Token in LocalStorage; /auth/me validiert Token; falsche E-Mail wird abgelehnt</td>
  </tr>
  <tr>
    <td><strong>US-002</strong></td>
    <td>Als neuer Nutzer m&ouml;chte ich beim ersten Login meinen Standort ausw&auml;hlen, damit ich relevante Events sehe.</td>
    <td>&#x2705;</td>
    <td>LocationPicker-Screen wenn locationId = null; Suchfeld; Radio-Auswahl; PUT /user/location; Weiterleitung zum Feed</td>
  </tr>
  <tr>
    <td><strong>US-003</strong></td>
    <td>Als Nutzer m&ouml;chte ich meine Sprache (DE/EN) in den Einstellungen &auml;ndern k&ouml;nnen.</td>
    <td>&#x2705;</td>
    <td>PUT /user/settings mit language-Feld; react-i18next wechselt sofort; Einstellung wird gespeichert</td>
  </tr>
  <tr>
    <td><strong>US-004</strong></td>
    <td>Als Nutzer m&ouml;chte ich der KI-Personalisierung zustimmen oder ablehnen k&ouml;nnen (DSGVO).</td>
    <td>&#x2705;</td>
    <td>aiOptIn-Flag in User-Tabelle; PUT /user/settings; Scoring nur wenn aiOptIn = true</td>
  </tr>
  <tr>
    <td><strong>US-005</strong></td>
    <td>Als Nutzer m&ouml;chte ich meine Business Line und mein Competence Center im Profil angeben, damit ich relevante Events erhalte.</td>
    <td>&#x2705;</td>
    <td>businessLine + competenceCenter Felder in User-Tabelle; PUT /user/settings; Profilseite zeigt Eingabefelder; Events mit BL/CC-Zielgruppe werden nur sichtbaren Nutzern angezeigt</td>
  </tr>
</table>

<h2>Epic 2: Event-Feed &amp; Swipe</h2>
<table>
  <tr><th>ID</th><th>User Story</th><th>Status</th><th>Akzeptanzkriterien</th></tr>
  <tr>
    <td><strong>US-101</strong></td>
    <td>Als Nutzer m&ouml;chte ich Events als Karten-Stapel sehen und per Swipe reagieren.</td>
    <td>&#x2705;</td>
    <td>Stapelansicht mit 3 Karten; Swipe rechts = Zusagen, links = Ablehnen; Animation mit @react-spring; POST /swipe</td>
  </tr>
  <tr>
    <td><strong>US-102</strong></td>
    <td>Als Nutzer m&ouml;chte ich Tinder-Stil-Schaltfl&auml;chen zum Bedienen des Feeds nutzen.</td>
    <td>&#x2705;</td>
    <td>4 Buttons: &#x27F2; Reload | &times; Ablehnen | &hearts; Zusagen | &#x1F4CD; Google Maps; Animations-Trigger &uuml;ber topCardRef</td>
  </tr>
  <tr>
    <td><strong>US-103</strong></td>
    <td>Als Nutzer m&ouml;chte ich Feedback erhalten, wenn ich ein Event swipe.</td>
    <td>&#x2705;</td>
    <td>Toast-Benachrichtigung: gr&uuml;n bei Zusagen (&hearts; Du nimmst teil), grau bei Ablehnen; 2,5 Sekunden sichtbar</td>
  </tr>
  <tr>
    <td><strong>US-104</strong></td>
    <td>Als Nutzer m&ouml;chte ich auf eine Karte tippen, um mehr Details zu sehen.</td>
    <td>&#x2705;</td>
    <td>Tap &ouml;ffnet EventDetail Bottom Sheet; zeigt Beschreibung, Datum, Uhrzeit, Standort, Teilnehmer, Organisator; NOPE/LIKE-Buttons schlie&szlig;en Modal und triggern Swipe-Animation</td>
  </tr>
  <tr>
    <td><strong>US-105</strong></td>
    <td>Als Nutzer m&ouml;chte ich LIKE/NOPE-Stempel w&auml;hrend des Swipe-Vorgangs sehen.</td>
    <td>&#x2705;</td>
    <td>LIKE-Stempel (gr&uuml;n, links gedreht) beim Rechts-Swipe; NOPE-Stempel (rot, rechts gedreht) beim Links-Swipe; Deckkraft proportional zur Drag-Weite</td>
  </tr>
  <tr>
    <td><strong>US-106</strong></td>
    <td>Als Nutzer m&ouml;chte ich sehen, wie viele Pl&auml;tze noch frei sind.</td>
    <td>&#x2705;</td>
    <td>EventDetail zeigt Teilnehmerzahl; orange Warnung bei &le;3 freie Pl&auml;tze; rot &ldquo;Ausgebucht&rdquo; wenn voll; Zusagen-Button deaktiviert bei vollen Events</td>
  </tr>
</table>

<h2>Epic 3: Event-Erstellung (Organizer)</h2>
<table>
  <tr><th>ID</th><th>User Story</th><th>Status</th><th>Akzeptanzkriterien</th></tr>
  <tr>
    <td><strong>US-201</strong></td>
    <td>Als Organisator m&ouml;chte ich neue Events erstellen k&ouml;nnen.</td>
    <td>&#x2705;</td>
    <td>POST /events; Felder: Titel, Beschreibung, Typ, Standort, Datum, Teilnehmerlimit, Hinweise; Validierung via Zod; Datum darf nicht in Vergangenheit liegen</td>
  </tr>
  <tr>
    <td><strong>US-202</strong></td>
    <td>Als Organisator m&ouml;chte ich eigene Events bearbeiten k&ouml;nnen.</td>
    <td>&#x2705;</td>
    <td>PUT /events/:id; nur Ersteller oder Admin; partielle Updates m&ouml;glich</td>
  </tr>
  <tr>
    <td><strong>US-203</strong></td>
    <td>Als Organisator m&ouml;chte ich Events absagen k&ouml;nnen.</td>
    <td>&#x2705;</td>
    <td>DELETE /events/:id setzt Status auf CANCELLED; nur Ersteller oder Admin; 204 No Content</td>
  </tr>
  <tr>
    <td><strong>US-204</strong></td>
    <td>Als Organisator m&ouml;chte ich beim Erstellen eines Events eine Zielgruppe festlegen: Alle / Standort(e) / Business Line / Competence Center / Bestimmte adessi.</td>
    <td>&#x2705;</td>
    <td>audienceType (ALL/LOCATION/BUSINESS_LINE/CC/SPECIFIC) + audienceValue im Event-Formular; LOCATION: Checkbox-Multi-Select; SPECIFIC: E-Mail-Eingabe; Feed-Filterung serverseitig via isVisibleToUser()</td>
  </tr>
  <tr>
    <td><strong>US-205</strong></td>
    <td>Als Admin m&ouml;chte ich alle Events zur Moderation in einer Liste sehen (nicht als Feed).</td>
    <td>&#x2705;</td>
    <td>GET /events/admin/all; keine Feed-Filter; alle Status; Teilnehmerzahl sichtbar</td>
  </tr>
</table>

<h2>Epic 4: Admin-Dashboard</h2>
<table>
  <tr><th>ID</th><th>User Story</th><th>Status</th><th>Akzeptanzkriterien</th></tr>
  <tr>
    <td><strong>US-301</strong></td>
    <td>Als Admin m&ouml;chte ich alle Nutzer sehen und Rollen vergeben.</td>
    <td>&#x2705;</td>
    <td>GET /admin/users; PUT /admin/users/:id/role; Rollen: USER, ORGANIZER, ADMIN</td>
  </tr>
  <tr>
    <td><strong>US-302</strong></td>
    <td>Als Admin m&ouml;chte ich Standorte verwalten.</td>
    <td>&#x2705;</td>
    <td>GET /admin/locations; POST /admin/locations; PUT /admin/locations/:id; DELETE /admin/locations/:id</td>
  </tr>
  <tr>
    <td><strong>US-303</strong></td>
    <td>Als Admin m&ouml;chte ich Systemstatistiken sehen.</td>
    <td>&#x2705;</td>
    <td>GET /admin/stats: Gesamtnutzer, Events gesamt/aktiv, Swipes heute, Teilnahmen gesamt</td>
  </tr>
</table>

<h2>Epic 5: Mehrsprachigkeit</h2>
<table>
  <tr><th>ID</th><th>User Story</th><th>Status</th><th>Akzeptanzkriterien</th></tr>
  <tr>
    <td><strong>US-401</strong></td>
    <td>Als Nutzer m&ouml;chte ich die App auf Deutsch und Englisch nutzen k&ouml;nnen.</td>
    <td>&#x2705;</td>
    <td>react-i18next; alle UI-Texte &uuml;bersetzt; Sprachwechsel sofort wirksam; Standard: Deutsch</td>
  </tr>
</table>

<h2>Epic 6: Microsoft-Integration</h2>
<table>
  <tr><th>ID</th><th>User Story</th><th>Status</th><th>Akzeptanzkriterien</th></tr>
  <tr>
    <td><strong>US-601</strong></td>
    <td>Als Mitarbeiter m&ouml;chte ich, dass zugesagte Events automatisch in meinen Outlook-Kalender eingetragen werden (Microsoft Graph API).</td>
    <td>&#x1F504;</td>
    <td>OAuth-Verbindung im Profil; Swipe-Right legt Termin an; Swipe-Left l&ouml;scht Termin; Token-Refresh automatisch; kein Fehler f&uuml;r Nutzer ohne Verbindung; Jira: AAPE-258</td>
  </tr>
</table>

<h2>Nicht-funktionale Anforderungen</h2>
<table>
  <tr><th>Kategorie</th><th>Anforderung</th><th>Status</th></tr>
  <tr><td>Performance</td><td>API-Antwortzeit &lt;500ms p95</td><td>&#x2705; (SQLite/Express)</td></tr>
  <tr><td>Skalierbarkeit</td><td>~1.000 gleichzeitige Nutzer</td><td>&#x23F3; (f&uuml;r PostgreSQL-Prod)</td></tr>
  <tr><td>Verf&uuml;gbarkeit</td><td>99,5% Uptime</td><td>&#x23F3; (Prod-Deployment)</td></tr>
  <tr><td>DSGVO</td><td>KI-Opt-in, keine externen Tracker</td><td>&#x2705;</td></tr>
  <tr><td>Sicherheit</td><td>JWT, RBAC, Zod-Validierung</td><td>&#x2705;</td></tr>
</table>

<h2>Test-Accounts (Seed-Daten)</h2>
<table>
  <tr><th>E-Mail</th><th>Passwort</th><th>Rolle</th></tr>
  <tr><td>demo@adesso.de</td><td>demo123</td><td>USER</td></tr>
  <tr><td>organizer@adesso.de</td><td>demo123</td><td>ORGANIZER</td></tr>
  <tr><td>admin@adesso.de</td><td>demo123</td><td>ADMIN</td></tr>
</table>
"""

ARCH_HTML = """
<h1>adessoEventApp &ndash; Architecture Document v1.4</h1>
<p><em>Erstellt von: Winston (System Architect) &bull; Zuletzt aktualisiert: 22.05.2026</em></p>

<h2>1. Systemarchitektur &ndash; &Uuml;bersicht</h2>

<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;">
<tbody>

  <!-- Benutzer -->
  <tr>
    <td colspan="3" style="text-align:center;padding:12px 0;">
      <table style="margin:0 auto;border:2px solid #374151;border-radius:10px;background:#F9FAFB;width:320px;">
        <tr><td style="padding:12px;text-align:center;">
          <div style="font-size:28px;">&#x1F4BB; &#x1F4F1;</div>
          <div style="font-weight:bold;font-size:14px;color:#111827;">Benutzer</div>
          <div style="font-size:12px;color:#6B7280;">Browser &bull; Handy &bull; Tablet</div>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- Pfeil 1 -->
  <tr>
    <td colspan="3" style="text-align:center;padding:4px;font-size:22px;color:#0D3B6E;">&#x2193;</td>
  </tr>
  <tr>
    <td colspan="3" style="text-align:center;padding:0 0 4px 0;">
      <span style="background:#DBEAFE;color:#1D4ED8;border-radius:12px;padding:2px 12px;font-size:11px;font-weight:bold;">HTTPS &bull; Browser-Request</span>
    </td>
  </tr>

  <!-- Vercel Frontend -->
  <tr>
    <td colspan="3" style="text-align:center;padding:12px 0;">
      <table style="margin:0 auto;border:3px solid #0D3B6E;border-radius:10px;background:#EFF6FF;width:420px;">
        <tr><td style="padding:14px;text-align:center;">
          <div style="font-weight:bold;font-size:15px;color:#0D3B6E;">&#x25B2; VERCEL &mdash; Frontend</div>
          <div style="font-size:13px;color:#1E40AF;margin:4px 0;"><strong>adesso-event-app.vercel.app</strong></div>
          <div style="font-size:11px;color:#374151;margin-top:6px;">
            React 18 &bull; TypeScript &bull; Vite &bull; Tailwind CSS<br/>
            Zustand (State) &bull; Axios &bull; react-spring &bull; i18n DE/EN
          </div>
          <div style="margin-top:8px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
            <span style="background:#DBEAFE;color:#1E40AF;border-radius:4px;padding:2px 6px;font-size:10px;">SwipeCard</span>
            <span style="background:#DBEAFE;color:#1E40AF;border-radius:4px;padding:2px 6px;font-size:10px;">EventFeed</span>
            <span style="background:#DBEAFE;color:#1E40AF;border-radius:4px;padding:2px 6px;font-size:10px;">EventDetail</span>
            <span style="background:#DBEAFE;color:#1E40AF;border-radius:4px;padding:2px 6px;font-size:10px;">AdminPanel</span>
            <span style="background:#DBEAFE;color:#1E40AF;border-radius:4px;padding:2px 6px;font-size:10px;">OrganizerDashboard</span>
          </div>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- Pfeil 2 -->
  <tr>
    <td colspan="3" style="text-align:center;padding:4px;font-size:22px;color:#0D3B6E;">&#x2193;</td>
  </tr>
  <tr>
    <td colspan="3" style="text-align:center;padding:0 0 4px 0;">
      <span style="background:#D1FAE5;color:#065F46;border-radius:12px;padding:2px 12px;font-size:11px;font-weight:bold;">REST API &bull; HTTPS &bull; JSON &bull; Bearer JWT</span>
    </td>
  </tr>

  <!-- Render Backend -->
  <tr>
    <td colspan="3" style="text-align:center;padding:12px 0;">
      <table style="margin:0 auto;border:3px solid #059669;border-radius:10px;background:#ECFDF5;width:500px;">
        <tr><td style="padding:14px;text-align:center;">
          <div style="font-weight:bold;font-size:15px;color:#065F46;">&#x25B2; RENDER &mdash; Backend API</div>
          <div style="font-size:13px;color:#065F46;margin:4px 0;"><strong>*.onrender.com</strong></div>
          <div style="font-size:11px;color:#374151;margin-top:6px;">
            Node.js 20 &bull; Express 4 &bull; TypeScript &bull; Prisma 5
          </div>
          <div style="margin-top:8px;">
            <table style="margin:0 auto;font-size:10px;border-collapse:collapse;">
              <tr>
                <td style="background:#D1FAE5;color:#065F46;border-radius:4px;padding:3px 8px;margin:2px;">POST /auth/callback</td>
                <td style="width:8px;"></td>
                <td style="background:#D1FAE5;color:#065F46;border-radius:4px;padding:3px 8px;">GET /events/feed</td>
                <td style="width:8px;"></td>
                <td style="background:#D1FAE5;color:#065F46;border-radius:4px;padding:3px 8px;">POST /swipe</td>
              </tr>
              <tr><td style="height:4px;"></td></tr>
              <tr>
                <td style="background:#D1FAE5;color:#065F46;border-radius:4px;padding:3px 8px;">DELETE /swipe/:id</td>
                <td style="width:8px;"></td>
                <td style="background:#D1FAE5;color:#065F46;border-radius:4px;padding:3px 8px;">POST /events</td>
                <td style="width:8px;"></td>
                <td style="background:#D1FAE5;color:#065F46;border-radius:4px;padding:3px 8px;">GET /admin/stats</td>
              </tr>
            </table>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#374151;">
            JWT-Auth &bull; RBAC Middleware &bull; Zod-Validierung &bull; KI-Scoring-Engine &bull; Rate Limiting
          </div>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- Pfeil 3 -->
  <tr>
    <td colspan="3" style="text-align:center;padding:4px;font-size:22px;color:#0D3B6E;">&#x2193;</td>
  </tr>
  <tr>
    <td colspan="3" style="text-align:center;padding:0 0 4px 0;">
      <span style="background:#FEF3C7;color:#92400E;border-radius:12px;padding:2px 12px;font-size:11px;font-weight:bold;">PostgreSQL &bull; SSL &bull; Supavisor Pooler &bull; Port 6543</span>
    </td>
  </tr>

  <!-- Supabase -->
  <tr>
    <td colspan="3" style="text-align:center;padding:12px 0;">
      <table style="margin:0 auto;border:3px solid #D97706;border-radius:10px;background:#FFFBEB;width:420px;">
        <tr><td style="padding:14px;text-align:center;">
          <div style="font-weight:bold;font-size:15px;color:#92400E;">&#x25B2; SUPABASE &mdash; Datenbank</div>
          <div style="font-size:13px;color:#92400E;margin:4px 0;"><strong>PostgreSQL 16 &bull; Region: eu-west-1</strong></div>
          <div style="font-size:11px;color:#374151;margin-top:6px;">
            Supavisor Connection Pooler &bull; SSL erzwungen
          </div>
          <div style="margin-top:8px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
            <span style="background:#FEF3C7;color:#92400E;border-radius:4px;padding:2px 8px;font-size:10px;">User</span>
            <span style="background:#FEF3C7;color:#92400E;border-radius:4px;padding:2px 8px;font-size:10px;">Location</span>
            <span style="background:#FEF3C7;color:#92400E;border-radius:4px;padding:2px 8px;font-size:10px;">Event</span>
            <span style="background:#FEF3C7;color:#92400E;border-radius:4px;padding:2px 8px;font-size:10px;">Swipe</span>
            <span style="background:#FEF3C7;color:#92400E;border-radius:4px;padding:2px 8px;font-size:10px;">Attendance</span>
          </div>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- GitHub -->
  <tr>
    <td colspan="3" style="text-align:center;padding:16px 0 8px 0;">
      <hr style="border:1px dashed #D1D5DB;margin:0 80px 12px 80px;"/>
      <table style="margin:0 auto;border:2px solid #374151;border-radius:10px;background:#F3F4F6;width:340px;">
        <tr><td style="padding:10px;text-align:center;">
          <div style="font-weight:bold;font-size:13px;color:#111827;">&#x1F4E6; GITHUB &mdash; Quellcode</div>
          <div style="font-size:11px;color:#374151;margin-top:4px;">
            github.com/stephpouegs/adessoEventApp<br/>
            <em>Automatisches Deployment bei Push auf master</em>
          </div>
          <div style="margin-top:6px;font-size:10px;">
            <span style="background:#E5E7EB;color:#374151;border-radius:4px;padding:2px 6px;">&#x2192; Render</span>
            &nbsp;
            <span style="background:#E5E7EB;color:#374151;border-radius:4px;padding:2px 6px;">&#x2192; Vercel</span>
          </div>
        </td></tr>
      </table>
    </td>
  </tr>

</tbody>
</table>

<h2>2. Architekturmuster</h2>
<p><strong>Modular Monolith</strong> &ndash; ein Backend-Prozess mit klar getrennten Modulen (Routes, Services, Middleware). Einfach zu deployen, bei Bedarf in Microservices aufteilbar.</p>

<h2>2. Tech-Stack (implementiert)</h2>
<table>
  <tr><th>Schicht</th><th>Technologie</th><th>Version</th></tr>
  <tr><td>Frontend</td><td>React + TypeScript + Vite + Tailwind CSS</td><td>React 18, Vite 5</td></tr>
  <tr><td>State</td><td>Zustand (persistiert via localStorage)</td><td>4.x</td></tr>
  <tr><td>Animationen</td><td>@react-spring/web + @use-gesture/react</td><td>9.x</td></tr>
  <tr><td>i18n</td><td>react-i18next</td><td>14.x</td></tr>
  <tr><td>HTTP-Client</td><td>Axios</td><td>1.x</td></tr>
  <tr><td>Backend</td><td>Node.js + Express + TypeScript</td><td>Node 22, Express 4</td></tr>
  <tr><td>ORM</td><td>Prisma</td><td>5.x</td></tr>
  <tr><td>DB (Dev)</td><td>SQLite (file:./dev.db)</td><td>&ndash;</td></tr>
  <tr><td>DB (Prod)</td><td>PostgreSQL via Supabase</td><td>16</td></tr>
  <tr><td>Hosting Frontend</td><td>Vercel</td><td>&ndash;</td></tr>
  <tr><td>Hosting Backend</td><td>Render</td><td>&ndash;</td></tr>
  <tr><td>Validierung</td><td>Zod</td><td>3.x</td></tr>
  <tr><td>Auth</td><td>JWT (jsonwebtoken + bcrypt)</td><td>&ndash;</td></tr>
</table>

<h2>3. Monorepo-Struktur</h2>
<pre>
adessoEventApp/
&#x251C;&#x2500;&#x2500; frontend/          # React-App
&#x2502;   &#x251C;&#x2500;&#x2500; src/
&#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; components/    # SwipeCard, EventFeed, EventDetail, LocationPicker, ...
&#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; store/         # auth.ts (Zustand)
&#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; api/           # client.ts (Axios)
&#x2502;   &#x2502;   &#x2514;&#x2500;&#x2500; i18n/          # de.json, en.json
&#x2502;   &#x2514;&#x2500;&#x2500; index.html
&#x251C;&#x2500;&#x2500; backend/
&#x2502;   &#x251C;&#x2500;&#x2500; src/
&#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; routes/        # auth, events, swipe, user, admin, microsoft
&#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; middleware/    # auth.ts (JWT + RBAC)
&#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; services/      # recommendation.ts (KI), calendarService.ts (Graph API)
&#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; prisma/        # schema.prisma, seed.ts, reset.ts
&#x2502;   &#x2502;   &#x2514;&#x2500;&#x2500; index.ts
&#x2502;   &#x251C;&#x2500;&#x2500; nixpacks.toml  # Render-Deployment-Konfiguration
&#x2502;   &#x2514;&#x2500;&#x2500; .env.example
&#x251C;&#x2500;&#x2500; frontend/
&#x2502;   &#x2514;&#x2500;&#x2500; vercel.json    # Vercel SPA-Routing-Konfiguration
&#x2514;&#x2500;&#x2500; _bmad-output/      # BMAD-Planungsartefakte
</pre>

<h2>4. Datenbankschema</h2>
<table>
  <tr><th>Tabelle</th><th>Schl&uuml;sselfelder</th></tr>
  <tr><td><strong>User</strong></td><td>id, email, name, passwordHash, role (USER/ORGANIZER/ADMIN), locationId, language, aiOptIn, businessLine, competenceCenter, <strong>msAccessToken</strong>, <strong>msRefreshToken</strong>, <strong>msTokenExpiry</strong></td></tr>
  <tr><td><strong>Location</strong></td><td>id, name, city, address (8 Standorte inkl. M&uuml;nster)</td></tr>
  <tr><td><strong>Event</strong></td><td>id, title, description, type, status, startDate, endDate, locationId, organizerId, maxAttendees, notes, imageUrl, audienceType (ALL/LOCATION/BUSINESS_LINE/CC/SPECIFIC), audienceValue (JSON f&uuml;r LOCATION/SPECIFIC)</td></tr>
  <tr><td><strong>Swipe</strong></td><td>id, userId, eventId, direction (RIGHT/LEFT), createdAt</td></tr>
  <tr><td><strong>Attendance</strong></td><td>id, userId, eventId, status (CONFIRMED/WAITLIST), <strong>calendarEventId</strong> (Outlook Graph API Event-ID)</td></tr>
</table>
<p><strong>Sprint 6 &ndash; Migration 20260522000000_ms_calendar:</strong> Neue Felder <code>msAccessToken</code>, <code>msRefreshToken</code>, <code>msTokenExpiry</code> auf User; <code>calendarEventId</code> auf Attendance.</p>
<p><strong>Hinweis:</strong> In der Entwicklungsumgebung werden Enums als String-Felder gespeichert (SQLite-Kompatibilit&auml;t). In Produktion mit PostgreSQL k&ouml;nnen native Enums verwendet werden.</p>

<h2>5. API-Endpunkte</h2>
<table>
  <tr><th>Methode</th><th>Pfad</th><th>Rolle</th><th>Beschreibung</th></tr>
  <tr><td>POST</td><td>/auth/register</td><td>&ouml;ffentlich</td><td>Nutzer registrieren</td></tr>
  <tr><td>POST</td><td>/auth/login</td><td>&ouml;ffentlich</td><td>Login, gibt JWT zur&uuml;ck</td></tr>
  <tr><td>GET</td><td>/auth/me</td><td>USER+</td><td>Aktueller Nutzer</td></tr>
  <tr><td>GET</td><td>/events/feed</td><td>USER+</td><td>Personalisierter Event-Feed (KI-sortiert)</td></tr>
  <tr><td>GET</td><td>/events/:id</td><td>USER+</td><td>Event-Details</td></tr>
  <tr><td>POST</td><td>/events</td><td>ORGANIZER+</td><td>Event erstellen</td></tr>
  <tr><td>PUT</td><td>/events/:id</td><td>ORGANIZER+</td><td>Event bearbeiten</td></tr>
  <tr><td>DELETE</td><td>/events/:id</td><td>ORGANIZER+</td><td>Event absagen (Status = CANCELLED)</td></tr>
  <tr><td>GET</td><td>/events/my</td><td>ORGANIZER+</td><td>Eigene erstellte Events mit Teilnehmerzahl</td></tr>
  <tr><td>GET</td><td>/events/admin/all</td><td>ADMIN</td><td>Alle Events zur Moderation (kein Feed-Filter)</td></tr>
  <tr><td>POST</td><td>/swipe</td><td>USER+</td><td>Swipe registrieren (RIGHT/LEFT), Attendance anlegen</td></tr>
  <tr><td>DELETE</td><td>/swipe/:eventId</td><td>USER+</td><td>Swipe r&uuml;ckg&auml;ngig machen (Undo) &ndash; l&ouml;scht Swipe + Attendance</td></tr>
  <tr><td>PUT</td><td>/user/location</td><td>USER+</td><td>Standort setzen (Onboarding)</td></tr>
  <tr><td>PUT</td><td>/user/settings</td><td>USER+</td><td>Sprache, KI-Opt-in, Standort &auml;ndern</td></tr>
  <tr><td>GET</td><td>/admin/users</td><td>ADMIN</td><td>Alle Nutzer auflisten</td></tr>
  <tr><td>PUT</td><td>/admin/users/:id/role</td><td>ADMIN</td><td>Rolle vergeben</td></tr>
  <tr><td>GET</td><td>/admin/locations</td><td>USER+</td><td>Alle Standorte auflisten</td></tr>
  <tr><td>POST</td><td>/admin/locations</td><td>ADMIN</td><td>Standort anlegen</td></tr>
  <tr><td>GET</td><td>/admin/stats</td><td>ADMIN</td><td>Systemstatistiken</td></tr>
</table>

<h2>6. KI-Scoring-Engine</h2>
<p>Datei: <code>backend/src/services/recommendation.ts</code></p>
<p>Aktiviert sich nach mindestens 5 Swipes des Nutzers (Kalt-Start-Schutz).</p>
<table>
  <tr><th>Signal</th><th>Punkte</th></tr>
  <tr><td>Standort-Match (User-Standort = Event-Standort)</td><td>+3,0</td></tr>
  <tr><td>Bevorzugter Event-Typ (aus bisherigen Right-Swipes)</td><td>+0,5 pro Swipe, max +2,0</td></tr>
  <tr><td>Neu erstellt (&lt;24h)</td><td>+1,0</td></tr>
  <tr><td>Bald stattfindend (&lt;3 Tage)</td><td>+0,5</td></tr>
  <tr><td>H&auml;ufig abgelehnter Typ (Left-Swipes)</td><td>&minus;0,5 pro Swipe, max &minus;2,0</td></tr>
</table>

<h2>7. Sicherheit</h2>
<ul>
  <li><strong>Authentifizierung:</strong> JWT (Bearer Token, 7 Tage G&uuml;ltigkeit)</li>
  <li><strong>RBAC:</strong> requireRole-Middleware pr&uuml;ft Rolle bei jedem gesch&uuml;tzten Endpunkt</li>
  <li><strong>Validierung:</strong> Zod-Schema bei allen POST/PUT-Endpunkten</li>
  <li><strong>Passwort:</strong> bcrypt (Saltrunden = 10)</li>
  <li><strong>CORS:</strong> konfiguriert f&uuml;r Frontend-Origin</li>
</ul>

<h2>8. Deployment (Produktion)</h2>
<table>
  <tr><th>Dienst</th><th>Plattform</th><th>Details</th></tr>
  <tr>
    <td><strong>Frontend</strong></td>
    <td>Vercel (Free)</td>
    <td>Root: <code>frontend/</code> &bull; vercel.json mit SPA-Rewrite &bull; Env: <code>VITE_API_URL</code></td>
  </tr>
  <tr>
    <td><strong>Backend</strong></td>
    <td>Render (Free)</td>
    <td>Root: <code>backend/</code> &bull; nixpacks.toml &bull; Env: <code>DATABASE_URL</code>, <code>JWT_SECRET</code>, <code>FRONTEND_URL</code></td>
  </tr>
  <tr>
    <td><strong>Datenbank</strong></td>
    <td>Supabase PostgreSQL (Free)</td>
    <td>Region: eu-west-1 &bull; Verbindung &uuml;ber Supavisor Transaction Pooler (Port 6543)</td>
  </tr>
</table>

<h3>Deployment-Ablauf (einmalig)</h3>
<ol>
  <li>Code auf GitHub pushen (<code>git push origin master</code>)</li>
  <li>Supabase: Projekt anlegen, Datenbank-URL kopieren</li>
  <li>Render: Web Service aus GitHub-Repo &rarr; Root <code>backend/</code> &rarr; Env-Variablen eintragen</li>
  <li>Vercel: Projekt aus GitHub-Repo &rarr; Root <code>frontend/</code> &rarr; <code>VITE_API_URL</code> = Render-URL</li>
  <li>Render: <code>FRONTEND_URL</code> = Vercel-URL nachtr&auml;glich setzen</li>
</ol>

<h3>Testdaten wiederherstellen</h3>
<pre>
cd backend
$env:DATABASE_URL="postgresql://postgres.PROJECT-REF:PASSWORT@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
npx ts-node --project tsconfig.json src/prisma/reset.ts
</pre>
<p><strong>Hinweis:</strong> <code>?pgbouncer=true</code> ist erforderlich, da Supabase den Supavisor Transaction Pooler verwendet. Ohne dieses Flag entstehen Fehler mit Prepared Statements (<code>42P05</code> / <code>26000</code>).</p>
<p>Alternativ: <strong>Doppelklick auf <code>reset-supabase.bat</code></strong> im Projektstamm &ndash; keine Kommandozeile n&ouml;tig.</p>

<h2>9. Zielgruppen-Targeting (Feed-Logik)</h2>
<p>Events k&ouml;nnen f&uuml;r verschiedene Zielgruppen erstellt werden. Die Sichtbarkeit wird serverseitig in <code>isVisibleToUser()</code> berechnet:</p>
<table>
  <tr><th>audienceType</th><th>audienceValue</th><th>Sichtbar f&uuml;r</th></tr>
  <tr><td>ALL</td><td>&ndash;</td><td>Alle Nutzer (standortgefiltert)</td></tr>
  <tr><td>LOCATION</td><td>JSON-Array von Location-IDs<br/><code>["loc-berlin","loc-hamburg"]</code></td><td>Nutzer dieser Standorte (standort&uuml;bergreifend)</td></tr>
  <tr><td>BUSINESS_LINE</td><td>Name der BL z.B. <code>Cross Industries</code></td><td>Nutzer mit passender businessLine</td></tr>
  <tr><td>CC</td><td>Name des CC z.B. <code>Digi Berlin 2</code></td><td>Nutzer mit passendem competenceCenter</td></tr>
  <tr><td>SPECIFIC</td><td>JSON-Array von E-Mails oder User-IDs</td><td>Explizit genannte Personen</td></tr>
</table>
<p>BL/CC/SPECIFIC-Events werden <strong>ohne Standortfilter</strong> gefetcht und dann per Profil-Abgleich gefiltert &rarr; ein Berliner BL-Mitglied sieht das BL-Event auch wenn es in M&uuml;nchen stattfindet.</p>

<h2>10. Microsoft Graph API &ndash; Outlook-Kalender-Sync</h2>
<p>Implementiert in <strong>Sprint 6</strong> (22.05.2026). Jira Epic: <strong>AAPE-258</strong>.</p>

<h3>Flow</h3>
<ol>
  <li>Nutzer klickt &laquo;Mit Microsoft verbinden&raquo; im Profil &rarr; Redirect zu <code>GET /api/microsoft/connect?token=&lt;JWT&gt;</code></li>
  <li>Backend leitet zu Azure AD OAuth 2.0 weiter (Scopes: <code>Calendars.ReadWrite offline_access User.Read</code>)</li>
  <li>Nach Consent: Azure AD sendet <code>code</code> + <code>state (JWT)</code> an Callback</li>
  <li>Backend tauscht Code gegen Access Token + Refresh Token, speichert verschl&uuml;sselt in User-Tabelle</li>
  <li>Bei Swipe-Right: <code>calendarService.addToCalendar()</code> ruft <code>POST /v1.0/me/events</code> auf</li>
  <li>Bei Swipe-Left / Undo: <code>calendarService.removeFromCalendar()</code> ruft <code>DELETE /v1.0/me/events/{id}</code> auf</li>
  <li>Abgelaufene Tokens werden automatisch per Refresh Token erneuert (5-Minuten-Buffer)</li>
</ol>

<h3>API-Endpunkte (/api/microsoft)</h3>
<table>
  <tr><th>Methode</th><th>Pfad</th><th>Beschreibung</th></tr>
  <tr><td>GET</td><td>/api/microsoft/connect?token=&lt;JWT&gt;</td><td>Startet OAuth-Flow (Redirect zu Azure AD)</td></tr>
  <tr><td>GET</td><td>/api/microsoft/callback</td><td>OAuth-Callback: tauscht Code gegen Token</td></tr>
  <tr><td>GET</td><td>/api/microsoft/status</td><td>Gibt <code>&#123; connected, expired &#125;</code> zur&uuml;ck</td></tr>
  <tr><td>DELETE</td><td>/api/microsoft/disconnect</td><td>Trennt Microsoft-Konto (l&ouml;scht Tokens)</td></tr>
</table>

<h3>Konfiguration (Umgebungsvariablen)</h3>
<table>
  <tr><th>Variable</th><th>Beschreibung</th></tr>
  <tr><td><code>MS_CLIENT_ID</code></td><td>Azure AD App-ID (aus App Registration)</td></tr>
  <tr><td><code>MS_CLIENT_SECRET</code></td><td>Azure AD Client Secret</td></tr>
  <tr><td><code>MS_TENANT_ID</code></td><td>Azure Tenant-ID oder <code>common</code> f&uuml;r Multi-Tenant</td></tr>
  <tr><td><code>MS_REDIRECT_URI</code></td><td>Muss in Azure AD als Redirect URI registriert sein: <code>{BACKEND_URL}/api/microsoft/callback</code></td></tr>
</table>

<h3>Azure AD App-Registrierung (einmalig durch Tenant-Admin)</h3>
<ol>
  <li><a href="https://portal.azure.com">portal.azure.com</a> &rarr; Azure Active Directory &rarr; App registrations &rarr; New registration</li>
  <li>Redirect URI: <code>https://[render-url]/api/microsoft/callback</code></li>
  <li>API permissions: <code>Calendars.ReadWrite</code>, <code>offline_access</code>, <code>User.Read</code> (delegated)</li>
  <li>Certificates &amp; secrets: Client Secret erstellen &rarr; in Render Env-Variable eintragen</li>
</ol>
"""

UX_HTML = """
<h1>adessoEventApp &ndash; UX Design Document v1.1</h1>
<p><em>Erstellt von: Sally (UX Designer) &bull; Zuletzt aktualisiert: 07.05.2026</em></p>

<h2>1. Design-Prinzipien</h2>
<ul>
  <li><strong>Mobile-First:</strong> Optimiert f&uuml;r Smartphones (360&ndash;430px), responsiv bis Desktop</li>
  <li><strong>Vertrautes Interaktionsmuster:</strong> Tinder-Mechanismus &ndash; intuitiv ohne Erkl&auml;rung</li>
  <li><strong>adesso Corporate Identity:</strong> Blau/Wei&szlig; konsequent eingehalten</li>
  <li><strong>Barrierefreiheit:</strong> Kontrastreiche Farben, aria-labels auf allen Buttons</li>
</ul>

<h2>2. Farbpalette</h2>
<table>
  <tr><th>Name</th><th>HEX</th><th>Verwendung</th></tr>
  <tr><td>adesso Blau (Prim&auml;r)</td><td><strong>#0D3B6E</strong></td><td>Header, Buttons, Badges, Hintergr&uuml;nde</td></tr>
  <tr><td>adesso Hellblau</td><td><strong>#1A6FBF</strong></td><td>Hover-Zust&auml;nde, Gradienten</td></tr>
  <tr><td>Wei&szlig;</td><td><strong>#FFFFFF</strong></td><td>Karten, Modals, Texte auf Blau</td></tr>
  <tr><td>Grau (Text)</td><td>#374151</td><td>Flie&szlig;text</td></tr>
  <tr><td>Gr&uuml;n (Erfolg)</td><td>#22C55E</td><td>LIKE-Stempel, Erfolgs-Toast, Swipe-rechts</td></tr>
  <tr><td>Rot (Ablehnen)</td><td>#EF4444</td><td>NOPE-Stempel, Ablehnen-Button</td></tr>
  <tr><td>Orange (Warnung)</td><td>#F97316</td><td>&ldquo;Nur noch X Pl&auml;tze&rdquo;-Hinweis</td></tr>
</table>

<h2>3. Typografie</h2>
<ul>
  <li>Schriftart: <strong>Inter</strong> (System-Font-Stack als Fallback)</li>
  <li>Titel: 24px / Bold</li>
  <li>Flie&szlig;text: 14px / Regular</li>
  <li>Labels: 12px / Medium / uppercase tracking-wide</li>
</ul>

<h2>4. Hauptscreens</h2>

<h3>4.1 Login-Screen</h3>
<ul>
  <li>adesso-Logo zentriert</li>
  <li>Dunkelblauer Hintergrund (#0D3B6E)</li>
  <li>Wei&szlig;e Input-Felder f&uuml;r E-Mail und Passwort</li>
  <li>Anmelden-Button (wei&szlig;, blauer Text)</li>
</ul>

<h3>4.2 Onboarding: Standortauswahl</h3>
<ul>
  <li>Dunkelblauer Hintergrund (#0D3B6E)</li>
  <li>&#x1F4CD;-Emoji als visueller Anker</li>
  <li>Suchfeld mit Lupe-Icon</li>
  <li>Wei&szlig;e Karte mit Radio-Auswahl (blauer Punkt bei Selektion)</li>
  <li>Weiter-Button aktiviert sich erst nach Auswahl</li>
</ul>

<h3>4.3 Event-Feed (Hauptscreen)</h3>
<ul>
  <li>Karten-Stapel (3 Karten sichtbar, perspektivisch gestaffelt)</li>
  <li>Obere Karte: vollst&auml;ndig interaktiv (Swipe + Tap)</li>
  <li>LIKE-Stempel: gr&uuml;n, 28px Bold, 25&deg; rotiert (links oben sichtbar beim Rechts-Swipe)</li>
  <li>NOPE-Stempel: rot, 28px Bold, -25&deg; rotiert (rechts oben sichtbar beim Links-Swipe)</li>
</ul>

<h3>4.4 Tinder-Stil-Buttons</h3>
<table>
  <tr><th>Button</th><th>Symbol</th><th>Gr&ouml;&szlig;e</th><th>Farbe</th><th>Aktion</th></tr>
  <tr><td>Undo / Reload</td><td>&#x27F2;</td><td>48&times;48px</td><td>Gelb (#EAB308) / Gelb-gef&uuml;llt bei Undo</td><td><strong>Kontextsensitiv:</strong> nach Swipe = Undo (pulsiert gelb); sonst = Feed neu laden</td></tr>
  <tr><td>Ablehnen</td><td>&times;</td><td>64&times;64px</td><td>Rot (#EF4444)</td><td>Links-Swipe ausl&ouml;sen (disabled bei leerem Feed)</td></tr>
  <tr><td>Zusagen</td><td>&hearts;</td><td>64&times;64px</td><td>Gr&uuml;n (#22C55E)</td><td>Rechts-Swipe ausl&ouml;sen (disabled bei leerem Feed)</td></tr>
  <tr><td>Standort</td><td>&#x1F4CD;</td><td>48&times;48px</td><td>Blau (#3B82F6)</td><td>Google Maps &ouml;ffnen (disabled bei leerem Feed)</td></tr>
</table>
<p>Alle Buttons: wei&szlig;er Hintergrund, runder Schatten, <code>active:scale-95</code> Feedback. Die Buttons sind <strong>immer sichtbar</strong>, auch wenn der Feed leer ist. &#x27F2; / Undo bleibt stets aktiv.</p>

<h3>4.5 Event-Karte</h3>
<ul>
  <li>Bild oben (wenn vorhanden), sonst Emoji-Placeholder</li>
  <li>Titel, Typ-Badge (adesso Blau), Datum, Standort, Teilnehmerzahl</li>
  <li>Abgerundete Ecken (rounded-3xl), Schatten (shadow-xl)</li>
  <li><strong>&#x24D8;-Button</strong> oben rechts im Bild-Bereich: &ouml;ffnet Beschreibungs-Popup direkt auf der Karte</li>
  <li>Popup: Blur-Hintergrund (bg-black/60 backdrop-blur), wei&szlig;es Fenster mit Titel + Beschreibungstext</li>
  <li>Swipe-Geste wird beim Klick auf &#x24D8; nicht ausgel&ouml;st (<code>data-no-drag</code> + <code>cancel()</code> im useDrag-Handler)</li>
</ul>

<h3>4.6 Event-Detail (Bottom Sheet Modal)</h3>
<ul>
  <li>&Ouml;ffnet sich von unten (fixed inset-0, items-end)</li>
  <li>Bild-Header (56px H&ouml;he) mit Schlie&szlig;en-Button (oben rechts)</li>
  <li>2-Spalten-Info-Raster: Datum, Uhrzeit, Standort, Teilnehmer</li>
  <li>Beschreibung, Hinweis-Box (amber), Organisator-Info</li>
  <li>Fu&szlig;zeile: NOPE-Button (rot, Rahmen) + LIKE-Button (adesso Blau, gef&uuml;llt)</li>
  <li>Max. 90vh H&ouml;he, scrollbarer Inhalt</li>
</ul>

<h3>4.7 Toast-Benachrichtigungen</h3>
<ul>
  <li>Erscheint oben mittig (fixed top-16)</li>
  <li>Gr&uuml;n f&uuml;r Zusagen: &ldquo;&#x2665; Du nimmst teil: [Event-Name]&rdquo;</li>
  <li>Grau f&uuml;r Ablehnen: &ldquo;&Uuml;bersprungen&rdquo;</li>
  <li>Verschwindet nach 2,5 Sekunden; animate-bounce-in</li>
</ul>

<h2>5. User Flows</h2>
<ol>
  <li><strong>Erstmaliger Login:</strong> Login-Screen &rarr; Standortauswahl &rarr; Event-Feed</li>
  <li><strong>Swipe:</strong> Drag-Geste auf Karte &rarr; LIKE/NOPE-Stempel &rarr; Toast &rarr; n&auml;chste Karte</li>
  <li><strong>Detail ansehen:</strong> Tap auf Karte &rarr; Bottom Sheet &rarr; Entscheidung (NOPE/LIKE) &rarr; schlie&szlig;t + Swipe-Animation</li>
  <li><strong>Button-Klick:</strong> Tinder-Button &rarr; Swipe-Animation auf oberster Karte &rarr; Toast</li>
  <li><strong>Beschreibung lesen:</strong> &#x24D8;-Button auf Karte &rarr; Popup &ouml;ffnet sich &rarr; Beschreibung lesen &rarr; ✕ oder Hintergrund klicken zum Schlie&szlig;en</li>
  <li><strong>Undo:</strong> Versehentlicher Swipe &rarr; &#x27F2;-Button leuchtet gelb &rarr; Klick &rarr; Event erscheint wieder oben auf dem Stapel &rarr; Toast &ldquo;&#x21A9; R&uuml;ckg&auml;ngig: [Event]&rdquo;</li>
  <li><strong>Leerer Feed:</strong> Alle Events geswipt &rarr; &ldquo;Alle Events bewertet&rdquo;-Meldung im Kartenbereich &rarr; &#x27F2; (Undo/Reload) bleibt sichtbar &amp; aktiv</li>
  <li><strong>Event erstellen (Organizer):</strong> &ldquo;Erstellen&rdquo;-Tab &rarr; Formular ausf&uuml;llen &rarr; Best&auml;tigung</li>
</ol>

<h2>6. Animations-Spezifikationen</h2>
<table>
  <tr><th>Animation</th><th>Bibliothek</th><th>Parameter</th></tr>
  <tr><td>Swipe-Drag</td><td>@use-gesture/react useDrag</td><td>filterTaps: true; bounds: none</td></tr>
  <tr><td>Karte ausfliegen</td><td>@react-spring/web useSpring</td><td>x: &plusmn;500px, rotate: &plusmn;30&deg;, config.tension: 200</td></tr>
  <tr><td>LIKE/NOPE-Deckkraft</td><td>react-spring animated.div</td><td>opacity proportional zu |mx| / 100</td></tr>
  <tr><td>Karten-Stapel-Staffelung</td><td>CSS transform</td><td>scale(1 &minus; i*0.04), translateY(i*8px)</td></tr>
  <tr><td>Toast einblenden</td><td>CSS animate-bounce-in</td><td>Keyframe: scale 0.8&rarr;1.05&rarr;1.0</td></tr>
  <tr><td>Button-Klick</td><td>CSS active:scale-95</td><td>Transition 150ms</td></tr>
</table>

<h2>7. Responsive Breakpoints</h2>
<table>
  <tr><th>Breakpoint</th><th>Breite</th><th>Verhalten</th></tr>
  <tr><td>Mobile (Standard)</td><td>&lt;640px</td><td>Vollbild, bottom nav, max-w-sm Karten</td></tr>
  <tr><td>Tablet</td><td>640px&ndash;1024px</td><td>Zentrierter Feed, max-w-lg Modals</td></tr>
  <tr><td>Desktop</td><td>&gt;1024px</td><td>Sidebar Navigation (geplant f&uuml;r v2)</td></tr>
</table>
"""

STATUS_HTML = """
<h1>adessoEventApp &ndash; Implementation Status</h1>
<p><em>Zuletzt aktualisiert: 22.05.2026 &bull; Stand: Sprint 6 in Arbeit, Microsoft Graph API / Outlook-Kalender-Sync</em></p>

<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p><strong>&#x1F680; Die App ist live:</strong> <a href="https://adesso-event-app.vercel.app">https://adesso-event-app.vercel.app</a><br/>
    Erreichbar von jedem Ger&auml;t (Handy, Tablet, Desktop) ohne Installation.<br/>
    Login mit <code>demo@adesso.de</code> &bull; <code>organizer@adesso.de</code> &bull; <code>admin@adesso.de</code></p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Implementierungsstand</h2>
<table>
  <tr><th>Feature</th><th>Status</th><th>Komponente / Datei</th></tr>
  <tr><td>JWT-Authentifizierung (Login/Register)</td><td>&#x2705; Fertig</td><td>backend/routes/auth.ts</td></tr>
  <tr><td>Standort-Onboarding (erster Login)</td><td>&#x2705; Fertig</td><td>frontend/components/Onboarding/LocationPicker.tsx</td></tr>
  <tr><td>Event-Feed mit KI-Scoring</td><td>&#x2705; Fertig</td><td>backend/routes/events.ts + services/recommendation.ts</td></tr>
  <tr><td>Tinder-Swipe-Geste (rechts/links)</td><td>&#x2705; Fertig</td><td>frontend/components/SwipeCard/SwipeCard.tsx</td></tr>
  <tr><td>LIKE/NOPE-Stempel beim Swipe</td><td>&#x2705; Fertig</td><td>SwipeCard.tsx (animated overlays)</td></tr>
  <tr><td>Tinder-Buttons &#x27F2; &#xD7; &#x2665; &#x1F4CD;</td><td>&#x2705; Fertig</td><td>frontend/components/EventFeed/EventFeed.tsx</td></tr>
  <tr><td>Toast-Benachrichtigungen</td><td>&#x2705; Fertig</td><td>EventFeed.tsx (showToast)</td></tr>
  <tr><td>Event-Detail Bottom Sheet</td><td>&#x2705; Fertig</td><td>frontend/components/EventDetail/EventDetail.tsx</td></tr>
  <tr><td>Pl&auml;tze-&Uuml;bersicht (ausgebucht / fast voll)</td><td>&#x2705; Fertig</td><td>EventDetail.tsx</td></tr>
  <tr><td>Event erstellen / bearbeiten / absagen</td><td>&#x2705; Fertig</td><td>backend/routes/events.ts</td></tr>
  <tr><td>Swipe registrieren + Attendance anlegen</td><td>&#x2705; Fertig</td><td>backend/routes/swipe.ts</td></tr>
  <tr><td>User-Einstellungen (Sprache, KI-Opt-in, Standort)</td><td>&#x2705; Fertig</td><td>backend/routes/user.ts</td></tr>
  <tr><td>Admin: Nutzerverwaltung &amp; Rollenvergabe</td><td>&#x2705; Fertig</td><td>backend/routes/admin.ts</td></tr>
  <tr><td>Admin: Standortverwaltung</td><td>&#x2705; Fertig</td><td>backend/routes/admin.ts</td></tr>
  <tr><td>Admin: Systemstatistiken</td><td>&#x2705; Fertig</td><td>backend/routes/admin.ts</td></tr>
  <tr><td>Mehrsprachigkeit DE/EN</td><td>&#x2705; Fertig</td><td>frontend/i18n/ (de.json, en.json)</td></tr>
  <tr><td>RBAC (USER / ORGANIZER / ADMIN)</td><td>&#x2705; Fertig</td><td>backend/middleware/auth.ts</td></tr>
  <tr><td>Seed-Daten (6 Standorte, 12 Events, 3 Nutzer)</td><td>&#x2705; Fertig</td><td>backend/src/prisma/seed.ts</td></tr>
  <tr><td>Reset-Script f&uuml;r Testdaten-Wiederherstellung</td><td>&#x2705; Fertig</td><td>backend/src/prisma/reset.ts</td></tr>
  <tr><td>PostgreSQL-Migration (Supabase)</td><td>&#x2705; Fertig</td><td>backend/src/prisma/migrations/</td></tr>
  <tr><td>Render-Deployment (Backend, Free Tier)</td><td>&#x2705; Fertig</td><td>backend/nixpacks.toml</td></tr>
  <tr><td>Vercel-Deployment (Frontend, Free Tier)</td><td>&#x2705; Fertig</td><td>frontend/vercel.json</td></tr>
  <tr><td>App &ouml;ffentlich erreichbar (Handy, Tablet, Desktop)</td><td>&#x2705; Fertig</td><td>adesso-event-app.vercel.app</td></tr>
  <tr><td>Profil-Seite: Standort &auml;ndern, Sprache (DE/EN), KI-Personalisierung</td><td>&#x2705; Fertig</td><td>frontend/src/pages/Profile.tsx</td></tr>
  <tr><td>Organizer-Events in MyEvents: eigene Events mit Teilnehmerzahl &amp; Absagen-Funktion</td><td>&#x2705; Fertig</td><td>frontend/src/pages/MyEvents.tsx + backend GET /events/my</td></tr>
  <tr><td>Typ-Filter im Feed: horizontale Filter-Chips (Sport, Meeting, Freizeit, Training, Firmen, Sonstiges)</td><td>&#x2705; Fertig</td><td>frontend/src/components/EventFeed/EventFeed.tsx</td></tr>
  <tr><td>EventForm: Standort des Organisators beim Erstellen vorausgew&auml;hlt</td><td>&#x2705; Fertig</td><td>frontend/src/pages/EventForm.tsx</td></tr>
  <tr><td>EventForm: Erfolgskarte nach Erstellen (statt sofortiger Weiterleitung)</td><td>&#x2705; Fertig</td><td>frontend/src/pages/EventForm.tsx</td></tr>
  <tr><td>Mobile Viewport-H&ouml;he (100dvh) &ndash; kein Scrollen auf iOS/Android</td><td>&#x2705; Fertig</td><td>frontend/src/index.css (.feed-container)</td></tr>
  <tr><td>Standort-Dropdown Mobile-Fix (appearance-none + h-11)</td><td>&#x2705; Fertig</td><td>EventFeed.tsx (inline style)</td></tr>
  <tr><td>SwipeCard f&uuml;llt verf&uuml;gbaren Platz (absolute inset-0 + flex-1)</td><td>&#x2705; Fertig</td><td>SwipeCard.tsx + EventFeed.tsx</td></tr>
  <tr><td>Event-Typ Selektor als Icon-Grid (3&times;2 Raster mit Emoji)</td><td>&#x2705; Fertig</td><td>frontend/components/EventForm/EventForm.tsx</td></tr>
  <tr><td>Datum und Uhrzeit im EventForm getrennt (type=date + type=time)</td><td>&#x2705; Fertig</td><td>frontend/components/EventForm/EventForm.tsx</td></tr>
  <tr><td>Filter-Chips Scrollbar optimiert (3px, CSS-only)</td><td>&#x2705; Fertig</td><td>frontend/src/index.css (.chips-scroll)</td></tr>
  <tr><td>Undo-Funktion: letzten Swipe r&uuml;ckg&auml;ngig machen (DELETE /swipe/:eventId)</td><td>&#x2705; Fertig</td><td>backend/routes/swipe.ts + EventFeed.tsx (lastSwiped State)</td></tr>
  <tr><td>&#x27F2;-Button kontextsensitiv: Undo (pulsiert gelb) oder Reload</td><td>&#x2705; Fertig</td><td>frontend/components/EventFeed/EventFeed.tsx</td></tr>
  <tr><td>Buttons immer sichtbar bei leerem Feed (&times;/&#x2665;/&#x1F4CD; disabled, &#x27F2; immer aktiv)</td><td>&#x2705; Fertig</td><td>frontend/components/EventFeed/EventFeed.tsx</td></tr>
  <tr><td>Info-Button &#x24D8; auf SwipeCard &ndash; Beschreibungsvorschau ohne Bottom Sheet</td><td>&#x2705; Fertig</td><td>frontend/components/SwipeCard/SwipeCard.tsx</td></tr>
  <tr><td>Zielgruppen-Targeting: ALL / LOCATION / BUSINESS_LINE / CC / SPECIFIC</td><td>&#x2705; Fertig</td><td>backend/routes/events.ts (isVisibleToUser) + EventForm.tsx</td></tr>
  <tr><td>Profil: Business Line &amp; Competence Center einstellbar</td><td>&#x2705; Fertig</td><td>frontend/pages/Profile.tsx + backend/routes/user.ts</td></tr>
  <tr><td>Admin: Event-Moderationsansicht (GET /events/admin/all)</td><td>&#x2705; Fertig</td><td>backend/routes/events.ts</td></tr>
  <tr><td>Standort M&uuml;nster (8. Standort) + 4 lokale Events</td><td>&#x2705; Fertig</td><td>reset.ts + seed.ts (loc-muenster, evt-13 bis evt-16)</td></tr>
  <tr><td>EventForm: Datum/Uhrzeit als sauberes 2-Spalten-Grid (Mobile-Fix)</td><td>&#x2705; Fertig</td><td>frontend/components/EventForm/EventForm.tsx</td></tr>
  <tr><td>Supabase Pooler Fix: pgbouncer=true in DATABASE_URL</td><td>&#x2705; Fertig</td><td>Render Env-Variable + reset-supabase.bat</td></tr>
  <tr><td>reset-supabase.bat: Testdaten per Doppelklick wiederherstellen</td><td>&#x2705; Fertig</td><td>reset-supabase.bat (Projektstamm)</td></tr>
  <tr><td>Microsoft Graph API: Outlook-Kalender-Sync bei Swipe-Right</td><td>&#x1F504; In Arbeit</td><td>backend/src/services/calendarService.ts + routes/swipe.ts</td></tr>
  <tr><td>Microsoft OAuth 2.0: &laquo;Mit Microsoft verbinden&raquo; im Profil (Azure AD)</td><td>&#x1F504; In Arbeit</td><td>backend/src/routes/microsoft.ts + frontend/pages/Profile.tsx</td></tr>
  <tr><td>DB-Migration: msAccessToken / msRefreshToken / calendarEventId</td><td>&#x1F504; In Arbeit</td><td>migrations/20260522000000_ms_calendar</td></tr>
</table>

<h2>Behobene Bugs</h2>
<table>
  <tr><th>Bug</th><th>Ursache</th><th>L&ouml;sung</th></tr>
  <tr><td>Swipe ging nur links (Ablehnen)</td><td><code>dx</code> (letzter Frame) statt Gesamtbewegung</td><td><code>mx &gt; 0</code> als Richtungsindikator</td></tr>
  <tr><td>Buttons nicht klickbar</td><td><code>mt-48</code> schob Buttons aus dem sichtbaren Bereich</td><td><code>mt-6</code> + feste Container-H&ouml;he 360px</td></tr>
  <tr><td>Keine Animation bei Button-Klick</td><td>Buttons riefen <code>handleSwipe</code> direkt auf statt Karten-Animation</td><td><code>forwardRef</code> + <code>useImperativeHandle</code> auf SwipeCard</td></tr>
  <tr><td>Beide LIKE/NOPE-Stempel sichtbar</td><td>Gemeinsame Opacity-Variable</td><td>Separate <code>rightOpacity</code> + <code>leftOpacity</code></td></tr>
  <tr><td>Frontend zeigte nichts an</td><td>Prisma-Enum-Import schlu&szlig; fehl mit SQLite</td><td>Alle Enums durch String-Literale ersetzt (<code>'ACTIVE'</code>, etc.)</td></tr>
  <tr><td>Prisma 7 inkompatibel</td><td><code>url</code> in datasource nicht mehr unterst&uuml;tzt</td><td>Downgrade auf Prisma 5</td></tr>
  <tr><td>adesso-Farben falsch (rot)</td><td>Standard-Tailwind-Farben verwendet</td><td>Konsequent <code>#0D3B6E</code> + <code>#1A6FBF</code> + Wei&szlig;</td></tr>
</table>

<h2>Sprint-&Uuml;bersicht</h2>
<p><strong>&#x2705; Sprint 3 abgeschlossen (14.05.2026):</strong></p>
<ul>
  <li>&#x2705; Mobile Viewport-H&ouml;he (100dvh) &ndash; kein Scrollen auf iOS/Android</li>
  <li>&#x2705; Undo-Funktion: versehentlichen Swipe r&uuml;ckg&auml;ngig machen</li>
  <li>&#x2705; &#x27F2;-Button kontextsensitiv (Undo/Reload)</li>
  <li>&#x2705; Buttons immer sichtbar bei leerem Feed</li>
  <li>&#x2705; Info-Button &#x24D8; auf SwipeCard &ndash; Beschreibungsvorschau per Popup</li>
</ul>
<p><strong>&#x2705; Sprint 4 abgeschlossen (21.05.2026) &ndash; Deployment &amp; Production Readiness:</strong></p>
<ul>
  <li>&#x2705; PostgreSQL-Migration (von SQLite zu Supabase)</li>
  <li>&#x2705; Backend-Deployment auf Render (Free Tier, nixpacks.toml)</li>
  <li>&#x2705; Frontend-Deployment auf Vercel (Free Tier, vercel.json)</li>
  <li>&#x2705; App &ouml;ffentlich erreichbar: <a href="https://adesso-event-app.vercel.app">adesso-event-app.vercel.app</a></li>
  <li>&#x2705; Reset-Script f&uuml;r Testdaten-Wiederherstellung in Produktion</li>
  <li>&#x2705; CORS-Konfiguration f&uuml;r Produktion</li>
  <li>&#x2705; GitHub-Repository: <a href="https://github.com/stephpouegs/adessoEventApp">stephpouegs/adessoEventApp</a></li>
</ul>
<p><strong>&#x2705; Sprint 5 abgeschlossen (21.05.2026) &ndash; Audience Targeting &amp; M&uuml;nster:</strong></p>
<ul>
  <li>&#x2705; Zielgruppen-Targeting beim Event erstellen (ALL / LOCATION / BUSINESS_LINE / CC / SPECIFIC)</li>
  <li>&#x2705; Business Line &amp; Competence Center im Nutzerprofil einstellbar</li>
  <li>&#x2705; Feed-Logik: BL/CC/SPECIFIC-Events bypass Standortfilter, Matching via Nutzerprofil</li>
  <li>&#x2705; Admin: Event-Moderationsansicht (GET /events/admin/all)</li>
  <li>&#x2705; Standort M&uuml;nster hinzugef&uuml;gt (8. Standort) mit 4 Aktivit&auml;ten</li>
  <li>&#x2705; EventForm Mobile-Fix: Datum/Uhrzeit als 2-Spalten-Grid (kein Emoji-Overlay mehr)</li>
  <li>&#x2705; Supabase pgbouncer=true Fix (Prepared Statement Fehler 42P05/26000 behoben)</li>
  <li>&#x2705; reset-supabase.bat: Testdaten per Doppelklick wiederherstellen</li>
</ul>
<p><strong>&#x1F504; Sprint 6 &ndash; Microsoft Integration (in Arbeit, 22.05.2026):</strong></p>
<ul>
  <li>&#x2705; Microsoft Graph API / Outlook-Kalender-Sync: Swipe-Right tr&auml;gt Event automatisch in Outlook-Kalender ein</li>
  <li>&#x2705; Microsoft OAuth 2.0 (Azure AD): &laquo;Mit Microsoft verbinden&raquo;-Button im Profil</li>
  <li>&#x2705; Token-Management: automatischer Refresh bei abgelaufenem Access Token</li>
  <li>&#x2705; Kalender-Eintrag l&ouml;schen bei Swipe-Left / Undo</li>
  <li>&#x2705; DB-Migration: msAccessToken, msRefreshToken, msTokenExpiry (User) + calendarEventId (Attendance)</li>
  <li>&#x2705; Jira-Tickets: AAPE-258 (Epic) + AAPE-253 bis AAPE-257 (Test Cases)</li>
  <li>&#x23F3; Azure AD App-Registrierung in Produktion (ausstehend: Tenant-Admin)</li>
  <li>&#x23F3; Push-Notifications bei neuen Events am eigenen Standort</li>
  <li>&#x23F3; E-Mail-Best&auml;tigung nach Teilnahme/Warteliste</li>
  <li>&#x23F3; Event-Cover Bild-Upload</li>
</ul>

<h2>Lokale Entwicklungsumgebung starten</h2>
<pre>
# Backend
cd backend
npm install
npx prisma generate --schema=src/prisma/schema.prisma
npx prisma migrate dev --schema=src/prisma/schema.prisma
npx ts-node src/prisma/seed.ts
npx ts-node src/index.ts     # Port 3003

# Frontend (neues Terminal)
cd frontend
npm install
npm run dev                  # Port 5173
</pre>

<h2>Produktionsumgebung</h2>
<table>
  <tr><th>Dienst</th><th>URL</th><th>Plattform</th></tr>
  <tr><td>Frontend</td><td><a href="https://adesso-event-app.vercel.app">adesso-event-app.vercel.app</a></td><td>Vercel (Free)</td></tr>
  <tr><td>Backend API</td><td>Render (onrender.com)</td><td>Render (Free)</td></tr>
  <tr><td>Datenbank</td><td>Supabase (eu-west-1)</td><td>Supabase PostgreSQL (Free)</td></tr>
  <tr><td>Quellcode</td><td><a href="https://github.com/stephpouegs/adessoEventApp">github.com/stephpouegs/adessoEventApp</a></td><td>GitHub</td></tr>
</table>

<h2>Testdaten wiederherstellen (Produktion)</h2>
<pre>
cd backend
$env:DATABASE_URL="postgresql://postgres.osunfbiicywwcjcikxex:PASSWORT@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require"
npx ts-node src/prisma/reset.ts
</pre>

<h2>Test-Accounts</h2>
<table>
  <tr><th>E-Mail</th><th>Rolle</th><th>Beschreibung</th></tr>
  <tr><td>demo@adesso.de</td><td>USER</td><td>Normaler Mitarbeiter, sieht den Event-Feed</td></tr>
  <tr><td>organizer@adesso.de</td><td>ORGANIZER</td><td>Kann Events erstellen und verwalten</td></tr>
  <tr><td>admin@adesso.de</td><td>ADMIN</td><td>Voller Zugriff, Nutzerverwaltung</td></tr>
</table>
<p><em>Kein Passwort ben&ouml;tigt &ndash; Login mit adesso-E-Mail gen&uuml;gt.</em></p>
"""


import mimetypes, os as _os

SCREENSHOTS_DIR = _os.path.join(_os.path.dirname(__file__), "docs", "screenshots")

SCREENSHOTS = [
    ("01_login.png",        "Login-Screen"),
    ("02_feed.png",         "Event-Feed mit Standort-Filter"),
    ("03_info_popup.png",   "Info-Button Beschreibungs-Popup"),
    ("04_swipe_right.png",  "Swipe-Geste (Rechts = Interesse)"),
    ("05_undo_button.png",  "Undo-Button (leuchtet gelb nach Swipe)"),
    ("06_my_events.png",    "Meine Events"),
    ("07_profile.png",      "Profil & Einstellungen"),
    ("08_organizer.png",    "Organizer-Dashboard"),
    ("09_create_event.png", "Event erstellen Formular"),
]


def _multipart_body(filename: str, file_data: bytes, mime_type: str, boundary: str) -> bytes:
    return b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
        f"Content-Type: {mime_type}\r\n\r\n".encode(),
        file_data,
        f"\r\n--{boundary}--\r\n".encode(),
    ])


def get_attachment_id(page_id: str, filename: str) -> str | None:
    """Return the attachment ID if a file with this name already exists on the page."""
    result = api("GET", f"/rest/api/content/{page_id}/child/attachment?filename={filename}&expand=version")
    if result and result.get("results"):
        return result["results"][0]["id"]
    return None


def upload_attachment(page_id: str, filepath: str, filename: str) -> bool:
    """Upload or update a file attachment on a Confluence page."""
    boundary = "----PythonConfluenceUpload"
    with open(filepath, "rb") as f:
        file_data = f.read()
    mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    body = _multipart_body(filename, file_data, mime_type, boundary)

    hdrs = dict(HEADERS)
    hdrs["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    hdrs["X-Atlassian-Token"] = "no-check"
    hdrs.pop("Accept", None)

    # Update existing attachment if it already exists
    existing_id = get_attachment_id(page_id, filename)
    if existing_id:
        endpoint = f"/rest/api/content/{page_id}/child/attachment/{existing_id}/data"
    else:
        endpoint = f"/rest/api/content/{page_id}/child/attachment"

    req = urllib.request.Request(BASE_URL + endpoint, data=body, headers=hdrs, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status in (200, 201)
    except urllib.error.HTTPError as e:
        print(f"    attachment error HTTP {e.code}: {e.read().decode()[:200]}")
        return False


def build_demo_html(page_id: str) -> str:
    """Build the Confluence storage HTML for the demo page, referencing uploaded screenshots."""

    def img(filename: str, caption: str) -> str:
        return (
            f'<p><strong>{caption}</strong></p>'
            f'<ac:image ac:width="320">'
            f'<ri:attachment ri:filename="{filename}" /></ac:image>'
        )

    slides = [
        ("01_login.png",       "Screen 1 – Login &amp; Onboarding",
         "Anmeldung mit adesso-E-Mail. Beim ersten Login w&auml;hlt der Nutzer seinen Standort aus."),
        ("02_feed.png",        "Screen 2 – Event-Feed",
         "Karten-Stapel-Ansicht mit Standort-Dropdown, Typ-Filter-Chips und &#x24D8;-Info-Button."),
        ("03_info_popup.png",  "Screen 3 – Beschreibungs-Popup (&#x24D8;-Button)",
         "Klick auf &#x24D8; oben rechts zeigt die Event-Beschreibung direkt auf der Karte &ndash; ohne die App zu verlassen."),
        ("04_swipe_right.png", "Screen 4 – Swipe: Interesse / Ablehnen",
         "Rechts wischen = Interesse / Teilnahme. Links wischen = &Uuml;berspringen. Gr&uuml;ner Stempel zeigt Interesse."),
        ("05_undo_button.png", "Screen 5 – Undo-Button nach Swipe",
         "Der &#x27F2;-Button leuchtet gelb nach einem Swipe: Klick macht den letzten Swipe r&uuml;ckg&auml;ngig."),
        ("06_my_events.png",   "Screen 6 – Meine Events",
         "&Uuml;bersicht aller best&auml;tigten Teilnahmen. Tap auf ein Event &ouml;ffnet die Detail-Ansicht."),
        ("07_profile.png",     "Screen 7 – Profil &amp; Einstellungen",
         "Standort wechseln, Sprache (DE/EN), KI-Personalisierung an/aus."),
        ("08_organizer.png",   "Screen 8 – Organizer-Dashboard",
         "Eigene Events verwalten: bearbeiten, absagen, neues Event erstellen."),
        ("09_create_event.png","Screen 9 – Event erstellen",
         "Formular mit Icon-Grid f&uuml;r Event-Typ, getrenntem Datum/Uhrzeit-Picker und Standortauswahl."),
    ]

    rows = ""
    for filename, slide_title, desc in slides:
        rows += f"""
  <tr>
    <td style="vertical-align:top;padding:8px;width:340px;">{img(filename, slide_title)}</td>
    <td style="vertical-align:top;padding:8px;">
      <h3>{slide_title}</h3>
      <p>{desc}</p>
    </td>
  </tr>"""

    return f"""
<h1>adessoEventApp &ndash; Prototype Demo Pr&auml;sentation</h1>
<p><em>Erstellt: 10.05.2026 &bull; Dauer: ~2 Minuten &bull; 7 Folien</em></p>

<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p>Die vollst&auml;ndige PowerPoint-Datei ist im Repository unter
    <code>docs/adessoEventApp_Prototype_Demo.pptx</code> gespeichert.</p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Ziel der Pr&auml;sentation</h2>
<p>Kurzvorstellung der <strong>adessoEventApp</strong> in 2 Minuten &mdash;
Tinder-inspirierte Event-App f&uuml;r adesso-Mitarbeitende. Die Folien enthalten
echte App-Screenshots im iPhone-14-Mockup-Rahmen.</p>

<h2>Folien&uuml;bersicht mit Screenshots</h2>
<table>
  <tbody>{rows}
  </tbody>
</table>

<h2>Gesp&auml;chspunkte (2-Minuten-Script)</h2>
<ol>
  <li><strong>Problem (15 Sek.):</strong> Events gehen per E-Mail unter &mdash; kein zentraler Ort.</li>
  <li><strong>L&ouml;sung (15 Sek.):</strong> Tinder f&uuml;r adesso-Events &mdash; wischen statt E-Mail lesen.</li>
  <li><strong>Feed (20 Sek.):</strong> KI-sortierter Feed, Standort- und Typ-Filter, 3 Karten auf einmal sichtbar.</li>
  <li><strong>Swipe (15 Sek.):</strong> Rechts = dabei, links = skip. Warteliste bei vollen Events automatisch.</li>
  <li><strong>Eigene Events (15 Sek.):</strong> Teilnahmen im Blick, Organisatoren verwalten ihre Events selbst.</li>
  <li><strong>Organizer (15 Sek.):</strong> Erstellen, bearbeiten, absagen &mdash; kein Admin-Umweg.</li>
  <li><strong>Demo &amp; Fragen (15 Sek.):</strong> Live unter <a href="https://adesso-event-app.vercel.app">adesso-event-app.vercel.app</a> &mdash; jetzt auf dem Handy &ouml;ffnen!</li>
</ol>

<h2>Tech-Stack (Kurzfassung)</h2>
<table>
  <tr><th>Frontend</th><td>React 18 + TypeScript + Tailwind CSS + React Spring</td></tr>
  <tr><th>Backend</th><td>Node.js + Express + Prisma + PostgreSQL (Supabase)</td></tr>
  <tr><th>Hosting</th><td>Vercel (Frontend) + Render (Backend) + Supabase (DB) &mdash; 100% kostenlos</td></tr>
  <tr><th>Features</th><td>JWT-Auth, RBAC (User/Organizer/Admin), KI-Scoring, i18n DE/EN, Undo-Swipe, Info-Popup</td></tr>
</table>
"""


def main():
    print("\n=== Confluence Update: adessoEventApp ===\n")

    print("1. Project Brief:")
    update_page(PAGE_IDS["brief"], "1. Project Brief - adessoEventApp", BRIEF_HTML)

    print("\n2. PRD (User Stories):")
    update_page(PAGE_IDS["prd"], "2. PRD - adessoEventApp", PRD_HTML)

    print("\n3. Architecture Document:")
    update_page(PAGE_IDS["arch"], "3. Architecture Document - adessoEventApp", ARCH_HTML)

    print("\n4. UX Design:")
    update_page(PAGE_IDS["ux"], "4. UX Design - adessoEventApp", UX_HTML)

    print("\n5. Implementation Status:")
    create_or_update_page(PARENT_ID, "IT", "5. Implementation Status - adessoEventApp", STATUS_HTML)

    print("\n6. Prototype Demo Presentation:")
    demo_title = "6. Prototype Demo - adessoEventApp"
    demo_id = find_page_by_title("IT", demo_title)
    if not demo_id:
        # Create empty page first to get an ID
        payload = {
            "type": "page",
            "title": demo_title,
            "ancestors": [{"id": PARENT_ID}],
            "space": {"key": "IT"},
            "body": {"storage": {"value": "<p>Wird geladen...</p>",
                                  "representation": "storage"}},
        }
        result = api("POST", "/rest/api/content", payload)
        if result:
            demo_id = result["id"]
            print(f"  Created page (ID: {demo_id})")
        else:
            print("  FAILED to create demo page")
            demo_id = None

    if demo_id:
        # Upload screenshots as attachments
        print("  Uploading screenshots...")
        for filename, label in SCREENSHOTS:
            filepath = _os.path.join(SCREENSHOTS_DIR, filename)
            if _os.path.exists(filepath):
                ok = upload_attachment(demo_id, filepath, filename)
                print(f"    {'OK' if ok else 'FAIL'} {filename} ({label})")
            else:
                print(f"    SKIP {filename} (not found)")

        # Update page with full content including image references
        update_page(demo_id, demo_title, build_demo_html(demo_id))

    print("\n=== Fertig! ===\n")


if __name__ == "__main__":
    main()
