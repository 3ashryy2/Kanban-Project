import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthStoreService } from '../../../core/store/auth-store.service';
import { MessageService } from 'primeng/api';

// PrimeNG Standalone Components (v22+)
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Card,
    InputText,
    Password,
    Button
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private readonly authStore = inject(AuthStoreService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  isRegisterMode = false;
  loading = false;

  credentials = {
    email: '',
    password: ''
  };

  signupDetails = {
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  };

  toggleMode(): void {
    this.isRegisterMode = !this.isRegisterMode;
  }

  onSubmit(): void {
    if (!this.credentials.email || !this.credentials.password) return;

    this.loading = true;
    this.authStore.login(this.credentials).subscribe({
      next: () => {
        this.loading = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Authenticated',
          detail: 'Session opened successfully. Welcome back!',
          life: 2000
        });
        setTimeout(() => this.navigateAfterSignIn(), 1000);
      },
      error: err => {
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Authentication Failed',
          detail: err.error?.message || 'Invalid corporate credentials.',
          life: 4000
        });
      }
    });
  }

  onRegister(): void {
    if (!this.signupDetails.firstName || !this.signupDetails.lastName || !this.signupDetails.email || !this.signupDetails.password) return;

    this.loading = true;
    this.authStore.register(this.signupDetails).subscribe({
      next: () => {
        this.loading = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Account Registered',
          detail: 'Corporate account provisioned successfully. Logging in...',
          life: 2000
        });
        setTimeout(() => this.router.navigate(['/']), 1000);
      },
      error: err => {
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Registration Failed',
          detail: err.error?.message || 'Could not provision account.',
          life: 4000
        });
      }
    });
  }

  // Return to the page an expired session was on; only in-app paths are honoured
  private navigateAfterSignIn(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
    const isInAppPath = returnUrl.startsWith('/') && !returnUrl.startsWith('//');
    this.router.navigateByUrl(isInAppPath ? returnUrl : '/');
  }
}
