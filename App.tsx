
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Team, PitData, MatchData, MatchRole, Accuracy, StartingPosition } from './types';
import { SMOKY_MOUNTAIN_TEAMS, DRIVETRAIN_TYPES, MOTOR_TYPES, ARCHETYPES, CLIMB_CAPABILITIES } from './constants';
import { savePitData, saveMatchData } from './lib/api';
import { addToSyncQueue, getSyncQueue, startSyncService } from './lib/sync';
import { encodeMatchData, encodeBulkMatchData } from './lib/qr-encode';
import { Button } from './components/Button';
import { Input, Toggle, Select, RadioGroup } from './components/Input';
import { SyncStatus } from './components/SyncStatus';
import { QRCodeModal } from './components/QRCodeModal';
import { QRScanner } from './components/QRScanner';
import {
  Trophy,
  Users,
  ClipboardCheck,
  Download,
  Settings,
  ChevronRight,
  Plus,
  Trash2,
  Activity,
  ArrowLeft,
  Search,
  CheckCircle2,
  XCircle,
  Zap,
  Weight,
  Cpu,
  Box,
  Target,
  MoveUp,
  BrainCircuit,
  Sword,
  Shield,
  Loader2,
  Timer,
  Play,
  Gamepad2,
  Flag,
  AlertTriangle,
  Star,
  MapPin,
  Flame,
  ZapOff,
  AlertCircle,
  Ruler,
  Clock,
  Layout,
  UserCheck,
  Hand,
  ScanLine,
  QrCode,
  Share2
} from 'lucide-react';

const STORAGE_KEY_PIT = 'smoky_scout_pit_v3';
const STORAGE_KEY_MATCH = 'smoky_scout_match_v6';

