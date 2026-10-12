import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { APP_NAME } from '@pokeneuf/core';
import { App } from './App';

describe('App', () => {
  it('shows the app name and the non-affiliation notice', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(APP_NAME);
    expect(screen.getByText(/non affilié/)).toBeTruthy();
  });
});
