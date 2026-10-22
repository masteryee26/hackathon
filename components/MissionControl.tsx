'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Lock, Zap, Terminal, Activity, Building2, User, Bot, Eye, EyeOff, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { PRIMARY_PATIENT } from '@/lib/synthetic-records';
import {
  connectBYOiD,
  sealPolicy,
  encryptRecord,
  attemptAdminOverride,
  decryptForRole,
  getAIAnonymizedView,
  makeEvent,
  type FabricEvent,
  type PolicySeal,
  type EncryptedBlob,
} from '@/lib/tidecloak-fabric';

type Phase = 'idle' | 'connected' | 'sealed' | 'encrypted';
type AdminAttempt = 'idle' | 'attempting' | 'blocked';
type DoctorAccess = 'idle' | 'verifying' | 'decrypted';
type AIAccess = 'idle' | 'requesting' | 'granted';

function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').replace('Z', ' UTC');
}

function SeverityIcon({ s }: { s: FabricEvent['severity'] }) {
  if (s === 'success') return <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />;
  if (s === 'error') return <XCircle className="w-3 h-3 text-red-400 shrink-0" />;
  if (s === 'warning') return <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />;
  return <Activity className="w-3 h-3 text-sky-400 shrink-0" />;
}

const SEVERITY_COLOR: Record<FabricEvent['severity'], string> = {
  info: 'text-sky-300',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  error: 'text-red-300',
};

