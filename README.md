[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

# MedCloak — Cyber-Immune Cross-Hospital Medical Exchange

> **RMIT Hackathon 2026 — Challenge 2: UNLOCKED**  
> *Cross-hospital medical record exchange powered by TideCloak's Cybersecurity Fabric. Zero god-mode. Immunity-Sealed E2EE.*

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

---

## 1. Vision & Originality

**MedCloak** is a cyber-immune cross-hospital medical exchange that gives patients sovereign control over their sensitive clinical and genomic records without requiring any centralized database, cloud vendor, or system administrator to be inherently trusted.

Each patient record is sealed by a decentralized authority key shard — assembled only by a cryptographic quorum of independent Tide nodes — so that sharing a record with a distant emergency room is as seamless as presenting a quorum-verified token. Crucially, a compromised cloud administrator or database engineer sees only encrypted ciphertext they can never unilaterally decrypt.

### What Makes MedCloak Distinctive
Unlike existing FHIR-based health-data exchanges and national EHR portals that still require trusting a centralized consortium, database administrator, or master root key, MedCloak mathematically eliminates unilateral administrative override:
- **Zero God-Mode:** No single sysadmin, hospital IT director, cloud engineer, or AI tool holds the master key required to view or alter records.
- **Immunity-Sealed E2EE:** Plaintext is purged from intermediate servers; data is decrypted purely inside verified, session-bound client tunnels.
- **Granular, Role-Bounded AI Access:** AI diagnostic assistants can access clinical markers for triage while PII and genomic markers are cryptographically stripped before reaching model context.

---

## 2. Trust Constraint Insight

Today, unified longitudinal patient records (LPRs) across independent hospitals are held back by an inescapable trust paradox:
> *To share data you must centralize it, and centralizing it creates a massive honeypot that demands someone hold "god-mode" database credentials.*

This single point of failure means:
1. **Insider & Ransomware Vulnerability:** A single compromised DBA, rogue cloud administrator, or supply-chain attack can exfiltrate millions of genomic profiles and medication histories.
2. **Regulatory & Liability Deadlock:** Hospitals refuse to federate records because HIPAA, GDPR, and the Australian Privacy Act place catastrophic financial and legal penalties on breaches caused by third-party data handlers.
3. **AI Exposure:** Healthcare providers hesitate to feed clinical datasets into LLMs and diagnostic models for fear of leaking re-identifiable patient data.

### The TideCloak Solution
When unilateral administrative control is replaced with **Quorum-Enforced Governance** across TideCloak's Cybersecurity Fabric, the trust barrier evaporates:
- Data flows freely between independent healthcare organizations because **no single intermediary, cloud host, or rogue insider has the cryptographic authority to unlock it**.
- Cross-hospital transfers (e.g. an unconscious emergency patient arriving at a different hospital) become instantaneous and safe: life-critical allergies and blood types are verified in seconds while preserving absolute cryptographic integrity.

---

## 3. Implementation of TideCloak's 4 Pillars

MedCloak natively showcases all four pillars of TideCloak's Cybersecurity Fabric:

| Pillar | TideCloak Technology | MedCloak Implementation |
|---|---|---|
| **01 CONNECT** | **BYOiD (Bring Your Own Identity)** | Patient authenticates via decentralized identifiers (`did:tide:...`) and OIDC tokens with Zero-Knowledge Proofs (`zkProof`), proving identity without exposing master passwords. |
| **02 DECREE** | **Authorisation Seals** | Dynamic policies sealed by a distributed quorum of 7 validator nodes. Plaintext records cannot be encrypted or decrypted without a valid, tamper-proof policy seal. |
| **03 ENTITLE** | **Zero "God-Mode" (Quorum Governance)** | Cloud root administrators attempting unilateral policy overrides or raw data dumps are instantly rebuffed with `QUORUM_PROOF` violations and forensically logged. |
| **04 CONCEAL** | **Immunity-Sealed E2EE** | Client-bound AES-256-GCM + TideFabric-EdDSA encryption. Ephemeral session tunnels allow ER physicians full emergency access while enforcing anonymized, redacted views for AI triage bots. |

---

## 4. Architecture & Technical Flow

```
+-----------------------------------------------------------------------------------+
|                              PATIENT / CLIENT TIER                                |
|  Alice Nguyen (Device: alice-iphone-SE3)                                         |
|  [Pillar 01: BYOiD / OIDC] -> Issues DID + ZKP Token                             |
|  [Pillar 02: DECREE]       -> Submits Tamper-Proof Authorization Policy          |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|                         TIDECLOAK CYBERSECURITY FABRIC                             |
|  • 7 Independent Quorum Nodes execute consensus vote                              |
|  • Authority Key Shard assembled only if quorum approval >= 4/7                  |
|  • Generates immutable Policy Seal (0x3a7f...)                                   |
|  [Pillar 04: CONCEAL] -> Record encrypted to E2EE Blob; Plaintext server purged  |
+-----------------------------------------------------------------------------------+
               |                                                   |
      Unauthorized Access                                   Authorized Access
               |                                                   |
               v                                                   v
+-------------------------------+               +-----------------------------------+
|   PILLAR 03: ENTITLE TEST     |               |     CROSS-HOSPITAL CONSUMERS      |
|  Cloud Root Admin (God-Mode)  |               |                                   |
|  • Attempts DB dump / decrypt |               | 1. Dr. Minh Tran (ER Doctor)      |
|  • Quorum check fails (1/7)   |               |    -> Verified: er_doctor seal   |
|  • BLOCKED: Quorum violation  |               |    -> Decrypts full vital record  |
|  • Forensic hash logged       |               |                                   |
|                               |               | 2. AI Clinical Triage Assistant   |
|                               |               |    -> Verified: ai_triage_bot     |
|                               |               |    -> Bounded view: PII & genome  |
|                               |               |       cryptographically excluded  |
+-------------------------------+               +-----------------------------------+
```

---

## 5. Judge's Mission Control Walkthrough

When evaluating the MedCloak prototype, follow this interactive evaluation flow:

1. **Patient Identity & Policy Decree (Panel 1):**
   - Notice Alice Nguyen's decentralized identity (`did:tide:...`) automatically verified via BYOiD.
   - Review the configurable authorization rules (ER Physicians allowed, AI Bot bounded, Root Admin disabled).
   - Click **"Seal Policy & Encrypt Record (Immunity-Sealed E2EE)"**.
   - Watch the 7 Quorum nodes cast cryptographic votes and generate the Authority Seal Hash. The record is instantly transformed into an immunity-sealed ciphertext blob, and plaintext is purged from memory.

2. **Admin "God-Mode" Breach Test (Panel 2):**
   - Inspect the Raw Database State: a database administrator with direct server access can only see the encrypted hex payload.
   - Click **"⚡ Attempt Admin 'God-Mode' Policy Override & Decrypt"**.
   - Observe the attack failure: TideCloak's quorum governance detects the unilateral override attempt, rejects it due to lack of authority key shards, and generates an immutable forensic audit proof.

3. **Authorized Cross-Hospital Emergency Access (Panel 3):**
   - Switch to **Dr. Minh (ER Doctor)** at City General Hospital treating Alice in an emergency transfer.
   - Click **"Verify Quorum Seal & Open E2EE Tunnel"**. The system validates credentials against the policy seal and opens an ephemeral tunnel, decrypting life-critical allergy and blood type warnings.
   - Switch to **AI Clinical Assistant** tab and click **"Request AI Access"**. Note how patient name, date of birth, emergency contacts, and sensitive genomic markers are mathematically redacted.

4. **Live Audit Console (Bottom):**
   - Review the real-time cryptographic audit trail tracking all OIDC tokens, quorum consensus votes, decryption tunnels, and blocked breach attempts.

---

## 6. Getting Started & Running Locally

### Prerequisites
- Node.js 18.x or 20.x
- npm or pnpm

### Installation
```bash
# Clone the repository and navigate to the directory
cd medcloak

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to interact with the Judge's Mission Control.

### Production Build
```bash
npm run build
npm start
```

---

## 7. Future Production Roadmap

- **Live TideCloak Fabric Integration:** Replace local simulation adapter with `@tidecloak/react` and `@tidecloak/node` SDKs connected to production Tide nodes.
- **FHIR R4 Ingestion:** Connect directly to hospital Electronic Health Record (EHR) systems via standard HL7/FHIR APIs.
- **Biometric Passkey Device Binding:** Bind emergency session key shards directly to hardware WebAuthn/FIDO2 credentials on clinical mobile tablets.
