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

export interface UserProfile {
  id: number; // userId stored as number for consistency with API
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
  userProfile!: Table<UserProfile>;
  syncQueue!: Table<SyncItem>;

  constructor() {
    super('TerritoryRunDB');
    
    // Version 1: Original schema with territories table
    this.version(1).stores({
      runs: '++id, synced, timestamp',
      territories: 'tileId, ownerId, lastUpdated', // Old schema
      userProfile: 'id, lastSynced',
      syncQueue: '++id, type, timestamp'
    });
    
    // Version 2: Remove territories table (now fetched from API)
    this.version(2).stores({
      runs: '++id, synced, timestamp',
      territories: null, // Delete the table
      userProfile: 'id, lastSynced',
      syncQueue: '++id, type, timestamp'
    });
  }
}

// Export singleton instance
export const db = new TerritoryRunDB();