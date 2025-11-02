import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import {
  CommunicationService,
  Conversation,
  Message
} from '../../../../../services/communication.service';
import { SkeletonListComponent } from '../../../../../shared/components/skeleton/skeleton-list.component';

@Component({
  selector: 'app-landlord-messages',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatInputModule,
    MatFormFieldModule,
    SkeletonListComponent
  ],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.scss']
})
export class LandlordMessagesComponent implements OnInit, OnDestroy {
  @ViewChild('threadRef') threadRef!: ElementRef<HTMLDivElement>;

  private readonly subscriptions = new Subscription();

  conversations: Conversation[] = [];
  filteredConversations: Conversation[] = [];
  selectedConversation: Conversation | null = null;

  isLoading = false;
  isSending = false;
  errorMessage: string | null = null;

  searchControl = new FormControl<string>('', { nonNullable: true });
  messageControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(1)]
  });

  constructor(
    private readonly communicationService: CommunicationService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.searchControl.valueChanges.pipe(debounceTime(150)).subscribe(() => this.applyFilter())
    );

    this.subscriptions.add(
      this.communicationService.watchLandlordConversations().subscribe(conversations => {
        this.conversations = conversations;
        this.applyFilter();
        if (!this.selectedConversation && this.filteredConversations.length) {
          this.selectConversation(this.filteredConversations[0]);
        } else if (
          this.selectedConversation &&
          !this.filteredConversations.find(item => item.id === this.selectedConversation?.id)
        ) {
          this.selectConversation(this.filteredConversations[0] ?? null);
        }
      })
    );

    this.loadConversations();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadConversations(): void {
    this.isLoading = true;
    this.errorMessage = null;

    const loadSub = this.communicationService.getLandlordConversations().subscribe({
      next: conversations => {
        this.isLoading = false;
        this.conversations = conversations;
        this.applyFilter();
        if (!this.selectedConversation && this.filteredConversations.length) {
          this.selectConversation(this.filteredConversations[0]);
        }
      },
      error: error => {
        this.isLoading = false;
        this.errorMessage = error?.message || 'Unable to load conversations right now.';
        const message = this.errorMessage ?? 'Unable to load conversations right now.';
        this.snackBar.open(message, 'Close', { duration: 4000 });
      }
    });

    this.subscriptions.add(loadSub);
  }

  applyFilter(): void {
    const term = this.searchControl.value.trim().toLowerCase();
    this.filteredConversations = this.conversations.filter(conversation => {
      if (!term) {
        return true;
      }
      const participants = conversation.participants.map(participant => participant.name.toLowerCase());
      return (
        conversation.title.toLowerCase().includes(term) ||
        participants.some(name => name.includes(term)) ||
        conversation.lastMessagePreview?.toLowerCase().includes(term)
      );
    });
  }

  selectConversation(conversation: Conversation | null): void {
    this.selectedConversation = conversation;
    if (conversation) {
      this.communicationService.markConversationRead(conversation.id).subscribe();
      setTimeout(() => this.scrollMessagesToBottom());
    }
  }

  sendMessage(): void {
    if (!this.selectedConversation || this.messageControl.invalid) {
      this.messageControl.markAsTouched();
      return;
    }

    const content = (this.messageControl.value ?? '').trim();
    if (!content) {
      return;
    }

    this.isSending = true;
    this.communicationService.sendLandlordMessage(this.selectedConversation.id, content).subscribe({
      next: (message: Message) => {
        this.isSending = false;
        this.messageControl.reset('');
        this.appendMessage(message);
        this.scrollMessagesToBottom();
      },
      error: error => {
        this.isSending = false;
        const message = error?.message || 'Failed to send message. Try again.';
        this.snackBar.open(message, 'Close', { duration: 4000 });
      }
    });
  }

  trackByConversationId(_index: number, conversation: Conversation): string {
    return conversation.id;
  }

  trackByMessageId(_index: number, message: Message): string {
    return message.id;
  }

  private appendMessage(message: Message): void {
    if (!this.selectedConversation) {
      return;
    }

    const updatedConversation: Conversation = {
      ...this.selectedConversation,
      messages: [...(this.selectedConversation.messages ?? []), message],
      lastMessagePreview: message.content,
      lastUpdated: message.timestamp
    };

    this.selectedConversation = updatedConversation;
    this.conversations = this.conversations.map(conversation =>
      conversation.id === updatedConversation.id ? updatedConversation : conversation
    );
    this.applyFilter();
  }

  private scrollMessagesToBottom(): void {
    setTimeout(() => {
      if (this.threadRef?.nativeElement) {
        this.threadRef.nativeElement.scrollTop = this.threadRef.nativeElement.scrollHeight;
      }
    });
  }

  participantsLabel(conversation: Conversation | null): string {
    if (!conversation || !conversation.participants?.length) {
      return 'No participants listed';
    }
    return conversation.participants
      .map(participant => participant.name ?? 'Unknown participant')
      .join(', ');
  }
}