export function MissionControl() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [policies, setPolicies] = useState({
    erDoctors: true,
    aiBot: true,
    adminRoot: false,
  });
  const [seal, setSeal] = useState<PolicySeal | null>(null);
  const [blob, setBlob] = useState<EncryptedBlob | null>(null);
  const [sealLoading, setSealLoading] = useState(false);
  const [adminAttempt, setAdminAttempt] = useState<AdminAttempt>('idle');
  const [adminResult, setAdminResult] = useState<ReturnType<typeof attemptAdminOverride> | null>(null);
  const [doctorAccess, setDoctorAccess] = useState<DoctorAccess>('idle');
  const [doctorRecord, setDoctorRecord] = useState<typeof PRIMARY_PATIENT | null>(null);
  const [doctorTunnel, setDoctorTunnel] = useState('');
  const [aiAccess, setAIAccess] = useState<AIAccess>('idle');
  const [aiView, setAIView] = useState<ReturnType<typeof getAIAnonymizedView> | null>(null);
  const [activeConsumer, setActiveConsumer] = useState<'doctor' | 'ai'>('doctor');
  const [events, setEvents] = useState<FabricEvent[]>([]);
  const [byoid, setByoid] = useState<ReturnType<typeof connectBYOiD> | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  const pushEvent = useCallback((evt: FabricEvent) => {
    setEvents(prev => [evt, ...prev].slice(0, 60));
  }, []);

  useEffect(() => {
    // Auto-connect on mount
    const auth = connectBYOiD(PRIMARY_PATIENT.id);
    setByoid(auth);
    setPhase('connected');
    pushEvent(makeEvent('OIDC_TOKEN', 'TideCloak BYOiD authentication complete', {
      did: auth.did,
      iss: 'https://tidecloak.rmit.edu.au/realms/medcloak',
      zkProof: auth.zkProof.slice(0, 20) + '...',
      token_type: 'Bearer',
    }, 'success'));
  }, [pushEvent]);

  function handleSealAndEncrypt() {
    if (!byoid) return;
    setSealLoading(true);

    const allowedRoles: string[] = [];
    if (policies.erDoctors) allowedRoles.push('er_doctor');
    if (policies.aiBot) allowedRoles.push('ai_triage_bot');

    pushEvent(makeEvent('QUORUM_CHECK', 'Initiating quorum governance vote for policy seal...', {
      quorum_nodes: '7',
      required_approvals: '4',
      patient_did: byoid.did.slice(0, 24) + '...',
    }, 'info'));

    setTimeout(() => {
      const newSeal = sealPolicy(PRIMARY_PATIENT.id, allowedRoles, 7);
      setSeal(newSeal);

      pushEvent(makeEvent('SEAL_VERIFY', 'Quorum governance approved. Authority key shard assembled.', {
        seal_hash: newSeal.sealHash.slice(0, 18) + '...',
        quorum: `${newSeal.quorumApproved}/${newSeal.quorumNodes}`,
        allowed_roles: allowedRoles.join(', ') || 'none',
      }, 'success'));

      const newBlob = encryptRecord(PRIMARY_PATIENT, newSeal, 'device-alice-iphone-SE3');
      setBlob(newBlob);

      pushEvent(makeEvent('E2EE_BIND', 'Immunity-Sealed E2EE applied. Plaintext purged from server.', {
        session_key_id: newBlob.sessionKeyId,
        device_binding: newBlob.deviceBinding,
        algorithm: newBlob.algorithm,
        iv: newBlob.iv.slice(0, 16) + '...',
      }, 'success'));

      setPhase('encrypted');
      setSealLoading(false);
    }, 1800);
  }

  function handleAdminOverride() {
    if (!blob || !seal) return;
    setAdminAttempt('attempting');

    pushEvent(makeEvent('ACCESS_DENIED', 'ALERT: Unilateral admin override attempt detected!', {
      admin_id: 'admin@cloudprovider.com',
      target_record: PRIMARY_PATIENT.id,
      attempt: 'POLICY_OVERRIDE + DECRYPT',
    }, 'warning'));

    setTimeout(() => {
      const result = attemptAdminOverride('admin@cloudprovider.com', blob, seal);
      setAdminResult(result);
      setAdminAttempt('blocked');

      pushEvent(makeEvent('ADMIN_BLOCKED', '[QUORUM GOVERNANCE BLOCKED] God-mode override REJECTED', {
        reason: 'Single admin lacks authority key shard',
        proof: result.proof.slice(0, 30) + '...',
        forensic_hash: result.forensicHash.slice(0, 18) + '...',
        action: 'Attempt logged to immutable audit ledger',
      }, 'error'));
    }, 1500);
  }

  function handleDoctorAccess() {
    if (!blob || !seal) return;
    setDoctorAccess('verifying');

    pushEvent(makeEvent('SEAL_VERIFY', 'Dr. Minh presenting credentials — verifying quorum seal...', {
      role: 'er_doctor',
      institution: 'City General Hospital',
      session_type: 'emergency_cross_hospital',
    }, 'info'));

    setTimeout(() => {
      const result = decryptForRole(blob, seal, 'er_doctor', PRIMARY_PATIENT);
      if (result.success) {
        setDoctorRecord(result.decryptedRecord);
        setDoctorTunnel(result.sessionTunnel);
        setDoctorAccess('decrypted');

        pushEvent(makeEvent('DECRYPT_SUCCESS', 'E2EE Tunnel established. Full emergency record decrypted.', {
          session_tunnel: result.sessionTunnel.slice(0, 24) + '...',
          decrypted_for: 'Dr. Minh Tran (er_doctor)',
          scope: 'full_emergency_record',
          expiry: '1800s (session-bound)',
        }, 'success'));
      }
    }, 2000);
  }

  function handleAIAccess() {
    if (!blob || !seal) return;
    setAIAccess('requesting');

    pushEvent(makeEvent('AI_ACCESS', 'AI Clinical Assistant requesting bounded data access...', {
      role: 'ai_triage_bot',
      access_type: 'anonymized_clinical_only',
      pii_redacted: 'true',
      genomics_redacted: 'true',
    }, 'info'));

    setTimeout(() => {
      const view = getAIAnonymizedView(PRIMARY_PATIENT);
      setAIView(view);
      setAIAccess('granted');

      pushEvent(makeEvent('AI_ACCESS', 'AI access granted — PII & genomics cryptographically excluded', {
        fields_returned: 'bloodType, allergies, diagnoses, medications',
        fields_blocked: 'name, dob, genomicMarkers, emergencyContact, hospital',
        policy: 'ai_triage_bot_anonymized_v2',
      }, 'success'));
    }, 1500);
  }

  const isSealed = phase === 'encrypted';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 font-mono">
      {/* Header */}
      <header className="mb-6 border-b border-emerald-900/50 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Shield className="w-9 h-9 text-emerald-400" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-emerald-300 tracking-widest uppercase">MedCloak</h1>
              <p className="text-xs text-gray-500 tracking-wider">Cyber-Immune Cross-Hospital Medical Exchange · TideCloak Fabric v1.0</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <StatusBadge label="TIDECLOAK FABRIC" active={phase !== 'idle'} color="emerald" />
            <StatusBadge label="QUORUM NODES" active={isSealed} color="blue" />
            <StatusBadge label="E2EE ACTIVE" active={isSealed} color="emerald" />
          </div>
        </div>
        {byoid && (
          <div className="mt-3 text-xs text-gray-600 font-mono">
            <span className="text-emerald-700">DID:</span> <span className="text-emerald-600">{byoid.did}</span>
            <span className="mx-4 text-gray-700">|</span>
            <span className="text-emerald-700">ZKP:</span> <span className="text-emerald-600">{byoid.zkProof.slice(0, 32)}…</span>
          </div>
        )}
      </header>

      {/* Main 3-column grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* Panel 1 — Patient Identity & Policy Decree */}
        <Panel1
          phase={phase}
          policies={policies}
          setPolicies={setPolicies}
          seal={seal}
          blob={blob}
          sealLoading={sealLoading}
          onSeal={handleSealAndEncrypt}
        />

        {/* Panel 2 — Admin God-Mode Breach Test */}
        <Panel2
          isSealed={isSealed}
          adminAttempt={adminAttempt}
          adminResult={adminResult}
          blob={blob}
          onAttempt={handleAdminOverride}
        />

        {/* Panel 3 — Authorized Cross-Hospital Access */}
        <Panel3
          isSealed={isSealed}
          activeConsumer={activeConsumer}
          setActiveConsumer={setActiveConsumer}
          doctorAccess={doctorAccess}
          doctorRecord={doctorRecord}
          doctorTunnel={doctorTunnel}
          aiAccess={aiAccess}
          aiView={aiView}
          onDoctorAccess={handleDoctorAccess}
          onAIAccess={handleAIAccess}
        />
      </div>

      {/* Bottom Console */}
      <AuditConsole events={events} consoleRef={consoleRef} />

      {/* Footer */}
      <footer className="mt-4 text-center text-xs text-gray-700">
        <span>MedCloak · RMIT Hackathon 2026 · Challenge 2: UNLOCKED</span>
        <span className="mx-2">·</span>
        <a href="https://tide.org/tidecloak" target="_blank" rel="noopener noreferrer" className="text-emerald-800 hover:text-emerald-600 transition-colors">
          Built with TideCloak
        </a>
      </footer>
    </div>
  );
}

