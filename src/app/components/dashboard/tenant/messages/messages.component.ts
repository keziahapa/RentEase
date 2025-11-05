import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import {
  CommunicationService,
  Conversation,
  Message
} from '../../../../services/communication.service';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.scss']
})
export class MessagesComponent implements OnInit, OnDestroy {
  private communicationService = inject(CommunicationService);
  private subscriptions = new Subscription();
  private conversationsSubscription: Subscription | null = null;

  conversations: Conversation[] = [];
  selectedConversation: Conversation | null = null;
  draftMessage = '';
  isLoadingConversations = false;
  loadError: string | null = null;

  ngOnInit(): void {
    this.loadConversations();
  }

  ngOnDestroy(): void {
    this.conversationsSubscription?.unsubscribe();
    this.subscriptions.unsubscribe();
  }

  loadConversations(): void {
    this.isLoadingConversations = true;
    this.loadError = null;

    this.conversationsSubscription?.unsubscribe();

    const subscription = this.communicationService.watchTenantConversations().subscribe({
      next: conversations => {
        this.conversations = conversations;
        this.isLoadingConversations = false;
        this.loadError = null;

        if (this.selectedConversation) {
          const updated = conversations.find(conv => conv.id === this.selectedConversation?.id);
          if (updated) {
            this.selectedConversation = updated;
          } else if (conversations.length > 0) {
            this.selectConversation(conversations[0]);
          } else {
            this.selectedConversation = null;
          }
        } else if (conversations.length > 0) {
          this.selectConversation(conversations[0]);
        }
      },
      error: error => {
        this.loadError = error?.message || 'Unable to load messages.';
        this.isLoadingConversations = false;
        this.handleError(error, 'load conversations');
      }
    });

    this.conversationsSubscription = subscription;
    this.subscriptions.add(subscription);
  }

  selectConversation(conversation: Conversation): void {
    this.selectedConversation = conversation;
    if (conversation.unreadCount > 0) {
      const sub = this.communicationService.markConversationRead(conversation.id).subscribe({
        next: () => {
          conversation.unreadCount = 0;
          conversation.messages = conversation.messages.map(message => ({ ...message, read: true }));
        },
        error: error => {
          this.handleError(error, 'mark conversation read');
        }
      });
      this.subscriptions.add(sub);
    }
  }

  get conversationMessages(): Message[] {
    return this.selectedConversation?.messages ?? [];
  }

  sendMessage(): void {
    if (!this.selectedConversation || !this.draftMessage.trim()) {
      return;
    }

    const content = this.draftMessage.trim();
    this.draftMessage = '';

    const sub = this.communicationService.sendTenantMessage(this.selectedConversation.id, content).subscribe({
      next: message => {
        this.selectedConversation?.messages.push(message);
        if (this.selectedConversation) {
          this.selectedConversation.lastMessagePreview = content;
          this.selectedConversation.lastUpdated = message.timestamp;
        }
      },
      error: error => {
        this.handleError(error, 'send message');
      }
    });

    this.subscriptions.add(sub);
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('en-KE', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getInitials(displayName: string): string {
    return displayName
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }

  getParticipantNames(conversation: Conversation | null): string {
    if (!conversation?.participants?.length) {
      return 'You';
    }
    return conversation.participants.map(participant => participant.name).join(', ');
  }

  private handleError(error: unknown, context: string): void {
    console.error(`MessagesComponent error during ${context}:`, error);
  }
}
