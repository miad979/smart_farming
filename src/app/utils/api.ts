export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api';
export const MAX_DOCTOR_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCTOR_UPLOAD_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
const ALLOWED_DOCTOR_UPLOAD_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
const CSRF_COOKIE_NAME = 'sf_csrf';

async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    credentials: 'include',
    ...init,
  });
}

async function ensureCsrfCookie() {
  await apiFetch(`${API_BASE_URL}/auth/csrf`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
}

async function withCsrfRetry(request: () => Promise<Response>): Promise<Response> {
  let response = await request();
  if (response.status !== 403) return response;

  // Peek at a clone so the caller can still read the original body (error message).
  const body = await readJsonSafely(response.clone());
  if (body?.error !== 'CSRF token is missing or invalid') {
    return response;
  }

  await ensureCsrfCookie();
  response = await request();
  return response;
}

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const cookies = document.cookie.split(';');
  for (const chunk of cookies) {
    const [k, ...rest] = chunk.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('=') || '');
  }
  return null;
}

function getAuthHeader(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token && (token.startsWith('sf_token_') || token.startsWith('demo_token_'))) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const csrf = getCookieValue(CSRF_COOKIE_NAME);
  if (csrf) {
    headers['X-CSRF-Token'] = csrf;
  }
  return headers;
}

async function readJsonSafely(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * Standard request path for every API call: sends cookies (needed when the API is on
 * another origin), attaches the current CSRF token, and on a CSRF rejection refreshes
 * the token once and retries with the new value.
 */
async function apiRequest(url: string, init: RequestInit = {}): Promise<Response> {
  const build = (): RequestInit => {
    const method = (init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers || {});
    const csrf = getCookieValue(CSRF_COOKIE_NAME);
    if (method !== 'GET' && csrf) headers.set('X-CSRF-Token', csrf);
    return { ...init, headers };
  };
  return withCsrfRetry(() => apiFetch(url, build()));
}

function createApiError(message: string, status: number) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

// Generic API helper
export async function apiPost<T = any>(endpoint: string, data: any, token?: string): Promise<T> {
  const response = await withCsrfRetry(() => apiFetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: getAuthHeader(token),
    body: JSON.stringify(data),
  }));
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `API error: ${response.statusText}`);
  }
  
  return response.json();
}

export interface UploadedDocumentFile {
  id: string;
  originalName: string;
  contentType: string;
  size: number;
  sha256?: string;
  url: string;
  uploadedAt: string;
}

export interface CropDiseaseDetectionRequest {
  imageBase64: string;
  crop?: string;
  language?: 'bn' | 'en';
}

export interface CropDiseaseDetectionResult {
  disease: string;
  confidence: number;
  advisory_en: string;
  advisory_bn: string;
  treatment_en: string;
  treatment_bn: string;
  prevention_en: string;
  prevention_bn: string;
  image_ref?: string;
}

export interface AssistantChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  time: string;
  createdAt?: string;
}

export interface AssistantChatSession {
  id: string;
  messages: AssistantChatMessage[];
  updatedAt: string;
}

export interface AvailableExpert {
  id: string;
  name: string;
  name_bn: string;
  specialty: string;
  specialty_bn: string;
  rating: number;
  responseTime: string;
  responseTime_bn: string;
  available: boolean;
  registrationNumber?: string;
  experienceYears?: number;
  profileSummary?: string;
  certificateDocument?: string;
  resumeDocument?: string;
  verificationStatus?: 'pending' | 'verified' | 'rejected' | string;
}

// ==================== AUTHENTICATION ====================

