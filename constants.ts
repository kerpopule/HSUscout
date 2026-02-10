
import { Team } from './types';

export const SMOKY_MOUNTAIN_TEAMS: Team[] = [
  { number: 379, name: "The RoboCats", location: "Girard, Ohio" },
  { number: 547, name: "Falcon Engineering And Robotics", location: "Fayetteville, Tennessee" },
  { number: 1038, name: "Lakota Robotics", location: "Liberty Township, Ohio" },
  { number: 1369, name: "Minotaur", location: "Tampa, Florida" },
  { number: 1445, name: "Webb Spark", location: "Knoxville, Tennessee" },
  { number: 1466, name: "Webb Robotics", location: "Knoxville, Tennessee" },
  { number: 2393, name: "Robotichauns", location: "Knoxville, Tennessee" },
  { number: 2783, name: "Engineers of Tomorrow", location: "La Grange, Kentucky" },
  { number: 2856, name: "Planetary Drive", location: "Lexington, Kentucky" },
  { number: 3102, name: "Tech-No-Tigers", location: "Nevis, Minnesota" },
  { number: 3138, name: "Innovators Robotics", location: "Englewood, Ohio" },
  { number: 3140, name: "Flagship", location: "Knoxville, Tennessee" },
  { number: 3492, name: "Putnam Area Robotics Team (P.A.R.T.s)", location: "Winfield, West Virginia" },
  { number: 3814, name: "PiBotics", location: "Florence, Kentucky" },
  { number: 3821, name: "Pirabots", location: "Belfry, Kentucky" },
  { number: 3824, name: "HVA RoHAWKtics", location: "Knoxville, Tennessee" },
  { number: 3843, name: "ROBO RACERS", location: "Murray, Kentucky" },
  { number: 3959, name: "Mech Tech", location: "Somerville, Alabama" },
  { number: 3966, name: "Gryphon Command", location: "Knoxville, Tennessee" },
  { number: 3984, name: "Topper Robotics", location: "Johnson City, Tennessee" },
  { number: 4013, name: "Clockwork Mania", location: "Orlando, Florida" },
  { number: 4020, name: "Cyber Tribe", location: "Kingsport, Tennessee" },
  { number: 4013, name: "Clockwork Mania", location: "Orlando, Florida" },
  { number: 4020, name: "Cyber Tribe", location: "Kingsport, Tennessee" },
  { number: 4065, name: "Nerds of Prey", location: "Minneola, Florida" },
  { number: 4265, name: "Secret City Wildbots", location: "Oak Ridge, Tennessee" },
  { number: 4504, name: "B. C. Robotics", location: "Maryville, Tennessee" },
  { number: 4576, name: "Red Nation Robotics", location: "Knoxville, Tennessee" },
  { number: 4630, name: "Robodragons", location: "Clinton, Tennessee" },
  { number: 5276, name: "Edgar Allan Ohms", location: "Tampa, Florida" },
  { number: 5492, name: "Winner's Circle Robo Jockey's", location: "Louisville, Kentucky" },
  { number: 5744, name: "RoboRunners", location: "Knoxville, Tennessee" },
  { number: 6302, name: "Greeneville High School Robotics", location: "Greeneville, Tennessee" },
  { number: 6517, name: "So-Kno Robo", location: "Knoxville, Tennessee" },
  { number: 6774, name: "Oh-Kno Robo", location: "Knoxville, Tennessee" },
  { number: 7111, name: "RAD Robotics", location: "Huntsville, Alabama" },
  { number: 7428, name: "Gigawatts", location: "Fort Payne, Alabama" },
  { number: 7516, name: "Louisville Centrons", location: "Louisville, Kentucky" },
  { number: 7525, name: "Pioneers", location: "Nashville, Tennessee" },
  { number: 7917, name: "Frontier", location: "Nashville, Tennessee" },
  { number: 8778, name: "HSUWerx", location: "Fort Walton Beach, Florida" },
  { number: 9097, name: "MachBusters", location: "Cincinnati, Ohio" },
  { number: 9152, name: "Rat Fight", location: "Berea, Kentucky" },
  { number: 9668, name: "West Robotics", location: "Knoxville, Tennessee" },
  { number: 10137, name: "RoboKats", location: "Lexington, Kentucky" },
  { number: 11275, name: "Defenders 1", location: "Lexington, Kentucky" },
  { number: 11337, name: "Jackson FRC", location: "Jackson, Tennessee" }
].sort((a, b) => a.number - b.number);

export const DRIVETRAIN_TYPES = ["Swerve", "Tank", "Mecanum", "Other"];
export const MOTOR_TYPES = ["Kraken", "Falcon", "NEO", "CIM", "Other"];
export const ARCHETYPES = ["Turret", "Stationary", "Other"];
export const CLIMB_CAPABILITIES = ["Auto L1", "L1", "L2", "L3"];
