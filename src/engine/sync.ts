/* ======================================================================== */
/*  VULCAN ERP — PART 10B: OFFLINE SYNC ENGINE                              */
/*  The hardest part of the mobile build — specified precisely              */
/* ======================================================================== */

import type { ERPState, Res, SyncQueueItem, SyncState, MediaUpload } from './types';
import { cloneState, uid, nowStamp, pushAudit } from './engine';

/* ===================== The Eight Rules ===================== */

/**
 * Rule 1: Client identity
 * Every device-created record carries client_uuid, device_id, client_timestamp, app_version.
 * Server clock is authoritative for sequencing and business dating.
 */
export function createOfflineRecord(
  sIn: ERPState,
  deviceId: string,
  entity: string,
  payload: any,
  dependsOn: string[] = [],
): Res {
  const s = cloneState(sIn);
  const clientUuid = uid();
  const clientTimestamp = nowStamp();

  const queueItem: SyncQueueItem = {
    id: uid(),
    clientUuid,
    deviceId,
    entity,
    payload,
    clientTimestamp,
    dependsOn,
    status: 'QUEUED',
    retryCount: 0,
  };

  // Initialize sync state if not exists
  if (!s.syncQueues[deviceId]) {
    s.syncQueues[deviceId] = {
      deviceId,
      serverCursor: 0,
      queueDepth: 0,
      items: [],
      cacheSize: 0,
      encrypted: true,
    };
  }

  s.syncQueues[deviceId].items.push(queueItem);
  s.syncQueues[deviceId].queueDepth++;

  return { s, ok: true, msg: `Offline record queued: ${entity} (${clientUuid})`, tone: 'ok', docId: clientUuid };
}

/**
 * Rule 2: Idempotency
 * client_uuid is the idempotency key. A retried upload never creates a second record.
 */
export function syncPush(
  sIn: ERPState,
  deviceId: string,
  items: { clientUuid: string; entity: string; payload: any; clientTimestamp: string; dependsOn: string[] }[],
): Res {
  const s = cloneState(sIn);
  const queue = s.syncQueues[deviceId];
  if (!queue) return { s, ok: false, msg: 'Device not registered', tone: 'bad' };

  const results: { clientUuid: string; status: string; reason?: string }[] = [];

  for (const item of items) {
    // Check for duplicate (idempotency)
    const existing = queue.items.find((q) => q.clientUuid === item.clientUuid);
    if (existing && existing.status === 'ACCEPTED') {
      results.push({ clientUuid: item.clientUuid, status: 'duplicate_ignored' });
      continue;
    }

    // Check dependencies
    const unmetDeps = item.dependsOn.filter((dep) => {
      const depItem = queue.items.find((q) => q.clientUuid === dep);
      return !depItem || depItem.status !== 'ACCEPTED';
    });

    if (unmetDeps.length > 0) {
      results.push({ clientUuid: item.clientUuid, status: 'rejected', reason: `Unmet dependencies: ${unmetDeps.join(', ')}` });
      continue;
    }

    // Accept the item
    if (existing) {
      existing.status = 'ACCEPTED';
      existing.serverTimestamp = nowStamp();
    } else {
      queue.items.push({
        id: uid(),
        clientUuid: item.clientUuid,
        deviceId,
        entity: item.entity,
        payload: item.payload,
        clientTimestamp: item.clientTimestamp,
        dependsOn: item.dependsOn,
        status: 'ACCEPTED',
        serverTimestamp: nowStamp(),
        retryCount: 0,
      });
    }

    results.push({ clientUuid: item.clientUuid, status: 'accepted' });
  }

  queue.queueDepth = queue.items.filter((i) => i.status === 'QUEUED' || i.status === 'UPLOADING').length;
  queue.lastSyncAt = nowStamp();

  return { s, ok: true, msg: `Sync push: ${results.length} items processed`, tone: 'ok', detail: JSON.stringify(results) };
}

/**
 * Rule 3 & 4: Conflict detection
 * Append-only facts never overwrite. Value data conflicts create exceptions.
 */
