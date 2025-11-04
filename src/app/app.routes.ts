import { Routes } from '@angular/router';
import { HomeComponent } from '../pages/home/home';
import { RegistrationComponent } from './components/auth/registration/registration.component';
import { LoginComponent } from './components/auth/login/login.component';
import { VerifyOtpComponent } from './components/auth/verify-otp/verify-otp.component';
import { ForgotPasswordComponent } from './components/auth/forgot-password/forgot-password';
import { PricingComponent } from '../pages/pricing/pricing';
import { ContactComponent } from '../pages/contacts/contacts';
import { TermsComponent } from '../pages/terms/terms';
import { PrivacyComponent } from '../pages/privacy/privacy';
import { AboutComponent } from '../pages/about/about';
import { TenantDashboardComponent } from './components/dashboard/tenant/tenant-dashboard/tenant-dashboard.component';
import { DepositComponent } from './components/dashboard/tenant/deposit/deposit.component';
import { PaymentsComponent } from './components/dashboard/tenant/payments/payments.component';
import { MaintenanceComponent } from './components/dashboard/tenant/maintenance/maintenance.component';
import { DocumentsComponent } from './components/dashboard/tenant/documents/documents.component';
import { MessagesComponent } from './components/dashboard/tenant/messages/messages.component';
import { ReviewComponent } from './components/dashboard/tenant/review/review.component';
import { SettingsComponent } from './components/dashboard/tenant/settings/settings.component';

import { FinancialsComponent } from './components/dashboard/landlord/landlord-dashboard/financials/financials';
import { InvoicesComponent } from './components/dashboard/landlord/landlord-dashboard/financials/invoices/invoices';
import { PaymentComponent } from './components/dashboard/landlord/landlord-dashboard/financials/payment/payment';
import { PropertyCreateComponent } from './components/dashboard/landlord/landlord-dashboard/property/property-create/property-create.component';
import { PropertyListComponent } from './components/dashboard/landlord/landlord-dashboard/property/property-list/property-list.component';
import { PropertyUnitsComponent } from './components/dashboard/landlord/landlord-dashboard/property/property-units/property-units.component';
import { LandlordDashboardHomeComponent } from './components/dashboard/landlord/landlord-dashboard/home/landlord-dashboard-home.component';
import { ProfileViewComponent } from './shared/components/profile-view/profile-view.component';
import { ProfileEditComponent } from './shared/components/profile-edit/profile-edit.component';
import { LandlordProfileEditComponent } from './components/dashboard/landlord/landlord-dashboard/profile/landlord-profile-edit/landlord-profile-edit.component';
import { ResetPasswordOtpComponent } from './components/auth/otp-verificationreset-password/otp-verificationreset-password.component';
import { ResetPasswordComponent } from './components/auth/reset-password/reset-password.component';
import { resetPasswordGuard } from './guards/reset-password.guard';
import { authGuard } from './guards/auth.guard';
import { AdminDashboardComponent } from './components/dashboard/admin/admin-dashboard/admin-dashboard.component';
import { CaretakerDashboardComponent } from './components/dashboard/caretaker/caretaker-dashboard.component';
import { CaretakerOverviewComponent } from './components/dashboard/caretaker/components/caretaker-overview/caretaker-overview.component';
import { BusinessDashboardComponent } from './components/dashboard/bussiness/business-dashboard.component';
import { AllUnitsComponent } from './components/dashboard/caretaker/components/properties/all-units/all-units.component';
import { PropertyDetailsComponent } from './components/dashboard/caretaker/components/properties/property-details/property-details.component';
import { PropertyUnitsComponent as CaretakerPropertyUnitsComponent } from './components/dashboard/caretaker/components/properties/property-units/property-units.component';
import { PropertiesListComponent } from './components/dashboard/caretaker/components/properties/properties-list/properties-list.component';
import { LandlordProfileViewComponent } from './components/dashboard/landlord/landlord-dashboard/profile/landlord-profile-view/landlord-profile-view.component';
import { LandlordTenantsComponent } from './components/dashboard/landlord/landlord-dashboard/tenants/tenants.component';
import { LandlordMaintenanceComponent } from './components/dashboard/landlord/landlord-dashboard/maintenance/maintenance.component';
import { LandlordMessagesComponent } from './components/dashboard/landlord/landlord-dashboard/messages/messages.component';
import { LandlordMarketplaceComponent } from './components/dashboard/landlord/landlord-dashboard/marketplace/marketplace';

