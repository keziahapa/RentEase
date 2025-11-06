import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private snackBar = inject(MatSnackBar);
  private isBrowser: boolean;

  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com/api/auth';

  private currentUserSubject = new BehaviorSubject<any>(null);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);

  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.initializeAuthState();
    }
  }

  // ADD MISSING METHODS
  logoutSync(): void {
    const token = this.getToken();
    
    this.performLocalLogout();
    
    if (token) {
      this.http.post<any>(
        `${this.apiUrl}/logout`,
        {},
        { 
          headers: this.getAuthHeaders(),
          responseType: 'json'
        }
      ).subscribe({
        next: () => console.log('Backend logout completed'),
        error: (err) => console.warn('Backend logout failed:', err)
      });
    }
  }

  isLoggedIn(): boolean {
    const token = this.getToken(); 
    return !!token;
  }

  getPhoneNumber(): string {
    if (!this.isBrowser) return '';
    
    try {
      const currentUser = this.currentUserSubject.value;
      if (currentUser?.phoneNumber) {
        return currentUser.phoneNumber;
      }
      
      const userData = localStorage.getItem('userData');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        if (parsedUser?.phoneNumber) {
          return parsedUser.phoneNumber;
        }
      }
      
      const sessionUser = sessionStorage.getItem('userData');
      if (sessionUser) {
        const parsedSessionUser = JSON.parse(sessionUser);
        if (parsedSessionUser?.phoneNumber) {
          return parsedSessionUser.phoneNumber;
        }
      }
      
      return '';
    } catch (error) {
      console.error('Error getting phone number from storage:', error);
      return '';
    }
  }

  clearCorruptedStorage(): void {
    this.clearAllStorage();
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  // EXISTING METHODS
  login(credentials: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      tap(res => {
        if (res.success === false) {
          throw new Error(res.message || 'Login failed');
        }

        const userData = res.user || {
          id: res.userId?.toString(),
          fullName: res.fullName,
          email: res.email,
          role: res.role,
          phoneNumber: res.phoneNumber,
          verified: res.verified,
          emailVerified: res.emailVerified
        };

        const phoneNumber = userData.phoneNumber || res.phoneNumber || this.getPendingPhoneNumber() || '';
        
        const enhancedResponse = {
          token: res.token,
          user: {
            ...userData,
            phoneNumber: phoneNumber
          }
        };
        
        this.handleAuthSuccess(enhancedResponse, credentials.rememberMe);
      }),
      catchError(this.handleError)
    );
  }

  register(userData: any): Observable<any> {
    const normalizedData = {
      ...userData,
      email: userData.email.trim().toLowerCase()
    };

    return this.http.post<any>(`${this.apiUrl}/signup`, normalizedData, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      tap(res => {
        if (res.success && res.user) {
          const tempUser = {
            ...res.user,
            phoneNumber: userData.phoneNumber,
            verified: false,
            emailVerified: false
          };
          
          if (this.isBrowser) {
            sessionStorage.setItem('pendingUser', JSON.stringify(tempUser));
            sessionStorage.setItem('pendingEmail', normalizedData.email);
            sessionStorage.setItem('pendingPhoneNumber', userData.phoneNumber);
          }
        }
      }),
      catchError(this.handleError)
    );
  }

  verifyOtp(request: any): Observable<any> {
    const cleanRequest = {
      email: request.email.trim().toLowerCase(),
      otpCode: request.otpCode.toString().trim(),
      type: request.type
    };

    return this.http.post<any>(`${this.apiUrl}/verify-otp`, cleanRequest, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      tap(res => {
        let token = null;
        let userData = null;

        if (res.token) token = res.token;
        else if (res.data?.token) token = res.data.token;
        else if (res.access_token) token = res.access_token;
        else if (res.authToken) token = res.authToken;
        else if (res.jwt) token = res.jwt;

        if (res.user) userData = res.user;
        else if (res.data?.user) userData = res.data.user;
        else {
          userData = {
            id: res.userId?.toString() || res.id?.toString(),
            fullName: res.fullName,
            email: res.email,
            role: res.role,
            verified: res.verified,
            emailVerified: res.emailVerified,
            phoneNumber: res.phoneNumber
          };
        }

        if (!userData.role) {
          throw new Error('User role not provided in verification response');
        }
        
        const phoneNumber = this.extractPhoneNumberFromMultipleSources(res);
        
        if (token) {
          const enhancedResponse = {
            token: token,
            user: {
              ...userData,
              phoneNumber: phoneNumber
            }
          };
          
          this.handleAuthSuccess(enhancedResponse, false);
        } else {
          throw new Error('No authentication token received after verification');
        }
      }),
      catchError(this.handleOtpError)
    );
  }

  resendOtp(request: any): Observable<any> {
    const cleanRequest = { 
      email: request.email.trim().toLowerCase(), 
      type: request.type 
    };
    
    return this.http.post<any>(`${this.apiUrl}/resend-otp`, cleanRequest, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(catchError(this.handleError));
  }

  logout(): Observable<any> {
    const token = this.getToken();
    
    if (!token) {
      this.performLocalLogout();
      return of({ success: true, message: 'Logged out locally' });
    }

    return this.http.post<any>(
      `${this.apiUrl}/logout`,
      {},
      { 
        headers: this.getAuthHeaders(),
        responseType: 'json'
      }
    ).pipe(
      tap(response => {
        this.performLocalLogout();
      }),
      catchError(error => {
        this.performLocalLogout();
        return of({ 
          success: true, 
          message: 'Logged out locally (backend unavailable)' 
        });
      })
    );
  }

  requestPasswordReset(request: any): Observable<any> {
    const normalizedRequest = { email: request.email.trim().toLowerCase() };
    return this.http.post<any>(
      `${this.apiUrl}/forgot-password`,
      normalizedRequest,
      { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
    ).pipe(catchError(this.handleError));
  }

  resetPassword(request: any): Observable<any> {
    const payload = {
      email: request.email.trim().toLowerCase(),
      otpCode: request.otpCode,
      newPassword: request.newPassword
    };
    
    return this.http.post<any>(
      `${this.apiUrl}/reset-password`,
      payload,
      { 
        headers: new HttpHeaders({ 
          'Content-Type': 'application/json'
        })
      }
    ).pipe(catchError(this.handleError));
  }

  verifyPasswordResetOtp(request: any): Observable<any> {
    const cleanRequest = {
      email: request.email.trim().toLowerCase(),
      otpCode: request.otpCode.toString().trim(),
      type: 'password_reset'
    };
    
    return this.http.post<any>(`${this.apiUrl}/verify-otp`, cleanRequest, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(catchError(this.handlePasswordResetError));
  }

  changePassword(request: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/change-password`,
      request,
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError));
  }

  updatePhone(newPhoneNumber: string): Observable<any> {
    const payload = { newPhoneNumber };
    
    return this.http.put<any>(`${this.apiUrl}/update-phone`, payload, {
      headers: this.getAuthHeaders()
    }).pipe(
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

  updatePassword(currentPassword: string, newPassword: string, confirmNewPassword: string): Observable<any> {
    const payload = {
      currentPassword,
      newPassword,
      confirmNewPassword
    };
    
    return this.http.put<any>(`${this.apiUrl}/update-password`, payload, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  sendOtp(request: any): Observable<any> {
    const cleanRequest = { email: request.email.trim().toLowerCase(), type: request.type };
    return this.http.post<any>(`${this.apiUrl}/send-otp`, cleanRequest, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(catchError(this.handleError));
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

  getCurrentUser(): any {
    const userData = this.getFromStorage('userData');
    
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
    return !!token;
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

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.role?.toUpperCase() === role.toUpperCase();
  }

  isBusiness(): boolean { return this.hasRole('BUSINESS'); }
  isTenant(): boolean { return this.hasRole('TENANT'); }
  isLandlord(): boolean { return this.hasRole('LANDLORD'); }
  isCaretaker(): boolean { return this.hasRole('CARETAKER'); }
  isAdmin(): boolean { return this.hasRole('ADMIN'); }

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

  private handleAuthSuccess(response: any, rememberMe: boolean = false): void {
    if (!this.isBrowser) return;
    
    const user = response.user || {
      id: response.userId?.toString(),
      email: response.email,
      fullName: response.fullName,
      role: response.role,
      verified: response.verified,
      emailVerified: response.emailVerified,
      phoneNumber: response.phoneNumber
    };

    const token = response.token;

    if (!user || !token) return;

    let cleanToken = token.trim();
    if (cleanToken.startsWith('Bearer ')) {
      cleanToken = cleanToken.substring(7).trim();
    }

    if (!user.role) {
      user.role = this.extractRoleFromToken(cleanToken);
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

  private hasValidToken(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) return false;
      
      const payload = tokenParts[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = base64 + '='.repeat((4 - base64.length % 4) % 4);
      const decodedPayload = atob(paddedBase64);
      const payloadObj = JSON.parse(decodedPayload);
      
      if (!payloadObj.exp) return true;
      
      const currentTime = Math.floor(Date.now() / 1000);
      return payloadObj.exp > currentTime;
      
    } catch (error) {
      return false;
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

  private extractPhoneNumberFromMultipleSources(response: any): string {
    const sources = [
      () => {
        try {
          const pendingUser = sessionStorage.getItem('pendingUser');
          if (pendingUser) {
            const userData = JSON.parse(pendingUser);
            return userData.phoneNumber || '';
          }
        } catch (e) {}
        return '';
      },
      () => sessionStorage.getItem('pendingPhoneNumber') || '',
      () => response.user?.phoneNumber || response.phoneNumber || '',
      () => {
        try {
          const verificationEmail = sessionStorage.getItem('pendingVerificationEmail');
          if (verificationEmail) {
            const pendingUser = sessionStorage.getItem('pendingUser');
            return pendingUser ? JSON.parse(pendingUser).phoneNumber : '';
          }
        } catch (e) {}
        return '';
      }
    ];

    for (const source of sources) {
      const phone = source();
      if (phone && phone.trim() !== '' && this.isValidPhoneNumber(phone)) {
        return phone;
      }
    }

    return '';
  }

  private isValidPhoneNumber(phone: string): boolean {
    if (!phone || typeof phone !== 'string') return false;
    const cleanPhone = phone.replace(/\s/g, '');
    return /^(\+254|0)[1-9]\d{8}$/.test(cleanPhone);
  }

  private updateUserStorage(userData: any): void {
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
    } catch (error) {}
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

  private handlePasswordResetError = (error: HttpErrorResponse): Observable<never> => {
    let message = 'Password reset verification failed';
    
    if (error.status === 400) message = error.error?.message || 'Invalid OTP format or data.';
    else if (error.status === 401) message = error.error?.message || 'Invalid or expired OTP code.';
    else if (error.status === 404) message = 'OTP not found or has expired. Please request a new one.';
    else if (error.status === 422) message = error.error?.message || 'Invalid OTP data format.';
    else if (error.status === 429) message = 'Too many verification attempts. Please wait before trying again.';
    else if (error.status >= 500) message = 'Server error during OTP verification. Please try again later.';
    else if (error.error?.message) message = error.error.message;
    
    return throwError(() => new Error(message));
  };

  private handleOtpError = (error: HttpErrorResponse): Observable<never> => {
    let message = 'OTP operation failed';
    if (error.status === 400) message = error.error?.message || 'Invalid OTP format or data.';
    else if (error.status === 401) message = error.error?.message || 'Invalid or expired OTP code.';
    else if (error.status === 404) message = 'OTP not found. Please request a new code.';
    else if (error.status === 422) message = error.error?.message || 'Invalid OTP data format.';
    else if (error.status === 429) message = 'Too many attempts. Please wait.';
    else if (error.status >= 500) message = 'Server error during OTP operation.';
    else if (error.error?.message) message = error.error.message;
    
    return throwError(() => new Error(message));
  };

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
      }
    }
    
    return throwError(() => new Error(message));
  };
}