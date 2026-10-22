/**
 * TideCloak Fabric Adapter
 * Simulates TideCloak's 4 core pillars for demo purposes.
 * In production, replace with @tidecloak/react SDK + live TideCloak server.
 */

export type PatientRecord = {
  id: string;
  name: string;
  dob: string;
  bloodType: string;
  allergies: string[];
  genomicMarkers: string[];
  diagnoses: string[];
  medications: string[];
  hospital: string;
  emergencyContact: string;
};

export type PolicySeal = {
  sealHash: string;
  quorumNodes: number;
  quorumApproved: number;
  timestamp: number;
  allowedRoles: string[];
  isValid: boolean;
};

export type EncryptedBlob = {
  ciphertext: string;
  sessionKeyId: string;
  deviceBinding: string;
  iv: string;
  algorithm: string;
};

export type FabricEvent = {
  id: string;
  timestamp: number;
  type: 'OIDC_TOKEN' | 'SEAL_VERIFY' | 'QUORUM_CHECK' | 'E2EE_BIND' | 'ACCESS_DENIED' | 'DECRYPT_SUCCESS' | 'AI_ACCESS' | 'ADMIN_BLOCKED';
  message: string;
  details: Record<string, string>;
  severity: 'info' | 'success' | 'warning' | 'error';
};

// Utility: generate deterministic-looking hex strings
function hashLike(input: string, length = 64): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  const chars = '0123456789abcdef';
  let result = '';
  let seed = h;
  while (result.length < length) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    result += chars[seed % 16];
  }
  return result;
}

function nowHex(): string {
  return Date.now().toString(16);
}

// Pillar 01 — CONNECT (BYOiD): Issue a simulated OIDC token for a patient
export function connectBYOiD(patientId: string): {
  idToken: string;
  accessToken: string;
  did: string;
  zkProof: string;
} {
  const did = `did:tide:${hashLike(patientId, 32)}`;
  const header = btoa(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: did,
    iss: 'https://tidecloak.rmit.edu.au/realms/medcloak',
    aud: 'medcloak-app',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    tide_fabric: '1.0',
    byoid: true,
  }));
  const sig = hashLike(did + nowHex(), 43);
  return {
    idToken: `${header}.${payload}.${sig}`,
    accessToken: hashLike(`access-${patientId}-${nowHex()}`, 128),
    did,
    zkProof: `zkp_${hashLike(`proof-${patientId}`, 48)}`,
  };
}

// Pillar 02 — DECREE: Seal an authorization policy with quorum nodes
export function sealPolicy(
  patientId: string,
  allowedRoles: string[],
  quorumSize = 7
): PolicySeal {
  const sealInput = `${patientId}:${allowedRoles.sort().join(',')}:${Date.now()}`;
  return {
    sealHash: `0x${hashLike(sealInput, 64)}`,
    quorumNodes: quorumSize,
    quorumApproved: quorumSize,
    timestamp: Date.now(),
    allowedRoles,
    isValid: true,
  };
}

// Pillar 04 — CONCEAL: Encrypt a record into an immunity-sealed E2EE blob
export function encryptRecord(
  record: PatientRecord,
  seal: PolicySeal,
  deviceId: string
): EncryptedBlob {
  const sessionKeyId = `sk_${hashLike(`${record.id}:${deviceId}:${seal.sealHash}`, 24)}`;
  const iv = hashLike(`iv:${sessionKeyId}:${nowHex()}`, 32);
  const plaintext = JSON.stringify(record);
  // Simulate AES-GCM ciphertext as a hex blob
  const ciphertext = hashLike(`enc:${plaintext}:${sessionKeyId}:${iv}`, Math.min(plaintext.length * 2, 256));
  return {
    ciphertext: ciphertext.match(/.{1,32}/g)!.join(' '),
    sessionKeyId,
    deviceBinding: `dev_${hashLike(`bind:${deviceId}:${sessionKeyId}`, 20)}`,
    iv,
    algorithm: 'AES-256-GCM + TideFabric-EdDSA',
  };
}

// Pillar 03 — ENTITLE: Attempt admin god-mode override (always fails)
export function attemptAdminOverride(
  adminId: string,
  _blob: EncryptedBlob,
  _seal: PolicySeal
): { blocked: true; reason: string; proof: string; forensicHash: string } {
  return {
    blocked: true,
    reason:
      'QUORUM GOVERNANCE VIOLATION: No single administrator holds the authority key shard required to decrypt or override this policy seal. Override requires ≥4 independent quorum node approvals. Attempted unilateral override is cryptographically impossible.',
    proof: `QUORUM_PROOF:${hashLike(`block:${adminId}:${nowHex()}`, 40)}`,
    forensicHash: `0x${hashLike(`forensic:${adminId}:${nowHex()}`, 64)}`,
  };
}

// Authorized decryption by a quorum-verified role
export function decryptForRole(
  blob: EncryptedBlob,
  seal: PolicySeal,
  role: string,
  record: PatientRecord
): { success: true; decryptedRecord: PatientRecord; sessionTunnel: string } | { success: false; reason: string } {
  if (!seal.allowedRoles.includes(role)) {
    return { success: false, reason: `Role '${role}' is not in the authority-sealed allowed list.` };
  }
  const sessionTunnel = `tunnel_${hashLike(`${role}:${blob.sessionKeyId}:${nowHex()}`, 32)}`;
  return { success: true, decryptedRecord: record, sessionTunnel };
}

// AI Anonymized Access
export function getAIAnonymizedView(record: PatientRecord): {
  bloodType: string;
  allergies: string[];
  diagnoses: string[];
  medications: string[];
  piiRedacted: true;
  genomicsRedacted: true;
} {
  return {
    bloodType: record.bloodType,
    allergies: record.allergies,
    diagnoses: record.diagnoses,
    medications: record.medications,
    piiRedacted: true,
    genomicsRedacted: true,
  };
}

// Event factory
export function makeEvent(
  type: FabricEvent['type'],
  message: string,
  details: Record<string, string>,
  severity: FabricEvent['severity'] = 'info'
): FabricEvent {
  return {
    id: `evt_${hashLike(`${type}:${Date.now()}:${Math.random()}`, 16)}`,
    timestamp: Date.now(),
    type,
    message,
    details,
    severity,
  };
}
