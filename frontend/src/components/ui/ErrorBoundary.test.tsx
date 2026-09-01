import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): never {
  throw new Error('Test bomb');
}

function Good() {
  return <div>Content</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <Good />
      </ErrorBoundary>
    );
    expect(screen.getByText('Content')).toBeDefined();
  });

  it('catches errors and displays default fallback UI', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeDefined();
    expect(
      screen.getByText('An unexpected error occurred. Please try refreshing the page.')
    ).toBeDefined();
  });

  it('displays custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom fallback')).toBeDefined();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('renders Try again button', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText('Try again')).toBeDefined();
  });

  it('reset clears error state and re-renders children', () => {
    let shouldBomb = true;

    function ConditionalBomb() {
      if (shouldBomb) throw new Error('Boom');
      return <div>Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalBomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeDefined();

    shouldBomb = false;

    fireEvent.click(screen.getByText('Try again'));

    expect(screen.getByText('Recovered')).toBeDefined();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('calls console.error when an error is caught', () => {
    const consoleSpy = vi.spyOn(console, 'error');

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(consoleSpy).toHaveBeenCalled();
    // componentDidCatch calls console.error('ErrorBoundary caught:', ...)
    const componentDidCatchLog = consoleSpy.mock.calls.find(
      (call) => call[0] === 'ErrorBoundary caught:'
    );
    expect(componentDidCatchLog).toBeDefined();
  });

  it('does not show default fallback when custom fallback is provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom UI</div>}>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(screen.getByText('Custom UI')).toBeDefined();
  });

  it('has Try again button with correct styles', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    const btn = screen.getByText('Try again');
    expect(btn.className).toContain('bg-primary');
    expect(btn.className).toContain('text-white');
  });

  it('shows icon in default fallback', () => {
    const { container } = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});
