// src/app/services/user.service.spec.ts

/**
 * Unit tests for UserService
 * 
 * These tests verify that the service correctly:
 * - Retrieves user profile data by email
 * - Updates user profile information
 * - Changes user passwords
 * - Deletes user accounts
 * - Handles errors with appropriate user-friendly messages
 * 
 * The service uses HTTP calls to communicate with the backend API,
 * and tests mock these calls using HttpClientTestingModule
 */
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { UserService } from './user.service';
import { User } from '../models/User';
import { environment } from '../environments/environment';

interface PasswordUpdateRequest {
  UserId: number;
  Password: string;
}

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/user`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UserService]
    });
    service  = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
    
    // Some tests may need auth setup
    localStorage.setItem('authHeader', 'Basic dummy');
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  /**
   * Basic service instantiation test
   * Verifies that the service can be created properly
   */
  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  /**
   * Tests getUserByEmail() method
   * Verifies that:
   * - The correct HTTP GET request is made
   * - The email parameter is correctly included in the URL
   * - The response is properly mapped to User model
   */
  it('should GET user by email', (done) => {
    const mockUser: User = {
      userId: 7,
      name: 'Alice',
      email: 'alice@example.com',
      pw: 'secret',
      createdAt: new Date()
    };

    service.getUserByEmail('alice@example.com').subscribe((user: User) => {
      expect(user).toEqual(mockUser);
      // Verify properties are correctly mapped
      expect(user.email).toBe('alice@example.com');
      expect(user.name).toBe('Alice');
      expect(user.userId).toBe(7);
      done();
    });

    // Verify HTTP request configuration
    const req = httpMock.expectOne(`${base}/byemail/alice@example.com`);
    expect(req.request.method).toBe('GET');
    req.flush(mockUser);
  });

  /**
   * Tests updateUser() method
   * Verifies that:
   * - The correct HTTP PUT request is made
   * - The user data is properly serialized in the request body
   * - The response is correctly handled
   */
  it('should PUT updateUser and return updated user', (done) => {
    const toUpdate: User = {
      userId: 7,
      name: 'Alice Smith',
      email: 'alice@example.com',
      pw: 'secret',
      createdAt: new Date()
    };

    service.updateUser(toUpdate).subscribe((user: User) => {
      expect(user).toEqual(toUpdate);
      // Verify the name was updated
      expect(user.name).toBe('Alice Smith');
      done();
    });

    // Verify HTTP request structure
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(toUpdate);
    req.flush(toUpdate);
  });

  /**
   * Tests updatePassword() method
   * Verifies that:
   * - The request format matches API expectations (UserId, Password)
   * - The correct HTTP PUT request is made to /password endpoint
   * - Successful responses are handled properly
   */
  it('should PUT updatePassword and handle success', (done) => {
    const userId = 7;
    const newPassword = 'newpass';

    service.updatePassword(userId, newPassword).subscribe(res => {
      expect(res).toBeTruthy();
      done();
    });

    // Verify the request format matches API expectations
    const req = httpMock.expectOne(`${base}/password`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ 
      UserId: userId, 
      Password: newPassword 
    } as PasswordUpdateRequest);
    req.flush({}, { status: 200, statusText: 'OK' });
  });

  /**
   * Tests updatePassword() error handling
   * Verifies that:
   * - 403 Forbidden responses show appropriate error message
   * - Error messages are user-friendly
   */
  it('should error 403 on updatePassword with user-friendly message', (done) => {
    service.updatePassword(7, 'bad').subscribe({
      next: () => fail('should have thrown'),
      error: err => {
        // Should provide a user-friendly error message
        expect(err.message).toContain('permission');
        expect(err.message).toBe('You do not have permission to update this password.');
        done();
      }
    });

    const req = httpMock.expectOne(`${base}/password`);
    req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });
  });

  /**
   * Tests deleteUser() method
   * Verifies that:
   * - The correct HTTP DELETE request is made
   * - The user ID is properly included in the URL
   * - No-content responses are handled correctly
   */
  it('should DELETE user and handle success', (done) => {
    service.deleteUser(7).subscribe(res => {
      expect(res).toBeTruthy();
      done();
    });

    // Verify correct endpoint is called
    const req = httpMock.expectOne(`${base}/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush({}, { status: 204, statusText: 'No Content' });
  });

  /**
   * Tests deleteUser() error handling
   * Verifies that:
   * - 404 Not Found responses show appropriate error message
   * - Error messages help users understand what went wrong
   */
  it('should error 404 on deleteUser with user-friendly message', (done) => {
    service.deleteUser(8).subscribe({
      next: () => fail('should have thrown'),
      error: err => {
        expect(err.message).toContain('not found');
        expect(err.message).toBe('User not found.');
        done();
      }
    });

    const req = httpMock.expectOne(`${base}/8`);
    req.flush('Not Found', { status: 404, statusText: 'Not Found' });
  });


  /**
   * Tests client-side error handling
   * Verifies that network errors are properly handled
   */
  it('should handle client-side errors', (done) => {
    // Create a mock ErrorEvent to simulate a client-side error
    const errorEvent = new ErrorEvent('Network error', {
      message: 'Could not connect to server'
    });

    service.getUserByEmail('test@example.com').subscribe({
      next: () => fail('should have thrown'),
      error: err => {
        expect(err.message).toContain('Error: Could not connect to server');
        done();
      }
    });

    const req = httpMock.expectOne(`${base}/byemail/test@example.com`);
    req.error(errorEvent);
  });  
});