import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type SkeletonVariant = 'card' | 'table' | 'stat' | 'quick' | 'list';

@Component({
  selector: 'app-skeleton-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skeleton-list.component.html',
  styleUrls: ['./skeleton-list.component.scss']
})
export class SkeletonListComponent {
  @Input() count = 3;
  @Input() variant: SkeletonVariant = 'card';
  @Input() lines = 3;

  get placeholders(): number[] {
    return Array.from({ length: this.count }).map((_, index) => index);
  }

  asVariant(value: SkeletonVariant): SkeletonVariant {
    return value;
  }
}
