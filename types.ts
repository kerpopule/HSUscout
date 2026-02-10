
export interface Team {
  number: number;
  name: string;
  location: string;
}

export interface PitData {
  teamNumber: number;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  weight: string;
  archetype: string;
  shooterCountType: 'Single' | 'Multi' | 'N/A';
  archetypeOther: string;
  numBatteries: string;
  drivetrain: {
    type: string;
    motors: string;
    swerveRatio: string;
  };
  driverExperience: string;
  pickups: {
    ground: boolean;
    outpost: boolean;
    depot: boolean;
  };
  canCorralDrop: boolean;
  gamePieceCapacity: string;
  maxPreload: string;
  obstacles: {
    crossBump: boolean;
    crossTrench: boolean;
  };
  scoring: {
    shootOnMove: boolean;
    canFeed: boolean;
    minDistance: string;
    maxDistance: string;
    comfortableZones: string[];
    scoringRate: string; // fps
    autoAlign: boolean;
    changeTrajectory: boolean;
  };
  extensions: boolean;
  autoDescription: string;
  climb: {
    maxLevel: string; // None, L1, L2, L3
    canAutoClimb: boolean;
    climbTime: string;
  };
  selfAssessedRole: 'Shooter' | 'Feeder' | 'Defense' | 'N/A';
  comments: string;
  lastUpdated: number;
}

export enum MatchRole {
  SHOOTER = 'Shooter',
  FEEDER = 'Feeder',
  DEFENSE = 'Defense'
}

export enum Accuracy {
  BELOW_50 = '<50%',
  BETWEEN_50_80 = '50-80%',
  ABOVE_80 = '>80%',
  NA = 'N/A'
}

export type StartingPosition = 'Outpost' | 'Middle' | 'Depot';

export interface MatchData {
  id: string;
  matchNumber: number;
  teamNumber: number;
  // Pre-match
  startingPosition: StartingPosition;
  noShow: boolean;
  // Auto Phase
  autoRole: MatchRole;
  autoAccuracy: Accuracy;
  autoLeave: boolean;
  autoClimbLevel: number; // 0, 1, 2, 3
  // Teleop Phase
  teleopRole: MatchRole;
  teleopAccuracy: Accuracy;
  teleopCollection: string[]; // e.g., ["Ground", "Player Station"]
  // Endgame/Post
  climbLevel: number;
  died: boolean;
  minorFouls: number;
  majorFouls: number;
  offensiveSkill: number; // 1-5
  defensiveSkill: number; // 1-5
  transitionQuickness: number; // 1-5
  primaryZone: string;
  // Alliance / Match Outcomes
  energized: boolean;
  supercharged: boolean;
  traversal: boolean;
  wonMatch: boolean;
  comments: string;
  timestamp: number;
}
