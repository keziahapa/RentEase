import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

export interface WorkSummary {
  completedJobsThisWeek: number;
  pendingRequests: number;
  upcomingInspections: number;
  averageResponseTime: string;
}

export interface RecentJob {
  id: string;
  type: string;
  property: string;
  description: string;
  date: string;
  status: 'completed' | 'in-progress' | 'pending';
  priority: 'low' | 'medium' | 'high';
}

export interface WeeklySchedule {
  day: string;
  tasks: string[];
  completed: boolean;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatCardModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit {
  workSummary: WorkSummary = {
    completedJobsThisWeek: 8,
    pendingRequests: 3,
    upcomingInspections: 2,
    averageResponseTime: '4.2h'
  };

  recentJobs: RecentJob[] = [
    {
      id: '1',
      type: 'Plumbing',
      property: 'Apartment 4B',
      description: 'Fixed leaking kitchen faucet',
      date: '2024-03-05',
      status: 'completed',
      priority: 'medium'
    },
    {
      id: '2',
      type: 'Electrical',
      property: 'Unit 2A',
      description: 'Replaced broken light switch',
      date: '2024-03-04',
      status: 'completed',
      priority: 'low'
    },
    {
      id: '3',
      type: 'General Repairs',
      property: 'Suite 5C',
      description: 'Repair broken window lock',
      date: '2024-03-06',
      status: 'in-progress',
      priority: 'medium'
    },
    {
      id: '4',
      type: 'HVAC',
      property: 'House 12',
      description: 'AC maintenance check',
      date: '2024-03-07',
      status: 'pending',
      priority: 'low'
    },
    {
      id: '5',
      type: 'Plumbing',
      property: 'Apartment 3B',
      description: 'Unclog bathroom drain',
      date: '2024-03-03',
      status: 'completed',
      priority: 'high'
    }
  ];

  weeklySchedule: WeeklySchedule[] = [
    {
      day: 'Monday',
      tasks: ['Property inspection - Block A', 'Maintenance inventory check'],
      completed: true
    },
    {
      day: 'Tuesday',
      tasks: ['Follow-up on pending repairs', 'Garden maintenance'],
      completed: true
    },
    {
      day: 'Wednesday',
      tasks: ['Routine safety checks', 'Meet with property manager'],
      completed: false
    },
    {
      day: 'Thursday',
      tasks: ['Deep cleaning common areas', 'Supply restocking'],
      completed: false
    },
    {
      day: 'Friday',
      tasks: ['Weekly report preparation', 'Equipment maintenance'],
      completed: false
    }
  ];

  supplyNeeds: string[] = [
    'Light bulbs (10 units)',
    'Plumbing tape',
    'Cleaning supplies',
    'Paint for touch-ups',
    'Door handles (set of 4)'
  ];

  constructor() {}

  ngOnInit(): void {}

  getStatusClass(status: string): string {
    const statusMap: any = {
      'completed': 'status-completed',
      'in-progress': 'status-progress',
      'pending': 'status-pending'
    };
    return statusMap[status] || 'status-pending';
  }

  getPriorityClass(priority: string): string {
    const priorityMap: any = {
      'low': 'priority-low',
      'medium': 'priority-medium',
      'high': 'priority-high'
    };
    return priorityMap[priority] || 'priority-medium';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  markDayComplete(day: WeeklySchedule): void {
    day.completed = !day.completed;
  }

  addSupplyItem(): void {
    const newItem = prompt('Enter new supply item:');
    if (newItem) {
      this.supplyNeeds.push(newItem);
    }
  }

  removeSupplyItem(index: number): void {
    this.supplyNeeds.splice(index, 1);
  }

 
  printWorkSummary(): void {
    window.print();
  }

  requestSupplies(): void {
    alert('Supply request feature coming soon!');
  }

  contactSupervisor(): void {
    alert('Opening contact form...');
  }
}