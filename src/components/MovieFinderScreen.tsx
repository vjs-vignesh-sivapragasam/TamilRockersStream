/**
 * MovieFinderScreen — Backward-compatibility bridge
 * The core Home/Movie Finder screen is now standardized as HomeScreen.tsx
 */

export * from './HomeScreen';
export { HomeScreen as MovieFinderScreen } from './HomeScreen';
export { default } from './HomeScreen';
