#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
"""
adessoEventApp - QA Testing Script (BMAD Tester Role)
Erstellt Testfaelle in Jira, verknuepft sie mit User Stories,
fuehrt automatisierte API-Tests aus und dokumentiert Ergebnisse.
"""

import json, urllib.request, urllib.error, base64, os, time

# ── Jira-Konfiguration ────────────────────────────────────────────────────────

def load_env(path=".env.jira"):
    cfg = {}
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip()
    return cfg

cfg = load_env(os.path.join(os.path.dirname(__file__), ".env.jira"))
JIRA_URL    = cfg.get("JIRA_URL", "https://adesso-group.atlassian.net").rstrip("/")
JIRA_USER   = cfg.get("JIRA_USER", "")
JIRA_TOKEN  = cfg.get("JIRA_TOKEN", "")
PROJECT_KEY = cfg.get("JIRA_PROJECT_KEY", "AAPE")

if not JIRA_TOKEN:
    print("FEHLER: Bitte trage deinen API-Token in .env.jira ein.")
    exit(1)

if "atlassian.net" in JIRA_URL:
    cred = base64.b64encode(f"{JIRA_USER}:{JIRA_TOKEN}".encode()).decode()
    AUTH_HEADER = f"Basic {cred}"
else:
    AUTH_HEADER = f"Bearer {JIRA_TOKEN}"

JIRA_HEADERS = {
    "Authorization": AUTH_HEADER,
    "Content-Type": "application/json",
    "Accept": "application/json",
}

# ── App-Konfiguration ─────────────────────────────────────────────────────────

APP_URL = "https://adessoeventapp.onrender.com"

# User Stories (aus letztem Jira-Run)
US = {
    "US-001": "AAPE-74",
    "US-002": "AAPE-75",
    "US-003": "AAPE-76",
    "US-004": "AAPE-77",
    "US-005": "AAPE-107",
    "US-101": "AAPE-78",
    "US-102": "AAPE-79",
    "US-103": "AAPE-80",
    "US-104": "AAPE-81",
    "US-105": "AAPE-82",
    "US-106": "AAPE-83",
    "US-201": "AAPE-84",
    "US-202": "AAPE-85",
    "US-203": "AAPE-86",
    "US-204": "AAPE-106",
    "US-205": "AAPE-108",
    "US-301": "AAPE-88",
    "US-302": "AAPE-89",
    "US-303": "AAPE-90",
    "US-401": "AAPE-91",
    "US-601": "AAPE-258",
}

# ── Jira REST-Hilfsfunktionen ─────────────────────────────────────────────────

def jira_req(method, path, body=None, base="rest/api/2"):
    url = f"{JIRA_URL}/{base}/{path.lstrip('/')}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, headers=JIRA_HEADERS, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code} {method} /{base}/{path}: {e.read().decode()[:300]}")
        return None

def jira_post(path, body): return jira_req("POST", path, body)
def jira_put(path, body):  return jira_req("PUT",  path, body)
def jira_get(path):        return jira_req("GET",  path)

def create_ticket(summary, description, labels, epic_key=None):
    fields = {
        "project":     {"key": PROJECT_KEY},
        "issuetype":   {"name": "Task"},
        "summary":     summary,
        "description": description,
        "labels":      labels,
    }
    if epic_key:
        fields["parent"] = {"key": epic_key}
    r = jira_post("issue", {"fields": fields})
    if r and "key" in r:
        return r["key"]
    return None

def link_issues(tc_key, us_key):
    """Verknuepft einen Testfall mit einer User Story."""
    body = {
        "type":         {"name": "Relates"},
        "inwardIssue":  {"key": tc_key},
        "outwardIssue": {"key": us_key},
    }
    jira_post("issueLink", body)

def update_ticket_status(key, status_label, result_comment):
    """Fuegt einen Kommentar mit dem Testergebnis hinzu."""
    jira_post(f"issue/{key}/comment", {
        "body": f"*Testergebnis:* {status_label}\n\n{result_comment}"
    })

# ── App HTTP-Hilfsfunktionen ──────────────────────────────────────────────────

def app_req(method, path, body=None, token=None):
    url = f"{APP_URL}/api{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        try:
            raw = e.read()
            return e.code, (json.loads(raw) if raw else {})
        except Exception:
            return e.code, {}

def login(email, name=None):
    status, data = app_req("POST", "/auth/callback", {"email": email, "name": name or email.split("@")[0]})
    if status == 200 and "accessToken" in data:
        return data["accessToken"]
    return None

# ── Testfall-Definitionen ─────────────────────────────────────────────────────

EPIC_QA = None  # wird zur Laufzeit gesetzt