// --- Sub-components ---

function StatusBadge({ label, active, color }: { label: string; active: boolean; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: active ? 'bg-emerald-950 border-emerald-700 text-emerald-400' : 'bg-gray-900 border-gray-800 text-gray-600',
    blue: active ? 'bg-blue-950 border-blue-700 text-blue-400' : 'bg-gray-900 border-gray-800 text-gray-600',
  };
  return (
    <span className={`px-2 py-1 rounded border text-xs font-mono tracking-wider transition-all duration-500 ${colorMap[color]}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${active ? (color === 'emerald' ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400 animate-pulse') : 'bg-gray-700'}`} />
      {label}
    </span>
  );
}

function PanelCard({ title, icon, color, children }: { title: string; icon: React.ReactNode; color: string; children: React.ReactNode }) {
  const borderMap: Record<string, string> = {
    emerald: 'border-emerald-900/60',
    red: 'border-red-900/60',
    blue: 'border-blue-900/60',
  };
  const titleMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  };
  return (
    <div className={`bg-gray-900/60 border ${borderMap[color]} rounded-xl p-5 flex flex-col gap-4`}>
      <div className={`flex items-center gap-2 ${titleMap[color]} font-bold text-sm tracking-wider uppercase`}>
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function PolicyToggle({ label, checked, onChange, locked }: { label: string; checked: boolean; onChange?: (v: boolean) => void; locked?: boolean }) {
  return (
    <label className={`flex items-center gap-3 cursor-pointer group ${locked ? 'opacity-60' : ''}`}>
      <div
        className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${checked ? 'bg-emerald-600' : 'bg-gray-700'} ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => !locked && onChange?.(!checked)}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${checked ? 'translate-x-5' : ''}`} />
      </div>
      <span className="text-xs text-gray-300 group-hover:text-white transition-colors">{label}</span>
      {locked && <Lock className="w-3 h-3 text-red-500 ml-auto" />}
    </label>
  );
}

function SealHashDisplay({ seal }: { seal: PolicySeal }) {
  return (
    <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-lg p-3 text-xs font-mono">
      <div className="text-emerald-600 mb-1 text-[10px] tracking-widest">AUTHORITY SEAL HASH</div>
      <div className="text-emerald-400 break-all leading-relaxed">{seal.sealHash}</div>
      <div className="flex gap-4 mt-2 text-gray-500 text-[10px]">
        <span>QUORUM: {seal.quorumApproved}/{seal.quorumNodes}</span>
        <span>ROLES: {seal.allowedRoles.join(', ') || 'none'}</span>
      </div>
    </div>
  );
}

function CiphertextDisplay({ blob }: { blob: EncryptedBlob }) {
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-[10px] font-mono">
      <div className="text-gray-600 mb-1 tracking-widest">E2EE CIPHERTEXT BLOB</div>
      <div className="text-gray-500 break-all leading-loose">{blob.ciphertext}</div>
      <div className="mt-2 text-gray-700">ALG: {blob.algorithm}</div>
      <div className="text-gray-700">SKI: {blob.sessionKeyId}</div>
      <div className="text-gray-700">BIND: {blob.deviceBinding}</div>
    </div>
  );
}

function Panel1({
  phase, policies, setPolicies, seal, blob, sealLoading, onSeal,
}: {
  phase: Phase;
  policies: { erDoctors: boolean; aiBot: boolean; adminRoot: boolean };
  setPolicies: React.Dispatch<React.SetStateAction<{ erDoctors: boolean; aiBot: boolean; adminRoot: boolean }>>;
  seal: PolicySeal | null;
  blob: EncryptedBlob | null;
  sealLoading: boolean;
  onSeal: () => void;
}) {
  const p = PRIMARY_PATIENT;
  const isEncrypted = phase === 'encrypted';

  return (
    <PanelCard title="01 BYOiD & DECREE — Patient Identity & Policy" icon={<User className="w-4 h-4" />} color="emerald">
      {/* Patient card */}
      <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-emerald-900 flex items-center justify-center text-emerald-300 text-sm font-bold">
            {p.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <div className="text-sm font-bold text-white">{p.name}</div>
            <div className="text-[10px] text-gray-500">DOB: {p.dob} · {p.hospital}</div>
          </div>
          <div className="ml-auto">
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400">BYOiD ✓</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Field label="Blood Type" value={p.bloodType} highlight="red" redact={isEncrypted} />
          <Field label="Allergies" value={p.allergies[0]} highlight="red" redact={isEncrypted} />
          <Field label="Genomic Marker" value={p.genomicMarkers[0]} highlight="amber" redact={isEncrypted} />
          <Field label="Medications" value={p.medications.join(', ')} highlight="blue" redact={isEncrypted} />
        </div>
        {isEncrypted && (
          <div className="mt-2 text-[10px] text-emerald-700 tracking-wider animate-pulse">
            ◉ IMMUNITY-SEALED · PLAINTEXT PURGED FROM SERVER
          </div>
        )}
      </div>

      {/* Policy toggles */}
      <div className="space-y-3">
        <div className="text-[10px] text-gray-500 tracking-widest uppercase">TAMPER-PROOF AUTHORIZATION RULES</div>
        <PolicyToggle
          label="Allow Emergency Room Doctors (Requires Quorum Seal)"
          checked={policies.erDoctors}
          onChange={v => setPolicies(p => ({ ...p, erDoctors: v }))}
          locked={isEncrypted}
        />
        <PolicyToggle
          label="Allow AI Triage Bot (Anonymized Redacted View Only)"
          checked={policies.aiBot}
          onChange={v => setPolicies(p => ({ ...p, aiBot: v }))}
          locked={isEncrypted}
        />
        <PolicyToggle
          label="Allow System/Cloud Admin Root Access (LOCKED BY QUORUM GOVERNANCE)"
          checked={false}
          locked
        />
      </div>

      {/* Seal button */}
      {!isEncrypted ? (
        <button
          onClick={onSeal}
          disabled={sealLoading}
          className="w-full py-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-bold tracking-wider transition-all duration-200 flex items-center justify-center gap-2"
        >
          {sealLoading ? (
            <>
              <Activity className="w-4 h-4 animate-spin" />
              Assembling Quorum & Encrypting…
            </>
          ) : (
            <>
              <Shield className="w-4 h-4" />
              Seal Policy & Encrypt Record (Immunity-Sealed E2EE)
            </>
          )}
        </button>
      ) : (
        <div className="space-y-3">
          {seal && <SealHashDisplay seal={seal} />}
          {blob && <CiphertextDisplay blob={blob} />}
        </div>
      )}
    </PanelCard>
  );
}

function Field({ label, value, highlight, redact }: { label: string; value: string; highlight: string; redact?: boolean }) {
  const colorMap: Record<string, string> = {
    red: 'text-red-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
  };
  return (
    <div>
      <div className="text-gray-600 text-[10px]">{label}</div>
      {redact ? (
        <div className="text-gray-700 font-mono text-[10px]">{'█'.repeat(Math.min(value.length, 20))}</div>
      ) : (
        <div className={`${colorMap[highlight]} font-bold text-[11px] leading-tight`}>{value}</div>
      )}
    </div>
  );
}

function Panel2({
  isSealed, adminAttempt, adminResult, blob, onAttempt,
}: {
  isSealed: boolean;
  adminAttempt: AdminAttempt;
  adminResult: ReturnType<typeof attemptAdminOverride> | null;
  blob: EncryptedBlob | null;
  onAttempt: () => void;
}) {
  return (
    <PanelCard title="03 ENTITLE — God-Mode Breach Test" icon={<ShieldAlert className="w-4 h-4" />} color="red">
      <div className="bg-gray-950 border border-red-950 rounded-lg p-3 text-xs">
        <div className="text-gray-500 text-[10px] mb-2 tracking-wider">COMPROMISED ACTOR</div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-red-950 flex items-center justify-center text-red-400 text-xs font-bold border border-red-900">⚠</div>
          <div>
            <div className="text-red-300 font-bold">CLOUD_ROOT_ADMIN</div>
            <div className="text-[10px] text-gray-600">admin@cloudprovider.com · UID: root_0001</div>
          </div>
        </div>
        <div className="text-[10px] text-gray-600 mt-2">Attempting: POLICY_OVERRIDE + DECRYPT + DATA_DUMP</div>
      </div>

      {/* Raw DB State */}
      <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
        <div className="text-[10px] text-gray-600 mb-2 tracking-wider">RAW DATABASE STATE (Admin&apos;s View)</div>
        {blob ? (
          <div className="space-y-1">
            <div className="text-[10px] font-mono">
              <span className="text-gray-700">record_id:</span> <span className="text-gray-500">pat-alice-001</span>
            </div>
            <div className="text-[10px] font-mono">
              <span className="text-gray-700">payload:</span> <span className="text-gray-600 break-all">{blob.ciphertext.slice(0, 64)}…</span>
            </div>
            <div className="text-[10px] font-mono">
              <span className="text-gray-700">key_ref:</span> <span className="text-gray-600">{blob.sessionKeyId} (tide_fabric_sealed)</span>
            </div>
            <div className="text-[10px] text-gray-700 italic mt-1">← Admin sees only sealed ciphertext. No key access.</div>
          </div>
        ) : (
          <div className="text-gray-700 text-[10px]">Seal record in Panel 1 first to see ciphertext.</div>
        )}
      </div>

      {/* Attack button */}
      <button
        onClick={onAttempt}
        disabled={!isSealed || adminAttempt !== 'idle'}
        className={`w-full py-3 rounded-lg text-sm font-bold tracking-wider transition-all duration-200 flex items-center justify-center gap-2 border
          ${!isSealed ? 'bg-gray-900 text-gray-700 border-gray-800 cursor-not-allowed'
            : adminAttempt === 'attempting' ? 'bg-red-950 text-red-400 border-red-900 animate-pulse'
            : adminAttempt === 'blocked' ? 'bg-gray-900 text-gray-700 border-gray-800 cursor-not-allowed'
            : 'bg-red-900/50 hover:bg-red-900 text-red-300 border-red-800 pulse-red'}`}
      >
        {adminAttempt === 'attempting' ? (
          <><Activity className="w-4 h-4 animate-spin" /> Executing Override Attack…</>
        ) : adminAttempt === 'blocked' ? (
          <><XCircle className="w-4 h-4 text-red-500" /> BLOCKED BY QUORUM GOVERNANCE</>
        ) : (
          <><Zap className="w-4 h-4" /> ⚡ Attempt Admin &quot;God-Mode&quot; Policy Override &amp; Decrypt</>
        )}
      </button>

      {/* Block result */}
      {adminResult && (
        <div className="bg-red-950/30 border border-red-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
            <ShieldCheck className="w-4 h-4" />
            [TIDECLOAK QUORUM GOVERNANCE BLOCKED]
          </div>
          <p className="text-red-300 text-[11px] leading-relaxed">{adminResult.reason}</p>
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-gray-600">
              <span className="text-gray-500">proof:</span> {adminResult.proof.slice(0, 40)}…
            </div>
            <div className="text-[10px] font-mono text-gray-600">
              <span className="text-gray-500">forensic_hash:</span> {adminResult.forensicHash.slice(0, 24)}…
            </div>
            <div className="text-[10px] text-amber-700 mt-1">↳ Attempt logged to immutable audit ledger. Forensic evidence preserved.</div>
          </div>
        </div>
      )}

      {!isSealed && (
        <div className="text-[10px] text-gray-700 text-center">
          ← Seal record in Panel 1 to activate attack simulation
        </div>
      )}
    </PanelCard>
  );
}

function Panel3({
  isSealed, activeConsumer, setActiveConsumer,
  doctorAccess, doctorRecord, doctorTunnel,
  aiAccess, aiView, onDoctorAccess, onAIAccess,
}: {
  isSealed: boolean;
  activeConsumer: 'doctor' | 'ai';
  setActiveConsumer: (v: 'doctor' | 'ai') => void;
  doctorAccess: DoctorAccess;
  doctorRecord: typeof PRIMARY_PATIENT | null;
  doctorTunnel: string;
  aiAccess: AIAccess;
  aiView: ReturnType<typeof getAIAnonymizedView> | null;
  onDoctorAccess: () => void;
  onAIAccess: () => void;
}) {
  return (
    <PanelCard title="04 CONCEAL — Authorized Cross-Hospital Access" icon={<Building2 className="w-4 h-4" />} color="blue">
      {/* Consumer tabs */}
      <div className="flex rounded-lg overflow-hidden border border-gray-800 text-xs">
        <button
          onClick={() => setActiveConsumer('doctor')}
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors font-bold tracking-wider
            ${activeConsumer === 'doctor' ? 'bg-blue-900/60 text-blue-300' : 'bg-gray-950 text-gray-600 hover:text-gray-400'}`}
        >
          <User className="w-3 h-3" /> DR. MINH (ER DOC)
        </button>
        <button
          onClick={() => setActiveConsumer('ai')}
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors font-bold tracking-wider
            ${activeConsumer === 'ai' ? 'bg-blue-900/60 text-blue-300' : 'bg-gray-950 text-gray-600 hover:text-gray-400'}`}
        >
          <Bot className="w-3 h-3" /> AI CLINICAL ASST
        </button>
      </div>

      {activeConsumer === 'doctor' ? (
        <DoctorView
          isSealed={isSealed}
          doctorAccess={doctorAccess}
          doctorRecord={doctorRecord}
          doctorTunnel={doctorTunnel}
          onDoctorAccess={onDoctorAccess}
        />
      ) : (
        <AIView
          isSealed={isSealed}
          aiAccess={aiAccess}
          aiView={aiView}
          onAIAccess={onAIAccess}
        />
      )}
    </PanelCard>
  );
}

function DoctorView({ isSealed, doctorAccess, doctorRecord, doctorTunnel, onDoctorAccess }: {
  isSealed: boolean;
  doctorAccess: DoctorAccess;
  doctorRecord: typeof PRIMARY_PATIENT | null;
  doctorTunnel: string;
  onDoctorAccess: () => void;
}) {
  return (
    <>
      <div className="bg-gray-950 border border-blue-950 rounded-lg p-3 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-blue-900 flex items-center justify-center text-blue-300 text-xs font-bold">DM</div>
          <div>
            <div className="text-blue-300 font-bold">Dr. Minh Tran</div>
            <div className="text-[10px] text-gray-600">ER Physician · City General Hospital</div>
          </div>
          <div className="ml-auto text-[10px] px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-400">er_doctor</div>
        </div>
        <div className="text-[10px] text-gray-600 mt-1">Context: Cross-hospital emergency transfer — Alice Nguyen unconscious on arrival</div>
      </div>

      <button
        onClick={onDoctorAccess}
        disabled={!isSealed || doctorAccess !== 'idle'}
        className={`w-full py-3 rounded-lg text-sm font-bold tracking-wider transition-all duration-200 flex items-center justify-center gap-2
          ${!isSealed ? 'bg-gray-900 text-gray-700 cursor-not-allowed'
            : doctorAccess === 'verifying' ? 'bg-blue-900/40 text-blue-400 animate-pulse'
            : doctorAccess === 'decrypted' ? 'bg-gray-900 text-gray-700 cursor-not-allowed'
            : 'bg-blue-800/50 hover:bg-blue-700/60 text-blue-300'}`}
      >
        {doctorAccess === 'verifying' ? (
          <><Activity className="w-4 h-4 animate-spin" /> Verifying Quorum Seal…</>
        ) : doctorAccess === 'decrypted' ? (
          <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> E2EE Tunnel Active</>
        ) : (
          <><ShieldCheck className="w-4 h-4" /> Verify Quorum Seal &amp; Open E2EE Tunnel</>
        )}
      </button>

      {doctorAccess === 'decrypted' && doctorRecord && (
        <div className="bg-blue-950/20 border border-blue-800/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-blue-400 text-xs font-bold">DECRYPTED EMERGENCY RECORD</span>
            <span className="text-[10px] text-emerald-500 flex items-center gap-1"><Eye className="w-3 h-3" /> FULL ACCESS</span>
          </div>
          <div className="text-[10px] font-mono text-gray-400">Tunnel: {doctorTunnel.slice(0, 28)}…</div>
          <div className="grid grid-cols-1 gap-2 text-[11px]">
            <RecordRow label="Patient" value={doctorRecord.name} color="white" />
            <RecordRow label="Blood Type" value={doctorRecord.bloodType} color="red" urgent />
            <RecordRow label="CRITICAL ALLERGY" value={doctorRecord.allergies[0]} color="red" urgent />
            <RecordRow label="Genomic" value={doctorRecord.genomicMarkers[0]} color="amber" />
            <RecordRow label="Current Meds" value={doctorRecord.medications.join(' · ')} color="blue" />
            <RecordRow label="Diagnoses" value={doctorRecord.diagnoses.join(' · ')} color="gray" />
            <RecordRow label="Emergency Contact" value={doctorRecord.emergencyContact} color="gray" />
          </div>
        </div>
      )}
    </>
  );
}

function RecordRow({ label, value, color, urgent }: { label: string; value: string; color: string; urgent?: boolean }) {
  const colorMap: Record<string, string> = {
    red: 'text-red-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    white: 'text-white',
    gray: 'text-gray-300',
  };
  return (
    <div className={`flex gap-2 ${urgent ? 'bg-red-950/30 border border-red-900/40 rounded px-2 py-1' : ''}`}>
      <span className="text-gray-600 shrink-0 w-32">{label}:</span>
      <span className={`${colorMap[color] || 'text-gray-300'} font-bold`}>{value}</span>
      {urgent && <span className="ml-auto text-red-500 text-[10px] animate-pulse font-bold">⚠ CRITICAL</span>}
    </div>
  );
}

function AIView({ isSealed, aiAccess, aiView, onAIAccess }: {
  isSealed: boolean;
  aiAccess: AIAccess;
  aiView: ReturnType<typeof getAIAnonymizedView> | null;
  onAIAccess: () => void;
}) {
  return (
    <>
      <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 text-xs border border-gray-700">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="text-gray-300 font-bold">AI Clinical Assistant</div>
            <div className="text-[10px] text-gray-600">role: ai_triage_bot · access: ANONYMIZED ONLY</div>
          </div>
        </div>
        <div className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> PII &amp; genomic data are cryptographically excluded from AI access
        </div>
      </div>

      <button
        onClick={onAIAccess}
        disabled={!isSealed || aiAccess !== 'idle'}
        className={`w-full py-3 rounded-lg text-sm font-bold tracking-wider transition-all duration-200 flex items-center justify-center gap-2
          ${!isSealed ? 'bg-gray-900 text-gray-700 cursor-not-allowed'
            : aiAccess === 'requesting' ? 'bg-gray-800 text-gray-400 animate-pulse'
            : aiAccess === 'granted' ? 'bg-gray-900 text-gray-700 cursor-not-allowed'
            : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
      >
        {aiAccess === 'requesting' ? (
          <><Activity className="w-4 h-4 animate-spin" /> Enforcing Policy Boundaries…</>
        ) : aiAccess === 'granted' ? (
          <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> AI Access Granted (Bounded)</>
        ) : (
          <><Bot className="w-4 h-4" /> Request AI Access</>
        )}
      </button>

      {aiAccess === 'granted' && aiView && (
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-xs font-bold">AI ANONYMIZED VIEW</span>
            <span className="text-[10px] text-amber-500 flex items-center gap-1"><EyeOff className="w-3 h-3" /> PII REDACTED</span>
          </div>
          <div className="space-y-2 text-[11px]">
            <RecordRow label="Blood Type" value={aiView.bloodType} color="gray" />
            <RecordRow label="Allergies" value={aiView.allergies.join(', ')} color="amber" />
            <RecordRow label="Diagnoses" value={aiView.diagnoses.join(', ')} color="gray" />
            <RecordRow label="Medications" value={aiView.medications.join(', ')} color="gray" />
            <div className="border-t border-gray-800 pt-2 space-y-1">
              <BlockedField label="Patient Name" />
              <BlockedField label="Date of Birth" />
              <BlockedField label="Genomic Markers" />
              <BlockedField label="Emergency Contact" />
            </div>
          </div>
          <div className="text-[10px] text-gray-600 italic">← 4 fields cryptographically excluded by TideCloak policy. AI cannot see or infer them.</div>
        </div>
      )}
    </>
  );
}