/** Whether an email can be used for a new account (checked before step 2 of doctor sign-up). */
export async function checkEmailAvailable(email: string): Promise<{ available: boolean; reason?: 'invalid' | 'taken'; error?: string }> {
  const response = await apiRequest(`${API_BASE_URL}/auth/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body = await readJsonSafely(response);
  if (!response.ok) throw new Error(body.error || 'Could not check the email address');
  return body;
}

export async function signUp(data: {
  email: string;
  password: string;
  name: string;
  role: 'farmer' | 'doctor';
  phone?: string;
  location?: string;
  specialty?: string;
  registrationNumber?: string;
  certificateDocument?: string;
  resumeDocument?: string;
  experienceYears?: number;
  profileSummary?: string;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
}) {
  const response = await apiFetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to sign up');
  }

  return readJsonSafely(response);
}

export async function signIn(email: string, password: string) {
  const response = await apiFetch(`${API_BASE_URL}/auth/signin`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ email, password }),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to sign in');
  }

  return readJsonSafely(response);
}

export async function getCurrentUser(token: string) {
  const response = await apiFetch(`${API_BASE_URL}/auth/me`, {
    headers: getAuthHeader(token),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw createApiError(error.error || 'Failed to fetch user', response.status);
  }

  return readJsonSafely(response);
}

export async function signOut(token?: string) {
  const response = await withCsrfRetry(() => apiFetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: getAuthHeader(token),
  }));

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to sign out');
  }

  return readJsonSafely(response);
}

export async function getSystemHealth() {
  const response = await apiFetch(`${API_BASE_URL}/health`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch system health');
  }

  return response.json();
}

export async function getAuditLogs(token: string) {
  const response = await apiFetch(`${API_BASE_URL}/admin/audit-logs`, {
    headers: getAuthHeader(token),
  });

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to fetch audit logs');
  }

  return readJsonSafely(response) as Promise<{ logs: any[] }>;
}

export interface AdminActivityDay {
  date: string; // YYYY-MM-DD in the viewer's local time
  detections: number;
  consultations: number;
}

export async function getAdminActivity(token: string) {
  const tzOffset = new Date().getTimezoneOffset();
  const response = await apiFetch(`${API_BASE_URL}/admin/activity?tzOffset=${tzOffset}`, {
    headers: getAuthHeader(token),
  });
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to fetch activity');
  }
  return readJsonSafely(response) as Promise<{ days: AdminActivityDay[] }>;
}

export async function getAdminDeviceStatuses(token: string) {
  const response = await apiFetch(`${API_BASE_URL}/admin/device-status`, {
    headers: getAuthHeader(token),
  });

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to fetch admin sensor status');
  }

  return readJsonSafely(response) as Promise<{
    statuses: any[];
    summary: {
      totalUsers: number;
      healthyUsers: number;
      attentionUsers: number;
      notWorkingUsers: number;
      brokenUsers: number;
      noDeviceUsers: number;
    };
    helpLineNumber?: string;
  }>;
}

export async function updateAdminHelpLineNumber(token: string, helpLineNumber: string) {
  const response = await withCsrfRetry(() => apiFetch(`${API_BASE_URL}/admin/help-line`, {
    method: 'PUT',
    headers: getAuthHeader(token),
    body: JSON.stringify({ helpLineNumber }),
  }));

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to update help line number');
  }

  return readJsonSafely(response) as Promise<{ helpLineNumber: string; message?: string }>;
}

export async function uploadDoctorDocument(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ file: UploadedDocumentFile }> {
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || '' : '';
  const validMime = ALLOWED_DOCTOR_UPLOAD_MIME_TYPES.includes(file.type as any);
  const validExtension = ALLOWED_DOCTOR_UPLOAD_EXTENSIONS.includes(extension);

  if (!validMime && !validExtension) {
    throw new Error('Only PDF, JPG, and PNG files are allowed');
  }

  if (file.size > MAX_DOCTOR_UPLOAD_SIZE_BYTES) {
    throw new Error('File size exceeds 10MB limit');
  }

  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/uploads/documents`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');
    const csrf = getCookieValue(CSRF_COOKIE_NAME);
    if (csrf) {
      xhr.setRequestHeader('X-CSRF-Token', csrf);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve(payload);
          return;
        }
        reject(new Error(payload?.error || 'Failed to upload document'));
      } catch {
        reject(new Error('Invalid upload response'));
      }
    };

    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(
      JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        base64Data,
      }),
    );
  });
}

export async function computeFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function checkUploadedDoctorDocumentDuplicate(file: File): Promise<{
  exists: boolean;
  file: UploadedDocumentFile | null;
  sha256: string;
}> {
  const sha256 = await computeFileSha256(file);

  const response = await apiRequest(`${API_BASE_URL}/uploads/documents/check-hash`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ sha256 }),
  });

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to check duplicate file');
  }

  const payload = await response.json();
  return {
    exists: Boolean(payload?.exists),
    file: payload?.file || null,
    sha256,
  };
}

