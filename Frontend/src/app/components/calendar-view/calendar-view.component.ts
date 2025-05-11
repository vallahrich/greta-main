/**
 * Calendar Component - Provides a monthly view of period cycles
 * 
 * This component:
 * - Displays a calendar grid with period days highlighted
 * - Shows fertility windows and ovulation days based on period data
 * - Allows navigation between months
 * - Has multiple visual indicators (period, fertile window, ovulation)
 * 
 * It's a comprehensive visualization of the user's cycle data.
 * 
 * Key fixes applied:
 * - Immutable date handling to prevent Angular change detection issues
 * - Proper conversion of API string dates to Date objects
 * - Race condition prevention for navigation
 * - Memory leak prevention with subscription cleanup
 * - Comprehensive error handling for all date operations
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { Subscription } from 'rxjs';

import { CycleService } from '../../services/cycle.service';
import { AuthService } from '../../services/auth.service';
import { CycleWithSymptoms } from '../../models/CycleWithSymptoms';
import { NavFooterComponent } from '../shared/nav-footer.component';

// Calendar day interface - models each cell in the calendar grid
interface CalendarDay {
  day: number | null;     // The day number (1-31), null for empty cells
  date: Date | null;      // Full date object for the day
  active: boolean;        // Whether this day has any cycle information
  isPeriod: boolean;      // Whether this day is part of a period
  isFertile: boolean;     // Whether this day is in a fertile window
  isOvulation: boolean;   // Whether this day is the ovulation day
  isToday: boolean;       // Whether this day is today's date
  cycleId?: number;       // ID of the cycle this day belongs to
}

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatMenuModule,
    NavFooterComponent
  ],
  templateUrl: './calendar-view.component.html',
  styleUrls: ['./calendar-view.component.css']
})
export class CalendarPageComponent implements OnInit, OnDestroy {
  // Date-related properties
  currentDate: Date = new Date();    // Current month being displayed
  currentMonth: string = '';         // Formatted month/year string for display
  currentYear: number = 0;          // Current year being displayed
  
  // Calendar structure
  weekDays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];  // Day labels
  monthDays: CalendarDay[] = [];     // Grid of calendar cells
  cycles: CycleWithSymptoms[] = [];  // User's cycle data
  
  // UI state
  isLoading = false;                 // Loading indicator state
  errorMessage = '';                 // Error messages to display
  
  // Navigation safety
  private isNavigating = false;      // Flag to prevent concurrent navigation
  private loadingSubscription?: Subscription;  // Observable subscription for cleanup

  constructor(
    private router: Router,
    private cycleService: CycleService,
    private authService: AuthService
  ) {}

  /**
   * Component initialization
   * Sets up the initial calendar state and loads user data
   */
  ngOnInit(): void {
    this.initializeCalendarState();
    this.loadCalendarData();
  }

  /**
   * Component cleanup
   * Unsubscribes from observables to prevent memory leaks
   */
  ngOnDestroy(): void {
    if (this.loadingSubscription) {
      this.loadingSubscription.unsubscribe();
    }
  }

  /**
   * Initialize calendar display state
   * Sets current year and updates month display
   */
  private initializeCalendarState(): void {
    this.currentYear = this.currentDate.getFullYear();
    this.updateMonthDisplay();
  }
  
  /**
   * Update the month display string
   * Formats the current date into a readable month/year format
   */
  private updateMonthDisplay(): void {
    this.currentMonth = this.currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  /**
   * Load cycle data for the calendar
   * Fetches user cycles from the API and converts string dates to Date objects
   */
  private loadCalendarData(): void {
    // Prevent multiple simultaneous loads
    if (this.isNavigating) return;
    
    this.isNavigating = true;
    this.isLoading = true;
    this.errorMessage = '';

    // Cancel any pending subscription to prevent memory leaks
    if (this.loadingSubscription) {
      this.loadingSubscription.unsubscribe();
    }

    this.loadingSubscription = this.cycleService.getUserCycles().subscribe({
      next: cycles => {
        // Convert API string dates to Date objects
        this.cycles = cycles.map(cycle => ({
          ...cycle,
          startDate: typeof cycle.startDate === 'string' ? new Date(cycle.startDate) : cycle.startDate,
          endDate: typeof cycle.endDate === 'string' ? new Date(cycle.endDate) : cycle.endDate,
          symptoms: cycle.symptoms?.map(symptom => ({
            ...symptom,
            date: typeof symptom.date === 'string' ? new Date(symptom.date) : symptom.date
          })) || []
        }));
        
        this.generateCalendarGrid();
        this.isLoading = false;
        this.isNavigating = false;
      },
      error: err => {
        this.errorMessage = 'Could not load calendar data. Please try again later.';
        this.isLoading = false;
        this.isNavigating = false;
        this.generateCalendarGrid();  // Still render empty grid
      }
    });
  }

  /**
   * Navigate to previous/next month
   * Creates a new Date object to avoid mutation issues that cause crashes
   * 
   * @param direction - -1 for previous month, 1 for next month
   */
  navigateMonth(direction: number): void {
    // Prevent navigation while another navigation is in progress
    if (this.isNavigating) return;
    
    try {
      // Create new Date object instead of mutating existing one (key fix)
      const newDate = new Date(this.currentDate);
      newDate.setMonth(newDate.getMonth() + direction);
      
      // Validate the calculated date
      if (isNaN(newDate.getTime())) return;
      
      // Update to the new date
      this.currentDate = newDate;
      this.initializeCalendarState();
      this.generateCalendarGrid();
    } catch (error) {
      // Reset to current month if navigation fails
      this.currentDate = new Date();
      this.initializeCalendarState();
      this.generateCalendarGrid();
    }
  }

  /**
   * Generate the calendar grid for the current month
   * Creates an array of CalendarDay objects representing each cell in the calendar
   */
  private generateCalendarGrid(): void {
    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();
      
      // Validate year and month to prevent invalid date calculations
      if (isNaN(year) || isNaN(month)) return;
      
      // Calculate month boundaries
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();

      // Calculate offset for first day of month (Monday = 0)
      let offset = firstDay.getDay() - 1;
      if (offset < 0) offset = 6;  // Sunday wraps to 6

      // Clear existing grid
      this.monthDays = [];
      
      // Add empty cells for days before the first of the month
      for (let i = 0; i < offset; i++) {
        this.monthDays.push(this.createEmptyCell());
      }

      const today = new Date();
      
      // Fill in the actual days of the month
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        
        // Skip invalid dates (safety check)
        if (isNaN(date.getTime())) continue;
        
        // Get cycle information for this day
        const info = this.getDayInfo(date);
        const isToday = this.isSameDay(date, today);
        
        this.monthDays.push({
          day: d,
          date,
          active: info.isPeriod || info.isFertile || info.isOvulation,
          isPeriod: info.isPeriod,
          isFertile: info.isFertile,
          isOvulation: info.isOvulation,
          isToday,
          cycleId: info.cycleId
        });
      }
      
      // Add empty cells at the end to complete the grid (6 rows of 7 days)
      const total = Math.ceil((offset + daysInMonth) / 7) * 7;
      while (this.monthDays.length < total) {
        this.monthDays.push(this.createEmptyCell());
      }
    } catch (error) {
      // Create a minimal grid if there's a critical error
      this.monthDays = Array(42).fill(null).map(() => this.createEmptyCell());
    }
  }

  /**
   * Determine cycle status for a specific date
   * Checks all cycles to see if the date falls within period, fertile window, or ovulation
   * 
   * @param date - The date to check
   * @returns Object indicating period/fertile/ovulation status
   */
  private getDayInfo(date: Date): { isPeriod: boolean; isFertile: boolean; isOvulation: boolean; cycleId?: number } {
    const result = { isPeriod: false, isFertile: false, isOvulation: false, cycleId: undefined as number | undefined };

    // Return early if no cycles are available
    if (!this.cycles || this.cycles.length === 0) return result;

    // Check each cycle to see if this date is significant
    for (const cycle of this.cycles) {
      try {
        // Ensure dates are Date objects (handle both string and Date inputs)
        const start = cycle.startDate instanceof Date ? cycle.startDate : new Date(cycle.startDate);
        const end = cycle.endDate instanceof Date ? cycle.endDate : new Date(cycle.endDate);
        
        // Skip invalid cycle dates
        if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
        
        // Check if date is within period range
        if (date >= start && date <= end) {
          result.isPeriod = true;
          result.cycleId = cycle.cycleId;
        }
        
        // Calculate and check fertility window
        const ovDate = this.calculateOvulationDate(cycle);
        if (ovDate) {
          // Fertile window: 5 days before ovulation
          const fertileStart = new Date(ovDate);
          fertileStart.setDate(ovDate.getDate() - 5);
          
          if (date >= fertileStart && date <= ovDate) result.isFertile = true;
          
          // Ovulation day takes precedence over fertile window
          if (this.isSameDay(date, ovDate)) { 
            result.isOvulation = true; 
            result.isFertile = false;
          }
          
          // Set cycleId if this day is related to fertility
          if (!result.cycleId && (result.isFertile || result.isOvulation)) {
            result.cycleId = cycle.cycleId;
          }
        }
      } catch (error) {
        continue;  // Skip problematic cycles
      }
    }

    return result;
  }

  /**
   * Calculate ovulation date for a cycle
   * Uses standard 14-day rule from start of cycle
   * 
   * @param cycle - The cycle to calculate ovulation for
   * @returns Date of ovulation or null if calculation fails
   */
  private calculateOvulationDate(cycle: CycleWithSymptoms): Date | null {
    try {
      // Ensure we have a Date object
      const startDate = cycle.startDate instanceof Date ? cycle.startDate : new Date(cycle.startDate);
      
      // Validate start date
      if (isNaN(startDate.getTime())) return null;
      
      // Calculate ovulation (14 days after start)
      const d = new Date(startDate);
      d.setDate(d.getDate() + 14);
      
      // Validate result
      if (isNaN(d.getTime())) return null;
      
      return d;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if two dates represent the same calendar day
   * Handles null/undefined values and different date types safely
   * 
   * @param a - First date to compare
   * @param b - Second date to compare
   * @returns True if both dates are the same day
   */
  private isSameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
    if (!a || !b) return false;
    
    try {
      // Convert to Date objects if needed
      const dateA = a instanceof Date ? a : new Date(a);
      const dateB = b instanceof Date ? b : new Date(b);
      
      // Validate both dates
      if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return false;
      
      // Compare year, month, and day
      return dateA.getFullYear() === dateB.getFullYear() && 
             dateA.getMonth() === dateB.getMonth() && 
             dateA.getDate() === dateB.getDate();
    } catch (error) {
      return false;
    }
  }

  /**
   * Create an empty calendar cell
   * Used for padding the calendar grid before and after the month
   * 
   * @returns Empty CalendarDay object
   */
  private createEmptyCell(): CalendarDay {
    return { 
      day: null, 
      date: null, 
      active: false, 
      isPeriod: false, 
      isFertile: false, 
      isOvulation: false, 
      isToday: false,
      cycleId: undefined
    };
  }

  /**
   * TrackBy function for ngFor performance optimization
   * Helps Angular track calendar cells efficiently during updates
   * 
   * @param index - Index of the item in the array
   * @param day - Calendar day object
   * @returns Unique identifier for this day
   */
  trackByDay(index: number, day: CalendarDay): string {
    return `${index}-${day.day || 'empty'}`;
  }

  /**
   * Log out the current user
   * Clears authentication and navigates to login page
   */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}