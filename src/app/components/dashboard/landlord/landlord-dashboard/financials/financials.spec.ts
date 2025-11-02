import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FinancialsComponent } from './financials';

describe('Financials', () => {
  let component: FinancialsComponent;
  let fixture: ComponentFixture<FinancialsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinancialsComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FinancialsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