type View = 'dashboard' | 'pit' | 'match' | 'settings' | 'team_detail' | 'strategy' | 'scanner';

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [pitData, setPitData] = useState<Record<number, PitData>>({});
  const [matchData, setMatchData] = useState<MatchData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [pendingSync, setPendingSync] = useState(getSyncQueue().length);
  const [qrModalData, setQrModalData] = useState<string | null>(null);

  useEffect(() => {
    const savedPit = localStorage.getItem(STORAGE_KEY_PIT);
    const savedMatch = localStorage.getItem(STORAGE_KEY_MATCH);
    if (savedPit) setPitData(JSON.parse(savedPit));
    if (savedMatch) setMatchData(JSON.parse(savedMatch));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PIT, JSON.stringify(pitData));
  }, [pitData]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MATCH, JSON.stringify(matchData));
  }, [matchData]);

  // Sync service
  useEffect(() => {
    const stopSync = startSyncService({
      onConnectionChange: setIsConnected,
      onDataRefresh: (pit, match) => {
        setPitData(pit);
        setMatchData(match);
      },
      onQueueDrained: () => setPendingSync(0),
    });
    return stopSync;
  }, []);

  const exportToCSV = useCallback(() => {
    const pitHeaders = "Team#,L,W,H,Weight,RoleAssessed,Archetype,ShooterConfig,Batteries,DriveType,Motors,Ratio,Exp,Ground,Outpost,Depot,Corral,Capacity,Preload,Bump,Trench,ShootOnMove,Feed,Rate,Trajectory,Extensions,AutoAlign,ClimbLvl,AutoClimb,ClimbTime,Notes";
    const pitRows = (Object.values(pitData) as PitData[]).map((d: PitData) => [
      d.teamNumber, d.dimensions.length, d.dimensions.width, d.dimensions.height, d.weight, d.selfAssessedRole, d.archetype, d.shooterCountType, d.numBatteries,
      d.drivetrain.type, d.drivetrain.motors, d.drivetrain.swerveRatio, d.driverExperience,
      d.pickups.ground, d.pickups.outpost, d.pickups.depot, d.canCorralDrop, d.gamePieceCapacity, d.maxPreload,
      d.obstacles.crossBump, d.obstacles.crossTrench, d.scoring.shootOnMove, d.scoring.canFeed, d.scoring.scoringRate, d.scoring.changeTrajectory, d.extensions, d.scoring.autoAlign,
      d.climb.maxLevel, d.climb.canAutoClimb, d.climb.climbTime, `"${d.comments.replace(/"/g, '""')}"`
    ].join(','));

    const matchHeaders = "Match#,Team#,NoShow,StartPos,AutoRole,AutoAcc,AutoLeave,AutoClimb,TeleRole,TeleAcc,TeleCollection,EndClimb,Died,MinorFouls,MajorFouls,OffenseSkill,DefenseSkill,TransitionSpeed,PrimaryZone,Energized,Supercharged,Traversal,WonMatch,Comments";
    const matchRows = matchData.map(d => [
      d.matchNumber, d.teamNumber, d.noShow, d.startingPosition, d.autoRole, d.autoAccuracy, d.autoLeave, d.autoClimbLevel,
      d.teleopRole, d.teleopAccuracy, `"${d.teleopCollection.join('|')}"`, d.climbLevel, d.died, d.minorFouls, d.majorFouls, d.offensiveSkill, d.defensiveSkill, d.transitionQuickness, d.primaryZone, d.energized, d.supercharged, d.traversal, d.wonMatch, `"${d.comments.replace(/"/g, '""')}"`
    ].join(','));

    const csvContent = `PIT SCOUTING\n${pitHeaders}\n${pitRows.join('\n')}\n\nMATCH SCOUTING\n${matchHeaders}\n${matchRows.join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smoky_scout_export_v6.csv`;
    a.click();
  }, [pitData, matchData]);

  const handleTeamClick = (team: Team) => {
    setSelectedTeam(team);
    setView('team_detail');
  };

  const getRoleIcon = (role: string) => {
    switch(role) {
      case 'Shooter': return <Target className="w-3 h-3" />;
      case 'Feeder': return <Hand className="w-3 h-3" />;
      case 'Defense': return <Shield className="w-3 h-3" />;
      default: return null;
    }
  };

  const filteredTeams = SMOKY_MOUNTAIN_TEAMS.filter(t => 
    t.number.toString().includes(searchQuery) || t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col pb-24 text-slate-100">
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-header text-2xl tracking-tight leading-none">SMOKY SCOUT PRO</h1>
        </div>
        <div className="flex items-center gap-3">
          <SyncStatus isConnected={isConnected} pendingCount={pendingSync} />
          <Button variant="ghost" size="sm" onClick={exportToCSV}>
            <Download className="w-5 h-5 mr-2" /> Export
          </Button>
        </div>
      </header>

      {qrModalData && <QRCodeModal data={qrModalData} onClose={() => setQrModalData(null)} />}

      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full">
        {view === 'dashboard' && (
          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input 
                type="text"
                placeholder="Search team..."
                className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-slate-100 placeholder:text-slate-600 focus:border-blue-600 focus:outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              {filteredTeams.map(team => {
                const teamPit = pitData[team.number];
                const isPitComplete = !!teamPit;

                return (
                  <button
                    key={team.number}
                    onClick={() => handleTeamClick(team)}
                    className={`flex flex-col p-4 bg-slate-900 border-2 rounded-2xl active:scale-[0.98] transition-all text-left ${
                      isPitComplete ? 'border-slate-800' : 'border-amber-500/30 bg-amber-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-3">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center border font-bold text-xl leading-none transition-colors ${
                          isPitComplete ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        }`}>
                          {team.number}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-100">{team.name}</h3>
                          <p className="text-xs text-slate-500 font-mono">{team.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPitComplete ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-[10px] font-bold text-green-500 uppercase">Pit Ready</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-[10px] font-bold text-amber-500 uppercase">Missing Pit</span>
                          </div>
                        )}
                        <ChevronRight className="w-5 h-5 text-slate-700" />
                      </div>
                    </div>

                    {isPitComplete && (
                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 mt-1 py-3 px-4 bg-slate-950/40 rounded-xl border border-slate-800/50">
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Drive Type</span>
                          <span className="text-xs font-semibold text-slate-300 truncate">{teamPit.drivetrain.type}</span>
                        </div>
                        <div className="flex flex-col border-l border-slate-800/50 pl-3">
                          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Intended Role</span>
                          <div className="flex items-center gap-1 text-xs font-semibold text-blue-400">
                            {getRoleIcon(teamPit.selfAssessedRole)}
                            <span className="truncate">{teamPit.selfAssessedRole}</span>
                          </div>
                        </div>
                        <div className="flex flex-col border-t border-slate-800/50 pt-2">
                          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Fuel Rate</span>
                          <span className="text-xs font-semibold text-slate-300 truncate">
                            {teamPit.scoring.scoringRate ? `${teamPit.scoring.scoringRate} FPS` : 'N/A'}
                          </span>
                        </div>
                        <div className="flex flex-col border-t border-l border-slate-800/50 pt-2 pl-3">
                          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Climb Level</span>
                          <span className="text-xs font-semibold text-slate-300 truncate">
                            {teamPit.climb.maxLevel !== 'None' ? `${teamPit.climb.maxLevel} (${teamPit.climb.climbTime})` : 'None'}
                          </span>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {view === 'team_detail' && selectedTeam && (
          <TeamDetail
            team={selectedTeam}
            pit={pitData[selectedTeam.number]}
            matches={matchData.filter(m => m.teamNumber === selectedTeam.number)}
            onBack={() => setView('dashboard')}
            onPitClick={() => setView('pit')}
            onMatchClick={() => setView('match')}
            onShowMatchQR={(m) => setQrModalData(encodeMatchData(m))}
          />
        )}

        {view === 'pit' && selectedTeam && (
          <PitScoutingForm
            team={selectedTeam}
            initialData={pitData[selectedTeam.number]}
            onSave={(d) => {
              setPitData(prev => ({...prev, [d.teamNumber]: d}));
              savePitData(d).catch(() => {
                addToSyncQueue({ type: 'pit', data: d });
                setPendingSync(getSyncQueue().length);
              });
              setView('team_detail');
            }}
            onCancel={() => setView('team_detail')}
          />
        )}

        {view === 'match' && selectedTeam && (
          <MatchScoutingForm
            team={selectedTeam}
            onSave={(d) => {
              setMatchData(prev => [d, ...prev]);
              saveMatchData(d).catch(() => {
                addToSyncQueue({ type: 'match', data: d });
                setPendingSync(getSyncQueue().length);
              });
              setQrModalData(encodeMatchData(d));
              setView('team_detail');
            }}
            onCancel={() => setView('team_detail')}
          />
        )}

        {view === 'strategy' && <StrategyLab pitData={pitData} matchData={matchData} />}

        {view === 'scanner' && (
          <QRScanner
            onImport={(matches) => {
              setMatchData(prev => {
                let updated = [...prev];
                for (const d of matches) {
                  const idx = updated.findIndex(m => m.matchNumber === d.matchNumber && m.teamNumber === d.teamNumber);
                  if (idx >= 0) {
                    // Smart merge: newer timestamp wins
                    if (d.timestamp > updated[idx].timestamp) {
                      updated[idx] = d;
                    }
                  } else {
                    updated = [d, ...updated];
                  }
                }
                return updated;
              });
              for (const d of matches) {
                saveMatchData(d).catch(() => {
                  addToSyncQueue({ type: 'match', data: d });
                  setPendingSync(getSyncQueue().length);
                });
              }
            }}
            onBack={() => setView('dashboard')}
          />
        )}

        {view === 'settings' && (
          <ConfigView
            matchData={matchData}
            onShowQR={(data) => setQrModalData(data)}
            onClearData={() => {
              setPitData({});
              setMatchData([]);
              localStorage.removeItem(STORAGE_KEY_PIT);
              localStorage.removeItem(STORAGE_KEY_MATCH);
            }}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800 px-6 py-4 flex justify-around items-center z-50">
        <NavButton active={view === 'dashboard' || view === 'team_detail'} onClick={() => setView('dashboard')} icon={<Users className="w-6 h-6" />} label="Teams" />
        <NavButton active={view === 'strategy'} onClick={() => setView('strategy')} icon={<BrainCircuit className="w-6 h-6" />} label="Strategy" />
        <NavButton active={view === 'scanner'} onClick={() => setView('scanner')} icon={<ScanLine className="w-6 h-6" />} label="Scan" />
        <NavButton active={view === 'settings'} onClick={() => setView('settings')} icon={<Settings className="w-6 h-6" />} label="Config" />
      </nav>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-blue-500' : 'text-slate-500'}`}>
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
  </button>
);

const TeamDetail: React.FC<{ team: Team, pit?: PitData, matches: MatchData[], onBack: () => void, onPitClick: () => void, onMatchClick: () => void, onShowMatchQR: (m: MatchData) => void }> = ({ team, pit, matches, onBack, onPitClick, onMatchClick, onShowMatchQR }) => (
  <div className="space-y-8 animate-in fade-in duration-300">
    <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-semibold"><ArrowLeft className="w-5 h-5" /> Dashboard</button>
    <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-8 shadow-2xl">
      <h2 className="text-4xl font-header text-white mb-2">TEAM {team.number}</h2>
      <p className="text-slate-500 font-mono">{team.name} • {team.location}</p>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Button size="lg" className="flex-col h-32 gap-3" onClick={onPitClick}>
        <ClipboardCheck className={`w-8 h-8 ${pit ? 'text-green-500' : ''}`} />
        {pit ? 'Edit Pit Data' : 'Add Pit Data'}
      </Button>
      <Button size="lg" variant="outline" className="flex-col h-32 gap-3" onClick={onMatchClick}><Plus className="w-8 h-8 text-blue-500" /> Log Match</Button>
    </div>
    <div className="space-y-4">
      <h3 className="font-header text-2xl text-slate-200">History</h3>
      {matches.length === 0 ? <p className="text-slate-600 italic">No matches logged.</p> : (
        <div className="space-y-3">
          {matches.map(m => (
            <div key={m.id} className="p-4 bg-slate-900 border-2 border-slate-800 rounded-2xl flex items-center gap-3">
              <div className="flex-1">
                <p className="font-bold text-blue-400">Match #{m.matchNumber}</p>
                <p className="text-xs text-slate-500 uppercase">{m.noShow ? 'No Show' : `${m.teleopRole} | ${m.teleopAccuracy}`}</p>
              </div>
              <div className="text-right flex-1">
                <p className="font-bold text-slate-300">{m.noShow ? '-' : `Climb: ${m.climbLevel} | ${m.wonMatch ? 'Won' : 'Lost'}`}</p>
              </div>
              <button onClick={() => onShowMatchQR(m)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors">
                <QrCode className="w-5 h-5 text-blue-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const PitScoutingForm: React.FC<{ team: Team, initialData?: PitData, onSave: (d: PitData) => void, onCancel: () => void }> = ({ team, initialData, onSave, onCancel }) => {
  const [data, setData] = useState<PitData>(initialData || {
    teamNumber: team.number,
    dimensions: { length: '', width: '', height: '' },
    weight: '',
    archetype: 'Stationary',
    shooterCountType: 'Single',
    archetypeOther: '',
    numBatteries: '',
    drivetrain: { type: 'Swerve', motors: 'NEO', swerveRatio: '' },
    driverExperience: '',
    pickups: { ground: false, outpost: false, depot: false },
    canCorralDrop: false,
    gamePieceCapacity: '1',
    maxPreload: '1',
    obstacles: { crossBump: false, crossTrench: false },
    scoring: { 
      shootOnMove: false,
      canFeed: false, 
      minDistance: '', 
      maxDistance: '', 
      comfortableZones: [], 
      scoringRate: '', 
      autoAlign: false,
      changeTrajectory: false
    },
    extensions: false,
    autoDescription: '',
    climb: { 
      maxLevel: 'None', 
      canAutoClimb: false,
      climbTime: '' 
    },
    selfAssessedRole: 'N/A',
    comments: '',
    lastUpdated: Date.now()
  });

  return (
    <div className="space-y-12 pb-24">
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <h2 className="text-3xl font-header tracking-tight">PIT: {team.number}</h2>
        <Button variant="ghost" onClick={onCancel}>Discard</Button>
      </div>

      <Section title="Robot Intent" icon={<UserCheck className="w-4 h-4" />}>
        <RadioGroup 
          label="What role does the team believe they play?" 
          options={['Shooter', 'Feeder', 'Defense', 'N/A']} 
          value={data.selfAssessedRole} 
          onChange={v => setData({...data, selfAssessedRole: v as any})} 
        />
      </Section>

      <Section title="Drivetrain" icon={<Cpu className="w-4 h-4" />}>
        <RadioGroup label="Drive Type" options={DRIVETRAIN_TYPES} value={data.drivetrain.type} onChange={v => setData({...data, drivetrain: {...data.drivetrain, type: v}})} />
        <RadioGroup label="Motors" options={MOTOR_TYPES} value={data.drivetrain.motors} onChange={v => setData({...data, drivetrain: {...data.drivetrain, motors: v}})} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Ratio (if Swerve)" value={data.drivetrain.swerveRatio} onChange={e => setData({...data, drivetrain: {...data.drivetrain, swerveRatio: e.target.value}})} />
          <Input label="Driver Exp (Years)" type="number" value={data.driverExperience} onChange={e => setData({...data, driverExperience: e.target.value})} />
        </div>
      </Section>

      <Section title="Dimensions & Mechanical" icon={<Ruler className="w-4 h-4" />}>
        <div className="grid grid-cols-3 gap-2">
          <Input label="Length (in)" value={data.dimensions.length} onChange={e => setData({...data, dimensions: {...data.dimensions, length: e.target.value}})} />
          <Input label="Width (in)" value={data.dimensions.width} onChange={e => setData({...data, dimensions: {...data.dimensions, width: e.target.value}})} />
          <Input label="Height (in)" value={data.dimensions.height} onChange={e => setData({...data, dimensions: {...data.dimensions, height: e.target.value}})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Weight (lbs)" value={data.weight} onChange={e => setData({...data, weight: e.target.value})} />
          <Input label="# of Batteries" type="number" value={data.numBatteries} onChange={e => setData({...data, numBatteries: e.target.value})} />
        </div>
        <Toggle label="Robot Extends Out of Bumper?" checked={data.extensions} onChange={v => setData({...data, extensions: v})} />
      </Section>

      <Section title="Archetype & Config" icon={<Layout className="w-4 h-4" />}>
        <RadioGroup label="Robot Archetype" options={ARCHETYPES} value={data.archetype} onChange={v => setData({...data, archetype: v})} />
        <RadioGroup label="Shooter Config" options={['Single', 'Multi', 'N/A']} value={data.shooterCountType} onChange={v => setData({...data, shooterCountType: v as any})} />
      </Section>

      <Section title="Game Piece Handling" icon={<Target className="w-4 h-4" />}>
        <div className="grid grid-cols-1 gap-3">
          <Toggle label="Floor Pickup" checked={data.pickups.ground} onChange={v => setData({...data, pickups: {...data.pickups, ground: v}})} />
          <Toggle label="Depot Pickup" checked={data.pickups.depot} onChange={v => setData({...data, pickups: {...data.pickups, depot: v}})} />
          <Toggle label="Outpost Pickup" checked={data.pickups.outpost} onChange={v => setData({...data, pickups: {...data.pickups, outpost: v}})} />
          <Toggle label="Corral Drop Off Capability" checked={data.canCorralDrop} onChange={v => setData({...data, canCorralDrop: v})} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Input label="Scoring Rate (FPS)" value={data.scoring.scoringRate} onChange={e => setData({...data, scoring: {...data.scoring, scoringRate: e.target.value}})} />
          <Input label="Piece Capacity" type="number" value={data.gamePieceCapacity} onChange={e => setData({...data, gamePieceCapacity: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Toggle label="Shoot on Move" checked={data.scoring.shootOnMove} onChange={v => setData({...data, scoring: {...data.scoring, shootOnMove: v}})} />
          <Toggle label="Auto Align" checked={data.scoring.autoAlign} onChange={v => setData({...data, scoring: {...data.scoring, autoAlign: v}})} />
          <Toggle label="Change Trajectory" checked={data.scoring.changeTrajectory} onChange={v => setData({...data, scoring: {...data.scoring, changeTrajectory: v}})} />
          <Toggle label="Under Trench" checked={data.obstacles.crossTrench} onChange={v => setData({...data, obstacles: {...data.obstacles, crossTrench: v}})} />
        </div>
      </Section>

      <Section title="Climbing" icon={<Activity className="w-4 h-4" />}>
        <RadioGroup label="Climb Level (Manual)" options={['None', 'L1', 'L2', 'L3']} value={data.climb.maxLevel} onChange={v => setData({...data, climb: {...data.climb, maxLevel: v}})} />
        <div className="pt-4 flex flex-col gap-4">
          <Toggle label="Can Climb in Auto?" checked={data.climb.canAutoClimb} onChange={v => setData({...data, climb: {...data.climb, canAutoClimb: v}})} />
          <Input label="Climb Time to Max (seconds)" placeholder="e.g. 15s" value={data.climb.climbTime} onChange={e => setData({...data, climb: {...data.climb, climbTime: e.target.value}})} />
        </div>
      </Section>

      <div className="space-y-2">
        <label className="text-xs font-bold uppercase text-slate-500">Comments</label>
        <textarea className="w-full h-32 bg-slate-900 border-2 border-slate-800 rounded-2xl p-4 text-slate-100" placeholder="Driver notes, mechanism reliability, etc." value={data.comments} onChange={e => setData({...data, comments: e.target.value})} />
      </div>

      <div className="fixed bottom-24 left-4 right-4 z-40">
        <Button size="lg" className="w-full shadow-2xl h-16" onClick={() => onSave({...data, lastUpdated: Date.now()})}>Save Pit Data</Button>
      </div>
    </div>
  );
};

const MatchScoutingForm: React.FC<{ team: Team, onSave: (d: MatchData) => void, onCancel: () => void }> = ({ team, onSave, onCancel }) => {
  const [phase, setPhase] = useState<'pre' | 'auto' | 'tele' | 'post'>('pre');
  const [matchNum, setMatchNum] = useState<number>(1);
  const [startingPos, setStartingPos] = useState<StartingPosition>('Middle');
  const [noShow, setNoShow] = useState(false);
  
  // Auto
  const [autoRole, setAutoRole] = useState<MatchRole>(MatchRole.SHOOTER);
  const [autoAccuracy, setAutoAccuracy] = useState<Accuracy>(Accuracy.BETWEEN_50_80);
  const [autoLeave, setAutoLeave] = useState(false);
  const [autoClimbLevel, setAutoClimbLevel] = useState(0);

  // Teleop
  const [teleopRole, setTeleopRole] = useState<MatchRole>(MatchRole.SHOOTER);
  const [teleopAccuracy, setTeleopAccuracy] = useState<Accuracy>(Accuracy.BETWEEN_50_80);
  const [teleopCollection, setTeleopCollection] = useState<string[]>([]);

  // Post/Endgame
  const [offenseSkill, setOffenseSkill] = useState(3);
  const [defenseSkill, setDefenseSkill] = useState(3);
  const [transitionQuickness, setTransitionQuickness] = useState(3);
  const [primaryZone, setPrimaryZone] = useState('Neutral');
  const [climbLevel, setClimbLevel] = useState(0);
  const [died, setDied] = useState(false);
  const [minorFouls, setMinorFouls] = useState(0);
  const [majorFouls, setMajorFouls] = useState(0);
  const [comments, setComments] = useState('');

  // Alliance Outcomes
  const [energized, setEnergized] = useState(false);
  const [supercharged, setSupercharged] = useState(false);
  const [traversal, setTraversal] = useState(false);
  const [wonMatch, setWonMatch] = useState(false);

  const handleSave = () => {
    onSave({
      id: crypto.randomUUID(),
      matchNumber: matchNum,
      teamNumber: team.number,
      startingPosition: startingPos,
      noShow,
      autoRole, autoAccuracy, autoLeave, autoClimbLevel,
      teleopRole, teleopAccuracy, teleopCollection,
      climbLevel, died, minorFouls, majorFouls, 
      offensiveSkill: offenseSkill, 
      defensiveSkill: defenseSkill, 
      transitionQuickness, primaryZone,
      energized, supercharged, traversal, wonMatch,
      comments,
      timestamp: Date.now()
    });
  };

  const toggleCollection = (type: string) => {
    setTeleopCollection(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const navStyles = "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border-b-4 transition-all";

  // Role helper for Teleop
  const handleTeleRoleChange = (role: string) => {
    const r = role as MatchRole;
    setTeleopRole(r);
    if (r === MatchRole.DEFENSE) {
      setTeleopAccuracy(Accuracy.NA);
    } else if (teleopAccuracy === Accuracy.NA) {
      setTeleopAccuracy(Accuracy.BETWEEN_50_80);
    }
  };

  const teleAccuracyLabel = teleopRole === MatchRole.SHOOTER 
    ? "Shooting Accuracy" 
    : teleopRole === MatchRole.FEEDER 
      ? "Feeding / Fuel Distribution Accuracy" 
      : "Accuracy";

  return (
    <div className="space-y-8 pb-32">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-header">LOG MATCH: {team.number}</h2>
        <Button variant="ghost" size="sm" onClick={onCancel}>Discard</Button>
      </div>

      <div className="flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden sticky top-[80px] z-50 shadow-xl backdrop-blur-md">
        <button onClick={() => setPhase('pre')} className={`${navStyles} ${phase === 'pre' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-transparent text-slate-500'}`}><Timer className="w-4 h-4 mx-auto mb-1" /> Pre</button>
        <button disabled={noShow} onClick={() => setPhase('auto')} className={`${navStyles} ${phase === 'auto' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-transparent text-slate-500'} ${noShow ? 'opacity-30' : ''}`}><Play className="w-4 h-4 mx-auto mb-1" /> Auto</button>
        <button disabled={noShow} onClick={() => setPhase('tele')} className={`${navStyles} ${phase === 'tele' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-transparent text-slate-500'} ${noShow ? 'opacity-30' : ''}`}><Gamepad2 className="w-4 h-4 mx-auto mb-1" /> Tele</button>
        <button onClick={() => setPhase('post')} className={`${navStyles} ${phase === 'post' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-transparent text-slate-500'}`}><Flag className="w-4 h-4 mx-auto mb-1" /> Post</button>
      </div>

      <div className="space-y-10 animate-in fade-in duration-300">
        {phase === 'pre' && (
          <div className="space-y-8">
            <Input label="Match Number" type="number" value={matchNum} onChange={e => setMatchNum(parseInt(e.target.value) || 0)} />
            <RadioGroup label="Starting Position" options={['Outpost', 'Middle', 'Depot']} value={startingPos} onChange={v => setStartingPos(v as StartingPosition)} />
            <div className="pt-4">
              <Toggle label="No Show?" checked={noShow} onChange={(v) => {
                setNoShow(v);
                if (v) setPhase('post');
              }} />
            </div>
          </div>
        )}

        {!noShow && phase === 'auto' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-6 bg-slate-900/40 p-6 rounded-3xl border border-slate-800/50">
              <RadioGroup label="Auto Role" options={[MatchRole.SHOOTER, MatchRole.FEEDER, MatchRole.DEFENSE]} value={autoRole} onChange={v => setAutoRole(v as MatchRole)} />
              <RadioGroup label="Auto Shooting Accuracy" options={[Accuracy.BELOW_50, Accuracy.BETWEEN_50_80, Accuracy.ABOVE_80, Accuracy.NA]} value={autoAccuracy} onChange={v => setAutoAccuracy(v as Accuracy)} />
              <div className="pt-4">
                <Toggle label="Left Zone (Move?)" checked={autoLeave} onChange={setAutoLeave} />
              </div>
            </div>
            
            <Section title="Auto Climb Level" noBorder icon={<Activity className="w-4 h-4" />}>
              <RadioGroup label="Climb Lvl" options={['None', 'L1', 'L2', 'L3']} value={autoClimbLevel === 0 ? 'None' : `L${autoClimbLevel}`} onChange={v => setAutoClimbLevel(v === 'None' ? 0 : parseInt(v.split('L')[1]))} />
            </Section>
          </div>
        )}

        {!noShow && phase === 'tele' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-6 bg-slate-900/40 p-6 rounded-3xl border border-slate-800/50">
              <RadioGroup 
                label="Teleop Role" 
                options={[MatchRole.SHOOTER, MatchRole.FEEDER, MatchRole.DEFENSE]} 
                value={teleopRole} 
                onChange={handleTeleRoleChange} 
              />
              <div className={teleopRole === MatchRole.DEFENSE ? 'opacity-40 pointer-events-none' : ''}>
                <RadioGroup 
                  label={teleAccuracyLabel} 
                  options={[Accuracy.BELOW_50, Accuracy.BETWEEN_50_80, Accuracy.ABOVE_80, Accuracy.NA]} 
                  value={teleopAccuracy} 
                  onChange={v => setTeleopAccuracy(v as Accuracy)} 
                />
              </div>
            </div>
            <Section title="Fuel Collection" noBorder icon={<Flame className="w-4 h-4" />}>
              <div className="grid grid-cols-2 gap-4">
                <Toggle label="Ground Pickup" checked={teleopCollection.includes('Ground')} onChange={() => toggleCollection('Ground')} />
                <Toggle label="Player Station" checked={teleopCollection.includes('Player Station')} onChange={() => toggleCollection('Player Station')} />
              </div>
            </Section>
          </div>
        )}

        {phase === 'post' && (
          <div className="space-y-8">
            {!noShow && (
              <>
                <Section title="Endgame Climb" noBorder icon={<Flag className="w-4 h-4" />}>
                  <RadioGroup label="Endgame Climb Level" options={['None', 'Lvl 1', 'Lvl 2', 'Lvl 3']} value={climbLevel === 0 ? 'None' : `Lvl ${climbLevel}`} onChange={v => setClimbLevel(v === 'None' ? 0 : parseInt(v.split(' ')[1]))} />
                </Section>
                <Section title="Alliance Performance" noBorder icon={<Zap className="w-4 h-4" />}>
                  <div className="grid grid-cols-2 gap-4">
                    <Toggle label="Energized" checked={energized} onChange={setEnergized} />
                    <Toggle label="Supercharged" checked={supercharged} onChange={setSupercharged} />
                    <Toggle label="Traversal" checked={traversal} onChange={setTraversal} />
                    <Toggle label="Won Match" checked={wonMatch} onChange={setWonMatch} />
                  </div>
                </Section>
              </>
            )}

            <Section title="Fouls & Technicals" noBorder icon={<AlertTriangle className="w-4 h-4" />}>
              <div className="grid grid-cols-1 gap-4">
                <Counter label="# of Minors" value={minorFouls} onChange={setMinorFouls} />
                <Counter label="# of Majors" value={majorFouls} onChange={setMajorFouls} />
              </div>
            </Section>

            {!noShow && (
              <>
                <Section title="Subjective Assessment" noBorder icon={<Star className="w-4 h-4" />}>
                  <div className="grid grid-cols-1 gap-6">
                    <SkillSlider label="Offensive Skill" value={offenseSkill} onChange={setOffenseSkill} />
                    <SkillSlider label="Defensive Skill" value={defenseSkill} onChange={setDefenseSkill} />
                    <SkillSlider label="Transition Speed" value={transitionQuickness} onChange={setTransitionQuickness} />
                  </div>
                </Section>

                <Section title="Field Positioning" noBorder icon={<MapPin className="w-4 h-4" />}>
                   <RadioGroup 
                    label="Primary Operating Zone" 
                    options={['Shooting Alliance', 'Neutral', 'Defensive Alliance']} 
                    value={primaryZone} 
                    onChange={setPrimaryZone} 
                  />
                  <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mt-6">
                    <Toggle label="Robot Died / Tipped / Disabled?" checked={died} onChange={setDied} />
                  </div>
                </Section>
              </>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Subjective Observations</label>
              <textarea className="w-full h-32 bg-slate-900 border-2 border-slate-800 rounded-2xl p-4 text-slate-100" placeholder={noShow ? "Add reasons for No Show..." : "Notes on driver agility, mechanical failures, or specific playstyles..."} value={comments} onChange={e => setComments(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-24 left-4 right-4 z-40 flex gap-3">
        {phase === 'post' ? (
          <Button size="lg" className="w-full h-16 shadow-2xl" onClick={handleSave}>Submit Match Report</Button>
        ) : (
          <Button size="lg" className="w-full h-16 shadow-2xl" onClick={() => {
            if (phase === 'pre') setPhase(noShow ? 'post' : 'auto');
            else if (phase === 'auto') setPhase('tele');
            else setPhase('post');
          }}>{phase === 'tele' ? 'Finish Match' : 'Next Phase'}</Button>
        )}
      </div>
    </div>
  );
};

const SkillSlider: React.FC<{ label: string, value: number, onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div className="space-y-3">
    <div className="flex justify-between items-center">
      <label className="text-xs font-bold uppercase text-slate-400">{label}</label>
      <span className="text-blue-400 font-bold">{value}/5</span>
    </div>
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map(v => (
        <button 
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`flex-1 h-10 rounded-lg font-bold transition-all ${value === v ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
        >
          {v}
        </button>
      ))}
    </div>
  </div>
);

const TeamPicker: React.FC<{ teams: number[], setTeams: React.Dispatch<React.SetStateAction<number[]>>, index: number }> = ({ teams, setTeams, index }) => (
  <div className="relative">
    <select
      className="w-full bg-slate-900 border-2 border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-sm focus:border-blue-600 focus:outline-none appearance-none"
      value={teams[index]}
      onChange={(e) => {
        const next = [...teams];
        next[index] = parseInt(e.target.value) || 0;
        setTeams(next);
      }}
    >
      <option value={0}>Select Team</option>
      {SMOKY_MOUNTAIN_TEAMS.map(t => (
        <option key={t.number} value={t.number}>{t.number} | {t.name}</option>
      ))}
    </select>
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
      <ChevronRight className="w-4 h-4 rotate-90" />
    </div>
  </div>
);

const AllianceStats: React.FC<{ label: string, color: string, teamNumbers: number[], pitData: Record<number, PitData>, matchData: MatchData[] }> = ({ label, color, teamNumbers, pitData, matchData }) => {
  const validTeams = teamNumbers.filter(n => n > 0);
  if (validTeams.length === 0) return null;

  const allMatches = validTeams.flatMap(n => matchData.filter(m => m.teamNumber === n));
  const winRate = allMatches.length > 0 ? (allMatches.filter(m => m.wonMatch).length / allMatches.length * 100).toFixed(0) : 'N/A';
  const avgOffense = allMatches.length > 0 ? (allMatches.reduce((s, m) => s + m.offensiveSkill, 0) / allMatches.length).toFixed(1) : 'N/A';
  const avgDefense = allMatches.length > 0 ? (allMatches.reduce((s, m) => s + m.defensiveSkill, 0) / allMatches.length).toFixed(1) : 'N/A';
  const avgTransition = allMatches.length > 0 ? (allMatches.reduce((s, m) => s + m.transitionQuickness, 0) / allMatches.length).toFixed(1) : 'N/A';
  const foulRate = allMatches.length > 0 ? ((allMatches.reduce((s, m) => s + m.minorFouls + m.majorFouls, 0) / allMatches.length)).toFixed(1) : 'N/A';

  const climbLevels = allMatches.filter(m => !m.noShow).map(m => m.climbLevel);
  const avgClimb = climbLevels.length > 0 ? (climbLevels.reduce((s, c) => s + c, 0) / climbLevels.length).toFixed(1) : 'N/A';

  const roleCount = { Shooter: 0, Feeder: 0, Defense: 0 };
  allMatches.forEach(m => { if (roleCount[m.teleopRole as keyof typeof roleCount] !== undefined) roleCount[m.teleopRole as keyof typeof roleCount]++; });

  const accCount = { '<50%': 0, '50-80%': 0, '>80%': 0, 'N/A': 0 };
  allMatches.forEach(m => { if (accCount[m.teleopAccuracy as keyof typeof accCount] !== undefined) accCount[m.teleopAccuracy as keyof typeof accCount]++; });

  const borderColor = color === 'blue' ? 'border-blue-500/30' : 'border-red-500/30';
  const bgColor = color === 'blue' ? 'bg-blue-500/5' : 'bg-red-500/5';
  const textColor = color === 'blue' ? 'text-blue-400' : 'text-red-400';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-2xl p-4 space-y-4`}>
      <h4 className={`text-xs font-bold uppercase ${textColor}`}>{label} Alliance Stats ({allMatches.length} matches)</h4>
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Win Rate" value={winRate === 'N/A' ? winRate : `${winRate}%`} />
        <StatBox label="Avg Climb" value={avgClimb === 'N/A' ? avgClimb : `L${avgClimb}`} />
        <StatBox label="Fouls/Match" value={foulRate} />
        <StatBox label="Offense" value={`${avgOffense}/5`} />
        <StatBox label="Defense" value={`${avgDefense}/5`} />
        <StatBox label="Transition" value={`${avgTransition}/5`} />
      </div>
      {allMatches.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950/40 rounded-xl p-3">
            <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Role Breakdown</span>
            <div className="text-xs space-y-0.5">
              <div className="flex justify-between"><span className="text-slate-400">Shooter</span><span className="text-slate-300 font-bold">{roleCount.Shooter}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Feeder</span><span className="text-slate-300 font-bold">{roleCount.Feeder}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Defense</span><span className="text-slate-300 font-bold">{roleCount.Defense}</span></div>
            </div>
          </div>
          <div className="bg-slate-950/40 rounded-xl p-3">
            <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Accuracy Dist.</span>
            <div className="text-xs space-y-0.5">
              <div className="flex justify-between"><span className="text-slate-400">&gt;80%</span><span className="text-green-400 font-bold">{accCount['>80%']}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">50-80%</span><span className="text-yellow-400 font-bold">{accCount['50-80%']}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">&lt;50%</span><span className="text-red-400 font-bold">{accCount['<50%']}</span></div>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {validTeams.map(num => {
          const pit = pitData[num];
          const tm = matchData.filter(m => m.teamNumber === num);
          return (
            <div key={num} className="bg-slate-950/40 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-200">Team {num}</span>
                <span className="text-[10px] text-slate-500">{tm.length} matches</span>
              </div>
              <div className="text-xs text-slate-400 space-y-0.5">
                {pit && <div>Drive: {pit.drivetrain.type} | Role: {pit.selfAssessedRole} | Climb: {pit.climb.maxLevel} | Rate: {pit.scoring.scoringRate || 'N/A'} FPS</div>}
                {!pit && <div className="text-amber-400">No pit data</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatBox: React.FC<{ label: string, value: string }> = ({ label, value }) => (
  <div className="bg-slate-950/40 rounded-xl p-2 text-center">
    <span className="text-[9px] uppercase font-bold text-slate-500 block">{label}</span>
    <span className="text-sm font-bold text-slate-200">{value}</span>
  </div>
);

const StrategyLab: React.FC<{ pitData: Record<number, PitData>, matchData: MatchData[] }> = ({ pitData, matchData }) => {
  const [blue, setBlue] = useState<number[]>([0, 0, 0]);
  const [red, setRed] = useState<number[]>([0, 0, 0]);

  return (
    <div className="space-y-8 pb-12">
      <h2 className="text-3xl font-header text-blue-500">STRATEGY LAB</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-blue-400 uppercase">Blue</h3>
          {[0, 1, 2].map(i => <TeamPicker key={i} teams={blue} setTeams={setBlue} index={i} />)}
        </div>
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-red-400 uppercase">Red</h3>
          {[0, 1, 2].map(i => <TeamPicker key={i} teams={red} setTeams={setRed} index={i} />)}
        </div>
      </div>
      <AllianceStats label="Blue" color="blue" teamNumbers={blue} pitData={pitData} matchData={matchData} />
      <AllianceStats label="Red" color="red" teamNumbers={red} pitData={pitData} matchData={matchData} />
    </div>
  );
};

const Section: React.FC<{ title: string, children: React.ReactNode, noBorder?: boolean, icon?: React.ReactNode }> = ({ title, children, noBorder, icon }) => (
  <div className={`space-y-4 ${noBorder ? '' : 'pt-8 border-t border-slate-800/30'}`}>
    <div className="flex items-center gap-2 mb-2">
      {icon && <div className="text-blue-500">{icon}</div>}
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</h3>
    </div>
    {children}
  </div>
);

const Counter: React.FC<{ label: string, value: number, onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div className="bg-slate-900 p-5 rounded-3xl border-2 border-slate-800 flex items-center justify-between">
    <span className="font-bold text-slate-400 text-xs uppercase tracking-wider">{label}</span>
    <div className="flex items-center gap-6">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl font-bold border border-slate-700">-</button>
      <span className="text-4xl font-header w-10 text-center text-blue-400">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-900/20">+</button>
    </div>
  </div>
);

const ConfigView: React.FC<{ matchData: MatchData[], onShowQR: (data: string) => void, onClearData: () => void }> = ({ matchData, onShowQR, onClearData }) => {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="space-y-8 pb-12">
      <h2 className="text-3xl font-header text-white">CONFIG</h2>

      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Share Data</h3>
        <Button
          size="lg"
          className="w-full h-16"
          onClick={() => {
            if (matchData.length === 0) return;
            onShowQR(encodeBulkMatchData(matchData));
          }}
          disabled={matchData.length === 0}
        >
          <Share2 className="w-5 h-5 mr-2" />
          Share All My Matches ({matchData.length})
        </Button>
        <p className="text-xs text-slate-500">
          Generates one QR code with all your match data. Any scout can scan it to import everything at once. Newer data automatically overwrites older data.
        </p>
      </div>

      <div className="space-y-4 pt-6 border-t border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">App Info</h3>
        <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Version</span><span className="text-slate-300">1.0.0</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Matches Stored</span><span className="text-slate-300">{matchData.length}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Device ID</span><span className="text-slate-400 font-mono text-xs truncate max-w-[180px]">{localStorage.getItem('smoky_scout_device_id') || 'N/A'}</span></div>
        </div>
      </div>

      <div className="space-y-4 pt-6 border-t border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-widest text-red-400">Danger Zone</h3>
        {!confirmClear ? (
          <Button variant="danger" size="lg" className="w-full" onClick={() => setConfirmClear(true)}>
            Clear All Local Data
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-400">This deletes all pit and match data from this device. Are you sure?</p>
            <div className="flex gap-3">
              <Button variant="danger" className="flex-1" onClick={() => { onClearData(); setConfirmClear(false); }}>
                Yes, Delete Everything
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmClear(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
