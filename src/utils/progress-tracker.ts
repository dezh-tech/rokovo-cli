import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { ProgressInfo } from '@/types';

export interface ProgressTrackerOptions {
  verbose?: boolean;
  showETA?: boolean;
  updateInterval?: number;
}

export class ProgressTracker {
  private spinner: Ora;
  private startTime: number;
  private verbose: boolean;
  private showETA: boolean;
  private updateInterval: number;

  constructor(private options: ProgressTrackerOptions = {}) {
    this.verbose = options.verbose || false;
    this.showETA = options.showETA || true;
    this.updateInterval = options.updateInterval || 1000;
    this.startTime = Date.now();
    
    this.spinner = ora({
      text: 'Initializing...',
      spinner: 'dots',
      color: 'blue'
    });
  }

  start(message?: string): void {
    if (message) {
      this.spinner.text = message;
    }
    
    if (!this.verbose) {
      this.spinner.start();
    } else {
      console.log(chalk.blue(`🚀 ${this.spinner.text}`));
    }
  }

  update(progress: ProgressInfo): void {
    const percentage = Math.round((progress.filesProcessed / progress.totalFiles) * 100);
    const eta = this.calculateETA(progress);
    
    let message = `${progress.currentPhase}: ${progress.currentFile} (${progress.filesProcessed}/${progress.totalFiles} - ${percentage}%)`;
    
    if (this.showETA && eta) {
      message += ` - ETA: ${this.formatDuration(eta)}`;
    }

    if (this.verbose) {
      this.spinner.stop();
      console.log(chalk.gray(`  ${message}`));
      if (!this.isComplete(progress)) {
        this.spinner.start();
      }
    } else {
      this.spinner.text = message;
    }
  }

  updatePhase(phase: ProgressInfo['currentPhase'], message?: string): void {
    const phaseMessages = {
      scanning: '🔍 Scanning files...',
      analyzing: '🤖 Analyzing with LLM...',
      formatting: '📝 Formatting output...',
      complete: '✅ Complete!'
    };

    const displayMessage = message || phaseMessages[phase];
    
    if (this.verbose) {
      this.spinner.stop();
      console.log(chalk.blue(displayMessage));
      if (phase !== 'complete') {
        this.spinner.start();
      }
    } else {
      this.spinner.text = displayMessage;
    }
  }

  succeed(message?: string): void {
    if (this.verbose) {
      this.spinner.stop();
      console.log(chalk.green(`✅ ${message || 'Complete!'}`));
    } else {
      this.spinner.succeed(message);
    }
  }

  fail(message?: string): void {
    if (this.verbose) {
      this.spinner.stop();
      console.error(chalk.red(`❌ ${message || 'Failed!'}`));
    } else {
      this.spinner.fail(message);
    }
  }

  warn(message: string): void {
    if (this.verbose) {
      this.spinner.stop();
      console.warn(chalk.yellow(`⚠ ${message}`));
      this.spinner.start();
    } else {
      // For non-verbose mode, just update the spinner text briefly
      const originalText = this.spinner.text;
      this.spinner.text = chalk.yellow(`⚠ ${message}`);
      setTimeout(() => {
        this.spinner.text = originalText;
      }, 2000);
    }
  }

  info(message: string): void {
    if (this.verbose) {
      this.spinner.stop();
      console.log(chalk.blue(`ℹ ${message}`));
      this.spinner.start();
    }
  }

  stop(): void {
    this.spinner.stop();
  }

  private calculateETA(progress: ProgressInfo): number | null {
    if (progress.filesProcessed === 0) {
      return null;
    }

    const elapsed = Date.now() - this.startTime;
    const rate = progress.filesProcessed / elapsed; // files per ms
    const remaining = progress.totalFiles - progress.filesProcessed;
    
    return remaining / rate;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private isComplete(progress: ProgressInfo): boolean {
    return progress.currentPhase === 'complete' || 
           progress.filesProcessed >= progress.totalFiles;
  }

  // Static utility methods
  static createFileProgressBar(current: number, total: number, width: number = 40): string {
    const percentage = current / total;
    const filled = Math.round(width * percentage);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percent = Math.round(percentage * 100);
    
    return `[${bar}] ${percent}% (${current}/${total})`;
  }

  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  static formatProcessingRate(filesProcessed: number, timeElapsed: number): string {
    const rate = filesProcessed / (timeElapsed / 1000); // files per second
    
    if (rate < 1) {
      return `${(rate * 60).toFixed(1)} files/min`;
    } else {
      return `${rate.toFixed(1)} files/sec`;
    }
  }

  // Method to create a summary of the analysis
  createSummary(
    totalFiles: number, 
    rulesExtracted: number, 
    errors: string[]
  ): void {
    const elapsed = Date.now() - this.startTime;
    const rate = ProgressTracker.formatProcessingRate(totalFiles, elapsed);
    
    console.log('\n' + chalk.bold('Analysis Summary:'));
    console.log(`  ${chalk.green('✓')} Files processed: ${totalFiles}`);
    console.log(`  ${chalk.green('✓')} Rules extracted: ${rulesExtracted}`);
    console.log(`  ${chalk.blue('ℹ')} Processing rate: ${rate}`);
    console.log(`  ${chalk.blue('ℹ')} Total time: ${this.formatDuration(elapsed)}`);
    
    if (errors.length > 0) {
      console.log(`  ${chalk.yellow('⚠')} Errors encountered: ${errors.length}`);
      if (this.verbose) {
        errors.forEach(error => {
          console.log(`    ${chalk.gray('•')} ${error}`);
        });
      }
    }
  }
}
