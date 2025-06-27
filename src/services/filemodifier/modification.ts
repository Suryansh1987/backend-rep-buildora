// modificationSummary.ts - Complete module for tracking and summarizing changes

import { ModificationChange, ModificationSessionSummary } from './types';

export class ModificationSummary {
  private changes: ModificationChange[] = [];
  private sessionStartTime: string;

  constructor() {
    this.sessionStartTime = new Date().toISOString();
  }

  /**
   * Add a new modification change to the tracking
   */
  addChange(
    type: 'modified' | 'created' | 'updated',
    file: string,
    description: string,
    options?: {
      approach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION';
      success?: boolean;
      linesChanged?: number;
      componentsAffected?: string[];
      reasoning?: string;
    }
  ): void {
    const change: ModificationChange = {
      type,
      file,
      description,
      timestamp: new Date().toISOString(),
      approach: options?.approach,
      success: options?.success,
      details: {
        linesChanged: options?.linesChanged,
        componentsAffected: options?.componentsAffected,
        reasoning: options?.reasoning
      }
    };

    this.changes.push(change);
  }

  /**
   * Get a comprehensive summary of all modifications in this session
   */
  getSummary(): string {
    if (this.changes.length === 0) {
      return "No changes recorded in this session.";
    }

    const uniqueFiles = new Set(this.changes.map(c => c.file));
    const successfulChanges = this.changes.filter(c => c.success !== false);
    const failedChanges = this.changes.filter(c => c.success === false);

    const summary = `
**MODIFICATION SESSION SUMMARY:**
📊 **Session Stats:**
   • Total Changes: ${this.changes.length}
   • Files Affected: ${uniqueFiles.size}
   • Success Rate: ${Math.round((successfulChanges.length / this.changes.length) * 100)}%
   • Session Duration: ${this.getSessionDuration()}

📝 **Changes Made:**
${this.changes.map((change, index) => {
  const icon = this.getChangeIcon(change);
  const status = change.success === false ? ' ❌' : change.success === true ? ' ✅' : '';
  return `   ${index + 1}. ${icon} ${change.file}${status}
      ${change.description}
      ${change.approach ? `• Approach: ${change.approach}` : ''}
      ${change.details?.reasoning ? `• Strategy: ${change.details.reasoning}` : ''}`;
}).join('\n\n')}

🕐 **Timeline:**
   • Started: ${new Date(this.sessionStartTime).toLocaleTimeString()}
   • Completed: ${new Date().toLocaleTimeString()}

${failedChanges.length > 0 ? `
⚠️ **Issues Encountered:**
${failedChanges.map(change => `   • ${change.file}: ${change.description}`).join('\n')}
` : ''}
    `.trim();

    return summary;
  }

  /**
   * Get a contextual summary for use in AI prompts
   */
  getContextualSummary(): string {
    if (this.changes.length === 0) {
      return "";
    }

    const recentChanges = this.changes.slice(-5); // Last 5 changes
    let summary = `
**RECENT MODIFICATIONS IN THIS SESSION:**
${recentChanges.map(change => {
  const icon = this.getChangeIcon(change);
  const status = change.success === false ? ' (failed)' : '';
  return `• ${icon} ${change.file}${status}: ${change.description}`;
}).join('\n')}

**Session Context:**
• Total files modified: ${new Set(this.changes.map(c => c.file)).size}
• Primary approach: ${this.getPrimaryApproach()}
• Session duration: ${this.getSessionDuration()}
    `.trim();

    return summary;
  }

  /**
   * Get detailed statistics about the modification session
   */
  getDetailedStats(): ModificationSessionSummary {
    const uniqueFiles = new Set(this.changes.map(c => c.file));
    const successfulChanges = this.changes.filter(c => c.success !== false);
    
    return {
      changes: this.changes,
      totalFiles: uniqueFiles.size,
      totalChanges: this.changes.length,
      approach: this.getPrimaryApproach(),
      sessionDuration: this.getSessionDurationMinutes(),
      successRate: this.changes.length > 0 ? Math.round((successfulChanges.length / this.changes.length) * 100) : 0,
      startTime: this.sessionStartTime,
      endTime: new Date().toISOString()
    };
  }