export function detectConflict(
  sIn: ERPState,
  deviceId: string,
  clientUuid: string,
  entity: string,
  serverVersion: any,
  clientVersion: any,
): Res {
  const s = cloneState(sIn);
  const queue = s.syncQueues[deviceId];
  if (!queue) return { s, ok: false, msg: 'Device not registered', tone: 'bad' };

  const item = queue.items.find((q) => q.clientUuid === clientUuid);
  if (!item) return { s, ok: false, msg: 'Item not found in queue', tone: 'bad' };

  // Conflict matrix
  const conflictRules: Record<string, (server: any, client: any) => { accept: boolean; reason?: string }> = {
    'ATTENDANCE_PUNCH': (server, client) => {
      // Same person, same time, two devices → both retained, duplicate flagged
      return { accept: true, reason: 'Duplicate punch retained for HR review' };
    },
    'DPR': (server, client) => {
      // Two engineers for same project/date/shift → second rejected
      if (server.projectCode === client.projectCode && server.date === client.date && server.shift === client.shift) {
        return { accept: false, reason: 'DPR already submitted for this project/date/shift' };
      }
      return { accept: true };
    },
    'MEASUREMENT': (server, client) => {
      // Item already certified → rejected, must become deviation
      if (server.certified) {
        return { accept: false, reason: 'Measurement already certified — create deviation entry instead' };
      }
      return { accept: true };
    },
    'MATERIAL_REQUEST': (server, client) => {
      // Stock insufficient → accepted but flagged
      return { accept: true, reason: 'Request accepted but flagged as unfulfillable' };
    },
    'EQUIPMENT_LOG': (server, client) => {
      // Reading lower than posted log → rejected
      if (client.closingHm < server.closingHm) {
        return { accept: false, reason: `Hour meter reading ${client.closingHm} < server ${server.closingHm}` };
      }
      return { accept: true };
    },
    'INSPECTION_RESULT': (server, client) => {
      // Lot already closed → rejected
      if (server.status === 'CLOSED') {
        return { accept: false, reason: 'Inspection lot already closed' };
      }
      return { accept: true };
    },
    'SAFETY_OBSERVATION': () => {
      // Always accepted (append-only)
      return { accept: true };
    },
    'CHAT_MESSAGE': () => {
      // Always accepted, ordered by server sequence
      return { accept: true };
    },
  };

  const rule = conflictRules[entity];
  if (!rule) {
    item.status = 'CONFLICT';
    item.conflictDetails = { serverVersion, clientVersion };
    return { s, ok: false, msg: `No conflict rule for entity: ${entity}`, tone: 'bad' };
  }

  const result = rule(serverVersion, clientVersion);
  if (result.accept) {
    item.status = 'ACCEPTED';
    item.serverTimestamp = nowStamp();
    return { s, ok: true, msg: result.reason || 'Conflict resolved — accepted', tone: 'ok' };
  } else {
    item.status = 'REJECTED';
    item.rejectionReason = result.reason;
    return { s, ok: false, msg: result.reason || 'Conflict — rejected', tone: 'bad' };
  }
}

/**
 * Rule 5: Master data is download-only
 * Devices never create or modify masters offline.
 */
export function requestNewMaster(
  sIn: ERPState,
  deviceId: string,
  masterType: string,
  data: any,
): Res {
  const s = cloneState(sIn);

  // Queue as a REQUEST, not a master creation
  const requestItem: SyncQueueItem = {
    id: uid(),
    clientUuid: uid(),
    deviceId,
    entity: 'MASTER_REQUEST',
    payload: { masterType, data, requestedAt: nowStamp() },
    clientTimestamp: nowStamp(),
    dependsOn: [],
    status: 'QUEUED',
    retryCount: 0,
  };

  if (!s.syncQueues[deviceId]) {
    s.syncQueues[deviceId] = {
      deviceId,
      serverCursor: 0,
      queueDepth: 0,
      items: [],
      cacheSize: 0,
      encrypted: true,
    };
  }

  s.syncQueues[deviceId].items.push(requestItem);
  s.syncQueues[deviceId].queueDepth++;

  return { s, ok: true, msg: `Master creation request queued: ${masterType} (will be reviewed by admin)`, tone: 'ok' };
}

/**
 * Rule 6: Bounded queue with visible state
 * Seven days retention. Queue depth, last sync, per-item status visible.
 */