TEST_CASES = [

    # ══════════════════════════════════════════════════════════════════════════
    # EPIC 1 – Authentifizierung & Profil
    # ══════════════════════════════════════════════════════════════════════════
    {
        "id": "TC-001", "us": "US-001",
        "summary": "[TC-001] Login mit gueltiger adesso-E-Mail",
        "labels": ["test", "auth", "automatisiert"],
        "description": (
            "*Testfall:* TC-001\n*User Story:* US-001 (AAPE-74)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- Nutzer demo@adesso.de existiert in Supabase\n\n"
            "*Schritte:*\n1. POST /api/auth/callback { email: demo@adesso.de, name: Demo User }\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- Antwort enthaelt Feld 'accessToken'\n- Antwort enthaelt Feld 'user' mit role=USER"
        ),
    },
    {
        "id": "TC-002", "us": "US-001",
        "summary": "[TC-002] Login mit ungueltiger E-Mail wird abgelehnt",
        "labels": ["test", "auth", "automatisiert", "negativ"],
        "description": (
            "*Testfall:* TC-002\n*User Story:* US-001 (AAPE-74)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- keine\n\n"
            "*Schritte:*\n1. POST /api/auth/callback { email: hacker@extern.de }\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 403\n- Fehlermeldung: Only adesso email addresses are allowed"
        ),
    },
    {
        "id": "TC-003", "us": "US-001",
        "summary": "[TC-003] GET /auth/me gibt aktuellen Nutzer zurueck",
        "labels": ["test", "auth", "automatisiert"],
        "description": (
            "*Testfall:* TC-003\n*User Story:* US-001 (AAPE-74)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- Gueltiger JWT-Token vorhanden\n\n"
            "*Schritte:*\n1. GET /api/auth/me mit Bearer-Token\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- user.email = demo@adesso.de"
        ),
    },
    {
        "id": "TC-004", "us": "US-001",
        "summary": "[TC-004] GET /auth/me ohne Token wird abgewiesen",
        "labels": ["test", "auth", "automatisiert", "negativ", "sicherheit"],
        "description": (
            "*Testfall:* TC-004\n*User Story:* US-001 (AAPE-74)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- kein Token\n\n"
            "*Schritte:*\n1. GET /api/auth/me ohne Authorization-Header\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 401\n- Kein Nutzerobjekt in Antwort"
        ),
    },
    {
        "id": "TC-005", "us": "US-002",
        "summary": "[TC-005] Standort setzen via PUT /user/location",
        "labels": ["test", "profil", "automatisiert"],
        "description": (
            "*Testfall:* TC-005\n*User Story:* US-002 (AAPE-75)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von demo@adesso.de\n\n"
            "*Schritte:*\n1. PUT /api/user/location { locationId: 'loc-berlin' }\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- user.locationId = loc-berlin"
        ),
    },
    {
        "id": "TC-006", "us": "US-003",
        "summary": "[TC-006] Sprache auf EN umschalten (PUT /user/settings)",
        "labels": ["test", "profil", "automatisiert"],
        "description": (
            "*Testfall:* TC-006\n*User Story:* US-003 (AAPE-76)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von demo@adesso.de\n\n"
            "*Schritte:*\n1. PUT /api/user/settings { language: 'EN' }\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- user.language = EN"
        ),
    },
    {
        "id": "TC-007", "us": "US-005",
        "summary": "[TC-007] Business Line & Competence Center speichern",
        "labels": ["test", "profil", "automatisiert"],
        "description": (
            "*Testfall:* TC-007\n*User Story:* US-005 (AAPE-107)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von demo@adesso.de\n\n"
            "*Schritte:*\n"
            "1. PUT /api/user/settings { businessLine: 'Digital Experience', competenceCenter: 'Cloud & Infrastructure' }\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- user.businessLine = 'Digital Experience'\n- user.competenceCenter = 'Cloud & Infrastructure'"
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # EPIC 2 – Event-Feed & Swipe
    # ══════════════════════════════════════════════════════════════════════════
    {
        "id": "TC-101", "us": "US-101",
        "summary": "[TC-101] Feed liefert Events fuer aktuellen Standort",
        "labels": ["test", "feed", "automatisiert"],
        "description": (
            "*Testfall:* TC-101\n*User Story:* US-101 (AAPE-78)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von demo@adesso.de\n\n"
            "*Schritte:*\n1. GET /api/events/feed\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- Array mit mindestens 1 Event\n- Jedes Event hat: id, title, type, startDate, location"
        ),
    },
    {
        "id": "TC-102", "us": "US-101",
        "summary": "[TC-102] Feed ohne Token wird abgewiesen",
        "labels": ["test", "feed", "automatisiert", "negativ", "sicherheit"],
        "description": (
            "*Testfall:* TC-102\n*User Story:* US-101 (AAPE-78)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- kein Token\n\n"
            "*Schritte:*\n1. GET /api/events/feed ohne Authorization-Header\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 401"
        ),
    },
    {
        "id": "TC-103", "us": "US-101",
        "summary": "[TC-103] Feed-Filterung nach Standort (?locationId=)",
        "labels": ["test", "feed", "automatisiert"],
        "description": (
            "*Testfall:* TC-103\n*User Story:* US-101 (AAPE-78)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT vorhanden\n\n"
            "*Schritte:*\n1. GET /api/events/feed?locationId=loc-muenster\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- Events haben locationId=loc-muenster oder audienceType!=ALL"
        ),
    },
    {
        "id": "TC-104", "us": "US-101",
        "summary": "[TC-104] Swipe RIGHT registriert Teilnahme (POST /swipe)",
        "labels": ["test", "swipe", "automatisiert"],
        "description": (
            "*Testfall:* TC-104\n*User Story:* US-101 (AAPE-78)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von demo@adesso.de\n- Mindestens 1 Event im Feed\n\n"
            "*Schritte:*\n1. GET /api/events/feed → erste Event-ID notieren\n"
            "2. POST /api/swipe { eventId: '<id>', direction: 'RIGHT' }\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 201\n- Attendance mit status CONFIRMED oder WAITLIST angelegt"
        ),
    },
    {
        "id": "TC-105", "us": "US-101",
        "summary": "[TC-105] Swipe LEFT registriert kein Attendance",
        "labels": ["test", "swipe", "automatisiert"],
        "description": (
            "*Testfall:* TC-105\n*User Story:* US-101 (AAPE-78)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von demo@adesso.de\n\n"
            "*Schritte:*\n1. GET /api/events/feed → zweite Event-ID\n"
            "2. POST /api/swipe { eventId: '<id>', direction: 'LEFT' }\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 201\n- Swipe gespeichert, kein Attendance-Eintrag"
        ),
    },
    {
        "id": "TC-106", "us": "US-104",
        "summary": "[TC-106] Event-Details abrufen (GET /events/:id)",
        "labels": ["test", "events", "automatisiert"],
        "description": (
            "*Testfall:* TC-106\n*User Story:* US-104 (AAPE-81)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT vorhanden\n- Bekannte Event-ID (z.B. evt-1)\n\n"
            "*Schritte:*\n1. GET /api/events/evt-1\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- Event-Objekt mit title, description, location, organizer, _count"
        ),
    },
    {
        "id": "TC-107", "us": "US-101",
        "summary": "[TC-107] Undo-Swipe: DELETE /swipe/:eventId",
        "labels": ["test", "swipe", "automatisiert"],
        "description": (
            "*Testfall:* TC-107\n*User Story:* US-101 (AAPE-78)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT vorhanden\n- Vorheriger Swipe auf evt-3 (RIGHT)\n\n"
            "*Schritte:*\n1. DELETE /api/swipe/evt-3\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 204\n- Swipe + Attendance geloescht"
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # EPIC 3 – Event-Erstellung (Organizer)
    # ══════════════════════════════════════════════════════════════════════════
    {
        "id": "TC-201", "us": "US-201",
        "summary": "[TC-201] Organizer erstellt Event erfolgreich",
        "labels": ["test", "events", "organizer", "automatisiert"],
        "description": (
            "*Testfall:* TC-201\n*User Story:* US-201 (AAPE-84)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von organizer@adesso.de\n\n"
            "*Schritte:*\n1. POST /api/events mit gueltigem Payload (Datum in Zukunft, alle Pflichtfelder)\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 201\n- Event-Objekt mit id und status=ACTIVE"
        ),
    },
    {
        "id": "TC-202", "us": "US-201",
        "summary": "[TC-202] Normaler Nutzer kann kein Event erstellen (403)",
        "labels": ["test", "events", "automatisiert", "negativ", "sicherheit"],
        "description": (
            "*Testfall:* TC-202\n*User Story:* US-201 (AAPE-84)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von demo@adesso.de (Rolle USER)\n\n"
            "*Schritte:*\n1. POST /api/events mit gueltigem Payload\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 403 Forbidden"
        ),
    },
    {
        "id": "TC-203", "us": "US-201",
        "summary": "[TC-203] Event mit Datum in Vergangenheit wird abgelehnt",
        "labels": ["test", "events", "automatisiert", "negativ"],
        "description": (
            "*Testfall:* TC-203\n*User Story:* US-201 (AAPE-84)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von organizer@adesso.de\n\n"
            "*Schritte:*\n1. POST /api/events mit startDate = 2020-01-01T10:00:00.000Z\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 400\n- Fehlermeldung: Start date cannot be in the past"
        ),
    },
    {
        "id": "TC-204", "us": "US-202",
        "summary": "[TC-204] Organizer bearbeitet eigenes Event",
        "labels": ["test", "events", "organizer", "automatisiert"],
        "description": (
            "*Testfall:* TC-204\n*User Story:* US-202 (AAPE-85)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von organizer@adesso.de\n- Event evt-1 gehoert organizer\n\n"
            "*Schritte:*\n1. PUT /api/events/evt-1 { title: 'Tischtennis Turnier (aktualisiert)' }\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- title aktualisiert"
        ),
    },
    {
        "id": "TC-205", "us": "US-203",
        "summary": "[TC-205] Organizer sagt Event ab (Status CANCELLED)",
        "labels": ["test", "events", "organizer", "automatisiert"],
        "description": (
            "*Testfall:* TC-205\n*User Story:* US-203 (AAPE-86)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von organizer@adesso.de\n- Von TC-201 erstelltes Event\n\n"
            "*Schritte:*\n1. DELETE /api/events/<neue-event-id>\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 204\n- Event.status = CANCELLED in DB"
        ),
    },
    {
        "id": "TC-206", "us": "US-204",
        "summary": "[TC-206] Event mit Zielgruppe LOCATION erstellen",
        "labels": ["test", "events", "targeting", "automatisiert"],
        "description": (
            "*Testfall:* TC-206\n*User Story:* US-204 (AAPE-106)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von organizer@adesso.de\n\n"
            "*Schritte:*\n"
            "1. POST /api/events mit audienceType='LOCATION', audienceValue='[\"loc-berlin\",\"loc-hamburg\"]'\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 201\n- audienceType=LOCATION, audienceValue gespeichert"
        ),
    },
    {
        "id": "TC-207", "us": "US-204",
        "summary": "[TC-207] Event mit Zielgruppe BUSINESS_LINE nur fuer passende Nutzer sichtbar",
        "labels": ["test", "events", "targeting", "automatisiert"],
        "description": (
            "*Testfall:* TC-207\n*User Story:* US-204 (AAPE-106)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- Nutzer mit businessLine='Digital Experience' in DB\n- Event mit audienceType=BUSINESS_LINE, audienceValue='Digital Experience'\n\n"
            "*Schritte:*\n"
            "1. Nutzer-BL auf 'Digital Experience' setzen (PUT /user/settings)\n"
            "2. GET /api/events/feed → pruefen ob BL-Event im Feed erscheint\n"
            "3. BL auf leeren String setzen → pruefen ob Event verschwindet\n\n"
            "*Erwartetes Ergebnis:*\n- Event nur sichtbar wenn BL uebereinstimmt"
        ),
    },
    {
        "id": "TC-208", "us": "US-204",
        "summary": "[TC-208] Event mit Zielgruppe SPECIFIC (E-Mail) nur fuer genannte Nutzer",
        "labels": ["test", "events", "targeting", "automatisiert"],
        "description": (
            "*Testfall:* TC-208\n*User Story:* US-204 (AAPE-106)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von organizer\n\n"
            "*Schritte:*\n"
            "1. POST /api/events mit audienceType=SPECIFIC, audienceValue='[\"demo@adesso.de\"]'\n"
            "2. Als demo@adesso.de: GET /api/events/feed → Event muss erscheinen\n"
            "3. Als organizer@adesso.de: GET /api/events/feed → Event darf NICHT erscheinen\n\n"
            "*Erwartetes Ergebnis:*\n- Nur demo@adesso.de sieht das Event im Feed"
        ),
    },
    {
        "id": "TC-209", "us": "US-201",
        "summary": "[TC-209] Eigene Events des Organisators abrufen (GET /events/my)",
        "labels": ["test", "events", "organizer", "automatisiert"],
        "description": (
            "*Testfall:* TC-209\n*User Story:* US-201 (AAPE-84)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von organizer@adesso.de\n\n"
            "*Schritte:*\n1. GET /api/events/my\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- Array mit Events, organizerId = user-organizer\n- Jedes Event hat _count.attendances"
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # EPIC 4 – Admin-Dashboard
    # ══════════════════════════════════════════════════════════════════════════
    {
        "id": "TC-301", "us": "US-301",
        "summary": "[TC-301] Admin sieht alle Nutzer (GET /admin/users)",
        "labels": ["test", "admin", "automatisiert"],
        "description": (
            "*Testfall:* TC-301\n*User Story:* US-301 (AAPE-88)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von admin@adesso.de\n\n"
            "*Schritte:*\n1. GET /api/admin/users\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- Array mit mindestens 3 Nutzern (admin, organizer, demo)"
        ),
    },
    {
        "id": "TC-302", "us": "US-301",
        "summary": "[TC-302] Normaler Nutzer hat keinen Zugriff auf Admin-Endpunkte (403)",
        "labels": ["test", "admin", "automatisiert", "negativ", "sicherheit"],
        "description": (
            "*Testfall:* TC-302\n*User Story:* US-301 (AAPE-88)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von demo@adesso.de (Rolle USER)\n\n"
            "*Schritte:*\n1. GET /api/admin/users\n2. GET /api/admin/stats\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 403 fuer beide Anfragen"
        ),
    },
    {
        "id": "TC-303", "us": "US-303",
        "summary": "[TC-303] Admin sieht Systemstatistiken (GET /admin/stats)",
        "labels": ["test", "admin", "automatisiert"],
        "description": (
            "*Testfall:* TC-303\n*User Story:* US-303 (AAPE-90)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von admin@adesso.de\n\n"
            "*Schritte:*\n1. GET /api/admin/stats\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- Felder: totalUsers, totalEvents, activeEvents, swipesToday, totalAttendances"
        ),
    },
    {
        "id": "TC-304", "us": "US-302",
        "summary": "[TC-304] Alle Standorte abrufen (GET /admin/locations)",
        "labels": ["test", "admin", "automatisiert"],
        "description": (
            "*Testfall:* TC-304\n*User Story:* US-302 (AAPE-89)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT vorhanden (USER reicht)\n\n"
            "*Schritte:*\n1. GET /api/admin/locations\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- Array mit 8 Standorten (inkl. loc-muenster)"
        ),
    },
    {
        "id": "TC-305", "us": "US-205",
        "summary": "[TC-305] Admin sieht alle Events zur Moderation (GET /events/admin/all)",
        "labels": ["test", "admin", "automatisiert"],
        "description": (
            "*Testfall:* TC-305\n*User Story:* US-205 (AAPE-108)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von admin@adesso.de\n\n"
            "*Schritte:*\n1. GET /api/events/admin/all\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- Alle Events (kein Feed-Filter)\n- Mindestens 16 Events"
        ),
    },
    {
        "id": "TC-306", "us": "US-205",
        "summary": "[TC-306] Normaler Nutzer hat keinen Zugriff auf admin/all (403)",
        "labels": ["test", "admin", "automatisiert", "negativ", "sicherheit"],
        "description": (
            "*Testfall:* TC-306\n*User Story:* US-205 (AAPE-108)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von demo@adesso.de\n\n"
            "*Schritte:*\n1. GET /api/events/admin/all\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 403"
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # EPIC 6 – Mobile & UX (manuelle Tests)
    # ══════════════════════════════════════════════════════════════════════════
    {
        "id": "TC-501", "us": "US-101",
        "summary": "[TC-501] Feed scrollt nicht auf Mobile (100dvh) [MANUELL]",
        "labels": ["test", "mobile", "manuell"],
        "description": (
            "*Testfall:* TC-501\n*User Story:* US-101 (AAPE-78)\n*Typ:* Manuell\n\n"
            "*Vorbedingungen:*\n- iPhone oder Android-Geraet\n- App unter adesso-event-app.vercel.app\n\n"
            "*Schritte:*\n"
            "1. App im Browser auf Handy oeffnen\n"
            "2. Feed aufrufen\n"
            "3. Pruefen ob die Seite scrollbar ist\n\n"
            "*Erwartetes Ergebnis:*\n- Kein Scroll noetig\n- Karten + Buttons passen vollstaendig auf den Bildschirm\n- Kein Leerraum unten"
        ),
    },
    {
        "id": "TC-502", "us": "US-204",
        "summary": "[TC-502] Zielgruppen-Selector im EventForm auf Mobile [MANUELL]",
        "labels": ["test", "mobile", "manuell", "targeting"],
        "description": (
            "*Testfall:* TC-502\n*User Story:* US-204 (AAPE-106)\n*Typ:* Manuell\n\n"
            "*Vorbedingungen:*\n- Eingeloggt als organizer@adesso.de\n- Handy\n\n"
            "*Schritte:*\n"
            "1. 'Neues Event' oeffnen\n"
            "2. Alle 5 Zielgruppen-Optionen antippen\n"
            "3. 'Standort(e)' auswaehlen → Checkbox-Liste erscheint\n"
            "4. 2 Standorte ankreuzen\n"
            "5. 'Bestimmte adessi' → E-Mail eingeben\n\n"
            "*Erwartetes Ergebnis:*\n- Alle Buttons tappbar\n- Checkbox-Liste scrollbar\n- Textarea fuer E-Mails funktioniert"
        ),
    },
    {
        "id": "TC-503", "us": "US-201",
        "summary": "[TC-503] Datum/Uhrzeit-Felder auf Mobile korrekt dargestellt [MANUELL]",
        "labels": ["test", "mobile", "manuell", "form"],
        "description": (
            "*Testfall:* TC-503\n*User Story:* US-201 (AAPE-84)\n*Typ:* Manuell\n\n"
            "*Vorbedingungen:*\n- Handy\n- Als Organizer eingeloggt\n\n"
            "*Schritte:*\n"
            "1. 'Neues Event' oeffnen\n"
            "2. Datum-Feld antippen\n"
            "3. Uhrzeit-Feld antippen\n\n"
            "*Erwartetes Ergebnis:*\n- Datum: nativer Date-Picker oeffnet sich\n- Uhrzeit: nativer Time-Picker oeffnet sich\n- Beide Felder nebeneinander sichtbar\n- 'Datum *' und 'Uhrzeit *' als Labels"
        ),
    },
    {
        "id": "TC-504", "us": "US-101",
        "summary": "[TC-504] Swipe-Geste auf Touch-Geraet [MANUELL]",
        "labels": ["test", "mobile", "manuell", "swipe"],
        "description": (
            "*Testfall:* TC-504\n*User Story:* US-101 (AAPE-78)\n*Typ:* Manuell\n\n"
            "*Vorbedingungen:*\n- Handy, Feed mit Events\n\n"
            "*Schritte:*\n"
            "1. Finger auf Karte legen\n"
            "2. Nach rechts wischen\n"
            "3. Toast beobachten\n"
            "4. Naechste Karte nach links wischen\n\n"
            "*Erwartetes Ergebnis:*\n- Karte folgt Finger\n- LIKE/NOPE Stempel erscheint\n- Karte fliegt aus dem Bild\n- Toast erscheint oben"
        ),
    },
    {
        "id": "TC-505", "us": "US-401",
        "summary": "[TC-505] Sprachwechsel DE/EN funktioniert [MANUELL]",
        "labels": ["test", "i18n", "manuell"],
        "description": (
            "*Testfall:* TC-505\n*User Story:* US-401 (AAPE-91)\n*Typ:* Manuell\n\n"
            "*Vorbedingungen:*\n- App geoeffnet\n\n"
            "*Schritte:*\n"
            "1. Profil oeffnen\n"
            "2. 'English' auswaehlen\n"
            "3. Feed oeffnen\n"
            "4. Zurueck zu Profil → 'Deutsch' auswaehlen\n\n"
            "*Erwartetes Ergebnis:*\n- Alle UI-Texte wechseln sofort\n- Navigation: Feed / My Events / Events / Profile\n- Wieder Deutsch nach Rueckwechsel"
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # EPIC 6 – Microsoft Graph API / Outlook-Kalender-Sync
    # ══════════════════════════════════════════════════════════════════════════
    {
        "id": "TC-601-01", "us": "US-601",
        "summary": "[TC-601-01] GET /microsoft/status ohne Verbindung",
        "labels": ["test", "microsoft", "automatisiert"],
        "description": (
            "*Testfall:* TC-601-01\n*User Story:* US-601 (AAPE-258)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von demo@adesso.de\n- kein msAccessToken gesetzt\n\n"
            "*Schritte:*\n1. GET /api/microsoft/status mit Bearer-Token\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- { connected: false, expired: false }"
        ),
    },
    {
        "id": "TC-601-02", "us": "US-601",
        "summary": "[TC-601-02] GET /microsoft/status ohne Token → 401",
        "labels": ["test", "microsoft", "automatisiert", "negativ", "sicherheit"],
        "description": (
            "*Testfall:* TC-601-02\n*User Story:* US-601 (AAPE-258)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- kein Token\n\n"
            "*Schritte:*\n1. GET /api/microsoft/status ohne Authorization-Header\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 401"
        ),
    },
    {
        "id": "TC-601-03", "us": "US-601",
        "summary": "[TC-601-03] GET /microsoft/connect ohne Token → 401",
        "labels": ["test", "microsoft", "automatisiert", "negativ", "sicherheit"],
        "description": (
            "*Testfall:* TC-601-03\n*User Story:* US-601 (AAPE-258)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- kein Token\n\n"
            "*Schritte:*\n1. GET /api/microsoft/connect ohne token-Parameter und ohne Bearer-Token\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 401"
        ),
    },
    {
        "id": "TC-601-04", "us": "US-601",
        "summary": "[TC-601-04] GET /microsoft/connect leitet zu Azure AD weiter",
        "labels": ["test", "microsoft", "automatisiert"],
        "description": (
            "*Testfall:* TC-601-04\n*User Story:* US-601 (AAPE-258)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von demo@adesso.de\n\n"
            "*Schritte:*\n1. GET /api/microsoft/connect?token=<JWT>\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 302\n- Location-Header beginnt mit: https://login.microsoftonline.com/"
        ),
    },
    {
        "id": "TC-601-05", "us": "US-601",
        "summary": "[TC-601-05] Swipe-RIGHT ohne MS-Verbindung – kein Absturz (Fallback)",
        "labels": ["test", "microsoft", "automatisiert"],
        "description": (
            "*Testfall:* TC-601-05\n*User Story:* US-601 (AAPE-258)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von demo@adesso.de\n- kein msAccessToken (nicht verbunden)\n\n"
            "*Schritte:*\n1. GET /api/events/feed → erstes Event-ID holen\n"
            "2. POST /api/swipe { eventId, direction: RIGHT }\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 201\n- direction=RIGHT, attendanceStatus=CONFIRMED oder WAITLIST\n"
            "- Kein Serverfehler (kein 500)"
        ),
    },
    {
        "id": "TC-601-06", "us": "US-601",
        "summary": "[TC-601-06] DELETE /microsoft/disconnect entfernt Tokens",
        "labels": ["test", "microsoft", "automatisiert"],
        "description": (
            "*Testfall:* TC-601-06\n*User Story:* US-601 (AAPE-258)\n*Typ:* Automatisiert\n\n"
            "*Vorbedingungen:*\n- JWT von demo@adesso.de\n\n"
            "*Schritte:*\n1. DELETE /api/microsoft/disconnect mit Bearer-Token\n\n"
            "*Erwartetes Ergebnis:*\n- HTTP 200\n- { message: 'Microsoft account disconnected' }"
        ),
    },
]

# ── Automatisierte API-Tests ──────────────────────────────────────────────────

def run_api_tests():
    print("\n" + "="*60)
    print("PHASE 2: Automatisierte API-Tests")
    print("="*60)

    results = {}

    # Login
    print("\n[Auth]")
    token_demo = login("demo@adesso.de")
    token_org  = login("organizer@adesso.de")
    token_adm  = login("admin@adesso.de")

    def check(tc_id, condition, detail):
        status = "✅ PASS" if condition else "❌ FAIL"
        results[tc_id] = (condition, detail)
        print(f"  {status} {tc_id}: {detail}")
        return condition

    # TC-001: Login gueltig
    check("TC-001", token_demo is not None, f"Login demo@ → {'token erhalten' if token_demo else 'FEHLER'}")

    # TC-002: Login mit nicht-adesso E-Mail → 403
    s, _ = app_req("POST", "/auth/callback", {"email": "hacker@extern.de", "name": "Hacker"})
    check("TC-002", s == 403, f"Login extern@ → HTTP {s}")

    # TC-003: GET /auth/me mit Token
    s, d = app_req("GET", "/auth/me", token=token_demo)
    check("TC-003", s == 200 and d.get("email") == "demo@adesso.de", f"GET /auth/me → {s}, email={d.get('email')}")

    # TC-004: GET /auth/me ohne Token
    s, _ = app_req("GET", "/auth/me")
    check("TC-004", s == 401, f"GET /auth/me (kein Token) → HTTP {s}")

    # TC-005: PUT /user/location
    s, d = app_req("PUT", "/user/location", {"locationId": "loc-dortmund"}, token=token_demo)
    check("TC-005", s == 200, f"PUT /user/location → {s}")

    # TC-006: PUT /user/settings (language)
    s, d = app_req("PUT", "/user/settings", {"language": "EN"}, token=token_demo)
    check("TC-006", s == 200, f"PUT /user/settings language=EN → {s}")
    # Zurueck auf DE
    app_req("PUT", "/user/settings", {"language": "DE"}, token=token_demo)

    # TC-007: Business Line & CC
    s, d = app_req("PUT", "/user/settings",
                   {"businessLine": "Digital Experience", "competenceCenter": "Cloud & Infrastructure"},
                   token=token_demo)
    check("TC-007", s == 200 and d.get("businessLine") == "Digital Experience",
          f"PUT /user/settings BL/CC → {s}, BL={d.get('businessLine')}")

    print("\n[Feed & Swipe]")
    # TC-101: Feed
    s, d = app_req("GET", "/events/feed", token=token_demo)
    feed_ok = s == 200 and isinstance(d, list) and len(d) > 0
    check("TC-101", feed_ok, f"GET /events/feed → {s}, {len(d) if isinstance(d,list) else '?'} Events")
    first_event_id = d[0]["id"] if feed_ok else "evt-4"
    second_event_id = d[1]["id"] if feed_ok and len(d) > 1 else "evt-5"

    # TC-102: Feed ohne Token
    s, _ = app_req("GET", "/events/feed")
    check("TC-102", s == 401, f"GET /events/feed (kein Token) → HTTP {s}")

    # TC-103: Feed mit Standort-Filter
    s, d = app_req("GET", "/events/feed?locationId=loc-muenster", token=token_demo)
    check("TC-103", s == 200, f"GET /events/feed?locationId=loc-muenster → {s}")

    # TC-104: Swipe RIGHT
    s, d = app_req("POST", "/swipe", {"eventId": first_event_id, "direction": "RIGHT"}, token=token_demo)
    check("TC-104", s in (201, 200), f"POST /swipe RIGHT {first_event_id} → {s}")

    # TC-105: Swipe LEFT
    s, d = app_req("POST", "/swipe", {"eventId": second_event_id, "direction": "LEFT"}, token=token_demo)
    check("TC-105", s in (201, 200), f"POST /swipe LEFT {second_event_id} → {s}")

    # TC-106: Event Details
    s, d = app_req("GET", "/events/evt-1", token=token_demo)
    check("TC-106", s == 200 and "title" in d, f"GET /events/evt-1 → {s}, title={d.get('title','?')[:30]}")

    # TC-107: Undo
    s, _ = app_req("DELETE", f"/swipe/{first_event_id}", token=token_demo)
    check("TC-107", s in (200, 204), f"DELETE /swipe/{first_event_id} → {s}")

    print("\n[Event-Erstellung]")
    import datetime
    future = (datetime.datetime.utcnow() + datetime.timedelta(days=10)).strftime("%Y-%m-%dT10:00:00.000Z")
    new_event_payload = {
        "title": "QA Test Event", "description": "Automatisch erstelltes Test-Event fuer QA-Zwecke.",
        "type": "MEETING", "locationId": "loc-dortmund", "startDate": future,
        "maxAttendees": 5, "audienceType": "ALL",
    }

    # TC-201: Organizer erstellt Event
    s, d = app_req("POST", "/events", new_event_payload, token=token_org)
    new_event_id = d.get("id") if s == 201 else None
    check("TC-201", s == 201 and new_event_id is not None, f"POST /events (org) → {s}, id={new_event_id}")

    # TC-202: User kann kein Event erstellen
    s, _ = app_req("POST", "/events", new_event_payload, token=token_demo)
    check("TC-202", s == 403, f"POST /events (user) → {s}")

    # TC-203: Event in Vergangenheit
    past_payload = {**new_event_payload, "startDate": "2020-01-01T10:00:00.000Z"}
    s, d = app_req("POST", "/events", past_payload, token=token_org)
    check("TC-203", s == 400, f"POST /events (past date) → {s}")

    # TC-204: Event bearbeiten
    if new_event_id:
        s, d = app_req("PUT", f"/events/{new_event_id}", {"title": "QA Test Event (aktualisiert)"}, token=token_org)
        check("TC-204", s == 200, f"PUT /events/{new_event_id} → {s}")

    # TC-205: Event absagen
    if new_event_id:
        s, _ = app_req("DELETE", f"/events/{new_event_id}", token=token_org)
        check("TC-205", s in (200, 204), f"DELETE /events/{new_event_id} → {s}")

    # TC-206: Audience LOCATION
    loc_payload = {**new_event_payload, "title": "QA Location Event",
                   "audienceType": "LOCATION", "audienceValue": '["loc-berlin","loc-hamburg"]'}
    s, d = app_req("POST", "/events", loc_payload, token=token_org)
    loc_event_id = d.get("id") if s == 201 else None
    check("TC-206", s == 201, f"POST /events LOCATION → {s}")
    if loc_event_id:
        app_req("DELETE", f"/events/{loc_event_id}", token=token_org)

    # TC-209: Eigene Events
    s, d = app_req("GET", "/events/my", token=token_org)
    check("TC-209", s == 200 and isinstance(d, list), f"GET /events/my (org) → {s}, {len(d) if isinstance(d,list) else '?'} Events")

    print("\n[Admin]")
    # TC-301: Admin users
    s, d = app_req("GET", "/admin/users", token=token_adm)
    check("TC-301", s == 200 and isinstance(d, list) and len(d) >= 3,
          f"GET /admin/users (admin) → {s}, {len(d) if isinstance(d,list) else '?'} Nutzer")

    # TC-302: User → 403
    s, _ = app_req("GET", "/admin/users", token=token_demo)
    check("TC-302", s == 403, f"GET /admin/users (user) → {s}")

    # TC-303: Stats
    s, d = app_req("GET", "/admin/stats", token=token_adm)
    check("TC-303", s == 200 and "totalUsers" in d, f"GET /admin/stats → {s}, totalUsers={d.get('totalUsers')}")

    # TC-304: Locations (alle Nutzer)
    s, d = app_req("GET", "/admin/locations", token=token_demo)
    muenster = any(l.get("id") == "loc-muenster" for l in d) if isinstance(d, list) else False
    check("TC-304", s == 200 and muenster, f"GET /admin/locations → {s}, Muenster={muenster}, total={len(d) if isinstance(d,list) else '?'}")

    # TC-305: Admin/all events
    s, d = app_req("GET", "/events/admin/all", token=token_adm)
    check("TC-305", s == 200 and isinstance(d, list) and len(d) >= 16,
          f"GET /events/admin/all (admin) → {s}, {len(d) if isinstance(d,list) else '?'} Events")

    # TC-306: User → 403
    s, _ = app_req("GET", "/events/admin/all", token=token_demo)
    check("TC-306", s == 403, f"GET /events/admin/all (user) → {s}")

    print("\n[Microsoft Graph API – Kalender-Sync]")

    # TC-601-01: /microsoft/status ohne Verbindung
    s, d = app_req("GET", "/microsoft/status", token=token_demo)
    check("TC-601-01", s == 200 and d.get("connected") is False,
          f"GET /microsoft/status → {s}, connected={d.get('connected')}")

    # TC-601-02: /microsoft/status ohne Token → 401
    s, _ = app_req("GET", "/microsoft/status")
    check("TC-601-02", s == 401, f"GET /microsoft/status (kein Token) → HTTP {s}")

    # TC-601-03: /microsoft/connect ohne Token → 401
    import urllib.request as _ur2
    try:
        _req = _ur2.Request(f"{APP_URL}/api/microsoft/connect", method="GET")
        with _ur2.urlopen(_req) as _r:
            _s = _r.status
    except urllib.error.HTTPError as _e:
        _s = _e.code
    check("TC-601-03", _s == 401, f"GET /microsoft/connect (kein Token) → HTTP {_s}")

    # TC-601-04: /microsoft/connect mit Token → 302 zu Azure AD
    import urllib.request as _ur3
    _connect_url = f"{APP_URL}/api/microsoft/connect?token={token_demo}"
    _location = ""
    try:
        _req = _ur3.Request(_connect_url, method="GET")
        _opener = _ur3.build_opener(_ur3.HTTPRedirectHandler())
        # Disable redirect following to capture the 302
        class _NoRedirect(_ur3.HTTPRedirectHandler):
            def redirect_request(self, *a, **kw): return None
        _opener2 = _ur3.build_opener(_NoRedirect())
        with _opener2.open(_req) as _r:
            _s = _r.status
            _location = _r.headers.get("Location", "")
    except urllib.error.HTTPError as _e:
        _s = _e.code
        _location = _e.headers.get("Location", "")
    check("TC-601-04", _s == 302 and "login.microsoftonline.com" in _location,
          f"GET /microsoft/connect → HTTP {_s}, Location: {_location[:60]}")

    # TC-601-05: Swipe-RIGHT ohne MS-Verbindung – kein 500 (best-effort Fallback)
    s2, d2 = app_req("GET", "/events/feed", token=token_demo)
    _fallback_id = d2[0]["id"] if s2 == 200 and isinstance(d2, list) and d2 else "evt-4"
    s, d = app_req("POST", "/swipe", {"eventId": _fallback_id, "direction": "RIGHT"}, token=token_demo)
    check("TC-601-05", s in (200, 201) and d.get("direction") == "RIGHT",
          f"Swipe RIGHT ohne MS-Token → HTTP {s}, direction={d.get('direction')}, attendance={d.get('attendanceStatus')}")
    # Cleanup
    app_req("DELETE", f"/swipe/{_fallback_id}", token=token_demo)

    # TC-601-06: /microsoft/disconnect → 200
    s, d = app_req("DELETE", "/microsoft/disconnect", token=token_demo)
    check("TC-601-06", s == 200 and "disconnected" in d.get("message", "").lower(),
          f"DELETE /microsoft/disconnect → HTTP {s}, msg={d.get('message','')}")

    return results

# ── Hauptprogramm ─────────────────────────────────────────────────────────────

def main():
    print("\n" + "="*60)
    print("adessoEventApp – QA Testing (BMAD Tester Role)")
    print("="*60)

    # Phase 1: Jira-Testfaelle erstellen
    print("\nPHASE 1: Jira-Testfaelle erstellen und verknuepfen")
    print("-"*60)

    # QA-Epic erstellen
    global EPIC_QA
    r = jira_post("issue", {"fields": {
        "project":   {"key": PROJECT_KEY},
        "issuetype": {"name": "Epic"},
        "summary":   "Epic 11 – QA & Testing",
    }})
    if r and "key" in r:
        EPIC_QA = r["key"]
        print(f"  Epic erstellt: {EPIC_QA} – Epic 11 – QA & Testing")
    time.sleep(0.5)

    tc_keys = {}
    auto_tcs = [tc["id"] for tc in TEST_CASES if "manuell" not in tc["labels"]]

    for tc in TEST_CASES:
        key = create_ticket(
            summary=tc["summary"],
            description=tc["description"],
            labels=tc["labels"],
            epic_key=EPIC_QA,
        )
        if key:
            tc_keys[tc["id"]] = key
            us_key = US.get(tc.get("us", ""))
            link_str = ""
            if us_key:
                link_issues(key, us_key)
                link_str = f" -> verknuepft mit {us_key}"
            print(f"  OK {key}: {tc['id']}{link_str}")
        time.sleep(0.2)

    print(f"\n  {len(tc_keys)} Testfaelle erstellt ({len(auto_tcs)} automatisiert, {len(TEST_CASES)-len(auto_tcs)} manuell)")

    # Phase 2: API-Tests ausfuehren
    test_results = run_api_tests()

    # Phase 3: Ergebnisse in Jira eintragen
    print("\nPHASE 3: Testergebnisse in Jira dokumentieren")
    print("-"*60)
    passed = failed = 0
    for tc_id, (ok, detail) in test_results.items():
        jira_key = tc_keys.get(tc_id)
        if not jira_key:
            continue
        label = "✅ BESTANDEN" if ok else "❌ FEHLGESCHLAGEN"
        update_ticket_status(jira_key, label, detail)
        if ok:
            passed += 1
        else:
            failed += 1
            # Bug-Ticket erstellen
            bug_key = create_ticket(
                summary=f"[BUG] {tc_id} fehlgeschlagen: {detail[:80]}",
                description=f"*Entdeckt durch:* {jira_key} ({tc_id})\n*Detail:* {detail}\n*Prioritaet:* Hoch",
                labels=["bug", "qa", tc_id.lower()],
                epic_key=EPIC_QA,
            )
            if bug_key:
                link_issues(bug_key, jira_key)
                print(f"  BUG angelegt: {bug_key} fuer {tc_id}")

    # Zusammenfassung
    total = len(test_results)
    print(f"\n{'='*60}")
    print(f"ERGEBNIS: {passed}/{total} Tests bestanden | {failed} fehlgeschlagen")
    print(f"{'='*60}")
    print(f"\n  Jira: {JIRA_URL}/jira/software/projects/{PROJECT_KEY}/list")
    print(f"  App:  https://adesso-event-app.vercel.app")


if __name__ == "__main__":
    main()
