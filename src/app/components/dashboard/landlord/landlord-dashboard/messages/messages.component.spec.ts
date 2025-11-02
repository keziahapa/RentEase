import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';

import { LandlordMessagesComponent } from './messages.component';
import {
  CommunicationService,
  Conversation,
  Message
} from '../../../../../services/communication.service';

class MockCommunicationService {
  private readonly conversationsSubject = new BehaviorSubject<Conversation[]>([]);

  watchLandlordConversations() {
    return this.conversationsSubject.asObservable();
  }

  getLandlordConversations() {
    return of(this.conversationsSubject.value);
  }

  markConversationRead() {
    return of(void 0);
  }

  sendLandlordMessage(_conversationId: string, content: string) {
    const message: Message = {
      id: `msg-${Date.now()}`,
      conversationId: 'conv-1',
      content,
      timestamp: new Date().toISOString(),
      sender: { name: 'You', role: 'landlord' },
      read: true
    };
    return of(message);
  }

  emit(conversations: Conversation[]): void {
    this.conversationsSubject.next(conversations);
  }
}

describe('LandlordMessagesComponent', () => {
  let component: LandlordMessagesComponent;
  let fixture: ComponentFixture<LandlordMessagesComponent>;
  let service: MockCommunicationService;

  const mockConversations: Conversation[] = [
    {
      id: 'conv-1',
      title: 'Tenant • Sarah',
      participants: [{ name: 'Sarah', role: 'tenant' }, { name: 'You', role: 'landlord' }],
      lastMessagePreview: 'Thanks for the quick response!',
      lastUpdated: '2024-02-22T10:00:00Z',
      unreadCount: 1,
      messages: []
    },
    {
      id: 'conv-2',
      title: 'Caretaker • James',
      participants: [{ name: 'James', role: 'caretaker' }, { name: 'You', role: 'landlord' }],
      lastMessagePreview: 'Inspection scheduled for tomorrow.',
      lastUpdated: '2024-02-21T15:30:00Z',
      unreadCount: 0,
      messages: []
    }
  ];

  beforeEach(async () => {
    service = new MockCommunicationService();

    await TestBed.configureTestingModule({
      imports: [LandlordMessagesComponent],
      providers: [{ provide: CommunicationService, useValue: service }]
    }).compileComponents();

    fixture = TestBed.createComponent(LandlordMessagesComponent);
    component = fixture.componentInstance;

    service.emit(mockConversations);
    fixture.detectChanges();
  });

  it('filters conversations by search term', () => {
    expect(component.filteredConversations.length).toBe(2);

    component.searchControl.setValue('Sarah');
    fixture.detectChanges();

    expect(component.filteredConversations.length).toBe(1);
    expect(component.filteredConversations[0].id).toBe('conv-1');
  });

  it('appends a message after sending', () => {
    component.selectConversation(mockConversations[0]);
    component.messageControl.setValue('Confirmed, thank you.');
    component.sendMessage();

    expect(component.selectedConversation?.messages.length).toBe(1);
    expect(component.selectedConversation?.messages[0].content).toContain('Confirmed');
  });
});

