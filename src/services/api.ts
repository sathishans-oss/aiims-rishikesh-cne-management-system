import {
  User,
  Cne,
  Area,
  CneApplication,
  CneParticipant,
  CneAttendance,
  CneResource,
  LibraryDocument,
  CneQuestion,
  PublicHomeData,
  AdminDiagnosticsData
} from '../types';

interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

function normalizeUser(user: any): User {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return {
    ...user,
    roles,
    isAdmin: roles.includes('ADMIN'),
    isAreaIncharge: roles.includes('AREA_INCHARGE')
  } as User;
}

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    const response = await fetch(endpoint, {
      ...options,
      credentials: 'include',
      headers
    });

    let resData: ApiResponse<T>;
    try {
      resData = await response.json();
    } catch (e) {
      throw new Error(`Server returned an invalid response (HTTP ${response.status})`);
    }

    if (!resData.success) {
      const msg = resData.error?.message || 'An unexpected error occurred';
      throw new Error(msg);
    }

    return resData.data;
  }

  // 1. Public
  getPublicHome(): Promise<PublicHomeData> {
    return this.request<PublicHomeData>('/api/public/home');
  }

  getPublicCneSchedule(params: Record<string, string | number> = {}): Promise<{ items: Cne[]; total: number }> {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<{ items: Cne[]; total: number }>(`/api/public/cne-schedule?${qs}`);
  }

  // 2. Auth
  async login(employee_id: string, password: string): Promise<{ user: User }> {
    const data = await this.request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ employee_id, password })
    });
    return { user: normalizeUser(data.user) };
  }

  async getMe(): Promise<{ authenticated: boolean; user: User | null }> {
    const data = await this.request<{ authenticated: boolean; user: User | null }>('/api/auth/me');
    return { ...data, user: data.user ? normalizeUser(data.user) : null };
  }

  async logout(): Promise<void> {
    await this.request('/api/auth/logout', { method: 'POST' });
  }

  forgotPassword(employee_id: string, date_of_joining: string): Promise<{ resetToken: string }> {
    return this.request<{ resetToken: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ employee_id, date_of_joining })
    });
  }

  resetPassword(reset_token: string, new_password: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ reset_token, new_password })
    });
  }

  getBootstrapStatus(): Promise<{ can_bootstrap: boolean }> {
    return this.request<{ can_bootstrap: boolean }>('/api/auth/bootstrap-status');
  }

  bootstrapInitialAdmin(data: {
    employee_id: string;
    name: string;
    designation?: string;
    department?: string;
    email?: string;
    phone?: string;
    date_of_joining: string;
    password: string;
    setup_token?: string;
  }): Promise<{ success: boolean; employee_id: string; message: string }> {
    return this.request<{ success: boolean; employee_id: string; message: string }>('/api/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // 3. CNE Core
  listCnes(params: Record<string, any> = {}): Promise<{ items: Cne[]; total: number }> {
    const qs = new URLSearchParams(params).toString();
    return this.request<{ items: Cne[]; total: number }>(`/api/cne?${qs}`);
  }

  getCne(id: string): Promise<Cne> {
    return this.request<Cne>(`/api/cne/${id}`);
  }

  createCne(data: any): Promise<Cne> {
    return this.request<Cne>('/api/cne', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  modifyCne(id: string, data: any): Promise<Cne> {
    return this.request<Cne>(`/api/cne/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  cancelCne(id: string, cancel_reason: string): Promise<Cne> {
    return this.request<Cne>(`/api/cne/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancel_reason })
    });
  }

  completeCne(id: string): Promise<Cne> {
    return this.request<Cne>(`/api/cne/${id}/complete`, { method: 'POST' });
  }

  searchResourcePersons(search = ''): Promise<any[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<any[]>(`/api/cne/resource-persons${qs}`);
  }

  // 4. Applications
  applyForCne(cne_id: string): Promise<CneApplication> {
    return this.request<CneApplication>('/api/applications/apply', {
      method: 'POST',
      body: JSON.stringify({ cne_id })
    });
  }

  getMyApplications(): Promise<{ items: CneApplication[]; total: number }> {
    return this.request<{ items: CneApplication[]; total: number }>('/api/applications/my');
  }

  listApplications(params: Record<string, any> = {}): Promise<{ items: CneApplication[]; total: number }> {
    const qs = new URLSearchParams(params).toString();
    return this.request<{ items: CneApplication[]; total: number }>(`/api/applications?${qs}`);
  }

  reviewApplication(id: string, decision: 'Approved' | 'Rejected', review_notes?: string): Promise<CneApplication> {
    return this.request<CneApplication>(`/api/applications/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, review_notes })
    });
  }

  // 5. Participants & Attendance
  listParticipants(cneId: string): Promise<CneParticipant[]> {
    return this.request<CneParticipant[]>(`/api/participants/${cneId}`);
  }

  addParticipant(cneId: string, employee_id: string): Promise<any> {
    return this.request(`/api/participants/${cneId}`, {
      method: 'POST',
      body: JSON.stringify({ employee_id })
    });
  }

  listAttendance(cneId: string): Promise<CneAttendance[]> {
    return this.request<CneAttendance[]>(`/api/attendance/${cneId}`);
  }

  getQrToken(cneId: string): Promise<{ qr_token: string; cne_id: string }> {
    return this.request<{ qr_token: string; cne_id: string }>(`/api/attendance/${cneId}/qr-token`);
  }

  scanQrAttendance(qr_token: string): Promise<any> {
    return this.request('/api/attendance/scan-qr', {
      method: 'POST',
      body: JSON.stringify({ qr_token })
    });
  }

  markManualAttendance(cne_id: string, employee_id: string): Promise<any> {
    return this.request('/api/attendance/manual', {
      method: 'POST',
      body: JSON.stringify({ cne_id, employee_id })
    });
  }

  // 6. Resources & Library
  listCneResources(cneId: string): Promise<CneResource[]> {
    return this.request<CneResource[]>(`/api/resources/cne/${cneId}`);
  }

  uploadCneResource(cneId: string, data: any): Promise<CneResource> {
    return this.request<CneResource>(`/api/resources/cne/${cneId}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  listLibraryDocuments(search?: string): Promise<LibraryDocument[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<LibraryDocument[]>(`/api/resources/library${qs}`);
  }

  addLibraryDocument(data: any): Promise<LibraryDocument> {
    return this.request<LibraryDocument>('/api/resources/library', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  retryCneResourceExtraction(resourceId: string): Promise<CneResource> {
    return this.request<CneResource>(`/api/resources/cne-resource/${resourceId}/retry-extraction`, { method: 'POST' });
  }

  retryLibraryExtraction(documentId: string): Promise<LibraryDocument> {
    return this.request<LibraryDocument>(`/api/resources/library/${documentId}/retry-extraction`, { method: 'POST' });
  }

  syncDriveLibrary(): Promise<{ added: number; updated: number; failed: number }> {
    return this.request('/api/resources/library/sync-drive', { method: 'POST' });
  }

  // 7. AI MCQ Generation & Questions
  listQuestions(cneId: string): Promise<CneQuestion[]> {
    return this.request<CneQuestion[]>(`/api/questions/${cneId}`);
  }

  generateAiMcqs(cneId: string): Promise<any> {
    return this.request(`/api/questions/${cneId}/generate-ai`, { method: 'POST' });
  }

  createManualQuestion(cneId: string, data: any): Promise<CneQuestion> {
    return this.request<CneQuestion>(`/api/questions/${cneId}/manual`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  updateQuestion(id: string, data: any): Promise<CneQuestion> {
    return this.request<CneQuestion>(`/api/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  deleteQuestion(id: string): Promise<void> {
    return this.request<void>(`/api/questions/${id}`, { method: 'DELETE' });
  }

  // 8. Post-Test
  getPostTest(cneId: string): Promise<any> {
    return this.request(`/api/post-test/${cneId}`);
  }

  submitPostTest(cneId: string, answers: Record<string, string>): Promise<any> {
    return this.request(`/api/post-test/${cneId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers })
    });
  }

  // 9. User Dashboard & Personal Records
  getUserDashboard(): Promise<any> {
    return this.request('/api/user/dashboard');
  }

  getMyCneRecords(search?: string): Promise<any[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<any[]>(`/api/user/my-cne-records${qs}`);
  }

  // 10. Masters & Admin
  listAreas(adminView: boolean = false): Promise<Area[]> {
    return this.request<Area[]>(adminView ? '/api/admin/areas' : '/api/areas');
  }

  createArea(data: { name: string; code: string; description?: string }): Promise<Area> {
    return this.request<Area>('/api/admin/areas', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  updateArea(id: string, data: { name?: string; description?: string; active?: boolean }): Promise<Area> {
    return this.request<Area>(`/api/admin/areas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  listEmployees(search?: string): Promise<any[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<any[]>(`/api/admin/roles/employees${qs}`);
  }

  assignRole(employee_id: string, role: string): Promise<any> {
    return this.request('/api/admin/roles/assign', {
      method: 'POST',
      body: JSON.stringify({ employee_id, role })
    });
  }

  listAreaIncharges(area_id?: string): Promise<any[]> {
    const qs = area_id ? `?area_id=${encodeURIComponent(area_id)}` : '';
    return this.request<any[]>(`/api/admin/area-incharges${qs}`);
  }

  assignAreaIncharge(employee_id: string, area_id: string): Promise<any> {
    return this.request('/api/admin/area-incharges', { method: 'POST', body: JSON.stringify({ employee_id, area_id }) });
  }

  removeAreaIncharge(employee_id: string, area_id: string): Promise<any> {
    return this.request('/api/admin/area-incharges', { method: 'DELETE', body: JSON.stringify({ employee_id, area_id }) });
  }

  syncOfficers(): Promise<any> {
    return this.request('/api/admin/sync-officers', { method: 'POST' });
  }

  getAdminContent(): Promise<any> {
    return this.request('/api/admin/content');
  }

  updateChairperson(data: any): Promise<any> {
    return this.request('/api/admin/content/chairperson', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  updateCoordinator(data: any): Promise<any> {
    return this.request('/api/admin/content/coordinator', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  createNews(data: any): Promise<any> {
    return this.request('/api/admin/content/news', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  updateNews(id: string, data: any): Promise<any> {
    return this.request(`/api/admin/content/news/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  deleteNews(id: string): Promise<void> {
    return this.request<void>(`/api/admin/content/news/${id}`, { method: 'DELETE' });
  }

  createQuickLink(data: any): Promise<any> {
    return this.request('/api/admin/content/quick-links', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  updateQuickLink(id: string, data: any): Promise<any> {
    return this.request(`/api/admin/content/quick-links/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  deleteQuickLink(id: string): Promise<void> {
    return this.request<void>(`/api/admin/content/quick-links/${id}`, { method: 'DELETE' });
  }

  createGalleryItem(data: any): Promise<any> {
    return this.request('/api/admin/content/gallery', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  updateGalleryItem(id: string, data: any): Promise<any> {
    return this.request(`/api/admin/content/gallery/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  deleteGalleryItem(id: string): Promise<void> {
    return this.request<void>(`/api/admin/content/gallery/${id}`, { method: 'DELETE' });
  }

  updateInstitutionalMetric(key: string, value: string): Promise<any> {
    return this.request('/api/admin/content/institutional-metric', {
      method: 'PUT',
      body: JSON.stringify({ key, value })
    });
  }

  getReports(params: Record<string, any> = {}): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/admin/reports?${qs}`);
  }

  getDiagnostics(): Promise<AdminDiagnosticsData> {
    return this.request<AdminDiagnosticsData>('/api/admin/diagnostics');
  }

  getSystemDiagnostics(): Promise<AdminDiagnosticsData> {
    return this.getDiagnostics();
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const res = await this.getMe();
      return res.authenticated && res.user ? res.user : null;
    } catch {
      return null;
    }
  }

  triggerBackupQueueProcess(): Promise<{ message: string; processed: boolean }> {
    return this.request('/api/admin/process-backup-queue', { method: 'POST' });
  }

  testGemini(): Promise<{ status: string; model: string; response: string }> {
    return this.request('/api/admin/test-gemini', { method: 'POST' });
  }
}

export const api = new ApiService();
