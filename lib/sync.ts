import { PitData, MatchData } from '../types';
import { checkHealth, syncQueue, fetchPitData, fetchMatchData } from './api';

const SYNC_QUEUE_KEY = 'smoky_scout_sync_queue';
const POLL_INTERVAL = 5000;

interface SyncItem {
  type: 'pit' | 'match';
  data: PitData | MatchData;
}

export function getSyncQueue(): SyncItem[] {
  const raw = localStorage.getItem(SYNC_QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function setSyncQueue(items: SyncItem[]) {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(items));
}

export function addToSyncQueue(item: SyncItem) {
  const queue = getSyncQueue();
  queue.push(item);
  setSyncQueue(queue);
}

export function startSyncService(callbacks: {
  onConnectionChange: (connected: boolean) => void;
  onDataRefresh: (pit: Record<number, PitData>, match: MatchData[]) => void;
  onQueueDrained: () => void;
}): () => void {
  let running = true;

  const poll = async () => {
    while (running) {
      const connected = await checkHealth();
      callbacks.onConnectionChange(connected);

      if (connected) {
        // Drain sync queue
        const queue = getSyncQueue();
        if (queue.length > 0) {
          try {
            await syncQueue(queue);
            setSyncQueue([]);
            callbacks.onQueueDrained();
          } catch {
            // Will retry next poll
          }
        }

        // Refresh data from server
        try {
          const [pit, match] = await Promise.all([fetchPitData(), fetchMatchData()]);
          callbacks.onDataRefresh(pit, match);
        } catch {
          // Will retry next poll
        }
      }

      await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
  };

  poll();

  return () => { running = false; };
}
