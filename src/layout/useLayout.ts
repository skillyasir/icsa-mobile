import { useWindowDimensions } from 'react-native';

import { layoutFor, type Layout } from './breakpoints';

/** Phone, iPad, or iPad with room for a list beside its item — from the window's width. */
export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  return layoutFor(width);
}
