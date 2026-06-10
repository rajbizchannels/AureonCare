#!/usr/bin/env python3
"""Generate the AureonCare physician-facing one-page feature visual (PNG + PDF)."""
import base64

W, H = 1240, 1754  # A4 portrait @ 150 dpi
M = 70             # page margin

GOLD = "#F2A91E"
GOLD_DARK = "#D98E00"
TEAL = "#17A398"
TEAL_DEEP = "#0E3D3B"
TEAL_MID = "#0F5A54"
INK = "#1E3432"
GREY = "#4A5F5D"
CARD_BG = "#F3FAF8"
CARD_EDGE = "#D8ECE8"

with open("/home/user/AureonCare/frontend/public/assets/aureoncare-logo-wide.png", "rb") as f:
    LOGO64 = base64.b64encode(f.read()).decode()

FONT = "Inter Display"


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def text(x, y, s, size, weight=400, fill=INK, anchor="start", spacing=None, opacity=1):
    sp = f' letter-spacing="{spacing}"' if spacing else ""
    return (f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" '
            f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{sp} '
            f'opacity="{opacity}">{esc(s)}</text>')


# ---- simple line icons (drawn in a 44x44 box centred at 0,0) ----------------
def icon(name, color="#FFFFFF"):
    s = f'stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"'
    if name == "ehr":  # chart/document with pulse line
        return (f'<path d="M-13,-18 h20 l6,6 v30 h-26 z" {s}/>'
                f'<path d="M7,-18 v6 h6" {s}/>'
                f'<path d="M-8,2 h4 l3,-6 4,10 3,-4 h7" {s}/>')
    if name == "calendar":
        return (f'<rect x="-15" y="-13" width="30" height="28" rx="3" {s}/>'
                f'<path d="M-15,-5 h30 M-8,-19 v8 M8,-19 v8" {s}/>'
                f'<path d="M-7,4 l4,4 8,-8" {s}/>')
    if name == "video":
        return (f'<rect x="-16" y="-11" width="22" height="22" rx="4" {s}/>'
                f'<path d="M6,-3 l10,-6 v18 l-10,-6 z" {s}/>')
    if name == "rx":
        return (f'<path d="M-9,-17 v34 M-9,-17 h10 a8,8 0 0 1 0,16 h-10" {s}/>'
                f'<path d="M1,-1 l14,18 M15,3 l-12,14" {s}/>')
    if name == "lab":
        return (f'<path d="M-5,-18 v12 l-11,18 a4,4 0 0 0 3.5,6 h25 a4,4 0 0 0 3.5,-6 l-11,-18 v-12" {s}/>'
                f'<path d="M-9,-18 h18 M-10,6 h20" {s}/>')
    if name == "rcm":  # currency circle + arrows
        return (f'<circle cx="-2" cy="0" r="13" {s}/>'
                f'<path d="M-2,-8 v16 M3,-5 h-7 a3.5,3.5 0 0 0 0,7 h4 a3.5,3.5 0 0 1 0,7 h-7" {s}/>'
                f'<path d="M13,-11 a17,17 0 0 1 4,11 l3,-3 m-3,3 l-3,-3" {s}/>')
    if name == "portal":  # phone with heart
        return (f'<rect x="-10" y="-18" width="20" height="36" rx="4" {s}/>'
                f'<path d="M-3,12 h6" {s}/>'
                f'<path d="M0,2 c-6,-6 -8,-10 -4,-12 c2.5,-1.2 4,1 4,1 c0,0 1.5,-2.2 4,-1 c4,2 2,6 -4,12 z" {s}/>')
    if name == "chart":
        return (f'<path d="M-16,-16 v32 h32" {s}/>'
                f'<path d="M-9,8 v-8 M-1,8 v-16 M7,8 v-11 M15,8 v-20" {s}/>')
    if name == "shield":
        return (f'<path d="M0,-19 l15,5 v10 c0,11 -7,18 -15,22 c-8,-4 -15,-11 -15,-22 v-10 z" {s}/>'
                f'<path d="M-6,0 l4,5 9,-10" {s}/>')
    return ""


