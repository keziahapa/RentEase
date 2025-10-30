import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class PropertyService {
  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com';

  constructor(private http: HttpClient, private authService: AuthService) {}

  getCurrentUserProfile(): Observable<any> {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      return throwError(() => ({ 
        status: 401, 
        message: 'No user data found' 
      }));
    }

    return of({
      success: true,
      message: 'Using local user data',
      user: currentUser
    });
  }

  updateUserProfile(profileData: any): Observable<any> {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      return throwError(() => ({ 
        status: 401, 
        message: 'No user data found' 
      }));
    }

    const updatedUser = {
      ...currentUser,
      ...profileData,
      id: currentUser.id,
      role: currentUser.role,
      verified: currentUser.verified,
      emailVerified: currentUser.emailVerified
    };
    
    this.updateLocalUserData(updatedUser);
    
    return of({
      success: true,
      message: 'Profile updated locally',
      user: updatedUser
    });
  }

  getProfilePicture(): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return of({
        success: false,
        pictureUrl: this.generateDefaultAvatar(),
        message: 'No token available'
      });
    }

    return this.http.get<any>(
      `${this.apiUrl}/api/profile/picture`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      tap(response => {
        const pictureUrl = this.extractImageUrl(response);
        if (response.success && pictureUrl) {
          localStorage.setItem('profileImage', pictureUrl);
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
          pictureUrl: this.generateDefaultAvatar(),
          message: 'Using default avatar'
        });
      })
    );
  }

  uploadProfilePicture(file: File): Observable<any> {
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

    return this.http.post<any>(
      `${this.apiUrl}/api/profile/upload-picture`,
      formData,
      { headers, responseType: 'json' }
    ).pipe(
      tap(response => {
        const pictureUrl = this.extractImageUrl(response);
        if (response.success && pictureUrl) {
          localStorage.setItem('profileImage', pictureUrl);
          this.updateUserProfilePicture(pictureUrl);
        }
      }),
      catchError(this.handleProfileError)
    );
  }

  updateProfilePicture(file: File): Observable<any> {
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

    return this.http.put<any>(
      `${this.apiUrl}/api/profile/update-picture`,
      formData,
      { headers, responseType: 'json' }
    ).pipe(
      tap(response => {
        const pictureUrl = this.extractImageUrl(response);
        if (response.success && pictureUrl) {
          localStorage.setItem('profileImage', pictureUrl);
          this.updateUserProfilePicture(pictureUrl);
        }
      }),
      catchError(this.handleProfileError)
    );
  }

  deleteProfilePicture(): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => ({ 
        status: 401, 
        message: 'No authentication token found' 
      }));
    }

    return this.http.delete<any>(
      `${this.apiUrl}/api/profile/delete-picture`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      tap(response => {
        if (response.success) {
          localStorage.removeItem('profileImage');
          this.updateUserProfilePicture(undefined);
        }
      }),
      catchError(this.handleProfileError)
    );
  }

  createProperty(request: any): Observable<any> {
    const backendRequest = {
      name: request.name.trim(),
      location: request.location.trim(),
      propertyType: request.propertyType,
      totalUnits: Number(request.totalUnits),
      description: request.description?.trim() || ''
    };

    return this.http.post<any>(
      `${this.apiUrl}/api/landlord/properties`,
      backendRequest,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  getProperties(): Observable<any[]> {
    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/properties`, 
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      map(response => {
        if (Array.isArray(response)) {
          return response;
        } else if (response?.data && Array.isArray(response.data)) {
          return response.data;
        } else if (response?.properties && Array.isArray(response.properties)) {
          return response.properties;
        } else if (response?.content && Array.isArray(response.content)) {
          return response.content;
        }
        return [];
      }),
      catchError(this.handleError)
    );
  }

  getPropertyById(propertyId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      map(response => {
        if (response?.data) {
          return response.data;
        } else if (response?.property) {
          return response.property;
        }
        return response;
      }),
      catchError(this.handleError)
    );
  }

  updateProperty(propertyId: string, request: any): Observable<any> {
    const backendRequest = {
      name: request.name.trim(),
      location: request.location.trim(),
      propertyType: request.propertyType,
      totalUnits: Number(request.totalUnits),
      description: request.description?.trim() || ''
    };

    return this.http.put<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}`,
      backendRequest,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  deleteProperty(propertyId: string): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  getUnitsByPropertyId(propertyId: string): Observable<any[]> {
    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}/units`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      map(response => {
        if (Array.isArray(response)) {
          return response;
        } else if (response?.data && Array.isArray(response.data)) {
          return response.data;
        } else if (response?.units && Array.isArray(response.units)) {
          return response.units;
        } else if (response?.content && Array.isArray(response.content)) {
          return response.content;
        }
        return [];
      }),
      catchError(this.handleError)
    );
  }

  getPropertyUnits(propertyId: string): Observable<any[]> {
    return this.getUnitsByPropertyId(propertyId);
  }

  createUnit(propertyId: string, unit: any): Observable<any> {
    const unitData = {
      unitNumber: unit.unitNumber.trim(),
      unitType: unit.unitType,
      rentAmount: Number(unit.rentAmount),
      deposit: Number(unit.deposit),
      description: unit.description?.trim() || ''
    };

    return this.http.post<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}/units`,
      unitData,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  updateUnit(propertyId: string, unitId: string, unit: any): Observable<any> {
    const unitData = {
      unitNumber: unit.unitNumber?.trim(),
      unitType: unit.unitType,
      rentAmount: Number(unit.rentAmount),
      deposit: Number(unit.deposit),
      description: unit.description?.trim() || ''
    };

    return this.http.put<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}/units/${unitId}`,
      unitData,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  deleteUnit(propertyId: string, unitId: string): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}/units/${unitId}`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  getDashboardStats(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/dashboard/stats`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  getPropertyStats(propertyId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}/stats`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  private extractImageUrl(response: any): string | undefined {
    return response.data || response.imageUrl || response.pictureUrl;
  }

  private updateUserProfilePicture(pictureUrl: string | undefined): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        profilePicture: pictureUrl
      };
      this.updateLocalUserData(updatedUser);
    }
  }

  private generateDefaultAvatar(): string {
    const currentUser = this.authService.getCurrentUser();
    const name = currentUser?.fullName || 'User';
    const names = name.split(' ');
    const initials = names.map((n: string) => n.charAt(0).toUpperCase()).join('').slice(0, 2) || 'US';
    
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    const color = colors[initials.charCodeAt(0) % colors.length];
    
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

  private handleProfileError = (error: HttpErrorResponse): Observable<never> => {
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
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error
    }));
  };

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'An unexpected error occurred';
    
    if (error.status === 401) {
      errorMessage = 'Authentication failed';
      this.authService.logout().subscribe();
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error
    }));
  };

  updateLocalUserData(user: any): void {
    const isPermanent = !!localStorage.getItem('userData');
    const storage = isPermanent ? localStorage : sessionStorage;
    storage.setItem('userData', JSON.stringify(user));
   
    if ((this.authService as any).currentUserSubject) {
      (this.authService as any).currentUserSubject.next(user);
    }
  }
}