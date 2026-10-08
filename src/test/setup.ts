import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Existing UI regression tests assert the Polish baseline explicitly. English
// coverage opts in per test instead of inheriting jsdom's en-US navigator.
window.localStorage.setItem('panstwa-miasta.app-language.v1', 'pl');

afterEach(() => cleanup());
