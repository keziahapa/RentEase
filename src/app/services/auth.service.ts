import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
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
  private refreshTokenInProgress = false;
  private refreshTokenSubject = new BehaviorSubject<boolean | null>(null);

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
    const loginPayload = {
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password.trim()
    };

    return this.http.post<AuthResponse>(
      `${this.apiUrl}/login`, 
      loginPayload,
      { headers: this.getBasicHeaders() }
    ).pipe(
      tap(response => {
        if (response.token) {
          this.storeAuthDataDirectly(response, credentials.rememberMe || false);
          
          if (credentials.rememberMe) {
            this.storeCredentialsSecurely(credentials.email, credentials.password);
          }
        } else {
          throw new Error('Authentication error: No token received');
        }
      }),
      catchError(this.handleError)
    );
  }

  silentReauth(): Observable<boolean> {
    if (this.refreshTokenInProgress) {
      return this.refreshTokenSubject.asObservable().pipe(
        map(value => value !== null ? value : false)
      );
    }

    this.refreshTokenInProgress = true;
    this.refreshTokenSubject.next(null);

    const storedEmail = this.getStoredEmail();
    const storedPassword = this.getStoredPassword();
    
    if (!storedEmail || !storedPassword) {
      this.refreshTokenInProgress = false;
      this.refreshTokenSubject.next(false);
      return of(false);
    }

    const loginRequest: LoginRequest = {
      email: storedEmail,
      password: storedPassword,
      rememberMe: true
    };

    return this.login(loginRequest).pipe(
      map(response => {
        this.refreshTokenInProgress = false;
        this.refreshTokenSubject.next(true);
        return true;
      }),
      catchError(error => {
        this.refreshTokenInProgress = false;
        this.refreshTokenSubject.next(false);
        this.clearStoredCredentials();
        return of(false);
      })
    );
  }

  public storeCredentialsSecurely(email: string, password: string): void {
    if (!this.isBrowser) return;
    
    try {
      localStorage.setItem('userEmail', email);
      const encodedPassword = btoa(password);
      localStorage.setItem('userPassword', encodedPassword);
    } catch (error) {
      console.error('Failed to store credentials:', error);
    }
  }

  private getStoredEmail(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem('userEmail');
  }

  private getStoredPassword(): string | null {
    if (!this.isBrowser) return null;
    const encodedPassword = localStorage.getItem('userPassword');
    if (!encodedPassword) return null;
    
    try {
      return atob(encodedPassword);
    } catch {
      return null;
    }
  }

  private clearStoredCredentials(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userPassword');
  }

  public canRefreshToken(): boolean {
    return !!(this.getStoredEmail() && this.getStoredPassword());
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
        if (response.success && this.isBrowser) {
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
        if (response.success) {
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
    
    return this.http.post<ApiResponse>(
      `${this.apiUrl}/resend-otp`, 
      cleanRequest,
      { headers: this.getBasicHeaders() }
    ).pipe(catchError(this.handleError));
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
      ).subscribe();
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
      this.removeFromStorage('userData');
      return null; 
    }
  }

  isAuthenticated(): boolean { 
    const token = this.getToken();
    
    if (!token) {
      return false;
    }
    
    const isTokenValid = this.hasValidToken();
    
    if (!isTokenValid) {
      if (this.canRefreshToken()) {
        this.silentReauth().subscribe(success => {
          if (!success) {
            this.clearAllStorage();
            this.currentUserSubject.next(null);
            this.isAuthenticatedSubject.next(false);
          }
        });
        return true;
      } else {
        this.clearAllStorage();
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
        return false;
      }
    }
    
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
        return false;
      }
      
      const payload = tokenParts[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = base64 + '='.repeat((4 - base64.length % 4) % 4);
      const decodedPayload = atob(paddedBase64);
      const payloadObj = JSON.parse(decodedPayload);
      
      if (!payloadObj.exp) {
        return true;
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      const isExpired = payloadObj.exp <= currentTime;
      
      return !isExpired;
      
    } catch (error) {
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
      
      return timeUntilExpiry < 300;
    } catch {
      return false;
    }
  }

  refreshToken(): Observable<boolean> {
    return this.silentReauth();
  }

  getRefreshToken(): string | null {
    return this.getFromStorage('refreshToken');
  }

  setRefreshToken(token: string): void {
    if (this.isUsingLocalStorage()) {
      localStorage.setItem('refreshToken', token);
    } else {
      sessionStorage.setItem('refreshToken', token);
    }
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

  debugToken(): void {
    const token = this.getToken();
    
    if (!token) {
      console.log('No token found in storage');
      return;
    }
    
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('Invalid token format');
        return;
      }
      
      const base64Payload = parts[1];
      const base64 = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = base64 + '='.repeat((4 - base64.length % 4) % 4);
      const decodedPayload = atob(paddedBase64);
      const payload = JSON.parse(decodedPayload);
      
      console.log('Token Debug Information');
      console.log('User ID:', payload.userId || payload.sub || payload.id || 'NOT FOUND');
      console.log('Email:', payload.email || 'NOT FOUND');
      console.log('Role:', payload.role || 'NOT FOUND');
      console.log('Full Name:', payload.fullName || payload.name || 'NOT FOUND');
      console.log('Issued At:', payload.iat ? new Date(payload.iat * 1000).toISOString() : 'NOT FOUND');
      console.log('Expires At:', payload.exp ? new Date(payload.exp * 1000).toISOString() : 'NOT FOUND');
      
      if (payload.exp) {
        const secondsUntilExpiry = Math.floor((payload.exp * 1000 - Date.now()) / 1000);
        const minutesUntilExpiry = Math.floor(secondsUntilExpiry / 60);
        console.log('Time Until Expiry:', `${secondsUntilExpiry}s (${minutesUntilExpiry} minutes)`);
      }
      
      const storedUser = this.getCurrentUser();
      if (storedUser && payload.role !== storedUser.role) {
        console.error('Token role does not match stored user role!');
      }
      
    } catch (error) {
      console.error('Token decode error:', error);
    }
  }

  verifyRoleConsistency(): boolean {
    try {
      const token = this.getToken();
      const storedUser = this.getCurrentUser();
      
      if (!token || !storedUser) {
        return false;
      }
      
      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1]));
      
      const tokenRole = payload.role?.toUpperCase();
      const storedRole = storedUser.role?.toUpperCase();
      
      if (tokenRole !== storedRole) {
        return false;
      }
      
      return true;
      
    } catch (error) {
      return false;
    }
  }

  hasAcceptedInvitation(): boolean {
    if (!this.isBrowser) return false;
    
    const user = this.getCurrentUser();
    const storedStatus = localStorage.getItem('invitationAccepted');
    
    return storedStatus === 'true' || user?.invitationAccepted === true;
  }

  setInvitationAccepted(): void {
    if (!this.isBrowser) return;
    
    localStorage.setItem('invitationAccepted', 'true');
    
    const user = this.getCurrentUser();
    if (user) {
      user.invitationAccepted = true;
      this.updateUserStorage(user);
      this.currentUserSubject.next(user);
    }
  }

  clearInvitationStatus(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem('invitationAccepted');
  }

  needsInvitation(): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    
    const needsInvite = this.isTenant() || this.isCaretaker();
    return needsInvite && !user.invitationAccepted;
  }

  hasInvitationAccess(): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    
    if (this.isLandlord() || this.isAdmin()) return true;
    
    return !!(user && user.invitationAccepted);
  }

  getInvitationStatus(): 'pending' | 'accepted' | 'not_needed' {
    const user = this.getCurrentUser();
    if (!user) return 'pending';
    
    if (this.isLandlord() || this.isAdmin()) return 'not_needed';
    if (user.invitationAccepted) return 'accepted';
    return 'pending';
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
    const keys = ['authToken', 'refreshToken', 'userData', 'profileImage', 'userEmail', 'userPassword', 'invitationAccepted'];
    keys.forEach(key => this.removeFromStorage(key));
    this.refreshTokenInProgress = false;
    this.refreshTokenSubject.next(null);
  }

  private storeAuthDataDirectly(authResponse: AuthResponse, rememberMe: boolean): void {
    if (!this.isBrowser) return;

    const user: User = {
      id: authResponse.userId.toString(),
      email: authResponse.email,
      fullName: authResponse.fullName,
      phoneNumber: authResponse.phoneNumber || '',
      role: authResponse.role,
      verified: authResponse.verified,
      emailVerified: authResponse.verified,
      invitationAccepted: authResponse.invitationAccepted || false
    };

    const token = authResponse.token;

    if (!user || !token) {
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
  }

  private isUsingLocalStorage(): boolean {
    if (!this.isBrowser) return false;
    return !!localStorage.getItem('authToken');
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
      console.error('Error updating user storage:', error);
    }
  }

  private performLocalLogout(): void {
    this.clearAllStorage();
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  private handleError = (error: HttpErrorResponse): Observable<never> => {
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
        message = 'Network error: Cannot connect to server.';
      }
    }
    
    return throwError(() => new Error(message));
  };
}