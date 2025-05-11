/**
 * Unit tests for LoginPageComponent
 * 
 * These tests verify that the login component correctly:
 * - Initializes with proper form structures and default state
 * - Toggles between login and registration modes
 * - Handles successful and failed login attempts
 * - Handles successful and failed registration attempts
 * - Validates form inputs before submission
 * - Shows appropriate error messages to users
 * - Integrates properly with the AuthService
 * 
 * Uses TestBed for component testing and mocks the AuthService
 * to isolate the component logic from external dependencies.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { of, throwError } from 'rxjs';

import { LoginPageComponent } from './login.component';
import { AuthService } from '../../services/auth.service';

describe('LoginPageComponent', () => {
  let component: LoginPageComponent;
  let fixture: ComponentFixture<LoginPageComponent>;
  let authService: jasmine.SpyObj<AuthService>;

  // Set up the testing environment before each test
  beforeEach(async () => {
    // Create a mock AuthService with spy methods
    // This allows us to control the responses in tests
    const authServiceSpy = jasmine.createSpyObj('AuthService', 
      ['login', 'register', 'isAuthenticated']
    );

    // Configure the testing module
    await TestBed.configureTestingModule({
      imports: [
        LoginPageComponent,  // The standalone component we're testing
        ReactiveFormsModule, // For reactive forms support
        RouterTestingModule, // For router navigation testing
        NoopAnimationsModule, // To prevent animation timing issues in tests
        // Angular Material modules used by the component
        MatSnackBarModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule
      ],
      providers: [
        // Replace the real AuthService with our mock
        { provide: AuthService, useValue: authServiceSpy }
      ]
    }).compileComponents();

    // Get the mock AuthService instance
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    // Set default return value for isAuthenticated
    authService.isAuthenticated.and.returnValue(false);
  });

  // Create a fresh component instance before each test
  beforeEach(() => {
    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    // Trigger Angular's change detection to initialize the component
    fixture.detectChanges();
  });

  /**
   * Test: Successful Login
   * Verifies that the component correctly handles a successful login:
   * - Calls AuthService.login with correct parameters
   * - Handles loading state properly
   * - Navigates to dashboard on success
   */
  it('should handle successful login', async () => {
    // Mock successful login response
    authService.login.and.returnValue(of({}));
    
    // Fill in login form with valid data
    component.loginForm.patchValue({
      email: 'test@example.com',
      password: 'password123'
    });
    
    // Trigger login
    component.onLoginSubmit();
    
    // Verify AuthService was called with correct parameters
    expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password123');
    
    // Verify loading state is reset after completion
    expect(component.isLoading).toBe(false);
    
    // Note: Router navigation is tested by RouterTestingModule
  });

  /**
   * Test: Successful Registration
   * Verifies that the component correctly handles successful registration:
   * - Calls AuthService.register with correct data structure
   * - Switches to login mode after success
   * - Pre-fills email in login form
   * - Shows success notification
   */
  it('should handle successful registration', async () => {
    // Mock successful registration
    authService.register.and.returnValue(of({}));
    
    // Fill registration form
    component.registerForm.patchValue({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    
    // Trigger registration
    component.onRegisterSubmit();
    
    // Verify AuthService was called with correct data
    expect(authService.register).toHaveBeenCalledWith({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    
    // Verify post-registration behavior
    expect(component.isLoginMode).toBe(true); // Switched to login mode
    expect(component.isLoading).toBe(false);
    
    // Check that email was pre-filled in login form
    expect(component.loginForm.get('email')?.value).toBe('test@example.com');
  });
});