  /**
   * Get changes by type
   */
  getChangesByType(): Record<string, ModificationChange[]> {
    return {
      created: this.changes.filter(c => c.type === 'created'),
      modified: this.changes.filter(c => c.type === 'modified'),
      updated: this.changes.filter(c => c.type === 'updated')
    };
  }

  /**
   * Get changes by file
   */
  getChangesByFile(): Record<string, ModificationChange[]> {
    const changesByFile: Record<string, ModificationChange[]> = {};
    
    this.changes.forEach(change => {
      if (!changesByFile[change.file]) {
        changesByFile[change.file] = [];
      }
      changesByFile[change.file].push(change);
    });
    
    return changesByFile;
  }

  /**
   * Get the most frequently modified files
   */
  getMostModifiedFiles(limit: number = 5): Array<{ file: string; count: number; types: string[] }> {
    const fileStats: Record<string, { count: number; types: Set<string> }> = {};
    
    this.changes.forEach(change => {
      if (!fileStats[change.file]) {
        fileStats[change.file] = { count: 0, types: new Set() };
      }
      fileStats[change.file].count++;
      fileStats[change.file].types.add(change.type);
    });
    
    return Object.entries(fileStats)
      .map(([file, stats]) => ({
        file,
        count: stats.count,
        types: Array.from(stats.types)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get a user-friendly progress update
   */
  getProgressUpdate(): string {
    if (this.changes.length === 0) {
      return "Session started - ready for modifications!";
    }

    const lastChange = this.changes[this.changes.length - 1];
    const uniqueFiles = new Set(this.changes.map(c => c.file)).size;
    const icon = this.getChangeIcon(lastChange);
    
    return `${icon} Latest: ${lastChange.description} | ${this.changes.length} changes across ${uniqueFiles} files`;
  }

  /**
   * Export session data for persistence
   */
  exportSession(): {
    sessionId: string;
    startTime: string;
    endTime: string;
    changes: ModificationChange[];
    summary: ModificationSessionSummary;
  } {
    return {
      sessionId: this.generateSessionId(),
      startTime: this.sessionStartTime,
      endTime: new Date().toISOString(),
      changes: this.changes,
      summary: this.getDetailedStats()
    };
  }

  /**
   * Clear all changes (start fresh session)
   */
  clear(): void {
    this.changes = [];
    this.sessionStartTime = new Date().toISOString();
  }

  /**
   * Get the number of changes
   */
  getChangeCount(): number {
    return this.changes.length;
  }

  /**
   * Check if any changes have been made
   */
  hasChanges(): boolean {
    return this.changes.length > 0;
  }

  /**
   * Get all changes
   */
  getAllChanges(): ModificationChange[] {
    return [...this.changes];
  }

  /**
   * Get recent changes
   */
  getRecentChanges(limit: number = 5): ModificationChange[] {
    return this.changes.slice(-limit);
  }

  /**
   * Get changes within a time range
   */
  getChangesInTimeRange(startTime: string, endTime: string): ModificationChange[] {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    
    return this.changes.filter(change => {
      const changeTime = new Date(change.timestamp).getTime();
      return changeTime >= start && changeTime <= end;
    });
  }

  /**
   * Get success/failure statistics
   */
  getSuccessStats(): {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  } {
    const total = this.changes.length;
    const successful = this.changes.filter(c => c.success !== false).length;
    const failed = this.changes.filter(c => c.success === false).length;
    
    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0
    };
  }

  // Private helper methods

  private getChangeIcon(change: ModificationChange): string {
    switch (change.type) {
      case 'created': return '📝';
      case 'modified': return '🔄';
      case 'updated': return '⚡';
      default: return '🔧';
    }
  }

  private getPrimaryApproach(): string {
    if (this.changes.length === 0) return 'None';
    
    const approaches: Record<string, number> = {};
    this.changes.forEach(change => {
      if (change.approach) {
        approaches[change.approach] = (approaches[change.approach] || 0) + 1;
      }
    });
    
    const sortedApproaches = Object.entries(approaches)
      .sort(([,a], [,b]) => b - a);
    
    return sortedApproaches.length > 0 ? sortedApproaches[0][0] : 'Mixed';
  }

  private getSessionDuration(): string {
    const durationMs = new Date().getTime() - new Date(this.sessionStartTime).getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  private getSessionDurationMinutes(): number {
    const durationMs = new Date().getTime() - new Date(this.sessionStartTime).getTime();
    return Math.floor(durationMs / 60000);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}