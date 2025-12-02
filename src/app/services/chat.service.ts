import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of, forkJoin } from 'rxjs';
import { catchError, tap, map, timeout, switchMap } from 'rxjs/operators';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { 
  Message, 
  ChatRoom, 
  SendMessageRequest, 
  ApiResponse,
  Participant,
  MessageStatus,
  BatchDeleteRequest,
  TypingIndicator,
  OnlineStatus,
  Property,
  Unit
} from './chat.interface';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'https://rentease-4.onrender.com/api/chat';
  private wsUrl = 'https://rentease-4.onrender.com/ws';
  private stompClient: Client | null = null;
  private roomSubscriptions: Map<string, any> = new Map();
  private authService = inject(AuthService);
  private currentUserId: number | null = null;

  private messagesSubject = new BehaviorSubject<Message[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  
  private roomsSubject = new BehaviorSubject<ChatRoom[]>([]);
  public rooms$ = this.roomsSubject.asObservable();

  private currentRoomSubject = new BehaviorSubject<ChatRoom | null>(null);
  public currentRoom$ = this.currentRoomSubject.asObservable();

  private connectedSubject = new BehaviorSubject<boolean>(false);
  public connected$ = this.connectedSubject.asObservable();

  private typingSubject = new BehaviorSubject<TypingIndicator[]>([]);
  public typing$ = this.typingSubject.asObservable();

  private onlineStatusSubject = new BehaviorSubject<OnlineStatus[]>([]);
  public onlineStatus$ = this.onlineStatusSubject.asObservable();

  private connectionAttempts = 0;
  private readonly MAX_CONNECTION_ATTEMPTS = 3;
  private readonly RECONNECT_DELAY = 2000;

  constructor(
    private http: HttpClient
  ) {
    this.initializeService();
  }

  private initializeService(): void {
    const user = this.authService.getCurrentUser();
    if (user?.id) {
      this.currentUserId = this.parseUserId(user.id);
    }

    if (this.authService.isAuthenticated()) {
      this.initializeWebSocketConnection();
      this.loadRooms();
    }

    this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      if (isAuthenticated) {
        setTimeout(() => {
          if (this.authService.isAuthenticated()) {
            const user = this.authService.getCurrentUser();
            if (user?.id) {
              this.currentUserId = this.parseUserId(user.id);
            }
            this.initializeWebSocketConnection();
            this.loadRooms();
          }
        }, 1000);
      } else {
        this.disconnect();
        this.clearLocalData();
        this.currentUserId = null;
      }
    });
  }

  private parseUserId(userId: string | number): number | null {
    if (typeof userId === 'number') {
      return userId;
    }
    
    if (typeof userId === 'string') {
      const parsed = parseInt(userId, 10);
      return isNaN(parsed) ? null : parsed;
    }
    
    return null;
  }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  private getWsToken(): string {
    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    return token;
  }

  private handleApiError(error: any, customMessage?: string): Observable<never> {
    console.error('Chat API Error:', error);
    
    let errorMessage = customMessage || 'An error occurred. Please try again.';
    
    if (error.status === 401) {
      errorMessage = 'Authentication failed. Please log in again.';
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to perform this action.';
    } else if (error.status === 404) {
      errorMessage = 'The requested resource was not found.';
    } else if (error.status === 400) {
      errorMessage = error.error?.message || 'Invalid request. Please check your data.';
    } else if (error.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    } else if (error.status === 0) {
      errorMessage = 'Cannot connect to server. Please check your internet connection.';
    }
    
    return throwError(() => new Error(errorMessage));
  }

  // ✅ FIXED: Much better property extraction with comprehensive logging
  public extractProperties(response: any): Property[] {
    console.log('🔍 ChatService.extractProperties called with:', response);
    
    if (!response) {
      console.warn('⚠️ Response is null or undefined');
      return [];
    }

    let propertiesArray: any[] = [];

    // Handle various response structures
    if (Array.isArray(response)) {
      console.log('📦 Response is direct array');
      propertiesArray = response;
    } else if (response.data && Array.isArray(response.data)) {
      console.log('📦 Response has data array');
      propertiesArray = response.data;
    } else if (response.properties && Array.isArray(response.properties)) {
      console.log('📦 Response has properties array');
      propertiesArray = response.properties;
    } else if (response.content && Array.isArray(response.content)) {
      console.log('📦 Response has content array (paginated)');
      propertiesArray = response.content;
    } else if (response.success && response.data && Array.isArray(response.data)) {
      console.log('📦 Response has success + data array');
      propertiesArray = response.data;
    } else if (typeof response === 'object' && (response.id || response.propertyId)) {
      console.log('📦 Response is single property object');
      propertiesArray = [response];
    } else {
      console.warn('⚠️ Could not extract properties from response structure');
      console.log('Response keys:', Object.keys(response || {}));
    }

    console.log(`📋 Extracted properties array with ${propertiesArray.length} items`);

    const processedProperties = propertiesArray
      .map((item: any, index: number) => {
        try {
          // Property data might be nested or direct
          const propertyData = item.property || item;
          
          // ✅ COMPREHENSIVE field mapping with multiple fallbacks
          const processedProperty: Property = {
            id: Number(propertyData.id || propertyData.propertyId) || 0,
            
            // Name with multiple fallbacks
            name: propertyData.name || 
                  propertyData.propertyName || 
                  propertyData.title ||
                  `Property ${propertyData.id || index + 1}`,
            
            // Address with multiple fallbacks
            address: propertyData.address || 
                    propertyData.location || 
                    propertyData.street ||
                    '',
            
            // Location with multiple fallbacks
            location: propertyData.location || 
                     propertyData.address || 
                     propertyData.city ||
                     '',
            
            // Property type with fallback
            propertyType: propertyData.propertyType || 
                         propertyData.type || 
                         'RESIDENTIAL',
            
            // Total units with multiple sources
            totalUnits: Number(propertyData.totalUnits || 
                             propertyData.numberOfUnits || 
                             propertyData.unitsCount ||
                             propertyData.units?.length || 
                             0),
            
            // Description
            description: propertyData.description || 
                        propertyData.details || 
                        '',
            
            // ✅ FIXED: Owner name with comprehensive checks
            ownerName: propertyData.ownerName || 
                      propertyData.landlordName || 
                      propertyData.landlord?.fullName ||
                      propertyData.landlord?.name ||
                      propertyData.owner?.fullName ||
                      propertyData.owner?.name ||
                      '',
            
            // ✅ FIXED: Owner ID with comprehensive checks
            ownerId: Number(propertyData.ownerId || 
                          propertyData.landlordId || 
                          propertyData.landlord?.id ||
                          propertyData.owner?.id || 
                          0),
            
            // Image URL with multiple sources
            imageUrl: propertyData.imageUrl || 
                     propertyData.image || 
                     propertyData.photo ||
                     propertyData.images?.[0] ||
                     '',
            
            // Amenities
            amenities: propertyData.amenities || 
                      propertyData.features || 
                      []
          };
          
          console.log(`✅ Processed property ${index + 1}:`, {
            id: processedProperty.id,
            name: processedProperty.name,
            ownerName: processedProperty.ownerName,
            totalUnits: processedProperty.totalUnits
          });
          
          return processedProperty;
        } catch (error) {
          console.error(`❌ Error processing property at index ${index}:`, error);
          console.error('Problematic item:', item);
          return null;
        }
      })
      .filter((property: Property | null): property is Property => {
        if (!property) return false;
        if (property.id <= 0) {
          console.warn('⚠️ Filtered out property with invalid ID:', property);
          return false;
        }
        return true;
      });

    console.log(`✅ Successfully processed ${processedProperties.length} valid properties`);
    return processedProperties;
  }

  // ✅ FIXED: Much better unit extraction with comprehensive logging
  public extractUnits(response: any): Unit[] {
    console.log('🔍 ChatService.extractUnits called with:', response);
    
    if (!response) {
      console.warn('⚠️ Response is null or undefined');
      return [];
    }

    let unitsArray: any[] = [];

    // Handle various response structures
    if (Array.isArray(response)) {
      console.log('📦 Response is direct array');
      unitsArray = response;
    } else if (response.data && Array.isArray(response.data)) {
      console.log('📦 Response has data array');
      unitsArray = response.data;
    } else if (response.units && Array.isArray(response.units)) {
      console.log('📦 Response has units array');
      unitsArray = response.units;
    } else if (response.content && Array.isArray(response.content)) {
      console.log('📦 Response has content array (paginated)');
      unitsArray = response.content;
    } else if (response.success && response.data && Array.isArray(response.data)) {
      console.log('📦 Response has success + data array');
      unitsArray = response.data;
    } else if (typeof response === 'object' && (response.id || response.unitId)) {
      console.log('📦 Response is single unit object');
      unitsArray = [response];
    } else {
      console.warn('⚠️ Could not extract units from response structure');
      console.log('Response keys:', Object.keys(response || {}));
    }

    console.log(`📋 Extracted units array with ${unitsArray.length} items`);

    const processedUnits = unitsArray
      .map((item: any, index: number) => {
        try {
          // Unit data might be nested or direct
          const unitData = item.unit || item;
          
          // ✅ COMPREHENSIVE field mapping
          const processedUnit: Unit = {
            id: Number(unitData.id || unitData.unitId) || 0,
            
            // Unit number (required)
            unitNumber: unitData.unitNumber || 
                       unitData.number || 
                       unitData.unit_number ||
                       '',
            
            // Unit type
            unitType: unitData.unitType || 
                     unitData.type ||
                     '',
            
            // Property ID
            propertyId: Number(unitData.propertyId || 
                             unitData.property_id ||
                             unitData.property?.id || 
                             0),
            
            // Property name
            propertyName: unitData.propertyName || 
                         unitData.property_name ||
                         unitData.property?.name ||
                         '',
            
            // Tenant name
            tenantName: unitData.tenantName || 
                       unitData.tenant_name ||
                       unitData.tenant?.fullName ||
                       unitData.tenant?.name ||
                       '',
            
            // Rent amount
            rentAmount: Number(unitData.rentAmount || 
                             unitData.rent_amount ||
                             unitData.rent || 
                             0),
            
            // Deposit
            deposit: Number(unitData.deposit || 
                           unitData.security_deposit ||
                           0),
            
            // ✅ FIXED: Better status determination
            status: unitData.status || 
                   (unitData.isOccupied === true ? 'OCCUPIED' : 
                    unitData.isOccupied === false ? 'AVAILABLE' : 
                    unitData.tenant || unitData.tenantId ? 'OCCUPIED' : 
                    'AVAILABLE'),
            
            // Bedrooms
            bedrooms: Number(unitData.bedrooms || 
                           unitData.bedroom_count ||
                           0),
            
            // Bathrooms
            bathrooms: Number(unitData.bathrooms || 
                            unitData.bathroom_count ||
                            0),
            
            // Square feet
            squareFeet: Number(unitData.squareFeet || 
                             unitData.square_feet ||
                             unitData.area ||
                             0),
            
            // Tenant ID
            tenantId: unitData.tenantId ? Number(unitData.tenantId) : 
                     unitData.tenant_id ? Number(unitData.tenant_id) :
                     unitData.tenant?.id ? Number(unitData.tenant.id) :
                     undefined,
            
            // Description
            description: unitData.description || 
                        unitData.details ||
                        '',
            
            // Amenities
            amenities: unitData.amenities || 
                      unitData.features ||
                      [],
            
            // Image URLs
            imageUrls: unitData.imageUrls || 
                      unitData.images || 
                      unitData.photos ||
                      []
          };
          
          console.log(`✅ Processed unit ${index + 1}:`, {
            id: processedUnit.id,
            unitNumber: processedUnit.unitNumber,
            propertyId: processedUnit.propertyId,
            propertyName: processedUnit.propertyName,
            status: processedUnit.status
          });
          
          return processedUnit;
        } catch (error) {
          console.error(`❌ Error processing unit at index ${index}:`, error);
          console.error('Problematic item:', item);
          return null;
        }
      })
      .filter((unit: Unit | null): unit is Unit => {
        if (!unit) return false;
        if (unit.id <= 0) {
          console.warn('⚠️ Filtered out unit with invalid ID:', unit);
          return false;
        }
        if (!unit.unitNumber) {
          console.warn('⚠️ Filtered out unit without unit number:', unit);
          return false;
        }
        return true;
      });

    console.log(`✅ Successfully processed ${processedUnits.length} valid units`);
    return processedUnits;
  }

  createTenantLandlordChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    console.log('🔧 Creating tenant-landlord chat for property:', propertyId);
    
    if (!propertyId || propertyId <= 0) {
      return throwError(() => new Error('Invalid property ID'));
    }
    
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/tenant/landlord/${propertyId}`,
      null, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      tap(response => {
        console.log('✅ Tenant-landlord chat response:', response);
        if (response.success && response.data) {
          console.log('✅ Tenant-landlord chat created successfully');
          const newRoom = this.processRoomData(response.data);
          this.addRoom(newRoom);
        }
      }),
      catchError(error => {
        console.error('❌ Error creating tenant-landlord chat:', error);
        let errorMsg = 'Failed to create chat with landlord. ';
        if (error.status === 404) {
          errorMsg += 'Landlord not found for this property.';
        } else if (error.status === 409) {
          errorMsg += 'Chat already exists.';
        }
        return this.handleApiError(error, errorMsg);
      })
    );
  }

  createTenantCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    console.log('🔧 Creating tenant-caretaker chat for property:', propertyId);
    
    if (!propertyId || propertyId <= 0) {
      return throwError(() => new Error('Invalid property ID'));
    }
    
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/tenant/caretaker/${propertyId}`,
      null, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      tap(response => {
        console.log('✅ Tenant-caretaker chat response:', response);
        if (response.success && response.data) {
          console.log('✅ Tenant-caretaker chat created successfully');
          const newRoom = this.processRoomData(response.data);
          this.addRoom(newRoom);
        }
      }),
      catchError(error => {
        console.error('❌ Error creating tenant-caretaker chat:', error);
        let errorMsg = 'Failed to create chat with caretaker. ';
        if (error.status === 404) {
          errorMsg += 'Caretaker not found for this property.';
        } else if (error.status === 409) {
          errorMsg += 'Chat already exists.';
        }
        return this.handleApiError(error, errorMsg);
      })
    );
  }

  createLandlordCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    console.log('🔧 Creating landlord-caretaker chat for property:', propertyId);
    
    if (!propertyId || propertyId <= 0) {
      return throwError(() => new Error('Invalid property ID'));
    }
    
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/landlord/caretaker/${propertyId}`,
      null, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      tap(response => {
        console.log('✅ Landlord-caretaker chat response:', response);
        if (response.success && response.data) {
          console.log('✅ Landlord-caretaker chat created successfully');
          const newRoom = this.processRoomData(response.data);
          this.addRoom(newRoom);
        }
      }),
      catchError(error => {
        console.error('❌ Error creating landlord-caretaker chat:', error);
        let errorMsg = 'Failed to create chat with caretaker. ';
        if (error.status === 404) {
          errorMsg += 'Caretaker not found for this property.';
        } else if (error.status === 409) {
          errorMsg += 'Chat already exists.';
        }
        return this.handleApiError(error, errorMsg);
      })
    );
  }

  createLandlordTenantChat(unitId: number): Observable<ApiResponse<ChatRoom>> {
    console.log('🔧 Creating landlord-tenant chat for unit:', unitId);
    
    if (!unitId || unitId <= 0) {
      return throwError(() => new Error('Invalid unit ID'));
    }
    
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/landlord/tenant/${unitId}`,
      null, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      tap(response => {
        console.log('✅ Landlord-tenant chat response:', response);
        if (response.success && response.data) {
          console.log('✅ Landlord-tenant chat created successfully');
          const newRoom = this.processRoomData(response.data);
          this.addRoom(newRoom);
        }
      }),
      catchError(error => {
        console.error('❌ Error creating landlord-tenant chat:', error);
        let errorMsg = 'Failed to create chat with tenant. ';
        if (error.status === 404) {
          errorMsg += 'Tenant not found for this unit.';
        } else if (error.status === 409) {
          errorMsg += 'Chat already exists.';
        }
        return this.handleApiError(error, errorMsg);
      })
    );
  }

  createCaretakerTenantChat(unitId: number): Observable<ApiResponse<ChatRoom>> {
    console.log('🔧 Creating caretaker-tenant chat for unit:', unitId);
    
    if (!unitId || unitId <= 0) {
      return throwError(() => new Error('Invalid unit ID'));
    }
    
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/caretaker/tenant/${unitId}`,
      null, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      tap(response => {
        console.log('✅ Caretaker-tenant chat response:', response);
        if (response.success && response.data) {
          console.log('✅ Caretaker-tenant chat created successfully');
          const newRoom = this.processRoomData(response.data);
          this.addRoom(newRoom);
        }
      }),
      catchError(error => {
        console.error('❌ Error creating caretaker-tenant chat:', error);
        let errorMsg = 'Failed to create chat with tenant. ';
        if (error.status === 404) {
          errorMsg += 'Tenant not found for this unit.';
        } else if (error.status === 409) {
          errorMsg += 'Chat already exists.';
        }
        return this.handleApiError(error, errorMsg);
      })
    );
  }

  sendMessage(content: string, roomId: number): Observable<ApiResponse> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => new Error('User not authenticated'));
    }

    console.log('📤 Sending message to room:', roomId);
    const messageRequest: SendMessageRequest = {
      content: content.trim(),
      chatRoomId: roomId,
      messageType: 'TEXT'
    };

    const currentUser = this.authService.getCurrentUser();
    const tempMessage: Message = {
      id: Date.now(),
      content: messageRequest.content,
      senderId: this.currentUserId || 0,
      senderName: currentUser?.fullName || 'You',
      senderEmail: currentUser?.email || '',
      chatRoomId: roomId,
      sentAt: new Date(),
      timestamp: new Date(),
      messageType: 'TEXT',
      status: 'SENDING',
      canDelete: true
    };

    this.addMessage(tempMessage);

    return this.http.post<ApiResponse>(`${this.apiUrl}/messages`, messageRequest, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(15000),
      tap(response => {
        if (response.success && response.data) {
          console.log('✅ Message sent successfully');
          this.removeMessage(tempMessage.id);
          this.handleIncomingMessage(response.data);
        } else {
          this.updateMessageStatus(tempMessage.id, 'FAILED');
        }
      }),
      catchError(error => {
        console.error('❌ Error sending message:', error);
        this.updateMessageStatus(tempMessage.id, 'FAILED');
        return this.handleApiError(error, 'Failed to send message. Please try again.');
      })
    );
  }

  batchDeleteMessages(messageIds: number[], chatRoomId: number): Observable<ApiResponse> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => new Error('User not authenticated'));
    }

    if (!messageIds || messageIds.length === 0) {
      return throwError(() => new Error('No messages to delete'));
    }

    console.log('🗑️ Batch deleting messages:', messageIds);
    
    const request: BatchDeleteRequest = {
      messageIds,
      chatRoomId,
      deleteForEveryone: false
    };

    return this.http.post<ApiResponse>(`${this.apiUrl}/messages/batch-delete`, request, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(15000),
      tap(response => {
        if (response.success) {
          console.log('✅ Messages deleted successfully via batch delete');
          messageIds.forEach(messageId => this.removeMessage(messageId));
        }
      }),
      catchError(error => {
        console.error('❌ Batch delete endpoint failed:', error);
        
        if (error.status === 404 || error.status === 405) {
          console.log('Batch delete endpoint not available, using individual deletes');
          return this.deleteMessagesIndividually(messageIds);
        }
        
        return this.handleApiError(error, 'Failed to delete messages.');
      })
    );
  }

  private deleteMessagesIndividually(messageIds: number[]): Observable<ApiResponse> {
    console.log('🗑️ Deleting messages individually:', messageIds);
    
    const deleteObservables = messageIds.map(messageId => 
      this.http.delete<ApiResponse>(`${this.apiUrl}/messages/${messageId}`, { 
        headers: this.getHeaders() 
      }).pipe(
        tap(response => {
          if (response.success) {
            console.log(`✅ Message ${messageId} deleted successfully`);
            this.removeMessage(messageId);
          }
        }),
        catchError(error => {
          console.error(`Failed to delete message ${messageId}:`, error);
          return of({ 
            success: false, 
            message: `Failed to delete message ${messageId}` 
          } as ApiResponse);
        })
      )
    );

    return forkJoin(deleteObservables).pipe(
      map(responses => {
        const successCount = responses.filter(r => r.success).length;
        const failedCount = responses.length - successCount;
        
        return {
          success: successCount > 0,
          message: `Deleted ${successCount} messages, ${failedCount} failed`
        };
      })
    );
  }

  deleteMessage(messageId: number): Observable<ApiResponse> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => new Error('User not authenticated'));
    }

    console.log('🗑️ Deleting message:', messageId);
    return this.http.delete<ApiResponse>(`${this.apiUrl}/messages/${messageId}`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(15000),
      tap(response => {
        if (response.success) {
          console.log('✅ Message deleted successfully');
          this.removeMessage(messageId);
        }
      }),
      catchError(error => {
        console.error('❌ Error deleting message:', error);
        return this.handleApiError(error, 'Failed to delete message.');
      })
    );
  }

  clearChat(roomId: number): Observable<ApiResponse> {
    return new Observable<ApiResponse>(observer => {
      this.getMessages(roomId).subscribe({
        next: (messages) => {
          const messageIds = messages.map(m => m.id);
          if (messageIds.length > 0) {
            this.batchDeleteMessages(messageIds, roomId).subscribe({
              next: (response) => {
                observer.next(response);
                observer.complete();
              },
              error: (error) => {
                observer.error(error);
                observer.complete();
              }
            });
          } else {
            observer.next({ 
              success: true, 
              message: 'No messages to clear' 
            } as ApiResponse);
            observer.complete();
          }
        },
        error: (error) => {
          observer.error(error);
          observer.complete();
        }
      });
    });
  }

  loadRooms(): Observable<ChatRoom[]> {
    if (!this.authService.isAuthenticated()) {
      console.log('⚠️ User not authenticated, skipping room load');
      return of([]);
    }

    console.log('📥 Loading chat rooms...');
    return this.http.get<ApiResponse<ChatRoom[]>>(`${this.apiUrl}/rooms`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(15000),
      map(response => {
        if (response && response.success && response.data && Array.isArray(response.data)) {
          const processedRooms = response.data.map(room => this.processRoomData(room));
          this.roomsSubject.next(processedRooms);
          console.log(`✅ Loaded ${processedRooms.length} chat rooms`);
          return processedRooms;
        }
        console.warn('⚠️ No rooms data in response');
        return [];
      }),
      catchError(error => {
        console.error('❌ Error loading rooms:', error);
        return of([]);
      })
    );
  }

    getMessages(roomId: number): Observable<Message[]> {
    if (!this.authService.isAuthenticated()) {
      console.log('⚠️ User not authenticated, skipping message load');
      return of([]);
    }

    console.log('📥 Loading messages for room:', roomId);
    return this.http.get<ApiResponse<Message[]>>(`${this.apiUrl}/rooms/${roomId}/messages`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(15000),
      map(response => {
        if (response && response.success && response.data && Array.isArray(response.data)) {
          const messages = response.data.map(msg => this.processMessageData(msg))
            .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
          this.messagesSubject.next(messages);
          console.log(`✅ Loaded ${messages.length} messages for room ${roomId}`);
          this.subscribeToRoom(roomId);
          return messages;
        }
        console.warn('⚠️ No messages data in response');
        return [];
      }),
      catchError(error => {
        console.error('❌ Error loading messages:', error);
        return of([]);
      })
    );
  }

  markMessageAsRead(roomId: number, messageId: number): Observable<ApiResponse> {
    if (!this.authService.isAuthenticated()) {
      return of({ success: false, message: 'User not authenticated' });
    }

    return this.http.post<ApiResponse>(
      `${this.apiUrl}/rooms/${roomId}/mark-read`,
      { messageId },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.error('❌ Error marking message as read:', error);
        return of({ success: false, message: 'Failed to mark as read' });
      })
    );
  }

  markMessageAsDelivered(roomId: number, messageId: number): Observable<ApiResponse> {
    if (!this.authService.isAuthenticated()) {
      return of({ success: false, message: 'User not authenticated' });
    }

    return this.http.post<ApiResponse>(
      `${this.apiUrl}/rooms/${roomId}/mark-delivered`,
      { messageId },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.error('❌ Error marking message as delivered:', error);
        return of({ success: false, message: 'Failed to mark as delivered' });
      })
    );
  }

  formatTime(timestamp: Date): string {
    if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
      return '';
    }
    
    try {
      const eatTime = new Date(timestamp.getTime() + (3 * 60 * 60 * 1000));
      
      return eatTime.toLocaleTimeString('en-KE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Africa/Nairobi'
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return timestamp.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
  }

  formatMessageTime(timestamp: Date): string {
    if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
      return '';
    }
    
    try {
      const now = new Date();
      const eatTime = new Date(timestamp.getTime() + (3 * 60 * 60 * 1000));
      const nowEAT = new Date(now.getTime() + (3 * 60 * 60 * 1000));
      
      const diffInHours = (nowEAT.getTime() - eatTime.getTime()) / (1000 * 60 * 60);
      
      if (diffInHours < 24) {
        return eatTime.toLocaleTimeString('en-KE', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Africa/Nairobi'
        });
      } else if (diffInHours < 168) {
        return eatTime.toLocaleDateString('en-KE', {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Africa/Nairobi'
        });
      } else {
        return eatTime.toLocaleDateString('en-KE', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Africa/Nairobi'
        });
      }
    } catch (error) {
      console.error('Error formatting message time:', error);
      const now = new Date();
      const messageTime = new Date(timestamp);
      
      const diffInHours = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
      
      if (diffInHours < 24) {
        return messageTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      } else {
        return messageTime.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
    }
  }

  formatDateOnly(timestamp: Date): string {
    if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
      return '';
    }
    
    try {
      const now = new Date();
      const eatTime = new Date(timestamp.getTime() + (3 * 60 * 60 * 1000));
      const nowEAT = new Date(now.getTime() + (3 * 60 * 60 * 1000));
      
      const diffInDays = Math.floor((nowEAT.getTime() - eatTime.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 0) {
        return 'Today';
      } else if (diffInDays === 1) {
        return 'Yesterday';
      } else if (diffInDays < 7) {
        return eatTime.toLocaleDateString('en-KE', { 
          weekday: 'long',
          timeZone: 'Africa/Nairobi'
        });
      } else {
        return eatTime.toLocaleDateString('en-KE', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          timeZone: 'Africa/Nairobi'
        });
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return timestamp.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  }

  private initializeWebSocketConnection(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      if (!this.authService.isAuthenticated()) {
        console.log('⚠️ User not authenticated, skipping WebSocket connection');
        return;
      }

      if (this.stompClient && this.stompClient.connected) {
        console.log('✅ WebSocket already connected');
        return;
      }

      console.log('🚀 Initializing WebSocket connection...');
      const socket = new SockJS(this.wsUrl);
      
      this.stompClient = new Client({
        webSocketFactory: () => socket,
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        connectHeaders: {
          'Authorization': `Bearer ${this.getWsToken()}`
        },
        debug: (str) => {
          if (str.includes('ERROR') || str.includes('CONNECT') || str.includes('DISCONNECT')) {
            console.log('STOMP:', str);
          }
        }
      });

      this.stompClient.onConnect = (frame) => {
        console.log('✅ WebSocket connected successfully');
        this.connectedSubject.next(true);
        this.connectionAttempts = 0;
        
        const userMessagesSubscription = this.stompClient!.subscribe('/user/queue/messages', (message: IMessage) => {
          console.log('📨 Received message via user queue');
          this.handleIncomingMessage(JSON.parse(message.body));
        });

        const userDeletedSubscription = this.stompClient!.subscribe('/user/queue/messages/deleted', (message: IMessage) => {
          console.log('🗑️ Received deletion notification');
          this.handleMessageDeleted(JSON.parse(message.body));
        });

        this.roomSubscriptions.set('/user/queue/messages', userMessagesSubscription);
        this.roomSubscriptions.set('/user/queue/messages/deleted', userDeletedSubscription);

        const currentRoom = this.currentRoomSubject.value;
        if (currentRoom?.id) {
          console.log('📡 Subscribing to current room:', currentRoom.id);
          this.subscribeToRoom(currentRoom.id);
        }
      };

      this.stompClient.onStompError = (frame) => {
        console.error('❌ STOMP error:', frame);
        this.connectedSubject.next(false);
        this.attemptReconnection();
      };

      this.stompClient.onWebSocketError = (event) => {
        console.error('❌ WebSocket error:', event);
        this.connectedSubject.next(false);
        this.attemptReconnection();
      };

      this.stompClient.onDisconnect = (frame) => {
        console.log('🔌 WebSocket disconnected');
        this.connectedSubject.next(false);
        this.roomSubscriptions.clear();
      };

      this.stompClient.activate();
    } catch (error) {
      console.error('❌ Error initializing WebSocket:', error);
      this.connectedSubject.next(false);
      this.attemptReconnection();
    }
  }

  private attemptReconnection(): void {
    if (this.connectionAttempts < this.MAX_CONNECTION_ATTEMPTS) {
      this.connectionAttempts++;
      console.log(`🔄 Attempting reconnection (${this.connectionAttempts}/${this.MAX_CONNECTION_ATTEMPTS})...`);
      
      setTimeout(() => {
        if (this.authService.isAuthenticated()) {
          this.initializeWebSocketConnection();
        }
      }, this.RECONNECT_DELAY * this.connectionAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.connectedSubject.next(false);
    }
  }

  private handleIncomingMessage(messageData: any): void {
    try {
      console.log('📥 Processing incoming message:', messageData);
      
      if (!messageData.chatRoomId && !messageData.roomId) {
        console.warn('⚠️ Message without chatRoomId, ignoring:', messageData);
        return;
      }
      
      const message: Message = {
        id: Number(messageData.id || messageData.messageId || Date.now()),
        content: messageData.content || messageData.message || '',
        senderId: Number(messageData.senderId || messageData.sender?.id || 0),
        senderName: messageData.senderName || messageData.sender?.fullName || 'Unknown User',
        senderEmail: messageData.senderEmail || messageData.sender?.email || '',
        chatRoomId: Number(messageData.chatRoomId || messageData.roomId),
        sentAt: new Date(messageData.sentAt || messageData.timestamp || messageData.createdAt || Date.now()),
        timestamp: new Date(messageData.sentAt || messageData.timestamp || messageData.createdAt || Date.now()),
        messageType: messageData.messageType || 'TEXT',
        status: (messageData.status || 'SENT') as MessageStatus,
        fileUrl: messageData.fileUrl,
        fileName: messageData.fileName,
        fileSize: messageData.fileSize ? Number(messageData.fileSize) : undefined,
        canDelete: messageData.canDelete || false,
        isEdited: messageData.isEdited || false,
        deletedAt: messageData.deletedAt ? new Date(messageData.deletedAt) : undefined,
        editedAt: messageData.editedAt ? new Date(messageData.editedAt) : undefined,
        replyToMessageId: messageData.replyToMessageId,
        sender: messageData.sender
      };
      
      console.log('✅ Message processed successfully:', message);
      this.addMessage(message);
      
      if (!this.isMyMessage(message)) {
        this.markMessageAsDelivered(message.chatRoomId, message.id).subscribe();
      }
      
      if (this.currentRoomSubject.value?.id === message.chatRoomId) {
        this.markMessageAsRead(message.chatRoomId, message.id).subscribe();
      }
    } catch (error) {
      console.error('❌ Error handling incoming message:', error, messageData);
    }
  }

  private handleMessageDeleted(deletionData: any): void {
    try {
      console.log('🗑️ Processing message deletion:', deletionData);
      
      if (deletionData.messageId) {
        this.removeMessage(Number(deletionData.messageId));
      } else if (deletionData.messageIds && Array.isArray(deletionData.messageIds)) {
        deletionData.messageIds.forEach((messageId: any) => {
          this.removeMessage(Number(messageId));
        });
      }
    } catch (error) {
      console.error('❌ Error handling message deletion:', error, deletionData);
    }
  }

  private addMessage(message: Message): void {
    const currentMessages = this.messagesSubject.value;
    const messageExists = currentMessages.some(m => m.id === message.id);
    
    if (!messageExists) {
      console.log('➕ Adding new message to list');
      const updatedMessages = [...currentMessages, message].sort((a, b) => 
        new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
      );
      this.messagesSubject.next(updatedMessages);
      
      if (message.chatRoomId) {
        this.updateRoomLastMessage(message.chatRoomId, message);
      }
    } else {
      console.log('ℹ️ Message already exists, updating status');
      this.updateMessageStatus(message.id, message.status);
    }
  }

  private removeMessage(messageId: number): void {
    console.log('🗑️ Removing message:', messageId);
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.filter(m => m.id !== messageId);
    this.messagesSubject.next(updatedMessages);
  }

  private updateMessageStatus(messageId: number, status: MessageStatus): void {
    console.log('🔄 Updating message status:', messageId, status);
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.map(m => {
      if (m.id === messageId) {
        return { ...m, status };
      }
      return m;
    });
    this.messagesSubject.next(updatedMessages);
  }

  private addRoom(room: ChatRoom): void {
    const currentRooms = this.roomsSubject.value;
    const roomExists = currentRooms.some(r => r.id === room.id);
    
    if (!roomExists) {
      console.log('➕ Adding new room to list');
      const updatedRooms = [...currentRooms, room].sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      this.roomsSubject.next(updatedRooms);
    }
  }

  private updateRoomLastMessage(roomId: number, message: Message): void {
    console.log('🔄 Updating room last message for room:', roomId);
    const currentRooms = this.roomsSubject.value;
    const updatedRooms = currentRooms.map(room => {
      if (room.id === roomId) {
        const isCurrentRoom = this.currentRoomSubject.value?.id === roomId;
        return { 
          ...room, 
          lastMessage: message,
          updatedAt: new Date(),
          unreadCount: isCurrentRoom ? 0 : (room.unreadCount || 0) + 1
        };
      }
      return room;
    });
    this.roomsSubject.next(updatedRooms);
  }

  private processRoomData(room: any): ChatRoom {
    const processedRoom: ChatRoom = {
      id: Number(room.id) || 0,
      name: room.name || room.propertyName || 'Unknown Chat',
      type: room.type || 'DIRECT',
      propertyId: room.propertyId ? Number(room.propertyId) : undefined,
      propertyName: room.propertyName || '',
      unitId: room.unitId ? Number(room.unitId) : undefined,
      unitNumber: room.unitNumber || '',
      participants: this.processParticipants(room.participants || room.users || []),
      lastMessage: room.lastMessage ? this.processMessageData(room.lastMessage) : null,
      unreadCount: Number(room.unreadCount) || 0,
      isGroup: room.isGroup || false,
      createdAt: new Date(room.createdAt || Date.now()),
      updatedAt: new Date(room.updatedAt || Date.now())
    };

    return processedRoom;
  }

  private processMessageData(messageData: any): Message {
    const message: Message = {
      id: Number(messageData.id),
      content: messageData.content || '',
      senderId: Number(messageData.senderId),
      senderName: messageData.senderName || messageData.sender?.fullName || 'Unknown User',
      senderEmail: messageData.senderEmail || '',
      chatRoomId: Number(messageData.chatRoomId),
      sentAt: new Date(messageData.sentAt),
      timestamp: new Date(messageData.sentAt),
      messageType: messageData.messageType || 'TEXT',
      status: (messageData.status || 'SENT') as MessageStatus,
      fileUrl: messageData.fileUrl,
      fileName: messageData.fileName,
      fileSize: messageData.fileSize ? Number(messageData.fileSize) : undefined,
      canDelete: messageData.canDelete || false,
      isEdited: messageData.isEdited || false,
      deletedAt: messageData.deletedAt ? new Date(messageData.deletedAt) : undefined,
      editedAt: messageData.editedAt ? new Date(messageData.editedAt) : undefined,
      replyToMessageId: messageData.replyToMessageId,
      sender: messageData.sender
    };
    
    return message;
  }

  private processParticipants(participants: any[]): Participant[] {
    if (!participants || !Array.isArray(participants)) {
      return [];
    }

    return participants.map((participant: any) => {
      const processedParticipant: Participant = {
        id: Number(participant.id || participant.userId),
        userId: Number(participant.userId || participant.id),
        name: participant.name || participant.fullName || 'Unknown User',
        fullName: participant.fullName || participant.name,
        email: participant.email || '',
        role: participant.role || 'USER',
        avatar: participant.avatar,
        profilePicture: participant.profilePicture,
        isOnline: participant.isOnline || false,
        lastSeen: participant.lastSeen ? new Date(participant.lastSeen) : undefined,
        phoneNumber: participant.phoneNumber,
        joinedAt: participant.joinedAt ? new Date(participant.joinedAt) : undefined,
        isAdmin: participant.isAdmin || false,
        unitNumber: participant.unitNumber || participant.unit?.unitNumber,
        propertyId: participant.propertyId || participant.unit?.propertyId,
        unit: participant.unit,
        property: participant.property
      };

      return processedParticipant;
    });
  }

  private subscribeToRoom(roomId: number): void {
    if (this.stompClient && this.stompClient.connected) {
      this.unsubscribeFromRoom(roomId);

      const topic = `/topic/chat/${roomId}`;
      try {
        console.log('📡 Subscribing to room topic:', topic);
        const subscription = this.stompClient!.subscribe(topic, (message: IMessage) => {
          console.log('📨 Received message from room topic');
          this.handleIncomingMessage(JSON.parse(message.body));
        });
        this.roomSubscriptions.set(topic, subscription);
        console.log('✅ Successfully subscribed to room:', roomId);
      } catch (error) {
        console.error('❌ Error subscribing to room:', error);
      }
    } else {
      console.warn('⚠️ Cannot subscribe to room - WebSocket not connected');
    }
  }

  private unsubscribeFromRoom(roomId: number): void {
    const topic = `/topic/chat/${roomId}`;
    const subscription = this.roomSubscriptions.get(topic);
    if (subscription) {
      console.log('📡 Unsubscribing from room:', roomId);
      subscription.unsubscribe();
      this.roomSubscriptions.delete(topic);
    }
  }

  selectRoom(room: ChatRoom | null): void {
    console.log('🎯 Selecting room:', room?.id || 'null');
    this.currentRoomSubject.next(room);
    
    if (room?.id) {
      console.log('📥 Loading messages for selected room');
      this.getMessages(room.id).subscribe();
      this.markRoomAsRead(room.id);
    } else {
      console.log('📭 Clearing messages');
      this.messagesSubject.next([]);
    }
  }

  private markRoomAsRead(roomId: number): void {
    console.log('✅ Marking room as read:', roomId);
    const currentRooms = this.roomsSubject.value;
    const updatedRooms = currentRooms.map(room => {
      if (room.id === roomId) {
        return { ...room, unreadCount: 0 };
      }
      return room;
    });
    this.roomsSubject.next(updatedRooms);
  }

  isMyMessage(message: Message): boolean {
    return this.currentUserId === message.senderId;
  }

  disconnect(): void {
    if (this.stompClient) {
      console.log('🔌 Disconnecting WebSocket');
      this.roomSubscriptions.clear();
      this.stompClient.deactivate();
      this.stompClient = null;
      this.connectedSubject.next(false);
    }
  }

  clearLocalData(): void {
    console.log('🧹 Clearing local chat data');
    this.messagesSubject.next([]);
    this.roomsSubject.next([]);
    this.currentRoomSubject.next(null);
  }

  refreshRooms(): Observable<ChatRoom[]> {
    return this.loadRooms();
  }

  getRoomById(roomId: number): ChatRoom | null {
    const rooms = this.roomsSubject.value;
    return rooms.find(room => room.id === roomId) || null;
  }

  getCurrentUserId(): number | null {
    return this.currentUserId;
  }

  getCurrentUserName(): string {
    const user = this.authService.getCurrentUser();
    return user?.fullName || '';
  }

  reconnect(): void {
    this.disconnect();
    setTimeout(() => {
      this.initializeWebSocketConnection();
    }, 1000);
  }
}