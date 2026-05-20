"""
Nimmt Screenshots der adessoEventApp (aktueller Stand inkl. Info-Button + Undo).
"""
import os, time
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(OUT, exist_ok=True)

VIEWPORT = {"width": 390, "height": 844}  # iPhone 14 Pro

def shot(page, name, delay=0.8):
    if delay:
        time.sleep(delay)
    page.screenshot(path=os.path.join(OUT, f"{name}.png"), full_page=False)
    print(f"  OK {name}.png")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport=VIEWPORT, device_scale_factor=2)
    page = ctx.new_page()

    # ── 1. Login-Screen ──
    page.goto("http://localhost:5173", wait_until="networkidle")
    time.sleep(1)
    shot(page, "01_login")

    # ── Login als User ──
    page.fill('input[type="email"]', "demo@adesso.de")
    page.click('button[type="submit"]')
    time.sleep(2)

    try:
        page.wait_for_selector("button:has-text('Speichern')", timeout=3000)
        page.locator("button.rounded-xl").first.click()
        time.sleep(0.5)
        page.click("button:has-text('Speichern')")
        time.sleep(1.5)
    except Exception:
        pass

    # ── 2. Feed ──
    shot(page, "02_feed")

    # ── 3. Info-Button Popup ──
    try:
        info_btn = page.locator("button[aria-label='Beschreibung anzeigen']").first
        info_btn.wait_for(timeout=3000)
        info_btn.click()
        time.sleep(0.6)
        shot(page, "03_info_popup")
        # Popup schliessen
        page.locator("button[aria-label='Schließen']").first.click()
        time.sleep(0.4)
    except Exception as e:
        print(f"  ! info popup skipped: {e}")

    # ── 4. Swipe rechts (Interesse) ──
    try:
        card = page.locator(".cursor-grab").first
        box = card.bounding_box()
        if box:
            cx = box["x"] + box["width"] / 2
            cy = box["y"] + box["height"] / 2
            page.mouse.move(cx, cy)
            page.mouse.down()
            page.mouse.move(cx + 110, cy, steps=12)
            time.sleep(0.4)
            shot(page, "04_swipe_right")
            page.mouse.up()
            time.sleep(1.2)
    except Exception as e:
        print(f"  ! swipe skipped: {e}")

    # ── 5. Undo-Button (leuchtet gelb nach Swipe) ──
    shot(page, "05_undo_button")

    # ── 6. Meine Events ──
    try:
        page.click("button:has-text('Meine Events')")
        time.sleep(1.5)
        shot(page, "06_my_events")
    except Exception as e:
        print(f"  ! my events skipped: {e}")

    # ── 7. Profil ──
    try:
        page.click("button:has-text('Profil')")
        time.sleep(1)
        shot(page, "07_profile")
    except Exception as e:
        print(f"  ! profile skipped: {e}")

    # ── Login als Organisator ──
    try:
        page.click("button:has-text('Abmelden')")
        time.sleep(1)
        page.fill('input[type="email"]', "organizer@adesso.de")
        page.click('button[type="submit"]')
        time.sleep(2)
        try:
            page.wait_for_selector("button:has-text('Speichern')", timeout=3000)
            page.locator("button.rounded-xl").first.click()
            time.sleep(0.5)
            page.click("button:has-text('Speichern')")
            time.sleep(1.5)
        except Exception:
            pass
    except Exception as e:
        print(f"  ! organizer login skipped: {e}")

    # ── 8. Organizer Dashboard ──
    try:
        page.click("button:has-text('Events')", timeout=3000)
        time.sleep(1.5)
        shot(page, "08_organizer")
    except Exception as e:
        print(f"  ! organizer tab skipped: {e}")

    # ── 9. Event erstellen Formular ──
    try:
        page.click("button:has-text('Neues Event')", timeout=3000)
        time.sleep(1)
        shot(page, "09_create_event")
    except Exception as e:
        print(f"  ! create form skipped: {e}")

    browser.close()

print("\nAlle Screenshots gespeichert in:", OUT)
