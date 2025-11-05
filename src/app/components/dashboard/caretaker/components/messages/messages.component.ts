import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatBadgeModule } from '@angular/material/badge';

export interface Message {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatCardModule, MatBadgeModule],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.scss']
})
export class MessagesComponent implements OnInit {
  messages: Message[] = [
    {
      id: '1',
      sender: 'John Doe',
      recipient: 'Caretaker',
      subject: 'Maintenance Request Update',
      content: 'Hello, just wanted to follow up on the kitchen faucet repair. When can we expect it to be completed?',
      timestamp: '2024-03-02T10:30:00',
      isRead: false,
      priority: 'medium'
    },
    {
      id: '2',
      sender: 'Property Manager',
      recipient: 'Caretaker',
      subject: 'Monthly Inspection Schedule',
      content: 'Please find attached the monthly inspection schedule for all properties under your care.',
      timestamp: '2024-03-02T09:15:00',
      isRead: true,
      priority: 'low'
    },
    {
      id: '3',
      sender: 'Sarah Smith',
      recipient: 'Caretaker',
      subject: 'URGENT: Electrical Issue',
      content: 'There is a burning smell coming from the electrical panel in the hallway. Need immediate assistance!',
      timestamp: '2024-03-02T08:45:00',
      isRead: false,
      priority: 'high'
    },
    {
      id: '4',
      sender: 'Mike Johnson',
      recipient: 'Caretaker',
      subject: 'Move-out Inspection Confirmation',
      content: 'Confirming our move-out inspection scheduled for next Monday at 10 AM.',
      timestamp: '2024-03-01T16:20:00',
      isRead: true,
      priority: 'medium'
    }
  ];

  selectedMessage: Message | null = null;
  unreadCount: number = 0;

  ngOnInit(): void {
    this.updateUnreadCount();
  }

  selectMessage(message: Message): void {
    this.selectedMessage = message;
    if (!message.isRead) {
      message.isRead = true;
      this.updateUnreadCount();
    }
  }

  updateUnreadCount(): void {
    this.unreadCount = this.messages.filter(msg => !msg.isRead).length;
  }

  getPriorityClass(priority: string): string {
    const priorityMap: any = {
      'low': 'priority-low',
      'medium': 'priority-medium',
      'high': 'priority-high'
    };
    return priorityMap[priority] || 'priority-medium';
  }

  formatDate(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  deleteMessage(message: Message): void {
    const index = this.messages.findIndex(msg => msg.id === message.id);
    if (index !== -1) {
      this.messages.splice(index, 1);
      if (this.selectedMessage?.id === message.id) {
        this.selectedMessage = null;
      }
      this.updateUnreadCount();
    }
  }

  markAsUnread(message: Message): void {
    message.isRead = false;
    this.updateUnreadCount();
  }

  replyToMessage(): void {
    if (this.selectedMessage) {
      alert(`Replying to: ${this.selectedMessage.sender}`);
    }
  }
}