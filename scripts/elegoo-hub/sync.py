#!/usr/bin/env python3
"""
Elegoo Hub — Raspberry Pi script
Polls Elegoo printers via Moonraker API and pushes status to Prototipalo.

Usage:
  pip install requests
  python3 sync.py

Environment variables (or edit PRINTERS / CONFIG below):
  PROTOTIPALO_URL   — e.g. https://tu-app.vercel.app
  ELEGOO_HUB_SECRET — same token configured in Vercel env
"""

import os
import time
import requests

# ── Config ──────────────────────────────────────────────────────────────────────

API_URL = os.environ.get("PROTOTIPALO_URL", "https://tu-app.vercel.app")
SECRET = os.environ.get("ELEGOO_HUB_SECRET", "changeme")
POLL_INTERVAL = 30  # seconds

# Define your printers here. serial_number must be unique and stable.
PRINTERS = [
    {"ip": "192.168.1.56", "serial": "ELEGOO-N4M-1", "name": "Neptune 4 Max 1", "model": "Neptune 4 Max"},
    {"ip": "192.168.1.XX", "serial": "ELEGOO-N4M-2", "name": "Neptune 4 Max 2", "model": "Neptune 4 Max"},
    {"ip": "192.168.1.XX", "serial": "ELEGOO-N4M-3", "name": "Neptune 4 Max 3", "model": "Neptune 4 Max"},
    {"ip": "192.168.1.XX", "serial": "ELEGOO-N4M-4", "name": "Neptune 4 Max 4", "model": "Neptune 4 Max"},
    {"ip": "192.168.1.XX", "serial": "ELEGOO-GIGA-1", "name": "OrangeStorm Giga", "model": "OrangeStorm Giga"},
]

# ── Moonraker state → Prototipalo gcode_state mapping ──────────────────────────

STATE_MAP = {
    "standby": "IDLE",
    "printing": "RUNNING",
    "paused": "PAUSE",
    "complete": "FINISH",
    "error": "FAILED",
    "cancelled": "IDLE",
}

# ── Polling logic ───────────────────────────────────────────────────────────────

def query_printer(ip: str) -> dict | None:
    """Query a single Elegoo printer via Moonraker HTTP API."""
    try:
        url = (
            f"http://{ip}/printer/objects/query"
            f"?print_stats=state,filename,print_duration,info"
            f"&display_status=progress"
            f"&extruder=temperature,target"
            f"&heater_bed=temperature,target"
        )
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        return resp.json().get("result", {}).get("status", {})
    except Exception as e:
        print(f"  [!] Failed to query {ip}: {e}")
        return None


def estimate_remaining(progress: float, print_duration: float) -> int | None:
    """Estimate remaining minutes from progress (0-1) and elapsed seconds."""
    if progress is None or progress <= 0 or print_duration is None or print_duration <= 0:
        return None
    total_est = print_duration / progress
    remaining_sec = total_est - print_duration
    return max(0, round(remaining_sec / 60))


def build_payload(printer_cfg: dict, status: dict | None) -> dict:
    """Build a printer payload for the Prototipalo API."""
    base = {
        "serial_number": printer_cfg["serial"],
        "name": printer_cfg["name"],
        "model": printer_cfg["model"],
        "online": False,
        "gcode_state": None,
        "print_percent": None,
        "remaining_minutes": None,
        "current_file": None,
        "layer_current": None,
        "layer_total": None,
        "nozzle_temp": None,
        "nozzle_target": None,
        "bed_temp": None,
        "bed_target": None,
        "chamber_temp": None,
        "speed_level": None,
        "fan_speed": None,
        "print_error": 0,
    }

    if status is None:
        return base

    ps = status.get("print_stats", {})
    ds = status.get("display_status", {})
    ext = status.get("extruder", {})
    bed = status.get("heater_bed", {})

    klipper_state = ps.get("state", "standby")
    progress = ds.get("progress", 0) or 0
    print_duration = ps.get("print_duration", 0) or 0
    info = ps.get("info") or {}

    base["online"] = True
    base["gcode_state"] = STATE_MAP.get(klipper_state, "IDLE")
    base["print_percent"] = round(progress * 100)
    base["remaining_minutes"] = estimate_remaining(progress, print_duration)
    base["current_file"] = ps.get("filename") or None
    base["layer_current"] = info.get("current_layer")
    base["layer_total"] = info.get("total_layer")
    base["nozzle_temp"] = round(ext.get("temperature", 0), 1) if ext.get("temperature") else None
    base["nozzle_target"] = round(ext.get("target", 0), 1) if ext.get("target") else None
    base["bed_temp"] = round(bed.get("temperature", 0), 1) if bed.get("temperature") else None
    base["bed_target"] = round(bed.get("target", 0), 1) if bed.get("target") else None

    if klipper_state == "error":
        base["print_error"] = 1

    return base


def sync_all():
    """Poll all printers and push to Prototipalo."""
    payloads = []
    for p in PRINTERS:
        print(f"  Querying {p['name']} ({p['ip']})...")
        status = query_printer(p["ip"])
        payloads.append(build_payload(p, status))

    try:
        resp = requests.post(
            f"{API_URL}/api/printers/elegoo-sync",
            json={"printers": payloads},
            headers={"Authorization": f"Bearer {SECRET}"},
            timeout=10,
        )
        data = resp.json()
        if resp.ok:
            print(f"  -> Synced {data.get('synced', 0)} printers")
        else:
            print(f"  -> Error: {data.get('error', resp.status_code)}")
    except Exception as e:
        print(f"  -> Push failed: {e}")


# ── Main loop ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"Elegoo Hub starting — polling {len(PRINTERS)} printers every {POLL_INTERVAL}s")
    print(f"API: {API_URL}/api/printers/elegoo-sync")
    print()

    while True:
        print(f"[{time.strftime('%H:%M:%S')}] Polling...")
        sync_all()
        print()
        time.sleep(POLL_INTERVAL)