function BlockedField({ label }: { label: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-600 shrink-0 w-32">{label}:</span>
      <span className="text-gray-700 font-mono">{'█'.repeat(12)}</span>
      <span className="ml-auto text-[10px] text-red-700">POLICY BLOCK</span>
    </div>
  );
}

function AuditConsole({ events, consoleRef }: { events: FabricEvent[]; consoleRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800">
        <Terminal className="w-4 h-4 text-emerald-500" />
        <span className="text-xs font-bold text-emerald-500 tracking-widest uppercase">TideCloak Cybersecurity Fabric · Live Audit Log</span>
        <span className="ml-auto text-[10px] text-gray-600">{events.length} events</span>
        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
      </div>
      <div ref={consoleRef} className="h-48 overflow-y-auto p-3 space-y-1 font-mono">
        {events.length === 0 ? (
          <div className="text-gray-700 text-xs flex items-center gap-1">
            <span className="cursor-blink">▌</span> Waiting for Fabric events…
          </div>
        ) : (
          events.map(evt => (
            <div key={evt.id} className="flex items-start gap-2 text-[10px] leading-relaxed">
              <SeverityIcon s={evt.severity} />
              <span className="text-gray-700 shrink-0">{formatTimestamp(evt.timestamp)}</span>
              <span className="text-gray-600 shrink-0">[{evt.type}]</span>
              <span className={`${SEVERITY_COLOR[evt.severity]} flex-1`}>{evt.message}</span>
              <div className="flex gap-2 flex-wrap justify-end">
                {Object.entries(evt.details).slice(0, 2).map(([k, v]) => (
                  <span key={k} className="text-gray-700">{k}=<span className="text-gray-600">{v.length > 20 ? v.slice(0, 20) + '…' : v}</span></span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
