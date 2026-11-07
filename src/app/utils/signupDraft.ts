// Keeps the two-step sign-up form filled in while the user moves between step 1 and step 2.
// - Everything lives in memory for the session of the page (survives Back/Next inside the app).
// - Non-secret fields are also mirrored to sessionStorage so a page refresh does not wipe the form.
// - The password is NEVER written to storage; after a refresh the user re-types it on step 1.

export type SignupDraft = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  location: string;
  role: 'farmer' | 'doctor';
  termsAccepted: boolean;
  privacyAccepted: boolean;
  // Step 2 (doctor)
  specialty: string;
  registrationNumber: string;
  experienceYears: string;
  profileSummary: string;
  doctorPhone: string;
  useSignupPhone: boolean;
  certificateDocument: string;
  certificateFileName: string;
  resumeDocument: string;
  resumeFileName: string;
};

const STORAGE_KEY = 'smart-farming-signup-draft';
const SECRET_FIELDS: (keyof SignupDraft)[] = ['password', 'confirmPassword'];

export const EMPTY_DRAFT: SignupDraft = {
  name: '', email: '', phone: '', password: '', confirmPassword: '', location: '', role: 'farmer',
  termsAccepted: false, privacyAccepted: false,
  specialty: '', registrationNumber: '', experienceYears: '', profileSummary: '',
  doctorPhone: '', useSignupPhone: true,
  certificateDocument: '', certificateFileName: '', resumeDocument: '', resumeFileName: '',
};

let memoryDraft: SignupDraft | null = null;

function readStored(): Partial<SignupDraft> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<SignupDraft>) : {};
  } catch {
    return {};
  }
}

export function getSignupDraft(): SignupDraft {
  if (memoryDraft) return memoryDraft;
  memoryDraft = { ...EMPTY_DRAFT, ...readStored(), password: '', confirmPassword: '' };
  return memoryDraft;
}

export function updateSignupDraft(patch: Partial<SignupDraft>): SignupDraft {
  memoryDraft = { ...getSignupDraft(), ...patch };
  try {
    const safe: Partial<SignupDraft> = { ...memoryDraft };
    for (const key of SECRET_FIELDS) delete safe[key];
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // Storage blocked (private mode): the in-memory draft still works.
  }
  return memoryDraft;
}

export function clearSignupDraft() {
  memoryDraft = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
