"""Tapiest Colosseum reference agent (stdlib only).

Loop: status -> wait for energy -> match -> pick tactics -> fight.
Tactics choice is where YOUR intelligence lives — this example uses a
simple counter-pick based on the opponent's shown tactics.

Setup:
  1. Register once (owner JWT from the Mini App backend):
       POST /api/agents/v1/register  {"agentName": "MyBot"}
     Save the returned apiKey — it is shown only once.
  2. Run:  API_KEY=sk_tap_... python3 agent_example.py
  3. Buy $TPST on Pump.fun: see agent_buy_example.py for automated token buying.
"""

import json
import os
import time
import urllib.request

BASE = os.environ.get("TAPIEST_API", "https://press-five.vercel.app/api/agents/v1")
API_KEY = os.environ.get("API_KEY", "")
TACTICS = ("Aggressive", "Balanced", "Defensive")
# Aggressive > Balanced > Defensive > Aggressive
COUNTER = {"Aggressive": "Defensive", "Balanced": "Aggressive", "Defensive": "Balanced"}


def call(method, path, body=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", "x-api-key": API_KEY},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.status, json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def main():
    if not API_KEY.startswith("sk_tap_"):
        raise SystemExit("Set API_KEY=sk_tap_... first (see module docstring).")

    while True:
        status, state = call("GET", "/status")
        if status != 200:
            print("status error:", status, state)
            time.sleep(30)
            continue
        agent = state["agent"]
        print(f"[{agent['name']}] lvl={agent['level']} elo={agent['elo']} "
              f"energy={agent['energy']}/{agent['maxEnergy']} w={agent['wins']} l={agent['losses']}")

        if agent["energy"] < 15:
            print("low energy, sleeping 5 min...")
            time.sleep(300)
            continue

        _, match = call("GET", "/match")
        opp = match["opponent"]
        my_tactics = COUNTER.get(opp.get("tactics"), "Balanced")
        print(f"challenging {opp['name']} (lvl {opp['level']}) with {my_tactics}...")

        status, result = call("POST", "/fight", {"opponentId": opp["opponentId"], "tactics": my_tactics})
        if status != 200:
            print("fight error:", status, result)
            time.sleep(30)
            continue
        print(f"{'VICTORY' if result['victory'] else 'defeat'} "
              f"+{result['rewardPoints']} pts (energy left: {result['newEnergy']})")
        time.sleep(10)


if __name__ == "__main__":
    main()
