import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface ProfilePictureResponse {
  success: boolean;
  message: string;
  data?: string;
  imageUrl?: string;
  pictureUrl?: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: 'caretaker' | 'tenant' | 'landlord' | 'admin' | 'business' | 'user';
  profilePicture?: string;
  verified: boolean;
  emailVerified: boolean;
  phoneNumber?: string;
  bio?: string;
  createdAt?: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  bio?: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  message: string;
  user?: UserProfile;
}

interface ApiProfileResponse {
  success?: boolean;
  message?: string;
  data?: UserProfile;
  user?: UserProfile;
}

@Injectable({
  providedIn: 'root'
})
export class ProfilePictureService {
  private readonly apiUrl = 'https://rentease-4.onrender.com/api';

  private profileSubject = new BehaviorSubject<UserProfile | null>(null);
  private profilePictureSubject = new BehaviorSubject<string>('');

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    const cachedProfile = this.getCachedUserProfile();
    this.profileSubject.next(cachedProfile);

    const cachedImage = this.getCachedProfileImage();
    if (cachedImage) {
      this.profilePictureSubject.next(cachedImage);
    } else {
      this.profilePictureSubject.next(this.getDefaultAvatar());
    }
  }

  // FIXED: Update profile method to use correct endpoint
  updateProfile(profileData: UpdateProfileRequest): Observable<UpdateProfileResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => ({ status: 401, message: 'No authentication token found' }));
    }

    // Use the correct endpoint - /api/profile/update
    return this.http
      .put<UpdateProfileResponse>(`${this.apiUrl}/profile/update`, profileData, { 
        headers: this.createHeaders() 
      })
      .pipe(
        map(response => this.normalizeProfileResponse(response)),
        tap(profileResponse => {
          if (profileResponse.success && profileResponse.user) {
            this.updateLocalState(profileResponse.user);
          }
        }),
        catchError(this.handleProfileError)
      );
  }

  // FIXED: Profile picture methods with correct endpoints
  getProfilePicture(): Observable<ProfilePictureResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return of(this.buildCachedPictureResponse('No authentication token found'));
    }

    return this.http
      .get<ProfilePictureResponse>(`${this.apiUrl}/profile/picture`, { 
        headers: this.createHeaders() 
      })
      .pipe(
        map(response => this.normalizePictureResponse(response)),
        tap(response => this.applyPictureResponse(response)),
        catchError(error => this.handlePictureError(error))
      );
  }

  uploadProfilePicture(file: File): Observable<ProfilePictureResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => ({ status: 401, message: 'No authentication token found' }));
    }

    const formData = new FormData();
    formData.append('file', file);

    // FIXED: Use correct endpoint and headers for FormData
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
      // Don't set Content-Type for FormData - let browser set it
    });

    return this.http
      .post<ProfilePictureResponse>(`${this.apiUrl}/profile/upload-picture`, formData, { headers })
      .pipe(
        map(response => this.normalizePictureResponse(response)),
        tap(response => this.applyPictureResponse(response)),
        catchError(this.handleProfileError)
      );
  }

  updateProfilePicture(file: File): Observable<ProfilePictureResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => ({ status: 401, message: 'No authentication token found' }));
    }

    const formData = new FormData();
    formData.append('file', file);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http
      .put<ProfilePictureResponse>(`${this.apiUrl}/profile/update-picture`, formData, { headers })
      .pipe(
        map(response => this.normalizePictureResponse(response)),
        tap(response => this.applyPictureResponse(response)),
        catchError(this.handleProfileError)
      );
  }

  deleteProfilePicture(): Observable<ProfilePictureResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => ({ status: 401, message: 'No authentication token found' }));
    }

    return this.http
      .delete<ProfilePictureResponse>(`${this.apiUrl}/profile/delete-picture`, { 
        headers: this.createHeaders() 
      })
      .pipe(
        map(response => this.normalizePictureResponse(response)),
        tap(response => {
          if (response.success) {
            this.cacheProfileImage(undefined);
          }
        }),
        catchError(this.handleProfileError)
      );
  }

  // FIXED: Add password update method
  updatePassword(currentPassword: string, newPassword: string, confirmNewPassword: string): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => ({ status: 401, message: 'No authentication token found' }));
    }

    const payload = {
      currentPassword,
      newPassword,
      confirmNewPassword
    };

    // Use the correct password update endpoint
    return this.http.put(`${this.apiUrl}/auth/update-password`, payload, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleProfileError)
    );
  }

  // Rest of your existing methods remain the same...
  watchProfile(): Observable<UserProfile | null> {
    return this.profileSubject.asObservable();
  }

  watchProfilePicture(): Observable<string> {
    return this.profilePictureSubject.asObservable();
  }

  getCurrentUserProfile(): Observable<UpdateProfileResponse> {
    const token = this.authService.getToken();
    if (!token) {
      const cached = this.profileSubject.value ?? this.getCachedUserProfile();
      if (cached) {
        return of({
          success: true,
          message: 'Using cached profile data',
          user: cached
        });
      }
      return throwError(() => ({ status: 401, message: 'No authentication token found' }));
    }

    return this.http
      .get<ApiProfileResponse>(`${this.apiUrl}/profile`, { headers: this.createHeaders() })
      .pipe(
        map(response => this.normalizeProfileResponse(response)),
        tap(profileResponse => {
          if (profileResponse.success && profileResponse.user) {
            this.updateLocalState(profileResponse.user);
          }
        }),
        catchError(error => this.handleProfileFetchError(error))
      );
  }

  updateProfilePartial(profileData: Partial<UpdateProfileRequest>): Observable<UpdateProfileResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => ({ status: 401, message: 'No authentication token found' }));
    }

    return this.http
      .patch<UpdateProfileResponse>(`${this.apiUrl}/profile`, profileData, { headers: this.createHeaders() })
      .pipe(
        map(response => this.normalizeProfileResponse(response)),
        tap(profileResponse => {
          if (profileResponse.success && profileResponse.user) {
            this.updateLocalState(profileResponse.user);
          }
        }),
        catchError(this.handleProfileError)
      );
  }

  private createHeaders(includeContentType: boolean = true): HttpHeaders {
    const token = this.authService.getToken();
    const headersConfig: Record<string, string> = {};

    if (includeContentType) {
      headersConfig['Content-Type'] = 'application/json';
    }

    if (token) {
      headersConfig['Authorization'] = `Bearer ${token}`;
    }

    return new HttpHeaders(headersConfig);
  }

  // ... rest of your existing helper methods remain unchanged
  private handleProfileFetchError(error: unknown): Observable<UpdateProfileResponse> {
    if (!this.shouldFallback(error)) {
      return throwError(() => error);
    }

    this.logFallback('profile', error);
    const cached = this.profileSubject.value ?? this.getCachedUserProfile();
    if (cached) {
      return of({
        success: true,
        message: 'Using cached profile data',
        user: cached
      });
    }

    return throwError(() => error);
  }

  private normalizeProfileResponse(response: ApiProfileResponse | UpdateProfileResponse | UserProfile | null | undefined): UpdateProfileResponse {
    if (!response) {
      return { success: false, message: 'Empty profile response' };
    }

    if ('success' in response && 'user' in response) {
      return {
        success: response.success ?? false,
        message: response.message ?? '',
        user: response.user
      };
    }

    if ('data' in response && response.data) {
      return {
        success: response.success ?? true,
        message: response.message ?? '',
        user: response.data
      };
    }

    const userProfile = response as UserProfile;
    if (userProfile && userProfile.id !== undefined) {
      return {
        success: true,
        message: 'Profile loaded',
        user: userProfile
      };
    }

    return { success: false, message: 'Invalid profile response' };
  }

  private normalizePictureResponse(response: ProfilePictureResponse | null | undefined): ProfilePictureResponse {
    const pictureUrl = response?.data || response?.imageUrl || response?.pictureUrl || this.getCachedProfileImage() || this.getDefaultAvatar();
    return {
      success: response?.success ?? true,
      message: response?.message ?? 'Profile picture loaded',
      data: pictureUrl,
      imageUrl: pictureUrl,
      pictureUrl
    };
  }

  private applyPictureResponse(response: ProfilePictureResponse): void {
    if (!response.success) {
      return;
    }
    const url = response.pictureUrl || response.imageUrl || response.data;
    this.cacheProfileImage(url);
  }

  private updateLocalState(user: UserProfile): void {
    const mergedUser = {
      ...this.mapAuthUserToProfile(this.authService.getCurrentUser()),
      ...user
    };

    this.persistUser(mergedUser);
    this.profileSubject.next(mergedUser);

    if (mergedUser.profilePicture) {
      this.cacheProfileImage(mergedUser.profilePicture);
    }

    if ((this.authService as any).currentUserSubject) {
      (this.authService as any).currentUserSubject.next({
        ...this.authService.getCurrentUser(),
        ...mergedUser
      });
    }
  }

  private persistUser(user: UserProfile): void {
    if (typeof window === 'undefined') {
      return;
    }

    const serialised = JSON.stringify(user);
    let persisted = false;

    if (localStorage.getItem('userData')) {
      localStorage.setItem('userData', serialised);
      persisted = true;
    }

    if (sessionStorage.getItem('userData')) {
      sessionStorage.setItem('userData', serialised);
      persisted = true;
    }

    if (!persisted) {
      localStorage.setItem('userData', serialised);
    }
  }

  private cacheProfileImage(url: string | undefined): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (!url) {
      localStorage.removeItem('profileImage');
      const fallback = this.getDefaultAvatar();
      this.profilePictureSubject.next(fallback);
      window.dispatchEvent(new Event('profileImageUpdated'));
      return;
    }

    const cacheBustedUrl = this.appendCacheBuster(url);
    localStorage.setItem('profileImage', cacheBustedUrl);
    this.profilePictureSubject.next(cacheBustedUrl);
    window.dispatchEvent(new Event('profileImageUpdated'));
  }

  private appendCacheBuster(url: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${Date.now()}`;
  }

  private getCachedUserProfile(): UserProfile | null {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      return this.mapAuthUserToProfile(currentUser);
    }

    if (typeof window === 'undefined') {
      return null;
    }

    const storedUser =
      localStorage.getItem('userData') ||
      sessionStorage.getItem('userData');

    if (!storedUser) {
      return null;
    }

    try {
      const parsed = JSON.parse(storedUser);
      return this.mapAuthUserToProfile(parsed);
    } catch {
      return null;
    }
  }

  private getCachedProfileImage(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const cached = localStorage.getItem('profileImage');
    if (cached) {
      return cached;
    }

    const currentUser = this.mapAuthUserToProfile(this.authService.getCurrentUser());
    if (currentUser?.profilePicture) {
      return currentUser.profilePicture;
    }

    return null;
  }

  private mapAuthUserToProfile(user: any): UserProfile | null {
    if (!user) {
      return null;
    }

    return {
      id: String(user.id ?? user.userId ?? ''),
      fullName: user.fullName ?? user.name ?? 'User',
      email: user.email ?? '',
      role: (user.role ?? 'user') as UserProfile['role'],
      profilePicture: user.profilePicture ?? user.avatar ?? user.picture ?? user.imageUrl,
      verified: Boolean(user.verified ?? user.isVerified ?? false),
      emailVerified: Boolean(user.emailVerified ?? user.isEmailVerified ?? false),
      phoneNumber: user.phoneNumber ?? user.phone ?? user.contactNumber,
      bio: user.bio ?? user.about ?? '',
      createdAt: user.createdAt ?? user.joinedAt
    };
  }

  getDefaultAvatar(name?: string): string {
    const displayName = name || this.profileSubject.value?.fullName || 'User';
    const initials = displayName
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('') || 'U';

    const colors = ['#1e40af', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
    const color = colors[initials.charCodeAt(0) % colors.length];

    return `data:image/svg+xml;base64,${btoa(`
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="${color}" rx="50"/>
        <text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-size="40" font-weight="600">${initials}</text>
      </svg>
    `)}`;
  }

  private buildCachedPictureResponse(message: string): ProfilePictureResponse {
    const cached = this.getCachedProfileImage() ?? this.getDefaultAvatar();
    return {
      success: Boolean(cached),
      message,
      data: cached,
      imageUrl: cached,
      pictureUrl: cached
    };
  }

  private shouldFallback(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return true;
    }

    if (error.status === 0 || error.status >= 500) {
      return true;
    }

    if (error.status === 401) {
      return true;
    }

    return false;
  }

  private handleProfileError = (error: any): Observable<never> => {
    let errorMessage = 'Profile operation failed';

    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (error.status === 403) {
        errorMessage = 'You do not have permission to perform this action.';
      } else if (error.status === 413) {
        errorMessage = 'The selected file is too large.';
      } else if (error.status === 415) {
        errorMessage = 'Unsupported file format.';
      } else if (error.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      }
    } else if (error?.message) {
      errorMessage = error.message;
    }

    return throwError(() => ({ status: error.status ?? 400, message: errorMessage }));
  };

  private handlePictureError(error: unknown): Observable<ProfilePictureResponse> {
    if (!this.shouldFallback(error)) {
      return throwError(() => error);
    }

    this.logFallback('profile picture', error);
    return of(this.buildCachedPictureResponse('Using cached profile picture'));
  }

  private logFallback(context: string, error: unknown): void {
    console.warn(`[ProfilePictureService] Falling back to cached data for ${context}`, error);
  }
}