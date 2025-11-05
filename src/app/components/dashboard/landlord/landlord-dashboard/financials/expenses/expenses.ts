import { Component, Input } from '@angular/core';

export interface Expense {
  id: number;
  property: string;
  expenseType: string;
  amount: number;
  date: string;
  status: 'Paid' | 'Unpaid';
}

@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.html',
  standalone: true
})
export class ExpensesComponent {
  @Input() expenses: Expense[] = [];
}
