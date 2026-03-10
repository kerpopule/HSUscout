import { MatchData, PitData, MatchRole, Accuracy, StartingPosition } from '../types';

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

// --- Pit data encoding ---

function encodePitFields(p: PitData): string {
  return [
    p.teamNumber,
    p.dimensions.length,
    p.dimensions.width,
    p.dimensions.height,
    p.weight,
    p.archetype,
    p.shooterCountType,
    p.archetypeOther,
    p.numBatteries,
    p.drivetrain.type,
    p.drivetrain.motors,
    p.drivetrain.swerveRatio,
    p.driverExperience,
    b(p.pickups.ground),
    b(p.pickups.outpost),
    b(p.pickups.depot),
    b(p.canCorralDrop),
    p.gamePieceCapacity,
    p.maxPreload,
    b(p.obstacles.crossBump),
    b(p.obstacles.crossTrench),
    b(p.scoring.shootOnMove),
    b(p.scoring.canFeed),
    p.scoring.minDistance,
    p.scoring.maxDistance,
    p.scoring.comfortableZones.join('|'),
    p.scoring.scoringRate,
    b(p.scoring.autoAlign),
    b(p.scoring.changeTrajectory),
    b(p.extensions),
    (p.autoDescription || '').slice(0, 50),
    p.climb.maxLevel,
    b(p.climb.canAutoClimb),
    p.climb.climbTime,
    p.selfAssessedRole,
    (p.comments || '').slice(0, 50),
    p.lastUpdated,
  ].join('\t');
}

function decodePitFields(parts: string[]): PitData | null {
  if (parts.length < 37) return null;
  return {
    teamNumber: parseInt(parts[0]),
    dimensions: { length: parts[1], width: parts[2], height: parts[3] },
    weight: parts[4],
    archetype: parts[5],
    shooterCountType: (parts[6] as PitData['shooterCountType']) || 'N/A',
    archetypeOther: parts[7],
    numBatteries: parts[8],
    drivetrain: { type: parts[9], motors: parts[10], swerveRatio: parts[11] },
    driverExperience: parts[12],
    pickups: { ground: parts[13] === '1', outpost: parts[14] === '1', depot: parts[15] === '1' },
    canCorralDrop: parts[16] === '1',
    gamePieceCapacity: parts[17],
    maxPreload: parts[18],
    obstacles: { crossBump: parts[19] === '1', crossTrench: parts[20] === '1' },
    scoring: {
      shootOnMove: parts[21] === '1',
      canFeed: parts[22] === '1',
      minDistance: parts[23],
      maxDistance: parts[24],
      comfortableZones: parts[25] ? parts[25].split('|').filter(Boolean) : [],
      scoringRate: parts[26],
      autoAlign: parts[27] === '1',
      changeTrajectory: parts[28] === '1',
    },
    extensions: parts[29] === '1',
    autoDescription: parts[30] || '',
    climb: { maxLevel: parts[31], canAutoClimb: parts[32] === '1', climbTime: parts[33] },
    selfAssessedRole: (parts[34] as PitData['selfAssessedRole']) || 'N/A',
    comments: parts[35] || '',
    lastUpdated: parseInt(parts[36]) || Date.now(),
  };
}

// --- Single match encoding: M1\t<fields> ---
export function encodeMatchData(d: MatchData): string {
  return `M${VERSION}\t${encodeFields(d)}`;
}

// --- Bulk match encoding: B1\n<fields>\n... ---
export function encodeBulkMatchData(matches: MatchData[]): string {
  const lines = matches.map(m => encodeFields(m));
  return `B${VERSION}\n${lines.join('\n')}`;
}

// --- Single pit encoding: P1\t<fields> ---
export function encodePitData(pit: PitData): string {
  return `P${VERSION}\t${encodePitFields(pit)}`;
}

// --- Bulk pit encoding: Q1\n<fields>\n... ---
export function encodeBulkPitData(pits: PitData[]): string {
  const lines = pits.map(p => encodePitFields(p));
  return `Q${VERSION}\n${lines.join('\n')}`;
}

// --- Combined all data: A1\n<match lines>\n---\n<pit lines> ---
export function encodeAllData(pits: PitData[], matches: MatchData[]): string {
  const matchLines = matches.map(m => encodeFields(m));
  const pitLines = pits.map(p => encodePitFields(p));
  return `A${VERSION}\n${matchLines.join('\n')}\n---\n${pitLines.join('\n')}`;
}

export interface DecodedQRData {
  matches: MatchData[];
  pits: PitData[];
}

// Decode any QR string - returns matches and pits
export function decodeQR(raw: string): DecodedQRData {
  try {
    // Single match
    if (raw.startsWith('M1\t')) {
      const parts = raw.slice(3).split('\t');
      const m = decodeFields(parts);
      return { matches: m ? [m] : [], pits: [] };
    }
    // Bulk matches
    if (raw.startsWith('B1\n')) {
      const lines = raw.slice(3).split('\n').filter(Boolean);
      const matches: MatchData[] = [];
      for (const line of lines) {
        const parts = line.split('\t');
        const m = decodeFields(parts);
        if (m) matches.push(m);
      }
      return { matches, pits: [] };
    }
    // Single pit
    if (raw.startsWith('P1\t')) {
      const parts = raw.slice(3).split('\t');
      const p = decodePitFields(parts);
      return { matches: [], pits: p ? [p] : [] };
    }
    // Bulk pits
    if (raw.startsWith('Q1\n')) {
      const lines = raw.slice(3).split('\n').filter(Boolean);
      const pits: PitData[] = [];
      for (const line of lines) {
        const parts = line.split('\t');
        const p = decodePitFields(parts);
        if (p) pits.push(p);
      }
      return { matches: [], pits };
    }
    // Combined all data
    if (raw.startsWith('A1\n')) {
      const body = raw.slice(3);
      const sepIdx = body.indexOf('\n---\n');
      if (sepIdx === -1) return { matches: [], pits: [] };
      const matchSection = body.slice(0, sepIdx);
      const pitSection = body.slice(sepIdx + 5);
      const matches: MatchData[] = [];
      const pits: PitData[] = [];
      for (const line of matchSection.split('\n').filter(Boolean)) {
        const m = decodeFields(line.split('\t'));
        if (m) matches.push(m);
      }
      for (const line of pitSection.split('\n').filter(Boolean)) {
        const p = decodePitFields(line.split('\t'));
        if (p) pits.push(p);
      }
      return { matches, pits };
    }
    return { matches: [], pits: [] };
  } catch {
    return { matches: [], pits: [] };
  }
}

// Keep old function for backward compat with scanner
export function decodeMatchData(raw: string): MatchData | null {
  const results = decodeQR(raw);
  return results.matches[0] || null;
}
