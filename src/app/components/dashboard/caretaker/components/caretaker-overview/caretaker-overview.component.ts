import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { CaretakerService } from '../../../../../services/caretaker.service';

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  action: () => void;
}

export interface Stats {
  pendingMaintenance: number;
  scheduledInspections: number;
  activeDepositCases: number;
  completedJobs: number;
  responseRate: number;
  tenantSatisfaction: number;
}

export interface MaintenanceRequest {
  id: string;
  title: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  status: 'submitted' | 'in-progress' | 'completed' | 'cancelled';
  dateSubmitted: string;
  tenantName: string;
  property: string;
}

export interface Inspection {
  id: string;
  type: 'move-in' | 'move-out' | 'routine';
  property: string;
  tenantName: string;
  date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  depositAmount: number;
}

@Component({
  selector: 'app-caretaker-overview',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatCardModule, MatButtonModule],
  templateUrl: './caretaker-overview.component.html',
  styleUrls: ['./caretaker-overview.component.scss']
})
export class CaretakerOverviewComponent implements OnInit {
  stats: Stats = {
    pendingMaintenance: 0,
    scheduledInspections: 0,
    activeDepositCases: 0,
    completedJobs: 0,
    responseRate: 92,
    tenantSatisfaction: 4.5
  };

  maintenanceRequests: MaintenanceRequest[] = [
    { 
      id: '1', 
      title: 'Kitchen faucet leaking', 
      category: 'Plumbing', 
      priority: 'medium', 
      description: 'Kitchen sink faucet has constant drip', 
      status: 'submitted', 
      dateSubmitted: '2024-03-01', 
      tenantName: 'John Doe', 
      property: 'Apartment 4B' 
    },
    { 
      id: '2', 
      title: 'Broken window lock', 
      category: 'General Repairs', 
      priority: 'low', 
      description: 'Bedroom window lock not closing properly', 
      status: 'in-progress', 
      dateSubmitted: '2024-02-28', 
      tenantName: 'Sarah Smith', 
      property: 'House 12' 
    },
    { 
      id: '3', 
      title: 'AC not cooling', 
      category: 'HVAC', 
      priority: 'high', 
      description: 'Air conditioning not cooling living room', 
      status: 'submitted', 
      dateSubmitted: '2024-03-02', 
      tenantName: 'Mike Johnson', 
      property: 'Apartment 7C' 
    }
  ];

  inspections: Inspection[] = [
    { 
      id: '1', 
      type: 'move-out', 
      property: 'Apartment 3A', 
      tenantName: 'David Wilson', 
      date: '2024-03-05', 
      status: 'scheduled', 
      depositAmount: 50000 
    },
    { 
      id: '2', 
      type: 'move-in', 
      property: 'House 15', 
      tenantName: 'Emma Davis', 
      date: '2024-03-06', 
      status: 'scheduled', 
      depositAmount: 75000 
    },
    { 
      id: '3', 
      type: 'routine', 
      property: 'Apartment 2B', 
      tenantName: 'James Miller', 
      date: '2024-03-10', 
      status: 'scheduled', 
      depositAmount: 0 
    }
  ];
  
  quickActions: QuickAction[] = [
    { 
      id: 'newMaintenance', 
      title: 'New Maintenance', 
      description: 'Create maintenance request', 
      icon: 'build', 
      color: '#007bff', 
      action: () => this.createMaintenance() 
    },
    { 
      id: 'scheduleInspection', 
      title: 'Schedule Inspection', 
      description: 'Schedule property inspection', 
      icon: 'calendar_today', 
      color: '#28a745', 
      action: () => this.scheduleInspection() 
    },
    { 
      id: 'processDeposit', 
      title: 'Process Deposit', 
      description: 'Handle deposit release', 
      icon: 'account_balance', 
      color: '#ffc107', 
      action: () => this.processDeposit() 
    },
    { 
      id: 'contactTenant', 
      title: 'Contact Tenant', 
      description: 'Message tenant', 
      icon: 'message', 
      color: '#17a2b8', 
      action: () => this.contactTenant() 
    }
  ];

  constructor(private caretakerService: CaretakerService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.updateStats();
  }

  updateStats(): void {
    this.stats.pendingMaintenance = this.maintenanceRequests.filter(r => 
      r.status === 'submitted' || r.status === 'in-progress'
    ).length;
    this.stats.completedJobs = this.maintenanceRequests.filter(r => r.status === 'completed').length;
    this.stats.scheduledInspections = this.inspections.filter(i => i.status === 'scheduled').length;
    this.stats.activeDepositCases = this.inspections.filter(i => i.depositAmount > 0).length;
  }

  createMaintenance(): void {
    console.log('Creating new maintenance request...');
  }

  scheduleInspection(): void {
    console.log('Scheduling inspection...');
  }

  processDeposit(): void {
    console.log('Processing deposit...');
  }

  contactTenant(): void {
    console.log('Contacting tenant...');
  }

  formatNumber(num: number): string {
    return num.toLocaleString('en-KE');
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getPriorityClass(priority: string): string {
    const priorityMap: any = {
      'low': 'priority-low',
      'medium': 'priority-medium',
      'high': 'priority-high',
      'urgent': 'priority-urgent'
    };
    return priorityMap[priority] || 'priority-medium';
  }

  getStatusClass(status: string): string {
    const statusMap: any = {
      'submitted': 'status-pending',
      'in-progress': 'status-progress',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled'
    };
    return statusMap[status] || 'status-pending';
  }

  getInspectionTypeClass(type: string): string {
    const typeMap: any = {
      'move-in': 'type-move-in',
      'move-out': 'type-move-out',
      'routine': 'type-routine'
    };
    return typeMap[type] || 'type-routine';
  }
}