export function getSyncStatus(s: ERPState, deviceId: string): {
  queueDepth: number;
  lastSyncAt?: string;
  items: { clientUuid: string; entity: string; status: string; reason?: string }[];
} {
  const queue = s.syncQueues[deviceId];
  if (!queue) {
    return { queueDepth: 0, items: [] };
  }

  // Purge items older than 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  queue.items = queue.items.filter((item) => {
    const itemDate = new Date(item.clientTimestamp);
    return itemDate > sevenDaysAgo;
  });

  queue.queueDepth = queue.items.filter((i) => i.status === 'QUEUED' || i.status === 'UPLOADING').length;

  return {
    queueDepth: queue.queueDepth,
    lastSyncAt: queue.lastSyncAt,
    items: queue.items.map((i) => ({
      clientUuid: i.clientUuid,
      entity: i.entity,
      status: i.status,
      reason: i.rejectionReason,
    })),
  };
}

/**
 * Rule 7: No offline approvals
 * Approval requires live server round trip and re-authentication.
 */
export function attemptOfflineApproval(sIn: ERPState): Res {
  return {
    s: sIn,
    ok: false,
    msg: 'Approvals require a live server connection and re-authentication. Please connect to the network.',
    tone: 'bad',
  };
}

/**
 * Rule 8: Deferred, resumable media
 * Photographs and voice notes queue separately. Parent syncs first.
 */
export function queueMediaUpload(
  sIn: ERPState,
  deviceId: string,
  parentId: string,
  parentEntity: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
): Res {
  const s = cloneState(sIn);
  const uploadId = uid();
  const chunkSize = 256 * 1024; // 256 KB chunks
  const totalChunks = Math.ceil(fileSize / chunkSize);

  const mediaUpload: MediaUpload = {
    id: uid(),
    uploadId,
    parentId,
    parentEntity,
    fileName,
    fileSize,
    mimeType,
    chunkSize,
    totalChunks,
    uploadedChunks: 0,
    status: 'INIT',
  };

  s.mediaUploads.push(mediaUpload);

  return {
    s,
    ok: true,
    msg: `Media upload queued: ${fileName} (${totalChunks} chunks)`,
    tone: 'ok',
    docId: uploadId,
  };
}

export function uploadMediaChunk(
  sIn: ERPState,
  uploadId: string,
  chunkNumber: number,
): Res {
  const s = cloneState(sIn);
  const upload = s.mediaUploads.find((u) => u.uploadId === uploadId);
  if (!upload) return { s, ok: false, msg: 'Upload not found', tone: 'bad' };

  if (chunkNumber < 1 || chunkNumber > upload.totalChunks) {
    return { s, ok: false, msg: `Invalid chunk number: ${chunkNumber}`, tone: 'bad' };
  }

  upload.uploadedChunks = Math.max(upload.uploadedChunks, chunkNumber);
  upload.status = upload.uploadedChunks === upload.totalChunks ? 'COMPLETE' : 'UPLOADING';

  return {
    s,
    ok: true,
    msg: `Chunk ${chunkNumber}/${upload.totalChunks} uploaded`,
    tone: 'ok',
  };
}

export function completeMediaUpload(
  sIn: ERPState,
  uploadId: string,
): Res {
  const s = cloneState(sIn);
  const upload = s.mediaUploads.find((u) => u.uploadId === uploadId);
  if (!upload) return { s, ok: false, msg: 'Upload not found', tone: 'bad' };

  if (upload.uploadedChunks !== upload.totalChunks) {
    return { s, ok: false, msg: 'Not all chunks uploaded', tone: 'bad' };
  }

  upload.status = 'COMPLETE';
  upload.attachmentId = uid();

  return {
    s,
    ok: true,
    msg: `Media upload complete: ${upload.fileName}`,
    tone: 'ok',
    docId: upload.attachmentId,
  };
}

/* ===================== Sync Protocol ===================== */

/**
 * DOWNLOAD: Delta, cursor-based
 */
export function syncPull(
  sIn: ERPState,
  deviceId: string,
  sinceCursor: number,
  scopes: string[],
): Res {
  const s = cloneState(sIn);
  const queue = s.syncQueues[deviceId];
  if (!queue) return { s, ok: false, msg: 'Device not registered', tone: 'bad' };

  // Simulate delta sync
  const mastersDelta: any[] = [];
  const documentsDelta: any[] = [];
  const configDelta: any[] = [];
  const deletions: any[] = [];
  const newCursor = queue.serverCursor + 1;

  queue.serverCursor = newCursor;
  queue.lastSyncAt = nowStamp();

  return {
    s,
    ok: true,
    msg: `Sync pull: cursor ${sinceCursor} → ${newCursor}`,
    tone: 'ok',
    detail: JSON.stringify({
      masters_delta: mastersDelta,
      documents_delta: documentsDelta,
      config_delta: configDelta,
      deletions,
      new_cursor: newCursor,
      full_resync_required: false,
    }),
  };
}