import { ApprovedAdvertisementsComponent } from './components/dashboard/bussiness/components/approved-advertisements/approved-advertisements.component';
import { CreateAdvertisementComponent } from './components/dashboard/bussiness/components/create-advertisement/create-advertisement.component';
import { MyAdvertisementsComponent } from './components/dashboard/bussiness/components/my-advertisements/my-advertisements.component';
import { BusinessOverviewComponent } from './components/dashboard/bussiness/components/business-overview/business-overview.component';
import { AdminOverviewComponent } from './components/dashboard/admin/admin-dashboard/components/admin-overview/admin-overview.component';
import { AcceptInvitationComponent } from './components/dashboard/landlord/landlord-dashboard/invite-dialog/accept-invitation/accept-invitation.component';
import { WaitingLandlordComponent } from './components/auth/waiting-landlord/waiting-landlord.component';
import { ChatComponent } from './shared/chat/chat.component';
import { AdminLoginComponent } from './components/auth/admin-login/admin-login.component';
import { BusinessManagementComponent } from './components/dashboard/admin/admin-dashboard/components/business-management/business-management.component';
import { AdvertisementManagementComponent } from './components/dashboard/admin/admin-dashboard/components/advertisement-management/advertisement-management.component';
import { ExternalBusinessManagementComponent } from './components/dashboard/admin/admin-dashboard/components/external-business-management/external-business-management.component';
import { MoveOutNoticeListComponent } from './components/dashboard/tenant/move-out-notice-list/move-out-notice-list.component';
import { LandlordMoveOutNoticeListComponent } from './components/dashboard/landlord/landlord-dashboard/landlord-move-out-notice-list/landlord-move-out-notice-list.component';
import { MoveOutActionDialogComponent } from './components/dashboard/landlord/landlord-dashboard/move-out-action-dialog/move-out-action-dialog.component';
import { LandlordDashboardComponent } from './components/dashboard/landlord/landlord-dashboard/landlord-dashboard.component';