FEATURES = [
    ("ehr", "Electronic Health Records",
     ["Unified patient charts with SOAP notes, ICD-10", "coding, prescriptions and complete histories."]),
    ("calendar", "Intelligent Scheduling",
     ["Day, week and month views with waitlists and", "automated SMS, email and WhatsApp reminders."]),
    ("video", "Integrated Telehealth",
     ["Secure video consultations via Zoom, Google", "Meet or Webex, documented in real time."]),
    ("rx", "ePrescribing",
     ["Surescripts connectivity reaching 95% of U.S.", "pharmacies, with refill tracking built in."]),
    ("lab", "Laboratory Integration",
     ["Electronic lab orders and results through Labcorp,", "with automatic flagging of abnormal values."]),
    ("rcm", "Revenue Cycle Management",
     ["Automated charge capture, claims, eligibility", "verification and denial management workflows."]),
    ("portal", "Patient Portal",
     ["24/7 self-service for appointments, records, lab", "results, refill requests and online payments."]),
    ("chart", "Reporting & Analytics",
     ["Real-time clinical, operational and financial", "dashboards with quality metrics and exports."]),
]

p = []
p.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
p.append(f'''<defs>
  <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="{TEAL_DEEP}"/><stop offset="1" stop-color="{TEAL_MID}"/>
  </linearGradient>
  <linearGradient id="goldline" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="{GOLD}"/><stop offset="1" stop-color="{TEAL}"/>
  </linearGradient>
</defs>''')