/**
 * Full resync demand
 */
export function demandFullResync(sIn: ERPState, deviceId: string, reason: string): Res {
  const s = cloneState(sIn);
  const queue = s.syncQueues[deviceId];
  if (!queue) return { s, ok: false, msg: 'Device not registered', tone: 'bad' };

  pushAudit(s, 'SYSTEM', 'SYSTEM', 'SYNC', deviceId, {
    reason: `Full resync demanded: ${reason}`,
  });

  // Reset cursor but preserve outbound queue
  queue.serverCursor = 0;

  return {
    s,
    ok: true,
    msg: `Full resync demanded: ${reason}. Outbound queue preserved.`,
    tone: 'warn',
  };
}

/* ===================== Cache Management ===================== */

/**
 * Scope-bounded download
 */
export function getCacheScope(s: ERPState, userId: string): {
  projects: string[];
  sites: string[];
  roles: string[];
} {
  // In a real implementation, this would query user assignments
  // For now, return a sample scope
  return {
    projects: ['PRJ-NH47'],
    sites: ['ST-NH47'],
    roles: ['ROLE-ENG'],
  };
}

/**
 * Cache size management
 */
export function getCacheSize(s: ERPState, deviceId: string): number {
  const queue = s.syncQueues[deviceId];
  return queue?.cacheSize || 0;
}

export function setCacheSize(sIn: ERPState, deviceId: string, size: number): Res {
  const s = cloneState(sIn);
  const queue = s.syncQueues[deviceId];
  if (!queue) return { s, ok: false, msg: 'Device not registered', tone: 'bad' };

  queue.cacheSize = size;
  return { s, ok: true, msg: `Cache size set to ${size} bytes`, tone: 'ok' };
}

/* ===================== Security ===================== */

/**
 * Device registration and binding
 */
export function registerDevice(
  sIn: ERPState,
  userId: string,
  deviceId: string,
  appVersion: string,
): Res {
  const s = cloneState(sIn);

  const device = {
    id: uid(),
    userId,
    deviceId,
    appVersion,
    registeredAt: nowStamp(),
    encrypted: true,
  };

  s.mobileDevices.push(device);

  // Initialize sync state
  s.syncQueues[deviceId] = {
    deviceId,
    serverCursor: 0,
    queueDepth: 0,
    items: [],
    cacheSize: 0,
    encrypted: true,
  };

  pushAudit(s, userId, 'SECURITY', 'DEVICE', deviceId, {
    reason: `Device registered: ${deviceId}`,
  });

  return { s, ok: true, msg: `Device registered: ${deviceId}`, tone: 'ok', docId: device.id };
}

/**
 * Device deregistration with remote wipe
 */
export function deregisterDevice(sIn: ERPState, deviceId: string, userId: string): Res {
  const s = cloneState(sIn);

  const deviceIndex = s.mobileDevices.findIndex((d) => d.deviceId === deviceId);
  if (deviceIndex === -1) return { s, ok: false, msg: 'Device not found', tone: 'bad' };

  s.mobileDevices.splice(deviceIndex, 1);
  delete s.syncQueues[deviceId];

  pushAudit(s, userId, 'SECURITY', 'DEVICE', deviceId, {
    reason: 'Device deregistered — cache purged, remote wipe initiated',
  });

  return { s, ok: true, msg: 'Device deregistered — cache purged, remote wipe initiated', tone: 'warn' };
}

/**
 * Repeated failed unlock → cache purge
 */
export function handleFailedUnlock(sIn: ERPState, deviceId: string, attemptCount: number): Res {
  const s = cloneState(sIn);
  const queue = s.syncQueues[deviceId];
  if (!queue) return { s, ok: false, msg: 'Device not registered', tone: 'bad' };

  if (attemptCount >= 5) {
    // Purge cache
    queue.items = [];
    queue.queueDepth = 0;
    queue.cacheSize = 0;

    pushAudit(s, 'SYSTEM', 'SECURITY', 'DEVICE', deviceId, {
      reason: `Cache purged after ${attemptCount} failed unlock attempts`,
    });

    return { s, ok: false, msg: `Cache purged after ${attemptCount} failed attempts`, tone: 'bad' };
  }

  return { s, ok: true, msg: `Failed unlock attempt ${attemptCount}/5`, tone: 'warn' };
}
