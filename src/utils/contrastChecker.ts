/**
 * Color Contrast Verification Tool
 * 
 * Automatically verify WCAG 2.1 AA compliance for all color combinations in the app.
 * Run this in development to identify contrast issues.
 * 
 * Usage:
 * import { verifyAppContrast } from './utils/contrastChecker';
 * verifyAppContrast(); // Run in DevTools console
 */

import { getContrastRatio } from './accessibility';

interface ColorPair {
  name: string;
  foreground: string;
  background: string;
  size: 'normal' | 'large';
  element: string;
}

// Define all color pairs used in the application
export const colorPairs: ColorPair[] = [
  // Primary Text
  { name: 'Body text on white', foreground: '#111827', background: '#ffffff', size: 'normal', element: 'p, span, div' },
  { name: 'Body text on gray-50', foreground: '#111827', background: '#f9fafb', size: 'normal', element: 'body background' },
  
  // Headings
  { name: 'Heading on white', foreground: '#111827', background: '#ffffff', size: 'large', element: 'h1, h2, h3' },
  
  // Links
  { name: 'Link default', foreground: '#2563eb', background: '#ffffff', size: 'normal', element: 'a' },
  { name: 'Link hover', foreground: '#1d4ed8', background: '#ffffff', size: 'normal', element: 'a:hover' },
  
  // Buttons - Primary
  { name: 'Primary button text', foreground: '#ffffff', background: '#3b82f6', size: 'normal', element: 'button.primary' },
  { name: 'Primary button hover', foreground: '#ffffff', background: '#2563eb', size: 'normal', element: 'button.primary:hover' },
  
  // Buttons - Like (Active)
  { name: 'Like button active', foreground: '#dc2626', background: '#fef2f2', size: 'normal', element: 'button.like.active' },
  
  // Secondary Text
  { name: 'Secondary text (gray-600)', foreground: '#4b5563', background: '#ffffff', size: 'normal', element: 'timestamps, metadata' },
  { name: 'Secondary text (gray-500)', foreground: '#6b7280', background: '#ffffff', size: 'normal', element: 'placeholders' },
  
  // Focus Indicators
  { name: 'Focus ring blue-500', foreground: '#3b82f6', background: '#ffffff', size: 'normal', element: 'focus ring' },
  { name: 'Focus ring red-500', foreground: '#ef4444', background: '#ffffff', size: 'normal', element: 'focus ring (like)' },
  
  // Error States
  { name: 'Error text', foreground: '#dc2626', background: '#ffffff', size: 'normal', element: 'error messages' },
  { name: 'Error background', foreground: '#7f1d1d', background: '#fef2f2', size: 'normal', element: 'error alerts' },
  
  // Success States
  { name: 'Success text', foreground: '#16a34a', background: '#ffffff', size: 'normal', element: 'success messages' },
  
  // Disabled States
  { name: 'Disabled text', foreground: '#9ca3af', background: '#ffffff', size: 'normal', element: 'disabled buttons' },
  
  // Borders (UI Components - 3:1 requirement)
  { name: 'Border gray-200', foreground: '#e5e7eb', background: '#ffffff', size: 'large', element: 'borders' },
  { name: 'Border gray-300', foreground: '#d1d5db', background: '#ffffff', size: 'large', element: 'borders' },
];

interface ContrastResult {
  name: string;
  ratio: number;
  passes: boolean;
  requirement: number;
  foreground: string;
  background: string;
  element: string;
}

/**
 * Verify all color contrast ratios in the application
 * Returns array of results with pass/fail status
 */
export function verifyAppContrast(): ContrastResult[] {
  const results: ContrastResult[] = [];

  for (const pair of colorPairs) {
    const ratio = getContrastRatio(pair.foreground, pair.background);
    const requirement = pair.size === 'large' ? 3.0 : 4.5;
    const passes = ratio >= requirement;

    results.push({
      name: pair.name,
      ratio: parseFloat(ratio.toFixed(2)),
      passes,
      requirement,
      foreground: pair.foreground,
      background: pair.background,
      element: pair.element,
    });
  }

  return results;
}

/**
 * Print contrast verification results to console
 * Shows pass/fail status with visual indicators
 */
export function printContrastReport(): void {
  const results = verifyAppContrast();
  

  const passed = results.filter(r => r.passes);
  const failed = results.filter(r => !r.passes);

  // Print passed results
  if (passed.length > 0) {
    passed.forEach(result => {
      console.log(
        `%c${result.name}%c ${result.ratio}:1 (requirement: ${result.requirement}:1)`,
        'font-weight: bold;',
        'color: green;'
      );
    });
  }

  // Print failed results
  if (failed.length > 0) {
    failed.forEach(result => {
      console.log(
        `%c${result.name}%c ${result.ratio}:1 (requirement: ${result.requirement}:1)`,
        'font-weight: bold;',
        'color: red;'
      );
    });
  }

  // Summary
  
  if (failed.length === 0) {
  } else {
  }

}

/**
 * Generate contrast report as JSON for automated testing
 */
export function getContrastReportJSON(): {
  passed: number;
  failed: number;
  total: number;
  compliance: number;
  results: ContrastResult[];
} {
  const results = verifyAppContrast();
  const passed = results.filter(r => r.passes).length;
  const failed = results.filter(r => !r.passes).length;

  return {
    passed,
    failed,
    total: results.length,
    compliance: parseFloat(((passed / results.length) * 100).toFixed(1)),
    results,
  };
}

/**
 * Suggest color adjustments for failing pairs
 */
export function suggestColorAdjustments(): void {
  const results = verifyAppContrast();
  const failed = results.filter(r => !r.passes);

  if (failed.length === 0) {
    return;
  }

  
  failed.forEach(() => {
  });

}

// Auto-run in development mode
if (import.meta.env.DEV) {
  // Make functions available globally for console testing
  (window as any).verifyAppContrast = verifyAppContrast;
  (window as any).printContrastReport = printContrastReport;
  (window as any).suggestColorAdjustments = suggestColorAdjustments;
  
}
