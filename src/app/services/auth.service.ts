import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../environments/environment';
import {
  LoginRequest,
  RegisterRequest,
  OtpVerifyRequest,
  OtpRequest,
  ApiResponse,
  User,
  UserRole,
  AuthResponse
} from './auth-interfaces';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private snackBar = inject(MatSnackBar);
  private isBrowser: boolean;

  private readonly apiUrl = `${environment.apiUrl}/auth`;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);

  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.initializeAuthState();
    }
  }

  private getBasicHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    console.log('🔐 Sending login request - FULL CREDENTIALS:', { 
      email: credentials.email, 
      password: credentials.password ? `[${credentials.password.length} chars]` : 'MISSING',
      rememberMe: credentials.rememberMe 
    });

    const loginPayload = {
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password.trim()
    };

    console.log('🔐 Final login payload being sent:', loginPayload);

    return this.http.post<AuthResponse>(
      `${this.apiUrl}/login`, 
      loginPayload,
      { headers: this.getBasicHeaders() }
    ).pipe(
      tap(response => {
        console.log('✅ Login SUCCESS - Full response:', response);
        
        if (response.token) {
          this.storeAuthDataDirectly(response, credentials.rememberMe || false);
        } else {
          console.error('❌ Login successful but no token received');
          throw new Error('Authentication error: No token received');
        }
      }),
      catchError(this.handleError)
    );
  }

  register(userData: RegisterRequest): Observable<ApiResponse> {
    const normalizedData = {
      ...userData,
      email: userData.email.trim().toLowerCase()
    };

    return this.http.post<ApiResponse>(
      `${this.apiUrl}/signup`, 
      normalizedData,
      { headers: this.getBasicHeaders() }
    ).pipe(
      tap(response => {
        console.log('📝 Registration response:', response);
        
        if (response.success) {
          if (this.isBrowser) {
            const tempUser: User = {
              id: response.user?.id || '',
              email: normalizedData.email,
              fullName: normalizedData.fullName,
              phoneNumber: normalizedData.phoneNumber,
              role: normalizedData.role,
              verified: false,
              emailVerified: false
            };
            
            sessionStorage.setItem('pendingUser', JSON.stringify(tempUser));
            sessionStorage.setItem('pendingEmail', normalizedData.email);
            sessionStorage.setItem('pendingPhoneNumber', normalizedData.phoneNumber);
          }
        }
      }),
      catchError(this.handleError)
    );
  }

  verifyOtp(request: OtpVerifyRequest): Observable<ApiResponse> {
    const cleanRequest = {
      email: request.email.trim().toLowerCase(),
      otpCode: request.otpCode.toString().trim(),
      type: request.type || 'email_verification'
    };

    return this.http.post<ApiResponse>(
      `${this.apiUrl}/verify-otp`, 
      cleanRequest,
      { headers: this.getBasicHeaders() }
    ).pipe(
      tap(response => {
        console.log('✅ OTP verification response:', response);
        
        if (response.success) {
          console.log('✅ OTP verified successfully - email confirmed');
          this.clearPendingVerification();
        } else {
          throw new Error(response.message || 'OTP verification failed');
        }
      }),
      catchError(this.handleError)
    );
  }

  resendOtp(request: OtpRequest): Observable<ApiResponse> {
    const cleanRequest = { 
      email: request.email.trim().toLowerCase(), 
      type: request.type || 'email_verification'
    };
    
    console.log('🔄 Resending OTP:', cleanRequest);

    return this.http.post<ApiResponse>(
      `${this.apiUrl}/resend-otp`, 
      cleanRequest,
      { headers: this.getBasicHeaders() }
    ).pipe(
      tap(response => {
        console.log('✅ Resend OTP response:', response);
      }),
      catchError(this.handleError)
    );
  }

  logout(): Observable<ApiResponse> {
    const token = this.getToken();
    
    this.performLocalLogout();
    
    if (token) {
      return this.http.post<ApiResponse>(
        `${this.apiUrl}/logout`, 
        {},
        { headers: this.getAuthHeaders() }
      ).pipe(
        catchError(() => of({ success: true, message: 'Logged out locally' }))
      );
    }
    
    return of({ success: true, message: 'Logged out locally' });
  }

  logoutSync(): void {
    const token = this.getToken();
    
    this.performLocalLogout();
    
    if (token) {
      this.http.post<ApiResponse>(
        `${this.apiUrl}/logout`,
        {},
        { 
          headers: this.getAuthHeaders(),
          responseType: 'json'
        }
      ).subscribe({
        next: () => console.log('✅ Backend logout completed'),
        error: (err) => console.warn('⚠️ Backend logout failed:', err)
      });
    }
  }

  requestPasswordReset(request: { email: string }): Observable<ApiResponse> {
    const normalizedRequest = { email: request.email.trim().toLowerCase() };
    return this.http.post<ApiResponse>(
      `${this.apiUrl}/forgot-password`,
      normalizedRequest,
      { headers: this.getBasicHeaders() }
    ).pipe(catchError(this.handleError));
  }

  resetPassword(request: { email: string; otpCode: string; newPassword: string }): Observable<ApiResponse> {
    const payload = {
      email: request.email.trim().toLowerCase(),
      otpCode: request.otpCode,
      newPassword: request.newPassword
    };
    
    return this.http.post<ApiResponse>(
      `${this.apiUrl}/reset-password`,
      payload,
      { headers: this.getBasicHeaders() }
    ).pipe(catchError(this.handleError));
  }

  verifyPasswordResetOtp(request: OtpVerifyRequest): Observable<ApiResponse> {
    const cleanRequest = {
      email: request.email.trim().toLowerCase(),
      otpCode: request.otpCode.toString().trim(),
      type: 'password_reset'
    };
    
    return this.http.post<ApiResponse>(
      `${this.apiUrl}/verify-otp`, 
      cleanRequest,
      { headers: this.getBasicHeaders() }
    ).pipe(catchError(this.handleError));
  }

  changePassword(request: { currentPassword: string; newPassword: string }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.apiUrl}/change-password`,
      request,
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError));
  }

  updatePassword(currentPassword: string, newPassword: string, confirmNewPassword: string): Observable<ApiResponse> {
    const payload = {
      currentPassword,
      newPassword,
      confirmNewPassword
    };
    
    return this.http.put<ApiResponse>(
      `${this.apiUrl}/update-password`, 
      payload,
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError));
  }

  updatePhone(newPhoneNumber: string): Observable<ApiResponse> {
    const payload = { newPhoneNumber };
    
    return this.http.put<ApiResponse>(
      `${this.apiUrl}/update-phone`, 
      payload,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          const currentUser = this.getCurrentUser();
          if (currentUser) {
            const updatedUser = { 
              ...currentUser, 
              phoneNumber: newPhoneNumber 
            };
            
            this.updateUserStorage(updatedUser);
            this.currentUserSubject.next(updatedUser);
          }
        }
      }),
      catchError(this.handleError)
    );
  }

  sendOtp(request: OtpRequest): Observable<ApiResponse> {
    const cleanRequest = { 
      email: request.email.trim().toLowerCase(), 
      type: request.type 
    };
    
    return this.http.post<ApiResponse>(
      `${this.apiUrl}/send-otp`, 
      cleanRequest,
      { headers: this.getBasicHeaders() }
    ).pipe(catchError(this.handleError));
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    
    if (!token) return null;
    
    let cleanToken = token.trim();

    if ((cleanToken.startsWith('"') && cleanToken.endsWith('"')) || 
        (cleanToken.startsWith("'") && cleanToken.endsWith("'"))) {
      cleanToken = cleanToken.slice(1, -1);
    }
    
    if (cleanToken.startsWith('Bearer ')) {
      cleanToken = cleanToken.substring(7).trim();
    }
    
    return cleanToken;
  }

  getCurrentUser(): User | null {
    if (!this.isBrowser) return null;
    
    const userData = localStorage.getItem('userData') || sessionStorage.getItem('userData');
    
    if (!userData) return null;
    
    try { 
      return JSON.parse(userData);
    } catch (error) { 
      console.error('❌ Error parsing user data:', error);
      this.removeFromStorage('userData');
      return null; 
    }
  }

  isAuthenticated(): boolean { 
    const token = this.getToken();
    
    if (!token) {
      console.log('🔐 isAuthenticated: No token found');
      return false;
    }
    
    const isTokenValid = this.hasValidToken();
    
    if (!isTokenValid) {
      console.log('🔐 isAuthenticated: Token expired or invalid');
      this.clearAllStorage();
      this.currentUserSubject.next(null);
      this.isAuthenticatedSubject.next(false);
      return false;
    }
    
    console.log('🔐 isAuthenticated: Token valid');
    return true;
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  hasValidToken(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        console.log('❌ Token has invalid format');
        return false;
      }
      
      const payload = tokenParts[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = base64 + '='.repeat((4 - base64.length % 4) % 4);
      const decodedPayload = atob(paddedBase64);
      const payloadObj = JSON.parse(decodedPayload);
      
      if (!payloadObj.exp) {
        console.log('⚠️ Token has no expiration date, assuming valid');
        return true;
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      const isExpired = payloadObj.exp <= currentTime;
      
      console.log('🔐 Token expiration check:', {
        exp: payloadObj.exp,
        currentTime,
        isExpired,
        expiresIn: payloadObj.exp - currentTime
      });
      
      return !isExpired;
      
    } catch (error) {
      console.error('❌ Error validating token:', error);
      return false;
    }
  }

  isTokenAboutToExpire(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    try {
      const tokenParts = token.split('.');
      const payload = JSON.parse(atob(tokenParts[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = payload.exp - currentTime;
      
      console.log('🔐 Token expires in:', timeUntilExpiry, 'seconds');
      
      return timeUntilExpiry < 300;
    } catch {
      return false;
    }
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.getFromStorage('refreshToken');
    
    if (!refreshToken) {
      console.warn('❌ No refresh token available');
      return throwError(() => new Error('No refresh token available'));
    }
    
    console.log('🔄 Refreshing token...');
    
    return this.http.post<AuthResponse>(
      `${this.apiUrl}/refresh-token`,
      { refreshToken },
      { headers: this.getBasicHeaders() }
    ).pipe(
      tap(response => {
        console.log('✅ Token refresh successful');
        if (response.token) {
          this.storeAuthDataDirectly(response, this.isUsingLocalStorage());
        }
      }),
      catchError(error => {
        console.error('❌ Token refresh failed:', error);
        this.logoutSync();
        return throwError(() => new Error('Token refresh failed'));
      })
    );
  }

  getAuthHeaders(includeContentType: boolean = true): HttpHeaders {
    const token = this.getToken();
    
    let headersConfig: { [name: string]: string } = {};

    if (includeContentType) {
      headersConfig['Content-Type'] = 'application/json';
    }

    if (token) {
      headersConfig['Authorization'] = `Bearer ${token}`;
    }
    
    return new HttpHeaders(headersConfig);
  }

  getPhoneNumber(): string {
    const user = this.getCurrentUser();
    return user?.phoneNumber || '';
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.role?.toUpperCase() === role.toUpperCase();
  }

  isExternal_Business(): boolean { return this.hasRole(UserRole.EXTERNAL_BUSINESS); }
  isTenant(): boolean { return this.hasRole(UserRole.TENANT); }
  isLandlord(): boolean { return this.hasRole(UserRole.LANDLORD); }
  isCaretaker(): boolean { return this.hasRole(UserRole.CARETAKER); }
  isAdmin(): boolean { return this.hasRole(UserRole.ADMIN); }

  needsEmailVerification(): boolean {
    const user = this.getCurrentUser();
    return !!(user && !user.emailVerified);
  }

  getPendingEmail(): string | null {
    if (!this.isBrowser) return null;
    return sessionStorage.getItem('pendingEmail');
  }

  clearPendingVerification(): void {
    if (!this.isBrowser) return;
    sessionStorage.removeItem('pendingUser');
    sessionStorage.removeItem('pendingEmail');
    sessionStorage.removeItem('pendingPhoneNumber');
  }

  clearCorruptedStorage(): void {
    this.clearAllStorage();
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  private getFromStorage(key: string): string | null {
    if (!this.isBrowser) return null;
    try {
      const value = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (value === 'undefined' || value === 'null') return null;
      return value;
    } catch {
      return null;
    }
  }

  private removeFromStorage(key: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {}
  }

  private clearAllStorage(): void {
    if (!this.isBrowser) return;
    const keys = ['authToken', 'refreshToken', 'userData', 'profileImage'];
    keys.forEach(key => this.removeFromStorage(key));
  }

  private storeAuthDataDirectly(authResponse: AuthResponse, rememberMe: boolean): void {
    if (!this.isBrowser) return;

    console.log('💾 Storing auth data directly from AuthResponse:', authResponse);

    const user: User = {
      id: authResponse.userId.toString(),
      email: authResponse.email,
      fullName: authResponse.fullName,
      role: authResponse.role,
      verified: authResponse.verified,
      emailVerified: authResponse.verified
    };

    const token = authResponse.token;

    if (!user || !token) {
      console.error('❌ Missing user or token in auth success');
      return;
    }

    let cleanToken = token.trim();
    if (cleanToken.startsWith('Bearer ')) {
      cleanToken = cleanToken.substring(7).trim();
    }

    if (rememberMe) {
      localStorage.setItem('authToken', cleanToken);
      localStorage.setItem('userData', JSON.stringify(user));
      if (authResponse.refreshToken) {
        localStorage.setItem('refreshToken', authResponse.refreshToken);
      }
    } else {
      sessionStorage.setItem('authToken', cleanToken);
      sessionStorage.setItem('userData', JSON.stringify(user));
      if (authResponse.refreshToken) {
        sessionStorage.setItem('refreshToken', authResponse.refreshToken);
      }
    }

    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(true);
    
    this.clearPendingVerification();
    
    console.log('✅ Auth storage completed - User:', user);
    console.log('✅ Token stored:', cleanToken ? 'YES' : 'NO');
  }

  private isUsingLocalStorage(): boolean {
    if (!this.isBrowser) return false;
    return !!localStorage.getItem('authToken');
  }

  private handleAuthSuccess(response: ApiResponse, rememberMe: boolean = false): void {
    if (!this.isBrowser) return;
    
    console.log('✅ Handling auth success:', response);

    const user: User = response.user || {
      id: response.data?.userId || '',
      email: response.data?.email || '',
      fullName: response.data?.fullName || '',
      role: response.data?.role || UserRole.TENANT,
      phoneNumber: response.data?.phoneNumber || '',
      verified: response.data?.verified || true,
      emailVerified: response.data?.emailVerified || true
    };

    const token = response.token || response.data?.token;

    if (!user || !token) {
      console.error('❌ Missing user or token in auth success');
      return;
    }

    let cleanToken = token.trim();
    if (cleanToken.startsWith('Bearer ')) {
      cleanToken = cleanToken.substring(7).trim();
    }

    if (rememberMe) {
      localStorage.setItem('authToken', cleanToken);
      localStorage.setItem('userData', JSON.stringify(user));
    } else {
      sessionStorage.setItem('authToken', cleanToken);
      sessionStorage.setItem('userData', JSON.stringify(user));
    }

    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(true);
    
    this.clearPendingVerification();
    
    console.log('✅ Auth storage completed');
  }

  private extractRoleFromToken(token: string): string | null {
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) return null;
      
      const payload = tokenParts[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = base64 + '='.repeat((4 - base64.length % 4) % 4);
      const decodedPayload = atob(paddedBase64);
      const payloadObj = JSON.parse(decodedPayload);
      
      return payloadObj.role || null;
    } catch (error) {
      return null;
    }
  }

  private initializeAuthState(): void {
    const user = this.getCurrentUser();
    const token = this.getToken();
    
    let isAuthenticated = false;
    
    if (user && token) {
      isAuthenticated = this.hasValidToken();
      
      if (!isAuthenticated) {
        this.clearAllStorage();
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
        return;
      }
    } else {
      if (user && !token) this.clearAllStorage();
      isAuthenticated = false;
    }
    
    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(isAuthenticated);
  }

  private updateUserStorage(userData: User): void {
    if (!this.isBrowser) return;
    
    try {
      const localStorageUser = localStorage.getItem('userData');
      if (localStorageUser) {
        localStorage.setItem('userData', JSON.stringify(userData));
      }
      
      const sessionStorageUser = sessionStorage.getItem('userData');
      if (sessionStorageUser) {
        sessionStorage.setItem('userData', JSON.stringify(userData));
      }
    } catch (error) {
      console.error('❌ Error updating user storage:', error);
    }
  }

  private getPendingPhoneNumber(): string {
    if (!this.isBrowser) return '';
    
    try {
      const pendingUser = sessionStorage.getItem('pendingUser');
      if (pendingUser) {
        const userData = JSON.parse(pendingUser);
        if (userData.phoneNumber) {
          return userData.phoneNumber;
        }
      }
      
      const pendingPhone = sessionStorage.getItem('pendingPhoneNumber');
      if (pendingPhone) {
        return pendingPhone;
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }

  private performLocalLogout(): void {
    this.clearAllStorage();
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    console.error('❌ Auth Service Error:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      error: error.error,
      message: error.message
    });
    
    let message = 'An unexpected error occurred';
    
    if (error.error instanceof ErrorEvent) {
      message = error.error.message;
    } else {
      if (error.error?.message) {
        message = error.error.message;
      } else if (error.status === 401) {
        message = 'Invalid credentials or session expired';
      } else if (error.status === 403) {
        message = 'Access denied';
      } else if (error.status === 409) {
        message = 'Account already exists with this email';
      } else if (error.status >= 500) {
        message = 'Server error. Please try again later.';
      } else if (error.status === 0) {
        message = 'Network error: Cannot connect to server. Check CORS configuration.';
      }
    }
    
    return throwError(() => new Error(message));
  };
}