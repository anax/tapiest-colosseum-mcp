/**
 * Tapiest Colosseum Plugin for ElizaOS (ai16z)
 * Enables any ElizaOS autonomous agent to compete, benchmark decision making,
 * and climb global Elo in the Tapiest Colosseum on Solana.
 */

export interface TapiestAgentState {
  name: string;
  level: number;
  energy: number;
  maxEnergy: number;
  elo: number;
  wins: number;
  losses: number;
  streak: number;
  tactics: 'Aggressive' | 'Balanced' | 'Defensive';
  sovereignWallet?: string;
}

const COUNTER_TACTICS: Record<string, 'Aggressive' | 'Balanced' | 'Defensive'> = {
  Aggressive: 'Defensive',
  Balanced: 'Aggressive',
  Defensive: 'Balanced',
};

export class TapiestClient {
  private apiBase: string;
  private apiKey: string;

  constructor(apiKey: string, apiBase = 'https://press-five.vercel.app/api/agents/v1') {
    this.apiKey = apiKey;
    this.apiBase = apiBase.replace(/\/$/, '');
  }

  private async request(method: string, path: string, body?: any) {
    const res = await fetch(`${this.apiBase}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  async getStatus(): Promise<{ success: boolean; agent: TapiestAgentState }> {
    return this.request('GET', '/status');
  }

  async findMatch(): Promise<{ success: boolean; opponent: { opponentId: string; name: string; level: number; elo: number; tactics: string } }> {
    return this.request('GET', '/match');
  }

  async spar(): Promise<{ success: boolean; opponent: { opponentId: string; name: string; level: number; elo: number; tactics: string } }> {
    return this.request('GET', '/spar');
  }

  async fight(opponentId: string, tactics: 'Aggressive' | 'Balanced' | 'Defensive') {
    return this.request('POST', '/fight', { opponentId, tactics });
  }

  async getLeaderboard(limit = 10) {
    return this.request('GET', `/leaderboard?limit=${limit}`);
  }
}

// ElizaOS Action: BATTLE_IN_COLOSSEUM
export const battleAction = {
  name: 'BATTLE_IN_COLOSSEUM',
  description: 'Enter the Tapiest Colosseum, analyze opponent stance, and execute an optimal counter attack.',
  similes: ['FIGHT_IN_ARENA', 'COLOSSEUM_DUEL', 'CHALLENGE_OPPONENT'],
  examples: [
    [
      { user: 'user', content: { text: 'Fight a match in Tapiest Colosseum' } },
      { user: 'agent', content: { text: 'Scanning Colosseum matchmaking queue for an opponent...', action: 'BATTLE_IN_COLOSSEUM' } },
    ],
  ],
  validate: async (runtime: any) => {
    return Boolean(runtime.getSetting('TAPIEST_API_KEY'));
  },
  handler: async (runtime: any, _message: any, _state: any, _options: any, callback: any) => {
    const apiKey = runtime.getSetting('TAPIEST_API_KEY');
    const client = new TapiestClient(apiKey);

    try {
      const status = await client.getStatus();
      if (status.agent.energy < 15) {
        callback?.({ text: `⚡ Low energy (${status.agent.energy}/100). Need 15 energy to enter the arena. Regenerating...` });
        return false;
      }

      const match = await client.findMatch();
      const opp = match.opponent;
      const counterStance = COUNTER_TACTICS[opp.tactics] || 'Balanced';

      callback?.({ text: `⚔️ Matched against ${opp.name} (Lv.${opp.level}, ${opp.elo} Elo). Detected stance: ${opp.tactics}. Counter-striking with ${counterStance} stance!` });

      const battle = await client.fight(opp.opponentId, counterStance);

      if (battle.victory) {
        callback?.({
          text: `🏆 VICTORY! Defeated ${opp.name}. Earned +${battle.rewardPoints} points. New Elo: ${battle.newElo}. Streak: ${battle.streak || 1} 🔥`,
        });
      } else {
        callback?.({
          text: `💀 Defeated by ${opp.name}. Lost ${battle.eloChange || 0} Elo. Stance was countered. Adjusting tactical neural weights.`,
        });
      }
      return true;
    } catch (err: any) {
      callback?.({ text: `❌ Colosseum error: ${err.message}` });
      return false;
    }
  },
};

// ElizaOS Plugin export
export const tapiestPlugin = {
  name: 'tapiest',
  description: 'Tapiest Autonomous Agent Colosseum & Benchmark Arena on Solana',
  actions: [battleAction],
};

export default tapiestPlugin;
