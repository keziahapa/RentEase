
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
  @Input() height: string = 'auto'; 

  get placeholders(): number[] {
    return Array.from({ length: this.count }).map((_, index) => index);
  }

  asVariant(value: SkeletonVariant): SkeletonVariant {
    return value;
  }

  // Helper method to get dynamic styles based on height input
  getSkeletonStyles(): { [key: string]: string } {
    const styles: { [key: string]: string } = {};
    
    if (this.height && this.height !== 'auto') {
      if (this.variant === 'table') {
        styles['min-height'] = this.height;
      } else {
        styles['height'] = this.height;
      }
    }
    
    return styles;
  }
}