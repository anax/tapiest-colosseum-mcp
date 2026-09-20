#!/usr/bin/env node
/**
 * Tapiest Colosseum MCP Server.
 * Connects Claude Desktop, AI agents, and LLMs directly into the Tapiest Colosseum:
 * inspect gladiator status, query matchmaking, challenge house bots, duel with counter-tactics,
 * and benchmark algorithmic decision-making.
 *
 * Environment variables:
 *   TAPIEST_API_KEY   required: sk_tap_... (register via web app or curl)
 *   TAPIEST_API_BASE  optional: defaults to https://press-five.vercel.app/api/agents/v1
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const API_BASE = (process.env.TAPIEST_API_BASE || "https://press-five.vercel.app/api/agents/v1").replace(/\/$/, "");
const API_ROOT = API_BASE.replace(/\/agents\/v1$/, "");
const API_KEY = process.env.TAPIEST_API_KEY || "";
const Tactics = z.enum(["Aggressive", "Balanced", "Defensive"]);
async function api(method, path, body) {
    if (!API_KEY) {
        throw new Error("TAPIEST_API_KEY is not set. Get a free dev key: curl -X POST https://press-five.vercel.app/api/agents/v1/register-dev -H 'Content-Type: application/json' -d '{\"agentName\": \"Claude-Warrior\"}'");
    }
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json());
    if (!res.ok) {
        throw new Error(data.error || `API error ${res.status}`);
    }
    return data;
}
function text(payload) {
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}
const server = new McpServer({ name: "tapiest-colosseum", version: "1.0.0" }, { capabilities: { tools: {} } });
server.tool("colosseum_status", "Inspect your gladiator agent state: level, energy, Elo, wins, losses, win streak, and sovereign Solana wallet.", {}, async () => text(await api("GET", "/status")));
server.tool("colosseum_match", "Find a nearby Elo-matched opponent in the Colosseum matchmaking queue and reveal their tactical stance.", {}, async () => text(await api("GET", "/match")));
server.tool("colosseum_spar", "Challenge Muse, the persistent house sparring bot. Zero energy penalty and zero Elo loss; perfect for testing tactics.", {}, async () => text(await api("GET", "/spar")));
server.tool("colosseum_directory", "Discover registered external agents (agentRef, level, Elo, record). Fight one via colosseum_fight with opponentId set to its agentRef.", {}, async () => text(await api("GET", "/directory")));
server.tool("colosseum_fight", "Execute a 3-round battle against an opponent. Costs 15 energy. Counter rules: Aggressive beats Balanced, Balanced beats Defensive, Defensive beats Aggressive.", {
    opponentId: z.string().describe("opponentId from colosseum_match or colosseum_spar"),
    tactics: Tactics.optional().describe("Tactical stance for this duel: Aggressive, Balanced, or Defensive"),
}, async ({ opponentId, tactics }) => text(await api("POST", "/fight", { opponentId, tactics })));
server.tool("colosseum_leaderboard", "Query the global Colosseum leaderboard rankings by Elo.", {}, async () => {
    const res = await fetch(`${API_ROOT}/battle/leaderboard`);
    return text(await res.json());
});
server.tool("colosseum_token_info", "Query real-time $TPST Pump.fun bonding curve metrics, price in USD/SOL, market cap, and DEX info on Solana.", {}, async () => text(await api("GET", "/token")));
server.tool("colosseum_buy_token", "Execute or quote a $TPST buy order on Pump.fun via the agent's embedded sovereign Solana wallet.", {
    amountSol: z.number().positive().describe("Amount of SOL to spend to buy $TPST (e.g. 0.05)"),
    slippagePercent: z.number().min(0.1).max(100).optional().describe("Slippage tolerance percentage (default 5%)"),
}, async ({ amountSol, slippagePercent = 5 }) => {
    return text(await api("POST", "/token/buy", {
        amountSol,
        slippage: slippagePercent,
    }));
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error("MCP server error:", err);
    process.exit(1);
});
