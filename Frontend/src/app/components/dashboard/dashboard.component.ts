/**
 * Dashboard Component - Main overview page for period tracking data
 * 
 * This component:
 * - Displays a summary of recent cycles with statistical insights
 * - Shows average cycle length and period length calculations
 * - Lists recent cycles with their symptoms and duration
 * - Provides quick actions for viewing and deleting cycles
 * - Serves as the primary landing page after login
 * 
 * The dashboard aggregates all user cycle data into a clear, actionable overview
 * that helps users understand their cycle patterns at a glance.
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';

import { CycleService } from '../../services/cycle.service';
import { AuthService } from '../../services/auth.service';
import { CycleWithSymptoms } from '../../models/CycleWithSymptoms';
import { NavFooterComponent } from '../shared/nav-footer.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatMenuModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    NavFooterComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardPageComponent implements OnInit {
  // User's cycle data
  recentCycles: CycleWithSymptoms[] = [];  // All user cycles, sorted by most recent
  
  // UI state management
  isLoading = false;     // Controls spinner visibility during data fetching
  errorMessage = '';     // Stores error messages to display to user
  
  // Statistical calculations
  averageCycleLength?: number;   // Average days between cycle starts (undefined if < 2 cycles)
  averagePeriodLength?: number;  // Average duration of periods in days

  constructor(
    private cycleService: CycleService,
    private auth: AuthService,
    private snack: MatSnackBar,
    private router: Router
  ) {}

  /**
   * Component initialization
   * Immediately loads cycle data on component mount
   */
  ngOnInit(): void {
    this.loadCycles();
  }

  /**
   * Loads all cycles with their symptoms in a single API call
   * Fetches user cycles, sorts them by recency, and calculates statistics
   */
  loadCycles(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.cycleService.getUserCycles().subscribe({
      next: (data) => {
        // Sort cycles with most recent first (descending by start date)
        this.recentCycles = data.sort((a, b) => 
          new Date(b.startDate).valueOf() - new Date(a.startDate).valueOf()
        );
        
        // Calculate dashboard statistics from loaded cycles
        this.calculateStats(this.recentCycles);
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'Failed to load cycles';
        console.error('Error loading cycles:', err);
        this.isLoading = false;
      }
    });
  }

  /**
   * Calculates statistical insights from cycle data
   * Computes average cycle length (time between cycles) and average period length
   * 
   * @param cycles - Array of user cycles to analyze
   */
  private calculateStats(cycles: CycleWithSymptoms[]): void {
    // Handle empty dataset
    if (!cycles.length) {
      this.averageCycleLength = undefined;
      this.averagePeriodLength = undefined;
      return;
    }

    // Calculate average period length (duration of each period)
    const periodLengths = cycles.map(c => {
      const start = new Date(c.startDate).valueOf();
      const end = new Date(c.endDate).valueOf();
      // Add 1 to include both start and end days
      return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    });
    
    // Calculate mean period length
    this.averagePeriodLength = Math.round(
      periodLengths.reduce((sum, len) => sum + len, 0) / periodLengths.length
    );

    // Calculate average cycle length (requires at least 2 cycles)
    if (cycles.length > 1) {
      // Sort cycles by start date ascending for chronological calculation
      const sorted = [...cycles].sort(
        (a, b) => new Date(a.startDate).valueOf() - new Date(b.startDate).valueOf()
      );
      
      // Calculate days between consecutive cycle start dates
      const diffs = sorted.slice(1).map((c, i) => {
        const prev = new Date(sorted[i].startDate).valueOf();
        const curr = new Date(c.startDate).valueOf();
        return Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      });
      
      // Calculate mean cycle length
      this.averageCycleLength = Math.round(
        diffs.reduce((sum, d) => sum + d, 0) / diffs.length
      );
    } else {
      // Need at least 2 cycles to measure time between them
      this.averageCycleLength = undefined;
    }
  }

  /**
   * Deletes a cycle and updates the UI
   * Removes cycle from local data array and recalculates statistics
   * 
   * @param cycleId - ID of the cycle to delete
   */
  onDeleteCycle(cycleId: number): void {
    this.cycleService.deleteCycle(cycleId).subscribe({
      next: () => {
        // Remove from local array to avoid full reload
        this.recentCycles = this.recentCycles.filter(c => c.cycleId !== cycleId);
        
        // Recalculate statistics with updated data
        this.calculateStats(this.recentCycles);
        
        // Show success feedback
        this.snack.open('Cycle deleted', 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Error deleting cycle:', err);
        this.snack.open('Failed to delete cycle', 'Close', { duration: 3000 });
      }
    });
  }
  
  /**
   * Logs out the current user
   * Clears authentication state and redirects to login page
   */
  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}