export async function deleteUploadedDoctorDocument(fileUrl: string) {
  const marker = '/uploads/documents/';
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) {
    throw new Error('Invalid uploaded document URL');
  }

  const fileId = fileUrl.slice(idx + marker.length);
  const response = await apiRequest(`${API_BASE_URL}/uploads/documents/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to remove uploaded document');
  }

  return response.json();
}

// ==================== USER MANAGEMENT ====================

export async function getAllUsers(token: string) {
  const response = await apiFetch(`${API_BASE_URL}/users`, {
    headers: getAuthHeader(token),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw createApiError(error.error || 'Failed to fetch users', response.status);
  }

  return readJsonSafely(response);
}

export async function updateUser(token: string, userId: string, updates: any) {
  const response = await withCsrfRetry(() => apiFetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'PUT',
    headers: getAuthHeader(token),
    body: JSON.stringify(updates),
  }));
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to update user');
  }

  return readJsonSafely(response);
}

export async function deleteUser(token: string, userId: string) {
  const response = await withCsrfRetry(() => apiFetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeader(token),
  }));

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to delete user');
  }

  return readJsonSafely(response);
}

// ==================== DOCTOR VERIFICATION ====================

export async function getPendingDoctors(token: string) {
  const response = await apiFetch(`${API_BASE_URL}/doctors/pending`, {
    headers: getAuthHeader(token),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to fetch pending doctors');
  }
  
  return response.json();
}

export async function verifyDoctor(token: string, doctorId: string, status: 'verified' | 'rejected' | 'suspended' | 'pending', reason?: string) {
  const response = await withCsrfRetry(() => apiFetch(`${API_BASE_URL}/doctors/${doctorId}/verify`, {
    method: 'POST',
    headers: getAuthHeader(token),
    body: JSON.stringify({ status, reason }),
  }));
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to verify doctor');
  }
  
  return response.json();
}

export async function getAvailableExperts() {
  const response = await apiRequest(`${API_BASE_URL}/experts`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to fetch experts');
  }

  return response.json() as Promise<{ experts: AvailableExpert[] }>;
}

// ==================== DISEASE DETECTION ====================

export async function saveDiseaseRecord(data: any, token?: string) {
  const response = await apiRequest(`${API_BASE_URL}/diseases`, {
    method: 'POST',
    headers: getAuthHeader(token),
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to save disease record');
  }
  
  return response.json();
}

export async function detectCropDisease(data: CropDiseaseDetectionRequest, token?: string) {
  const response = await apiRequest(`${API_BASE_URL}/diseases/detect`, {
    method: 'POST',
    headers: getAuthHeader(token),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to detect crop disease');
  }

  return response.json() as Promise<{
    result: CropDiseaseDetectionResult;
    raw?: any;
    provider?: 'plant.id' | 'local-fallback' | string;
    warning?: string;
  }>;
}

export async function getDiseaseHistory(token: string) {
  const response = await apiRequest(`${API_BASE_URL}/diseases`, {
    headers: getAuthHeader(token),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to fetch disease history');
  }
  
  return response.json();
}

export async function updateDiseaseRecord(
  token: string,
  diseaseId: string,
  updates: {
    treatmentOutcome?: 'improved' | 'no-change' | 'worse' | 'unknown';
    treatmentNote?: string;
  },
) {
  const response = await apiRequest(`${API_BASE_URL}/diseases/${diseaseId}`, {
    method: 'PUT',
    headers: getAuthHeader(token),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to update disease record');
  }

  return response.json();
}

// ==================== ASSISTANT CHAT ====================

export async function getAssistantChatHistory(chatId: string) {
  const params = new URLSearchParams({ chatId });
  const response = await apiRequest(`${API_BASE_URL}/assistant-chat/history?${params.toString()}`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to fetch assistant chat history');
  }

  return response.json() as Promise<{ chat: AssistantChatSession }>;
}

export async function sendAssistantChatMessage(data: {
  chatId: string;
  message: string;
  language?: 'bn' | 'en';
  imageBase64?: string;
  disease?: string;
  disease_bn?: string;
  advisory_en?: string;
  advisory_bn?: string;
  treatment_en?: string;
  treatment_bn?: string;
  prevention_en?: string;
  prevention_bn?: string;
}) {
  const response = await apiRequest(`${API_BASE_URL}/assistant-chat`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to send assistant chat message');
  }

  return response.json() as Promise<{
    chat: AssistantChatSession;
    assistantMessage: AssistantChatMessage;
    userMessage: AssistantChatMessage;
    provider?: 'openai' | 'fallback' | string;
    reason?: string | null;
  }>;
}

// ==================== IRRIGATION ====================

export async function getIrrigationSchedule(token: string, userId: string) {
  const response = await apiRequest(`${API_BASE_URL}/irrigation/${userId}`, {
    headers: getAuthHeader(token),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to fetch irrigation schedule');
  }
  
  return response.json();
}

export async function getCurrentWeatherData(lat: number, lng: number) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });

  const response = await apiRequest(`${API_BASE_URL}/weather/current?${params.toString()}`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to fetch weather');
  }

  return response.json();
}

export async function getYieldAdvice(params: {
  lat: number;
  lng: number;
  moisture?: number;
  crop?: string;
}) {
  const query = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
  });

  if (typeof params.moisture === 'number') {
    query.set('moisture', String(params.moisture));
  }
  if (params.crop) {
    query.set('crop', params.crop);
  }

  const response = await apiRequest(`${API_BASE_URL}/yield/advice?${query.toString()}`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to fetch yield advice');
  }

  return response.json();
}

export async function updateIrrigationSchedule(token: string, userId: string, updates: any) {
  const response = await apiRequest(`${API_BASE_URL}/irrigation/${userId}`, {
    method: 'PUT',
    headers: getAuthHeader(token),
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to update irrigation schedule');
  }
  
  return response.json();
}

// ==================== CONSULTATIONS ====================

export async function createConsultation(token: string, data: any) {
  const response = await apiRequest(`${API_BASE_URL}/consultations`, {
    method: 'POST',
    headers: getAuthHeader(token),
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to create consultation');
  }
  
  return response.json();
}

export async function getConsultations(token: string) {
  const response = await apiRequest(`${API_BASE_URL}/consultations`, {
    headers: getAuthHeader(token),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to fetch consultations');
  }
  
  return response.json();
}

export async function updateConsultation(token: string, consultationId: string, updates: any) {
  const response = await apiRequest(`${API_BASE_URL}/consultations/${consultationId}`, {
    method: 'PUT',
    headers: getAuthHeader(token),
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to update consultation');
  }

  return response.json();
}

export async function changePassword(token: string, currentPassword: string, newPassword: string) {
  const response = await apiRequest(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: getAuthHeader(token),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to change password');
  }
  return response.json();
}

export interface ConsultationMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'farmer' | 'doctor' | string;
  text: string;
  createdAt: string;
}

export interface Consultation {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerPhone?: string;
  crop?: string;
  crop_bn?: string;
  disease?: string;
  disease_bn?: string;
  description?: string;
  description_en?: string;
  location?: string;
  location_bn?: string;
  priority?: 'low' | 'medium' | 'high';
  mode?: 'chat' | 'call';
  status: 'pending' | 'in-progress' | 'completed';
  requestedDoctorId?: string | null;
  requestedDoctorName?: string | null;
  doctorId?: string | null;
  doctorName?: string | null;
  doctorSpecialty?: string;
  doctorResponse?: string;
  doctorResponse_en?: string;
  responseTime?: string;
  responseTime_bn?: string;
  respondedAt?: string;
  completedAt?: string;
  rating?: number;
  adminNote?: string;
  feedback?: string;
  feedback_en?: string;
  images?: string[];
  messages?: ConsultationMessage[];
  submittedAt: string;
  updatedAt?: string;
}

async function postConsultationAction(token: string, path: string, body: unknown, fallbackError: string) {
  const response = await apiRequest(`${API_BASE_URL}/consultations/${path}`, {
    method: 'POST',
    headers: getAuthHeader(token),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || fallbackError);
  }
  return response.json() as Promise<{ consultation: Consultation }>;
}

export function sendConsultationMessage(token: string, consultationId: string, text: string) {
  return postConsultationAction(token, `${encodeURIComponent(consultationId)}/messages`, { text }, 'Failed to send message');
}

export function rateConsultation(token: string, consultationId: string, rating: number, feedback: string) {
  return postConsultationAction(token, `${encodeURIComponent(consultationId)}/rating`, { rating, feedback }, 'Failed to submit rating');
}

// ==================== MARKET PRICES ====================

export async function getMarketPrices(location?: string, crop?: string) {
  const params = new URLSearchParams();
  if (location) params.append('location', location);
  if (crop) params.append('crop', crop);
  
  const url = `${API_BASE_URL}/prices${params.toString() ? '?' + params.toString() : ''}`;
  const response = await apiRequest(url, {
    headers: getAuthHeader(),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to fetch prices');
  }
  
  return response.json();
}

export async function getLiveMarketPrices(location?: string, crop?: string) {
  const params = new URLSearchParams();
  if (location) params.append('location', location);
  if (crop) params.append('crop', crop);

  const url = `${API_BASE_URL}/prices/live${params.toString() ? '?' + params.toString() : ''}`;
  const response = await apiRequest(url, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to fetch live prices');
  }

  return response.json();
}

export async function getLiveDhakaMarketPrices() {
  return getLiveMarketPrices('Dhaka');
}

export async function updateMarketPrice(token: string, data: any) {
  const response = await apiRequest(`${API_BASE_URL}/prices`, {
    method: 'POST',
    headers: getAuthHeader(token),
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to update price');
  }
  
  return response.json();
}

// ==================== PRICE ALERTS ====================

export async function createPriceAlert(token: string, data: any) {
  const response = await apiRequest(`${API_BASE_URL}/alerts`, {
    method: 'POST',
    headers: getAuthHeader(token),
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to create alert');
  }
  
  return response.json();
}

export async function getPriceAlerts(token: string) {
  const response = await apiRequest(`${API_BASE_URL}/alerts`, {
    headers: getAuthHeader(token),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to fetch alerts');
  }
  
  return response.json();
}

export async function deletePriceAlert(token: string, alertId: string) {
  const response = await apiRequest(`${API_BASE_URL}/alerts/${alertId}`, {
    method: 'DELETE',
    headers: getAuthHeader(token),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to delete alert');
  }
  
  return response.json();
}

// ==================== DEVICES ====================

export async function registerDevice(token: string, data: any) {
  const response = await apiRequest(`${API_BASE_URL}/devices`, {
    method: 'POST',
    headers: getAuthHeader(token),
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to register device');
  }
  
  return response.json();
}

export async function getDevices(token: string) {
  const response = await apiRequest(`${API_BASE_URL}/devices`, {
    headers: getAuthHeader(token),
  });
  
  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to fetch devices');
  }
  
  return response.json();
}

export async function setupVirtualIrrigationDevice(token: string, data?: { crop?: string }) {
  const response = await apiRequest(`${API_BASE_URL}/devices/virtual-irrigation/setup`, {
    method: 'POST',
    headers: getAuthHeader(token),
    body: JSON.stringify(data || {}),
  });

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to setup virtual irrigation device');
  }

  return response.json();
}

export async function simulateVirtualIrrigationTick(
  token: string,
  deviceId: string,
  data?: {
    crop?: string;
    measuredMoisture?: number;
    forcePump?: 'on' | 'off';
    manualLiters?: number;
    manualRuntimeMinutes?: number;
    tickMode?: 'decision' | 'sensor-only';
  },
) {
  const response = await apiRequest(`${API_BASE_URL}/devices/${encodeURIComponent(deviceId)}/simulate`, {
    method: 'POST',
    headers: getAuthHeader(token),
    body: JSON.stringify(data || {}),
  });

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to simulate virtual irrigation tick');
  }

  return response.json();
}

// Health check
export async function healthCheck() {
  const response = await apiRequest(`${API_BASE_URL}/health`);
  return response.json();
}

export async function sendRealtimeTestEvent(
  token: string,
  data: {
    type: 'price' | 'consultation' | 'irrigation' | 'disease' | 'system';
    targetUserId?: string;
  },
) {
  const response = await apiRequest(`${API_BASE_URL}/realtime/test-event`, {
    method: 'POST',
    headers: getAuthHeader(token),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await readJsonSafely(response);
    throw new Error(error.error || 'Failed to send realtime test event');
  }

  return response.json();
}