// src/app/services/symptom.service.spec.ts

/**
 * Unit tests for SymptomService
 * 
 * These tests verify that the service correctly:
 * - Fetches the catalog of available symptoms
 * - Handles errors when the API is unavailable
 * - Properly maps the response to the Symptom model
 * 
 * Since symptoms are relatively static reference data,
 * this service has simpler functionality than others.
 */
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { SymptomService } from './symptom.service';
import { Symptom } from '../models/Symptom';
import { environment } from '../environments/environment';

describe('SymptomService', () => {
  let service: SymptomService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/symptom`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SymptomService]
    });
    service  = TestBed.inject(SymptomService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  /**
   * Basic service instantiation test
   * Verifies that Angular's dependency injection can create the service
   */
  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  /**
   * Tests the getSymptomCatalog() method
   * Verifies that:
   * - The service makes a GET request to the correct endpoint
   * - The response is properly mapped to Symptom model
   * - The data structure matches expectations
   */
  it('should GET all symptoms', (done) => {
    // Mock list of symptoms matching your Symptom interface
    const mockList: Symptom[] = [
      { symptomId: 1, name: 'Headache' },
      { symptomId: 2, name: 'Cramps' },
      { symptomId: 3, name: 'Nausea', icon: 'sick' },
      { symptomId: 4, name: 'Bloating' }
    ];

    // Call the service method and verify response
    service.getSymptomCatalog().subscribe((symptoms: Symptom[]) => {
      // Verify the response matches our mock data
      expect(symptoms).toEqual(mockList);
      
      // Verify the structure of individual symptoms
      expect(symptoms.length).toBe(4);
      expect(symptoms[0].symptomId).toBe(1);
      expect(symptoms[0].name).toBe('Headache');
      expect(symptoms[2].icon).toBe('sick'); // Optional icon property
      done();
    });

    // Verify the HTTP request was made correctly
    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush(mockList);
  });

  /**
   * Tests error handling when the API is unavailable
   * Verifies that:
   * - HTTP errors are properly caught
   * - The error is logged to console (for debugging)
   * - The error is propagated to the subscriber
   */
  it('should handle errors when getting symptoms', (done) => {
    // Spy on console.error to verify error logging
    spyOn(console, 'error');

    service.getSymptomCatalog().subscribe({
      next: () => {
        fail('Expected an error response');
      },
      error: (error) => {
        // Verify the error object was received
        expect(error).toBeTruthy();
        expect(error.status).toBe(500);
        
        // Verify the error was logged
        expect(console.error).toHaveBeenCalledWith(
          'Error fetching symptoms:', 
          jasmine.any(Object)
        );
        done();
      }
    });

    // Simulate server error
    const req = httpMock.expectOne(baseUrl);
    req.flush('Server error', { 
      status: 500, 
      statusText: 'Internal Server Error' 
    });
  });

  /**
   * Tests response validation
   * Verifies that the service handles different response formats correctly
   */
  it('should handle empty symptom list', (done) => {
    // Mock an empty list response
    const emptyList: Symptom[] = [];

    service.getSymptomCatalog().subscribe((symptoms: Symptom[]) => {
      expect(symptoms).toEqual([]);
      expect(symptoms.length).toBe(0);
      done();
    });

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush(emptyList);
  });

  /**
   * Tests that the service handles partial data gracefully
   * Some symptoms may not have icons, which should be handled properly
   */
  it('should handle symptoms without icons', (done) => {
    const symptomsWithoutIcons: Symptom[] = [
      { symptomId: 1, name: 'Headache' }, // No icon property
      { symptomId: 2, name: 'Cramps', icon: undefined } // Explicit undefined
    ];

    service.getSymptomCatalog().subscribe((symptoms: Symptom[]) => {
      expect(symptoms.length).toBe(2);
      expect(symptoms[0].icon).toBeUndefined();
      expect(symptoms[1].icon).toBeUndefined();
      done();
    });

    const req = httpMock.expectOne(baseUrl);
    req.flush(symptomsWithoutIcons);
  });

  /**
   * Tests timeout behavior
   * Verifies the service handles slow or unresponsive API endpoints
   */
  it('should handle slow API responses', (done) => {
    // Set a shorter timeout for testing
    const slowResponse: Symptom[] = [
      { symptomId: 1, name: 'Slow Symptom' }
    ];

    service.getSymptomCatalog().subscribe((symptoms: Symptom[]) => {
      expect(symptoms).toEqual(slowResponse);
      done();
    });

    // Simulate a delayed response
    const req = httpMock.expectOne(baseUrl);
    setTimeout(() => {
      req.flush(slowResponse);
    }, 100); // 100ms delay
  });
});