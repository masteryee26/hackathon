import type { PatientRecord } from './tidecloak-fabric';

export const PATIENTS: PatientRecord[] = [
  {
    id: 'pat-alice-001',
    name: 'Alice Nguyen',
    dob: '1989-03-14',
    bloodType: 'O-',
    allergies: ['Penicillin (SEVERE — anaphylactic risk)', 'Sulfonamides'],
    genomicMarkers: ['BRCA1 variant detected', 'HLA-B*57:01 (abacavir sensitivity)'],
    diagnoses: ['Type-2 Diabetes (controlled)', 'Hypertension Stage 1'],
    medications: ['Metformin 1000mg', 'Lisinopril 10mg'],
    hospital: 'RMIT Medical Center',
    emergencyContact: 'Hoa Nguyen (Sister) +61 412 000 111',
  },
  {
    id: 'pat-marcus-002',
    name: 'Marcus Vance',
    dob: '1975-08-21',
    bloodType: 'A+',
    allergies: ['Latex', 'Iodine contrast agents'],
    genomicMarkers: ['APOE ε4 allele (elevated Alzheimer risk)', 'CYP2C19 poor metabolizer'],
    diagnoses: ['Chronic Kidney Disease Stage 3', 'Atrial Fibrillation'],
    medications: ['Warfarin 5mg', 'Furosemide 40mg'],
    hospital: 'City General Hospital',
    emergencyContact: 'Sandra Vance (Spouse) +61 400 222 333',
  },
  {
    id: 'pat-elena-003',
    name: 'Elena Rostova',
    dob: '2001-11-05',
    bloodType: 'B+',
    allergies: ['Aspirin (NSAID sensitivity)'],
    genomicMarkers: ['Factor V Leiden (thrombophilia risk)'],
    diagnoses: ['Asthma (moderate persistent)', 'Iron-deficiency Anemia'],
    medications: ['Salbutamol inhaler PRN', 'Ferrous sulfate 325mg'],
    hospital: 'RMIT Medical Center',
    emergencyContact: 'Dmitri Rostov (Father) +61 499 444 555',
  },
];

export const HOSPITALS = [
  { id: 'hosp-rmit', name: 'RMIT Medical Center', city: 'Melbourne' },
  { id: 'hosp-city', name: 'City General Hospital', city: 'Melbourne' },
];

export const PRIMARY_PATIENT = PATIENTS[0]; // Alice Nguyen
