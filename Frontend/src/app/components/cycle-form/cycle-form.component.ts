/**
 * Cycle Form Component - Creates and edits period cycle records
 * 
 * This component handles:
 * - Creating new period cycles with start/end dates
 * - Editing existing cycles and their associated symptoms
 * - Symptom selection with intensity ratings (1-5 scale)
 * - Form validation for dates and required fields
 * - Cycle deletion with confirmation dialog
 * 
 * The form adapts between create and edit modes based on route parameters,
 * providing a consistent interface for cycle management while handling
 * the different data requirements for each operation.
 */

import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormArray, ReactiveFormsModule} from '@angular/forms';

// Angular Material modules
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';

// Services and models
import { AuthService } from '../../services/auth.service';
import { CycleService } from '../../services/cycle.service';
import { SymptomService } from '../../services/symptom.service';
import { CycleWithSymptoms, CycleSymptom } from '../../models/CycleWithSymptoms';
import { Symptom } from '../../models/Symptom';
import { NavFooterComponent } from '../shared/nav-footer.component';

@Component({
  selector: 'app-cycle-form-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    // Material modules
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatDialogModule,
    NavFooterComponent
  ],
  templateUrl: './cycle-form.component.html',
  styleUrls: ['./cycle-form.component.css']
})
export class CycleFormPageComponent implements OnInit {
  // Template reference for delete confirmation dialog
  @ViewChild('deleteDialog') deleteDialog!: TemplateRef<any>;
  
  // Mode and state
  isEditMode = false;          // Determines if we're creating or editing
  cycleId: number | null = null;  // ID of cycle being edited (null for new)
  
  // Form and data
  cycleForm!: FormGroup;       // Main reactive form for cycle data
  allSymptoms: Symptom[] = []; // Available symptoms catalog
  
  // UI state
  isLoading = false;          // Loading indicator state
  errorMessage = '';          // Error messages to display

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private location: Location,
    private route: ActivatedRoute,
    private router: Router,
    private cycleService: CycleService,
    private symptomService: SymptomService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  /**
   * Component initialization
   * Sets up form structure and determines operating mode
   */
  ngOnInit(): void {
    // Build the form structure with validation
    this.cycleForm = this.fb.group({
      cycleId: [0],
      startDate: [null, Validators.required],
      endDate: [null, Validators.required],
      notes: [''],
      symptoms: this.fb.array([])  // Dynamic array for symptom selections
    }, { validators: this.dateRangeValidator });

    // Check route parameters to determine if editing existing cycle
    this.route.params.subscribe(params => {
      if (params['cycle_id']) {
        this.isEditMode = true;
        this.cycleId = +params['cycle_id'];
      }
    });

    // Load available symptoms from the catalog
    this.loadSymptoms();
  }

  /**
   * Loads available symptoms and initializes form controls
   * Creates a form control for each symptom with checkbox and intensity fields
   */
  private loadSymptoms(): void {
    this.symptomService.getSymptomCatalog().subscribe({
      next: syms => {
        this.allSymptoms = syms;
        
        // Create form controls for each symptom in the catalog
        syms.forEach(s => {
          // Each symptom gets its own form group
          const group = this.fb.group({
            symptomId: [s.symptomId],
            symptomName: [s.name],
            selected: [false],  // Checkbox for symptom selection
            intensity: [{ value: 1, disabled: true }, [Validators.min(1), Validators.max(5)]],
            date: [new Date()] // Default to today
          });
          
          // Enable/disable intensity field based on selection
          group.get('selected')!.valueChanges.subscribe(sel =>
            sel ? group.get('intensity')!.enable({ emitEvent: false })
                : group.get('intensity')!.disable({ emitEvent: false })
          );
          
          this.symptoms.push(group);
        });
        
        // If editing an existing cycle, load its data
        if (this.isEditMode && this.cycleId) {
          this.loadCycle();
        }
      },
      error: (err) => {
        console.error('Failed to load symptoms:', err);
        this.errorMessage = 'Failed to load symptoms';
      }
    });
  }
  
