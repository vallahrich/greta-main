// src/app/services/auth.service.spec.ts

/**
 * Unit tests for AuthService
 * 
 * These tests verify that the authentication service correctly:
 * - Handles login requests and stores auth data
 * - Manages logout functionality
 * - Handles registration requests
 * - Provides access to user information
 * - Manages authentication state
 * 
 * Tests use HttpClientTestingModule to mock HTTP requests
 */
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { environment } from '../environments/environment';

interface LoginResponse {
  userId?: number;
  name?: string;
  email: string;
  token?: string;  // Note: The actual service expects token in the response body
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const loginUrl = `${environment.apiUrl}/auth/login`;
  const registerUrl = `${environment.apiUrl}/auth/register`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);

    // Clear any leftover storage before each test
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  /**
   * Tests that the service can be instantiated
   */
  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  /**
   * Tests successful login flow:
   * 1. Makes login request
   * 2. Stores auth data from response body in localStorage
   * 3. Updates currentUserSubject
   * 
   * Note: Based on the actual AuthService implementation,
   * the token comes in the response body, not headers
   */
  it('should store header and body on successful login', (done) => {
    const dummyBody: LoginResponse = {
      userId: 1,
      name: 'John Doe',
      email: 'john.doe',
      token: 'Basic am9obi5kb2U6VmVyeVNlY3JldCE='  // Token should be in the response body
    };

    service.login('john.doe', 'VerySecret!').subscribe(body => {
      // Verify the observable yields the JSON body
      expect(body).toEqual(dummyBody);

      // Verify localStorage was set correctly based on how AuthService actually works
      expect(localStorage.getItem('authHeader')).toBe(dummyBody.token || '');
      expect(localStorage.getItem('isAuthenticated')).toBe('true');
      expect(localStorage.getItem('userEmail')).toBe('john.doe');
      expect(localStorage.getItem('userId')).toBe('1');
      // AuthService doesn't store userName separately - it's part of currentUser
      expect(localStorage.getItem('currentUser')).toBe(JSON.stringify(body));
      
      // Verify currentUser observable was updated
      expect(service.currentUserValue).toEqual(body);
      done();
    });

    // Expect one HTTP call
    const req = httpMock.expectOne(loginUrl);
    expect(req.request.method).toBe('POST');
    // Verify request payload
    expect(req.request.body).toEqual({ email: 'john.doe', password: 'VerySecret!' });
    // Return the response body with token included
    req.flush(dummyBody);
  });

  /**
   * Tests logout functionality:
   * 1. Sets up auth data
   * 2. Calls logout
   * 3. Verifies all auth data is cleared
   */
  it('should handle logout properly', () => {
    // Set up some auth data first
    localStorage.setItem('authHeader', 'test-header');
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userEmail', 'test@example.com');
    localStorage.setItem('userId', '1');
    localStorage.setItem('currentUser', JSON.stringify({ email: 'test@example.com' }));

    // Call logout
    service.logout();

    // Verify all items were removed
    expect(localStorage.getItem('authHeader')).toBeNull();
    expect(localStorage.getItem('isAuthenticated')).toBeNull();
    expect(localStorage.getItem('userEmail')).toBeNull();
    expect(localStorage.getItem('userId')).toBeNull();
    expect(localStorage.getItem('currentUser')).toBeNull();
    
    // Verify currentUser observable was updated to null
    expect(service.currentUserValue).toBeNull();
  });

  /**
   * Tests successful registration flow
   */
  it('should handle registration successfully', (done) => {
    const registerData = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'password123'
    };

    // Execute registration
    service.register(registerData).subscribe(response => {
      expect(response).toBeTruthy();
      expect(response.email).toBe('jane@example.com');
      done();
    });

    // Mock the HTTP request
    const req = httpMock.expectOne(registerUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(registerData);
    req.flush({ userId: 2, name: 'Jane Doe', email: 'jane@example.com' });
  });

  /**
   * Tests getUserId and getUserEmail methods
   * Verifies they correctly retrieve data from localStorage
   */
  it('should return userId and email from localStorage', () => {
    localStorage.setItem('userId', '123');
    localStorage.setItem('userEmail', 'test@example.com');

    expect(service.getUserId()).toBe(123);
    expect(service.getUserEmail()).toBe('test@example.com');
  });

  /**
   * Tests behavior when no auth data is stored
   * All auth-related methods should return null/false
   */
  it('should return null when no auth data is stored', () => {
    expect(service.getUserId()).toBeNull();
    expect(service.getUserEmail()).toBeNull();
    expect(service.isAuthenticated()).toBeFalsy();
  });

  /**
   * Tests isAuthenticated method
   * Verifies it returns true when currentUser exists or isAuthenticated flag is set
   */
  it('should properly check authentication status', () => {
    // Not authenticated initially
    expect(service.isAuthenticated()).toBeFalsy();

    // Set authenticated flag
    localStorage.setItem('isAuthenticated', 'true');
    expect(service.isAuthenticated()).toBeTruthy();

    // Clear flag but set currentUser
    localStorage.clear();
    service['currentUserSubject'].next({ email: 'test@example.com' } as any);
    expect(service.isAuthenticated()).toBeTruthy();
  });

  /**
   * Tests currentUser observable subscription
   * Verifies that subscribers receive updates when user state changes
   */
  it('should emit current user changes to subscribers', (done) => {
    let updateCount = 0;
    
    service.currentUser.subscribe(user => {
      updateCount++;
      if (updateCount === 1) {
        // First emission should be null (initial state)
        expect(user).toBeNull();
      } else if (updateCount === 2) {
        // Second emission should be the logged-in user
        expect(user).toEqual(jasmine.objectContaining({
          email: 'logged.in.user'
        }));
        done();
      }
    });

    // Trigger a login to emit a new value
    service.login('logged.in.user', 'password').subscribe();
    
    const req = httpMock.expectOne(loginUrl);
    req.flush({ email: 'logged.in.user', token: 'test-token' });
  });

  /**
   * Tests login with minimum response data
   * Verifies the service handles responses with only required fields
   */
  it('should handle login with minimal response data', (done) => {
    const minimalResponse: LoginResponse = {
      email: 'minimal.user'
      // Note: No userId, name, or token - just email
    };

    service.login('minimal.user', 'password').subscribe(body => {
      expect(body).toEqual(minimalResponse);
      
      // Should still set basic auth data
      expect(localStorage.getItem('userEmail')).toBe('minimal.user');
      expect(localStorage.getItem('authHeader')).toBe(''); // Empty since no token
      done();
    });

    const req = httpMock.expectOne(loginUrl);
    req.flush(minimalResponse);
  });

  /**
   * Tests getUserFromStorage method indirectly
   * Verifies that user data is retrieved on service initialization
   * 
   * Uses objectContaining to match only the properties we're testing
   */
  it('should retrieve user from storage on initialization', () => {
    // Set up user data in localStorage (partial user data)
    const userData = { 
      userId: 1, 
      email: 'stored@example.com',
      name: 'Stored User'
      // Note: No pw or createdAt properties
    };
    localStorage.setItem('currentUser', JSON.stringify(userData));

    // Create a new service instance to trigger initialization
    const newService = new AuthService(TestBed.inject(HttpTestingController) as any);

    // Verify the user was loaded from storage (using objectContaining for partial match)
    expect(newService.currentUserValue).toEqual(jasmine.objectContaining({
      userId: 1,
      email: 'stored@example.com',
      name: 'Stored User'
    }));
  });
});