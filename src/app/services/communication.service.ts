import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, of, throwError, timer } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ConversationParticipant {
  name: string;
  role: 'tenant' | 'landlord' | 'caretaker' | 'system';
}

export interface Message {
  id: string;
  conversationId: string;
  sender: ConversationParticipant;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  participants: ConversationParticipant[];
  lastMessagePreview: string;
  lastUpdated: string;
  unreadCount: number;
  messages: Message[];
}

export interface TenantNotification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'payment' | 'maintenance' | 'announcement' | 'system';
  read: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CommunicationService {
  private readonly http = inject(HttpClient);
  private readonly conversationsUrl = `${environment.apiUrl}/communications/conversations`;
  private readonly notificationsUrl = `${environment.apiUrl}/communications/notifications`;
  private readonly notificationSummaryUrl = `${this.notificationsUrl}/summary`;

  private fallbackConversations: Conversation[] = [
    {
      id: 'conv-1',
      title: 'Landlord • Sarah Johnson',
      participants: [
        { name: 'You', role: 'tenant' },
        { name: 'Sarah Johnson', role: 'landlord' }
      ],
      lastMessagePreview: 'Payment received. Thank you! Let me know if you need anything else.',
      lastUpdated: '2024-02-20T08:45:00Z',
      unreadCount: 1,
      messages: [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          sender: { name: 'Sarah Johnson', role: 'landlord' },
          content: 'Payment received. Thank you! Let me know if you need anything else.',
          timestamp: '2024-02-20T08:45:00Z',
          read: false
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          sender: { name: 'You', role: 'tenant' },
          content: 'Hi Sarah, just confirming that I made the rent payment via M-Pesa this morning.',
          timestamp: '2024-02-20T08:32:00Z',
          read: true
        }
      ]
    },
    {
      id: 'conv-2',
      title: 'Caretaker • James Otieno',
      participants: [
        { name: 'You', role: 'tenant' },
        { name: 'James Otieno', role: 'caretaker' }
      ],
      lastMessagePreview: 'I will check on the leaking faucet this afternoon.',
      lastUpdated: '2024-02-19T15:20:00Z',
      unreadCount: 0,
      messages: [
        {
          id: 'msg-3',
          conversationId: 'conv-2',
          sender: { name: 'You', role: 'tenant' },
          content: 'Hi James, the kitchen faucet started leaking again today.',
          timestamp: '2024-02-19T14:05:00Z',
          read: true
        },
        {
          id: 'msg-4',
          conversationId: 'conv-2',
          sender: { name: 'James Otieno', role: 'caretaker' },
          content: 'Thanks for letting me know. I will check on the leaking faucet this afternoon.',
          timestamp: '2024-02-19T15:20:00Z',
          read: true
        }
      ]
    }
  ];

  private fallbackNotifications: TenantNotification[] = [
    {
      id: 'notif-1',
      title: 'Rent payment receipt available',
      description: 'Your February rent payment receipt has been generated.',
      timestamp: '2024-02-15T07:30:00Z',
      type: 'payment',
      read: false
    },
    {
      id: 'notif-2',
      title: 'Maintenance visit scheduled',
      description: 'Caretaker James scheduled maintenance for February 21 at 10:00 AM.',
      timestamp: '2024-02-18T11:10:00Z',
      type: 'maintenance',
      read: true
    },
    {
      id: 'notif-3',
      title: 'Community meeting this Saturday',
      description: 'Join us for a residents meeting in the lounge at 4:00 PM.',
      timestamp: '2024-02-17T09:00:00Z',
      type: 'announcement',
      read: false
    }
  ];

  private conversationsCache: Conversation[] = this.cloneConversations(this.fallbackConversations);
  private notificationsCache: TenantNotification[] = this.fallbackNotifications.map(notification => ({ ...notification }));
  private conversationsSubject = new BehaviorSubject<Conversation[]>(this.cloneConversations(this.conversationsCache));
  private summarySubject = new BehaviorSubject<{ unreadNotifications: number; unreadMessages: number }>(
    this.computeNotificationSummary()
  );
  private conversationPollingSubscription: Subscription | null = null;
  private summaryPollingSubscription: Subscription | null = null;
  private conversationWatchers = 0;
  private summaryWatchers = 0;

  getTenantConversations(): Observable<Conversation[]> {
    return this.http
      .get<Conversation[] | { data?: Conversation[]; items?: Conversation[] }>(this.conversationsUrl)
      .pipe(
        map(response => this.normalizeConversations(this.extractConversations(response))),
        tap(conversations => this.setConversations(conversations)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          this.logFallback('load conversations', error);
          const fallback = this.getConversationsSnapshot();
          this.conversationsSubject.next(this.cloneConversations(fallback));
          return of(fallback);
        })
      );
  }

  getLandlordConversations(): Observable<Conversation[]> {
    return this.getTenantConversations();
  }

  sendTenantMessage(conversationId: string, content: string): Observable<Message> {
    const trimmed = content.trim();
    if (!trimmed.length) {
      return throwError(() => new Error('Message content cannot be empty'));
    }

    const payload = { content: trimmed };
    const endpoint = `${this.conversationsUrl}/${conversationId}/messages`;

    return this.http
      .post<Message | { data?: Message }>(endpoint, payload)
      .pipe(
        map(response => {
          const message = this.unwrapMessage(response);
          if (!message) {
            throw new Error('Empty message response');
          }
          return this.normalizeMessage(message);
        }),
        tap(message => this.cacheConversationMessage(conversationId, message)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          this.logFallback(`send message in conversation ${conversationId}`, error);
          const fallbackMessage = this.createLocalMessage(conversationId, trimmed);
          this.cacheConversationMessage(conversationId, fallbackMessage);
          return of(fallbackMessage);
        })
      );
  }

  sendLandlordMessage(conversationId: string, content: string): Observable<Message> {
    return this.sendTenantMessage(conversationId, content);
  }

  markConversationRead(conversationId: string): Observable<void> {
    const endpoint = `${this.conversationsUrl}/${conversationId}/read`;

    return this.http.post<void | { data?: unknown }>(endpoint, { read: true }).pipe(
      tap(() => this.applyConversationRead(conversationId)),
      map(() => void 0),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback(`mark conversation ${conversationId} read`, error);
        this.applyConversationRead(conversationId);
        return of(void 0);
      })
    );
  }

  getTenantNotifications(): Observable<TenantNotification[]> {
    return this.http
      .get<TenantNotification[] | { data?: TenantNotification[]; items?: TenantNotification[] }>(this.notificationsUrl)
      .pipe(
        map(response => this.normalizeNotifications(this.extractNotifications(response))),
        tap(notifications => this.setNotifications(notifications)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          this.logFallback('load notifications', error);
          const fallback = this.getNotificationsSnapshot();
          this.summarySubject.next(this.computeNotificationSummary());
          return of(fallback);
        })
      );
  }

  getNotificationSummary(): Observable<{ unreadNotifications: number; unreadMessages: number }> {
    const fallbackSummary = this.computeNotificationSummary();

    return this.http
      .get<{ unreadNotifications: number; unreadMessages: number } | { data?: { unreadNotifications: number; unreadMessages: number } }>(
        this.notificationSummaryUrl
      )
      .pipe(
        map(response => this.extractSummary(response, fallbackSummary)),
        tap(summary => this.summarySubject.next(summary)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          this.logFallback('load notification summary', error);
          const summary = this.computeNotificationSummary();
          this.summarySubject.next(summary);
          return of(summary);
        })
      );
  }

  markNotificationRead(notificationId: string): Observable<void> {
    const endpoint = `${this.notificationsUrl}/${notificationId}/read`;

    return this.http.post<void | { data?: unknown }>(endpoint, { read: true }).pipe(
      tap(() => this.applyNotificationRead(notificationId)),
      map(() => void 0),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback(`mark notification ${notificationId} read`, error);
        this.applyNotificationRead(notificationId);
        return of(void 0);
      })
    );
  }

  watchTenantConversations(intervalMs = 30000): Observable<Conversation[]> {
    this.conversationWatchers++;
    this.startConversationPolling(intervalMs);
    return this.conversationsSubject.asObservable().pipe(
      finalize(() => {
        this.conversationWatchers = Math.max(0, this.conversationWatchers - 1);
        if (this.conversationWatchers === 0) {
          this.stopConversationPolling();
        }
      })
    );
  }

  watchLandlordConversations(intervalMs = 30000): Observable<Conversation[]> {
    return this.watchTenantConversations(intervalMs);
  }

  watchNotificationSummary(intervalMs = 30000): Observable<{ unreadNotifications: number; unreadMessages: number }> {
    this.summaryWatchers++;
    this.startSummaryPolling(intervalMs);
    return this.summarySubject.asObservable().pipe(
      finalize(() => {
        this.summaryWatchers = Math.max(0, this.summaryWatchers - 1);
        if (this.summaryWatchers === 0) {
          this.stopSummaryPolling();
        }
      })
    );
  }

  private setConversations(conversations: Conversation[]): void {
    this.conversationsCache = this.cloneConversations(conversations);
    this.conversationsSubject.next(this.cloneConversations(this.conversationsCache));
    this.summarySubject.next(this.computeNotificationSummary());
  }

  private setNotifications(notifications: TenantNotification[]): void {
    this.notificationsCache = notifications.map(notification => ({ ...notification }));
    this.summarySubject.next(this.computeNotificationSummary());
  }

  private getConversationsSnapshot(): Conversation[] {
    return this.cloneConversations(this.conversationsCache);
  }

  private getNotificationsSnapshot(): TenantNotification[] {
    return this.notificationsCache.map(notification => ({ ...notification }));
  }

  private cloneConversations(conversations: Conversation[]): Conversation[] {
    return conversations.map(conversation => ({
      ...conversation,
      participants: conversation.participants.map(participant => ({ ...participant })),
      messages: conversation.messages.map(message => ({ ...message, sender: { ...message.sender } }))
    }));
  }

  private cacheConversationMessage(conversationId: string, message: Message): void {
    const index = this.conversationsCache.findIndex(conv => conv.id === conversationId);
    if (index === -1) {
      const fallbackConversation: Conversation = {
        id: conversationId,
        title: message.sender.name,
        participants: [message.sender],
        lastMessagePreview: message.content,
        lastUpdated: message.timestamp,
        unreadCount: 0,
        messages: [message]
      };
      this.conversationsCache = [fallbackConversation, ...this.conversationsCache];
      return;
    }

    const updated = this.cloneConversation(this.conversationsCache[index]);
    updated.messages = [...updated.messages, message];
    updated.lastMessagePreview = message.content;
    updated.lastUpdated = message.timestamp;
    updated.unreadCount = 0;

    const newCache = [...this.conversationsCache];
    newCache[index] = updated;
    this.conversationsCache = newCache;
    this.conversationsSubject.next(this.cloneConversations(this.conversationsCache));
    this.summarySubject.next(this.computeNotificationSummary());
  }

  private cloneConversation(conversation: Conversation): Conversation {
    return {
      ...conversation,
      participants: conversation.participants.map(participant => ({ ...participant })),
      messages: conversation.messages.map(message => ({ ...message, sender: { ...message.sender } }))
    };
  }

  private applyConversationRead(conversationId: string): void {
    this.conversationsCache = this.conversationsCache.map(conversation =>
      conversation.id === conversationId
        ? {
            ...conversation,
            unreadCount: 0,
            messages: conversation.messages.map(message => ({ ...message, read: true }))
          }
        : conversation
    );
    this.conversationsSubject.next(this.cloneConversations(this.conversationsCache));
    this.summarySubject.next(this.computeNotificationSummary());
  }

  private applyNotificationRead(notificationId: string): void {
    this.notificationsCache = this.notificationsCache.map(notification =>
      notification.id === notificationId ? { ...notification, read: true } : notification
    );
    this.summarySubject.next(this.computeNotificationSummary());
  }

  private createLocalMessage(conversationId: string, content: string): Message {
    const timestamp = new Date().toISOString();
    return {
      id: `tmp-msg-${Date.now()}`,
      conversationId,
      sender: { name: 'You', role: 'tenant' },
      content,
      timestamp,
      read: true
    };
  }

  private normalizeConversations(conversations: Conversation[]): Conversation[] {
    return conversations.map(conversation => this.normalizeConversation(conversation));
  }

  private normalizeConversation(input: Partial<Conversation> & Record<string, any>): Conversation {
    const participants: ConversationParticipant[] =
      Array.isArray(input.participants) && input.participants.length
        ? input.participants.map((participant: any) => this.normalizeParticipant(participant))
        : [{ name: input.title ?? 'Conversation', role: 'system' }];

    const messages: Message[] = Array.isArray(input.messages)
      ? input.messages.map((message: any) => this.normalizeMessage(message))
      : [];

    return {
      id: input.id ?? `conv-${Date.now()}`,
      title: input.title ?? this.generateConversationTitle(participants),
      participants,
      lastMessagePreview: input.lastMessagePreview ?? messages.at(-1)?.content ?? '',
      lastUpdated: this.normalizeDateString(input.lastUpdated) ?? messages.at(-1)?.timestamp ?? new Date().toISOString(),
      unreadCount: typeof input.unreadCount === 'number' ? input.unreadCount : Number(input.unreadCount ?? 0),
      messages
    };
  }

  private normalizeParticipant(participant: Partial<ConversationParticipant> & Record<string, any>): ConversationParticipant {
    return {
      name: participant.name ?? participant['displayName'] ?? 'Unknown',
      role: participant.role ?? 'system'
    };
  }

  private normalizeMessage(input: Partial<Message> & Record<string, any>): Message {
    return {
      id: input.id ?? `msg-${Date.now()}`,
      conversationId: input.conversationId ?? input['threadId'] ?? 'unknown',
      sender: this.normalizeParticipant(
        input.sender ?? { name: input['senderName'] ?? 'System', role: input['senderRole'] ?? 'system' }
      ),
      content: input.content ?? input['body'] ?? '',
      timestamp: this.normalizeDateString(input.timestamp) ?? new Date().toISOString(),
      read: Boolean(input.read ?? input['isRead'] ?? false)
    };
  }

  private normalizeNotifications(notifications: TenantNotification[]): TenantNotification[] {
    return notifications.map(notification => this.normalizeNotification(notification));
  }

  private normalizeNotification(input: Partial<TenantNotification> & Record<string, any>): TenantNotification {
    return {
      id: input.id ?? `notif-${Date.now()}`,
      title: input.title ?? 'Notification',
      description: input.description ?? input['body'] ?? '',
      timestamp: this.normalizeDateString(input.timestamp) ?? new Date().toISOString(),
      type: input.type ?? input['category'] ?? 'system',
      read: Boolean(input.read ?? input['isRead'] ?? false)
    };
  }

  private extractConversations(response: unknown): Conversation[] {
    if (Array.isArray(response)) {
      return response as Conversation[];
    }
    if (response && typeof response === 'object') {
      const data = (response as any).data ?? (response as any).items;
      if (Array.isArray(data)) {
        return data as Conversation[];
      }
    }
    return this.getConversationsSnapshot();
  }

  private extractNotifications(response: unknown): TenantNotification[] {
    if (Array.isArray(response)) {
      return response as TenantNotification[];
    }
    if (response && typeof response === 'object') {
      const data = (response as any).data ?? (response as any).items;
      if (Array.isArray(data)) {
        return data as TenantNotification[];
      }
    }
    return this.getNotificationsSnapshot();
  }

  private unwrapMessage(response: Message | { data?: Message } | null | undefined): Message | null {
    if (!response) {
      return null;
    }
    if (response && typeof response === 'object' && 'data' in response) {
      return (response as { data?: Message }).data ?? null;
    }
    return response as Message;
  }

  private extractSummary(
    response: { unreadNotifications: number; unreadMessages: number } | { data?: { unreadNotifications: number; unreadMessages: number } },
    fallback: { unreadNotifications: number; unreadMessages: number }
  ): { unreadNotifications: number; unreadMessages: number } {
    if (!response || typeof response !== 'object') {
      return fallback;
    }
    if ('data' in response && response.data) {
      return response.data;
    }
    if ('unreadNotifications' in response && 'unreadMessages' in response) {
      return response as { unreadNotifications: number; unreadMessages: number };
    }
    return fallback;
  }

  private computeNotificationSummary(): { unreadNotifications: number; unreadMessages: number } {
    const unreadNotifications = this.notificationsCache.filter(notification => !notification.read).length;
    const unreadMessages = this.conversationsCache.reduce((total, conversation) => total + (conversation.unreadCount ?? 0), 0);
    return { unreadNotifications, unreadMessages };
  }

  private normalizeDateString(value: string | Date | undefined | null): string | undefined {
    if (!value) {
      return undefined;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    return date.toISOString();
  }

  private generateConversationTitle(participants: ConversationParticipant[]): string {
    if (!participants.length) {
      return 'Conversation';
    }
    const others = participants.filter(participant => participant.role !== 'tenant');
    if (others.length === 0) {
      return participants[0].name;
    }
    return others.map(participant => participant.name).join(', ');
  }

  private shouldFallback(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return true;
    }
    if (error.status === 0 || error.status >= 500) {
      return true;
    }
    return false;
  }

  private logFallback(context: string, error: unknown): void {
    console.warn(`[CommunicationService] Falling back to local data for ${context}`, error);
  }

  private startConversationPolling(intervalMs: number): void {
    if (this.conversationPollingSubscription) {
      return;
    }
    this.conversationPollingSubscription = timer(0, intervalMs)
      .pipe(
        switchMap(() =>
          this.getTenantConversations().pipe(
            catchError(error => {
              if (!this.shouldFallback(error)) {
                return throwError(() => error);
              }
              this.logFallback('poll conversations', error);
              return of(this.getConversationsSnapshot());
            })
          )
        )
      )
      .subscribe(conversations => {
        this.conversationsSubject.next(this.cloneConversations(conversations));
      });
  }

  private stopConversationPolling(): void {
    if (this.conversationPollingSubscription) {
      this.conversationPollingSubscription.unsubscribe();
      this.conversationPollingSubscription = null;
    }
  }

  private startSummaryPolling(intervalMs: number): void {
    if (this.summaryPollingSubscription) {
      return;
    }
    this.summaryPollingSubscription = timer(0, intervalMs)
      .pipe(
        switchMap(() =>
          this.getNotificationSummary().pipe(
            catchError(error => {
              if (!this.shouldFallback(error)) {
                return throwError(() => error);
              }
              this.logFallback('poll notification summary', error);
              return of(this.computeNotificationSummary());
            })
          )
        )
      )
      .subscribe(summary => {
        this.summarySubject.next(summary);
      });
  }

  private stopSummaryPolling(): void {
    if (this.summaryPollingSubscription) {
      this.summaryPollingSubscription.unsubscribe();
      this.summaryPollingSubscription = null;
    }
  }
}