  /**
   * Loads an existing cycle for editing
   * Fetches cycle data and populates the form with existing values
   */
  private loadCycle(): void {
    if (!this.cycleId) return;
    
    this.isLoading = true;
    
    this.cycleService.getUserCycles().subscribe({
      next: (cycles) => {
        // Find the specific cycle we're editing
        const cycle = cycles.find(c => c.cycleId === this.cycleId);
        
        if (cycle) {
          // Populate form with cycle data
          this.cycleForm.patchValue({
            cycleId: cycle.cycleId,
            startDate: new Date(cycle.startDate),
            endDate: new Date(cycle.endDate),
            notes: cycle.notes || ''
          });
          
          // Restore symptom selections and intensities
          cycle.symptoms.forEach((cs: { symptomId: number; intensity: any; date: string | number | Date; }) => {
            const index = this.allSymptoms.findIndex(s => s.symptomId === cs.symptomId);
            if (index !== -1 && index < this.symptoms.controls.length) {
              const control = this.symptoms.at(index);
              control.get('selected')?.setValue(true);
              control.get('intensity')?.setValue(cs.intensity);
              control.get('date')?.setValue(new Date(cs.date));
            }
          });
        } else {
          this.errorMessage = 'Cycle not found';
        }
        
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading cycle data:', err);
        this.errorMessage = 'Failed to load cycle data';
        this.isLoading = false;
      }
    });
  }

  /**
   * Convenience getter for the symptoms form array
   * Provides type-safe access to the symptoms FormArray
   */
  get symptoms(): FormArray {
    return this.cycleForm.get('symptoms') as FormArray;
  }

  /**
   * Custom validator for date range
   * Ensures end date is not before start date
   * 
   * @param group - Form group to validate
   * @returns Validation error object or null if valid
   */
  private dateRangeValidator(group: FormGroup) {
    const start = group.get('startDate')!.value;
    const end = group.get('endDate')!.value;
    return start && end && end < start ? { dateRange: true } : null;
  }

  /**
   * Cancels form editing and navigates back
   * Returns to the previous page in browser history
   */
  cancel(): void {
    this.location.back();
  }

  /**
   * Opens delete confirmation dialog
   * Shows modal dialog before proceeding with deletion
   */
  openDeleteConfirmation(): void {
    if (!this.cycleId) return;
    
    const dialogRef = this.dialog.open(this.deleteDialog);
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.deleteCycle();
      }
    });
  }
  
  /**
   * Deletes the current cycle
   * Removes cycle from database and navigates back to dashboard
   */
  deleteCycle(): void {
    if (!this.cycleId) return;
    
    this.isLoading = true;
    
    this.cycleService.deleteCycle(this.cycleId).subscribe({
      next: () => {
        this.isLoading = false;
        this.snackBar.open('Cycle deleted', 'Close', { duration: 3000 });
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Failed to delete cycle';
        console.error('Error deleting cycle:', err);
      }
    });
  }

  /**
   * Saves the cycle and symptoms
   * Validates form, prepares data, and either creates or updates the cycle
   * Handles different payload requirements for create vs update operations
   */
  saveCycle(): void {
    // Prevent submission if form is invalid
    if (this.cycleForm.invalid) return;
    
    this.isLoading = true;
    
    // Get authenticated user ID for cycle ownership
    const userId = this.auth.getUserId();
    if (!userId) {
      this.errorMessage = 'User authentication error. Please log in again.';
      this.isLoading = false;
      return;
    }
    
    // Create different payloads for create vs update
    let cycleData: any;
    
    if (this.isEditMode) {
      // For update, include cycleId in payload
      cycleData = {
        cycleId: this.cycleId!,
        userId,
        startDate: this.cycleForm.value.startDate,
        endDate: this.cycleForm.value.endDate,
        notes: this.cycleForm.value.notes,
        symptoms: this.symptoms.controls
          .filter(c => c.value.selected)  // Only include selected symptoms
          .map(c => ({
            symptomId: c.value.symptomId,
            name: c.value.symptomName,
            intensity: c.value.intensity,
            date: c.value.date || this.cycleForm.value.startDate  // Default to cycle start if no date
          }))
      };
    } else {
      // For create, exclude cycleId from payload
      cycleData = {
        userId,
        startDate: this.cycleForm.value.startDate,
        endDate: this.cycleForm.value.endDate,
        notes: this.cycleForm.value.notes,
        symptoms: this.symptoms.controls
          .filter(c => c.value.selected)
          .map(c => ({
            symptomId: c.value.symptomId,
            name: c.value.symptomName,
            intensity: c.value.intensity,
            date: c.value.date || this.cycleForm.value.startDate
          }))
      };
    }
    
    // Execute create or update request based on mode
    const request = this.isEditMode ?
      this.cycleService.updateCycle(this.cycleId!, cycleData) :
      this.cycleService.createCycle(cycleData);
      
    request.subscribe({
      next: () => {
        this.isLoading = false;
        this.snackBar.open('Cycle saved', 'Close', { duration: 3000 });
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Failed to save cycle';
        console.error('Error saving cycle:', err);
      }
    });
  }
}