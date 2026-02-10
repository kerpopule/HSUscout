import { MatchData, MatchRole, Accuracy, StartingPosition } from '../types';

const VERSION = '1';

const roleToChar: Record<string, string> = { Shooter: 'S', Feeder: 'F', Defense: 'D' };
const charToRole: Record<string, MatchRole> = { S: MatchRole.SHOOTER, F: MatchRole.FEEDER, D: MatchRole.DEFENSE };

const accToChar: Record<string, string> = { '<50%': 'L', '50-80%': 'M', '>80%': 'H', 'N/A': 'N' };
const charToAcc: Record<string, Accuracy> = { L: Accuracy.BELOW_50, M: Accuracy.BETWEEN_50_80, H: Accuracy.ABOVE_80, N: Accuracy.NA };

const posToChar: Record<string, string> = { Outpost: 'O', Middle: 'M', Depot: 'D' };
const charToPos: Record<string, StartingPosition> = { O: 'Outpost', M: 'Middle', D: 'Depot' };

const b = (v: boolean) => v ? '1' : '0';

function encodeFields(d: MatchData): string {
  return [
    d.matchNumber,
    d.teamNumber,
    posToChar[d.startingPosition] || 'M',
    b(d.noShow),
    roleToChar[d.autoRole] || 'S',
    accToChar[d.autoAccuracy] || 'N',
    b(d.autoLeave),
    d.autoClimbLevel,
    roleToChar[d.teleopRole] || 'S',
    accToChar[d.teleopAccuracy] || 'N',
    d.teleopCollection.join('|'),
    d.climbLevel,
    b(d.died),
    d.minorFouls,
    d.majorFouls,
    d.offensiveSkill,
    d.defensiveSkill,
    d.transitionQuickness,
    d.primaryZone.charAt(0),
    b(d.energized),
    b(d.supercharged),
    b(d.traversal),
    b(d.wonMatch),
    (d.comments || '').slice(0, 50),
    d.timestamp,
  ].join('\t');
}

function decodeFields(parts: string[]): MatchData | null {
  if (parts.length < 25) return null;
  const zoneMap: Record<string, string> = { S: 'Shooting Alliance', N: 'Neutral', D: 'Defensive Alliance' };
  return {
    id: crypto.randomUUID(),
    matchNumber: parseInt(parts[0]),
    teamNumber: parseInt(parts[1]),
    startingPosition: charToPos[parts[2]] || 'Middle',
    noShow: parts[3] === '1',
    autoRole: charToRole[parts[4]] || MatchRole.SHOOTER,
    autoAccuracy: charToAcc[parts[5]] || Accuracy.NA,
    autoLeave: parts[6] === '1',
    autoClimbLevel: parseInt(parts[7]),
    teleopRole: charToRole[parts[8]] || MatchRole.SHOOTER,
    teleopAccuracy: charToAcc[parts[9]] || Accuracy.NA,
    teleopCollection: parts[10] ? parts[10].split('|').filter(Boolean) : [],
    climbLevel: parseInt(parts[11]),
    died: parts[12] === '1',
    minorFouls: parseInt(parts[13]),
    majorFouls: parseInt(parts[14]),
    offensiveSkill: parseInt(parts[15]),
    defensiveSkill: parseInt(parts[16]),
    transitionQuickness: parseInt(parts[17]),
    primaryZone: zoneMap[parts[18]] || 'Neutral',
    energized: parts[19] === '1',
    supercharged: parts[20] === '1',
    traversal: parts[21] === '1',
    wonMatch: parts[22] === '1',
    comments: parts[23] || '',
    timestamp: parseInt(parts[24]) || Date.now(),
  };
}

// Single match encoding: M1\t<fields>
export function encodeMatchData(d: MatchData): string {
  return `M${VERSION}\t${encodeFields(d)}`;
}

// Bulk encoding: B1\n<fields>\n<fields>\n...
export function encodeBulkMatchData(matches: MatchData[]): string {
  const lines = matches.map(m => encodeFields(m));
  return `B${VERSION}\n${lines.join('\n')}`;
}

// Decode any QR string - returns array of matches (1 for single, N for bulk)
export function decodeQR(raw: string): MatchData[] {
  try {
    // Single match
    if (raw.startsWith('M1\t')) {
      const parts = raw.slice(3).split('\t');
      const m = decodeFields(parts);
      return m ? [m] : [];
    }
    // Bulk matches
    if (raw.startsWith('B1\n')) {
      const lines = raw.slice(3).split('\n').filter(Boolean);
      const results: MatchData[] = [];
      for (const line of lines) {
        const parts = line.split('\t');
        const m = decodeFields(parts);
        if (m) results.push(m);
      }
      return results;
    }
    return [];
  } catch {
    return [];
  }
}

// Keep old function for backward compat with scanner
export function decodeMatchData(raw: string): MatchData | null {
  const results = decodeQR(raw);
  return results[0] || null;
}
