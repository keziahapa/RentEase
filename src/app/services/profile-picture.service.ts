import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
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

@Injectable({
  providedIn: 'root'
})
export class ProfilePictureService {
  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  updateProfile(profileData: UpdateProfileRequest): Observable<UpdateProfileResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => ({ 
        status: 401, 
        message: 'No authentication token found' 
      }));
    }

    return this.http.put<UpdateProfileResponse>(
      `${this.apiUrl}/profile/update`,
      profileData,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.user) {
          this.updateLocalUserData(response.user);
          if ((this.authService as any).currentUserSubject) {
            (this.authService as any).currentUserSubject.next(response.user);
          }
        }
      }),
      catchError(this.handleProfileError)
    );
  }

  updateProfilePartial(profileData: Partial<UpdateProfileRequest>): Observable<UpdateProfileResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => ({ 
        status: 401, 
        message: 'No authentication token found' 
      }));
    }

    return this.http.patch<UpdateProfileResponse>(
      `${this.apiUrl}/profile`,
      profileData,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.user) {
          this.updateLocalUserData(response.user);
          if ((this.authService as any).currentUserSubject) {
            (this.authService as any).currentUserSubject.next(response.user);
          }
        }
      }),
      catchError(this.handleProfileError)
    );
  }

  getCurrentUserProfile(): Observable<UserProfile> {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      return throwError(() => ({ 
        status: 401, 
        message: 'No user data found' 
      }));
    }

    const userProfile: UserProfile = {
      id: currentUser.id,
      fullName: currentUser.fullName,
      email: currentUser.email,
      role: currentUser.role,
      profilePicture: currentUser.profilePicture,
      verified: currentUser.verified,
      emailVerified: currentUser.emailVerified,
      phoneNumber: currentUser.phoneNumber,
      bio: currentUser.bio,
      createdAt: currentUser.createdAt
    };

    return of(userProfile);
  }

  getProfilePicture(): Observable<ProfilePictureResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return of({
        success: false,
        pictureUrl: this.getDefaultAvatar(),
        message: 'No token available'
      });
    }

    return this.http.get<ProfilePictureResponse>(
      `${this.apiUrl}/profile/picture`,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        const pictureUrl = response.data || response.imageUrl || response.pictureUrl;
        if (response.success && pictureUrl) {
          localStorage.setItem('profileImage', pictureUrl);
          const currentUser = this.authService.getCurrentUser();
          if (currentUser) {
            const updatedUser = {
              ...currentUser,
              profilePicture: pictureUrl
            };
            this.updateLocalUserData(updatedUser);
          }
        }
      }),
      catchError(() => {
        const cachedImage = localStorage.getItem('profileImage');
        if (cachedImage && !cachedImage.includes('svg+xml')) {
          return of({
            success: true,
            pictureUrl: cachedImage,
            message: 'Using cached image'
          });
        }
        return of({
          success: false,
          pictureUrl: this.getDefaultAvatar(),
          message: 'Using default avatar'
        });
      })
    );
  }

  uploadProfilePicture(file: File): Observable<ProfilePictureResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => ({ 
        status: 401, 
        message: 'No authentication token found' 
      }));
    }

    const formData = new FormData();
    formData.append('file', file);
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post<ProfilePictureResponse>(
      `${this.apiUrl}/profile/upload-picture`,
      formData,
      { headers }
    ).pipe(
      tap(response => {
        const pictureUrl = response.data || response.imageUrl || response.pictureUrl;
        if (response.success && pictureUrl) {
          localStorage.removeItem('profileImage');
          const currentUser = this.authService.getCurrentUser();
          if (currentUser) {
            const updatedUser = {
              ...currentUser,
              profilePicture: pictureUrl
            };
            this.updateLocalUserData(updatedUser);
          }
        }
      }),
      catchError(this.handleProfileError)
    );
  }

  updateProfilePicture(file: File): Observable<ProfilePictureResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => ({ 
        status: 401, 
        message: 'No authentication token found' 
      }));
    }

    const formData = new FormData();
    formData.append('file', file);
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.put<ProfilePictureResponse>(
      `${this.apiUrl}/profile/update-picture`,
      formData,
      { headers }
    ).pipe(
      tap(response => {
        const pictureUrl = response.data || response.imageUrl || response.pictureUrl;
        if (response.success && pictureUrl) {
          localStorage.removeItem('profileImage');
          const currentUser = this.authService.getCurrentUser();
          if (currentUser) {
            const updatedUser = {
              ...currentUser,
              profilePicture: pictureUrl
            };
            this.updateLocalUserData(updatedUser);
          }
        }
      }),
      catchError(this.handleProfileError)
    );
  }

  deleteProfilePicture(): Observable<ProfilePictureResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => ({ 
        status: 401, 
        message: 'No authentication token found' 
      }));
    }

    return this.http.delete<ProfilePictureResponse>(
      `${this.apiUrl}/profile/delete-picture`,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          localStorage.removeItem('profileImage');
          const currentUser = this.authService.getCurrentUser();
          if (currentUser) {
            const updatedUser = {
              ...currentUser,
              profilePicture: undefined
            };
            this.updateLocalUserData(updatedUser);
          }
        }
      }),
      catchError(this.handleProfileError)
    );
  }

  getDefaultAvatar(name?: string): string {
    const currentUser = this.authService.getCurrentUser();
    const userName = name || currentUser?.fullName || 'User';
    const role = currentUser?.role || 'user';
    const names = userName.split(' ');
    const initials = names.map((n: string) => n.charAt(0).toUpperCase()).join('').slice(0, 2) || 'US';
    
    const colors = {
      caretaker: '#FF6B6B',
      tenant: '#4ECDC4', 
      landlord: '#45B7D1',
      admin: '#43e97b',
      business: '#fa709a',
      user: '#96CEB4'
    };
    
    const color = colors[role as keyof typeof colors] || '#96CEB4';
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="${color}" rx="100"/>
        <text x="100" y="125" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="80" font-weight="bold">${initials}</text>
      </svg>
    `)}`;
  }

  private createHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private handleProfileError = (error: any): Observable<never> => {
    let errorMessage = 'Profile picture operation failed';
    
    if (error.status === 500) {
      errorMessage = 'Server error - profile picture feature temporarily unavailable';
    } else if (error.status === 401) {
      errorMessage = 'Authentication failed';
      this.authService.logout().subscribe();
    } else if (error.status === 413) {
      errorMessage = 'Image file is too large';
    } else if (error.status === 415) {
      errorMessage = 'Unsupported image format';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error
    }));
  };

  private updateLocalUserData(user: any): void {
    const isPermanent = !!localStorage.getItem('userData');
    const storage = isPermanent ? localStorage : sessionStorage;
    storage.setItem('userData', JSON.stringify(user));
   
    if ((this.authService as any).currentUserSubject) {
      (this.authService as any).currentUserSubject.next(user);
    }
  }
}