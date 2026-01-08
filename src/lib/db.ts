import Dexie, { Table } from 'dexie';

// Define interfaces for data
export interface Run {
  id?: number;
  gpsPoints: Array<{ lat: number; lng: number; timestamp: number; accuracy?: number }>;
  distance: number; // in meters
  duration: number; // in seconds
  activityType: string;
  timestamp: number; // start time
  synced: boolean;
}

export interface Territory {
  tileId: string;
  ownerId: string;
  strength: number;
  geometry: any; // GeoJSON polygon
  lastUpdated: number;
}

export interface UserProfile {
  id: string; // userId
  username: string;
  email: string;
  stats: any; // cached stats
  lastSynced: number;
}

export interface SyncItem {
  id?: number;
  type: 'run' | 'territory';
  data: any;
  timestamp: number;
}

// Database class
export class TerritoryRunDB extends Dexie {
  runs!: Table<Run>;
  territories!: Table<Territory>;
  userProfile!: Table<UserProfile>;
  syncQueue!: Table<SyncItem>;

  constructor() {
    super('TerritoryRunDB');
    this.version(1).stores({
      runs: '++id, synced, timestamp',
      territories: 'tileId, ownerId, lastUpdated',
      userProfile: 'id, lastSynced',
      syncQueue: '++id, type, timestamp'
    });
  }
}

// Export singleton instance
export const db = new TerritoryRunDB();