# ---------------------------------------------------------------- background
p.append(f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>')

# ---------------------------------------------------------------- header
logo_h = 88
logo_w = int(logo_h * 522 / 170)
p.append(f'<image x="{M}" y="40" width="{logo_w}" height="{logo_h}" '
         f'href="data:image/png;base64,{LOGO64}"/>')
p.append(text(W - M, 78, "PRACTICE MANAGEMENT  ·  EHR  ·  TELEHEALTH", 17, 600, TEAL_MID, "end", "2.5"))
p.append(text(W - M, 106, "For Physicians, Clinics & Healthcare Groups", 17, 400, GREY, "end"))
p.append(f'<rect x="{M}" y="156" width="{W - 2*M}" height="4" rx="2" fill="url(#goldline)"/>')

# ---------------------------------------------------------------- hero band
hero_y, hero_h = 190, 240
p.append(f'<rect x="0" y="{hero_y}" width="{W}" height="{hero_h}" fill="url(#hero)"/>')
# subtle decorative circles
p.append(f'<circle cx="{W-150}" cy="{hero_y+200}" r="150" fill="#FFFFFF" opacity="0.04"/>')
p.append(f'<circle cx="{W-60}" cy="{hero_y+40}" r="100" fill="{GOLD}" opacity="0.08"/>')
p.append(text(W/2, hero_y + 78, "One Platform. One Patient Record.", 44, 800, "#FFFFFF", "middle"))
p.append(text(W/2, hero_y + 134, "End-to-End Care.", 44, 800, GOLD, "middle"))
p.append(text(W/2, hero_y + 188,
              "A unified, HIPAA-aligned practice management and EHR platform — so your team can focus on patients, not paperwork.",
              19, 400, "#D9ECEA", "middle"))

# ---------------------------------------------------------------- invitation line
inv_y = hero_y + hero_h + 56
p.append(text(W/2, inv_y,
              "We respectfully invite you to discover how AureonCare brings every aspect of your practice together.",
              20, 500, GREY, "middle"))

# ---------------------------------------------------------------- features
sec_y = inv_y + 56
p.append(text(W/2, sec_y, "A Complete Platform for the Modern Medical Practice", 30, 700, INK, "middle"))

card_w, card_h, gap = 550, 132, 30
row_gap = 20
gx = (W - 2*card_w - gap) / 2
gy = sec_y + 34
for i, (ic, title, lines) in enumerate(FEATURES):
    cx = gx + (i % 2) * (card_w + gap)
    cy = gy + (i // 2) * (card_h + row_gap)
    p.append(f'<rect x="{cx}" y="{cy}" width="{card_w}" height="{card_h}" rx="14" '
             f'fill="{CARD_BG}" stroke="{CARD_EDGE}" stroke-width="1.5"/>')
    p.append(f'<rect x="{cx}" y="{cy}" width="6" height="{card_h}" rx="3" fill="{GOLD if i % 2 == 0 else TEAL}"/>')
    icx, icy = cx + 52, cy + card_h/2
    p.append(f'<circle cx="{icx}" cy="{icy}" r="30" fill="{TEAL if i % 2 == 0 else GOLD_DARK}"/>')
    p.append(f'<g transform="translate({icx},{icy}) scale(0.78)">{icon(ic)}</g>')
    tx = cx + 100
    p.append(text(tx, cy + 46, title, 21, 700, INK))
    p.append(text(tx, cy + 76, lines[0], 16.5, 400, GREY))
    p.append(text(tx, cy + 101, lines[1], 16.5, 400, GREY))

# ---------------------------------------------------------------- security strip
sec2_y = gy + 4 * (card_h + row_gap) - row_gap + 24
strip_h = 94
p.append(f'<rect x="{M}" y="{sec2_y}" width="{W - 2*M}" height="{strip_h}" rx="14" '
         f'fill="#FDF6E7" stroke="#F0DFB6" stroke-width="1.5"/>')
shx, shy = M + 56, sec2_y + strip_h/2
p.append(f'<circle cx="{shx}" cy="{shy}" r="32" fill="{GOLD_DARK}"/>')
p.append(f'<g transform="translate({shx},{shy}) scale(0.8)">{icon("shield")}</g>')
p.append(text(M + 110, sec2_y + 40, "Security & Interoperability You Can Rely On", 20, 700, INK))
p.append(text(M + 110, sec2_y + 70,
              "HIPAA-aligned safeguards  ·  FHIR R4 & HL7 standards  ·  Encryption in transit and at rest  ·  Role-based access  ·  Full audit logging",
              16.5, 400, GREY))

# ---------------------------------------------------------------- stats row
st_y = sec2_y + strip_h + 30
stats = [
    ("65%", "fewer no-shows with", "automated reminders"),
    ("40%", "less time spent on", "clinical documentation"),
    ("95%", "of U.S. pharmacies reached", "via Surescripts ePrescribing"),
    ("24/7", "patient self-service", "through the portal"),
]
sw = (W - 2*M - 3*24) / 4
for i, (big, l1, l2) in enumerate(stats):
    sx = M + i * (sw + 24)
    p.append(f'<rect x="{sx}" y="{st_y}" width="{sw}" height="120" rx="14" fill="{TEAL_DEEP}"/>')
    p.append(text(sx + sw/2, st_y + 52, big, 36, 800, GOLD, "middle"))
    p.append(text(sx + sw/2, st_y + 82, l1, 15, 400, "#D9ECEA", "middle"))
    p.append(text(sx + sw/2, st_y + 104, l2, 15, 400, "#D9ECEA", "middle"))

# ---------------------------------------------------------------- CTA footer
cta_y = st_y + 120 + 30
cta_h = H - cta_y
p.append(f'<rect x="0" y="{cta_y}" width="{W}" height="{cta_h}" fill="url(#hero)"/>')
p.append(f'<rect x="0" y="{cta_y}" width="{W}" height="5" fill="url(#goldline)"/>')
p.append(f'<circle cx="120" cy="{cta_y + cta_h}" r="130" fill="#FFFFFF" opacity="0.04"/>')
p.append(text(W/2, cta_y + 64, "We Would Be Delighted to Show You More", 30, 700, "#FFFFFF", "middle"))
p.append(text(W/2, cta_y + 104,
              "Please allow us to arrange a personalised, no-obligation demonstration for you and your practice team,",
              18, 400, "#D9ECEA", "middle"))
p.append(text(W/2, cta_y + 132, "at a time convenient to your schedule.", 18, 400, "#D9ECEA", "middle"))
# contact pill
pill_w, pill_h = 720, 58
px, py = (W - pill_w)/2, cta_y + 164
p.append(f'<rect x="{px}" y="{py}" width="{pill_w}" height="{pill_h}" rx="29" fill="{GOLD}"/>')
p.append(text(W/2, py + 37, "www.aureoncare.tech      ·      support@aureoncare.tech", 20, 700, TEAL_DEEP, "middle"))
p.append(text(W/2, cta_y + cta_h - 28,
              "AureonCare  ·  Health | Efficiency | Growth  ·  Empowering Healthcare Practices with Modern Technology",
              14, 400, "#9CC4C0", "middle"))

p.append('</svg>')

svg = "\n".join(p)
with open("aureoncare-onepager.svg", "w") as f:
    f.write(svg)

import cairosvg
cairosvg.svg2png(bytestring=svg.encode(), write_to="AureonCare-Features-OnePager.png",
                 output_width=W*2, output_height=H*2)
cairosvg.svg2pdf(bytestring=svg.encode(), write_to="AureonCare-Features-OnePager.pdf")
print("done")
