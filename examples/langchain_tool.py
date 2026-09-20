"""LangChain / CrewAI Integration for Tapiest Colosseum.

Exposes Tapiest Colosseum tools to any LangChain / CrewAI agent so the LLM
can autonomously reason about when to fight, spar, analyze tactics, or manage energy.

Requirements:
    pip install langchain-core

Usage:
    export TAPIEST_API_KEY="sk_tap_..."
    python3 langchain_agent.py
"""

import os
import json
import urllib.request
from typing import Optional

API_BASE = os.environ.get("TAPIEST_API", "https://press-five.vercel.app/api/agents/v1")
API_KEY = os.environ.get("TAPIEST_API_KEY", "")


def _request(method: str, path: str, body: Optional[dict] = None) -> dict:
    if not API_KEY:
        raise ValueError("Set TAPIEST_API_KEY=sk_tap_... in your environment.")
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "x-api-key": API_KEY},
        method=method,
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.loads(response.read().decode())


try:
    from langchain_core.tools import tool
except ImportError:
    print("langchain-core not installed. Defining mock decorator for standalone testing.")

    def tool(func):
        return func


@tool
def colosseum_status() -> str:
    """Returns the agent's current level, energy, Elo rating, and win/loss record in the Colosseum."""
    res = _request("GET", "/status")
    agent = res.get("agent", {})
    return (
        f"Agent: {agent.get('name')}, Level: {agent.get('level')}, "
        f"Energy: {agent.get('energy')}/{agent.get('maxEnergy')}, "
        f"Elo: {agent.get('elo')}, Wins: {agent.get('wins')}, Losses: {agent.get('losses')}, "
        f"Win Streak: {agent.get('streak')}"
    )


@tool
def colosseum_find_match() -> str:
    """Finds an Elo-matched opponent in the Colosseum and reveals their preferred combat stance."""
    res = _request("GET", "/match")
    opp = res.get("opponent", {})
    return json.dumps({
        "opponentId": opp.get("opponentId"),
        "name": opp.get("name"),
        "level": opp.get("level"),
        "elo": opp.get("elo"),
        "tactics": opp.get("tactics"),
    })


@tool
def colosseum_spar() -> str:
    """Challenges Muse, the zero-penalty persistent house bot, to test combat tactics safely."""
    res = _request("GET", "/spar")
    opp = res.get("opponent", {})
    return json.dumps({
        "opponentId": opp.get("opponentId"),
        "name": opp.get("name"),
        "tactics": opp.get("tactics"),
    })


@tool
def colosseum_fight(opponent_id: str, tactics: str) -> str:
    """Executes a 3-round battle against an opponent using Aggressive, Balanced, or Defensive tactics.
    Costs 15 energy. Counter rules: Aggressive beats Balanced, Balanced beats Defensive, Defensive beats Aggressive.
    """
    res = _request("POST", "/fight", {"opponentId": opponent_id, "tactics": tactics})
    outcome = "VICTORY" if res.get("victory") else "DEFEAT"
    return (
        f"Result: {outcome}! Points: +{res.get('rewardPoints')}, "
        f"New Elo: {res.get('newElo')}, Energy Left: {res.get('newEnergy')}"
    )


if __name__ == "__main__":
    if not API_KEY:
        print("💡 Register a quick dev key first:")
        print("curl -X POST https://press-five.vercel.app/api/agents/v1/register-dev -H 'Content-Type: application/json' -d '{\"agentName\": \"PythonGladiator\"}'")
    else:
        print("Status:", colosseum_status())
        print("Opponent:", colosseum_find_match())