export const routes: Routes = [
 
  { path: '', component: HomeComponent, pathMatch: 'full' },
  { path: 'registration', component: RegistrationComponent },
  { path: 'login', component: LoginComponent },
  { path: 'admin/login', component: AdminLoginComponent },
  { path: 'otp-verificationreset-password', component: ResetPasswordOtpComponent },
  { path: 'verify-otp', component: VerifyOtpComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent, canActivate: [resetPasswordGuard] },
  { path: 'pricing', component: PricingComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'about', component: AboutComponent },
  { path: 'terms', component: TermsComponent },
  { path: 'privacy', component: PrivacyComponent },
  // { path: 'accept-invitation/:token', component: AcceptInvitationComponent },
  { path: 'accept-invitation', component: AcceptInvitationComponent },
  { path: 'waiting-landlord', component: WaitingLandlordComponent },
  

  { path: 'business/register', component: BusinessDashboardComponent },
  { path: 'business/registration-status', component: BusinessDashboardComponent },
  

  { 
    path: 'chat', 
    component: ChatComponent,
    canActivate: [authGuard]
  },
  { 
    path: 'chat/:roomId', 
    component: ChatComponent,
    canActivate: [authGuard]
  },
  

  {
    path: 'tenant-dashboard',
    component: TenantDashboardComponent,
     canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: TenantDashboardComponent },
      { path: 'deposit', component: DepositComponent },
      { path: 'payments', component: PaymentsComponent },
      { path: 'maintenance', component: MaintenanceComponent },
      { path: 'documents', component: DocumentsComponent },
      { path: 'messages', component: MessagesComponent },
      { path: 'chat', component: ChatComponent },
      { path: 'reviews', component: ReviewComponent },
      { path: 'settings', component: SettingsComponent },
      { path: 'move-out-notices', component: MoveOutNoticeListComponent },
      { 
        path: 'profile',
        children: [
          { path: 'view', component: ProfileViewComponent },
          { path: 'edit', component: ProfileEditComponent },
          { path: '', redirectTo: 'view', pathMatch: 'full' }
        ]
      }
    ]
  },
  
  
  {
    path: 'landlord-dashboard',
    component: LandlordDashboardComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: LandlordDashboardHomeComponent },
      { path: 'profile', redirectTo: 'profile/view', pathMatch: 'full' },
      { path: 'profile/view', component: LandlordProfileViewComponent },
      { path: 'profile/edit', component: LandlordProfileEditComponent },
      { path: 'property', redirectTo: 'property/list', pathMatch: 'full' },
      { path: 'property/create', component: PropertyCreateComponent },
      { path: 'property/list', component: PropertyListComponent },
      { path: 'property/:id', redirectTo: 'property/:id/units' },
      { path: 'property/:id/units', component: PropertyUnitsComponent },
      { path: 'property/:propertyId/unit/create', component: PropertyCreateComponent },
      { path: 'financials', component: FinancialsComponent },
      { path: 'financials/invoices', component: InvoicesComponent },
      { path: 'financials/payments', component: PaymentComponent },
      { path: 'maintenance', component: LandlordMaintenanceComponent },
      { path: 'tenants', component: LandlordTenantsComponent },
      { path: 'messages', component: LandlordMessagesComponent },
      { path: 'chat', component: ChatComponent },
      { path: 'marketplace', component: LandlordMarketplaceComponent },
      { path: 'move-out-notices', component: LandlordMoveOutNoticeListComponent },
      { path: 'move-out-action/:id', component: MoveOutActionDialogComponent },
      { path: 'dashboard', redirectTo: 'home', pathMatch: 'full' }
    ]
  },
  
 
  {
    path: 'business-dashboard',
    component: BusinessDashboardComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: BusinessOverviewComponent },
      { path: 'ads', component: MyAdvertisementsComponent },
      { path: 'ads/create', component: CreateAdvertisementComponent },
      { path: 'ads/approved', component: ApprovedAdvertisementsComponent },
      { path: 'analytics', component: BusinessOverviewComponent },
      { path: 'billing', component: BusinessOverviewComponent },
      { path: 'documents', component: BusinessOverviewComponent },
      { path: 'messages', component: BusinessOverviewComponent },
      { path: 'jobs', component: BusinessDashboardComponent },
      { path: 'earnings', component: BusinessDashboardComponent },
      { path: 'reviews', component: BusinessDashboardComponent },
      { path: 'services', component: BusinessDashboardComponent },
      { path: 'chat', component: ChatComponent },
      { 
        path: 'profile',
        children: [
          { path: 'view', component: ProfileViewComponent },
          { path: 'edit', component: ProfileEditComponent },
          { path: '', redirectTo: 'view', pathMatch: 'full' }
        ]
      }
    ]
  },
  
 
  {
    path: 'caretaker-dashboard',
    component: CaretakerDashboardComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', component: CaretakerOverviewComponent },
      { path: 'maintenance', component: CaretakerOverviewComponent },
      { path: 'inspections', component: CaretakerOverviewComponent },
      { path: 'deposits', component: CaretakerOverviewComponent },
      { path: 'reports', component: CaretakerOverviewComponent },
      { 
        path: 'properties',
        children: [
          { path: '', component: PropertiesListComponent },
          { path: 'all-units', component: AllUnitsComponent },
          { path: ':id', component: PropertyDetailsComponent },
          { path: ':id/units', component: CaretakerPropertyUnitsComponent },
        ]
      },
      { path: 'messages', component: CaretakerOverviewComponent },
      { path: 'chat', component: ChatComponent },
      { 
        path: 'profile',
        children: [
          { path: 'view', component: ProfileViewComponent },
          { path: 'edit', component: ProfileEditComponent },
          { path: '', redirectTo: 'view', pathMatch: 'full' }
        ]
      }
    ]
  },
  

  {
    path: 'admin-dashboard',
    component: AdminDashboardComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', component: AdminOverviewComponent },
      { path: 'businesses', component: BusinessManagementComponent },
      { path: 'advertisements', component: AdvertisementManagementComponent },
      { path: 'external-businesses', component: ExternalBusinessManagementComponent },
      { path: 'users', component: AdminDashboardComponent },
      { path: 'disputes', component: AdminDashboardComponent },
      { path: 'transactions', component: AdminDashboardComponent },
      { path: 'reports', component: AdminDashboardComponent },
      { path: 'settings', component: AdminDashboardComponent },
      { path: 'chat', component: ChatComponent },
      { 
        path: 'profile',
        children: [
          { path: 'view', component: ProfileViewComponent },
          { path: 'edit', component: ProfileEditComponent },
          { path: '', redirectTo: 'view', pathMatch: 'full' }
        ]
      }
    ]
  },
  
  { path: 'landlord', redirectTo: '/landlord-dashboard' },
  { path: 'tenant', redirectTo: '/tenant-dashboard' },
  { path: 'business', redirectTo: '/business-dashboard' },
  { path: 'caretaker', redirectTo: '/caretaker-dashboard' },
  { path: 'admin', redirectTo: '/admin-dashboard' },
  { path: 'dashboard', redirectTo: '/tenant-dashboard', pathMatch: 'full' },
  
  { path: '**', redirectTo: '' }
];