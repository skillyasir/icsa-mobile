import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { AppText } from '@/components/AppText';
import { brand } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import { regionFor, type Fix } from './rules';
import type { Branch } from './types';

// The check-in map (Yasir ruled, 6 Nov 2026: "Real map now"): Apple Maps on
// iPhone, Google Maps on Android — react-native-maps' default on each.
//
// It draws each branch's check-in area as the AMS measures it (my-context
// `branches`: the same rows and radius the check-in uses), and the student's
// position ONLY once a check-in has read it. It never shows the phone's live
// location (showsUserLocation stays off): the location is read only when the
// student taps Check in.
//
// A picture, not a control: it does not pan or zoom, so the screen scrolls
// over it. It is drawn afresh when the student's position arrives (the key),
// and fitted to the area once the map is ready (fitToCoordinates): on the
// Android emulator, 7 Nov 2026, the map after a check-in ignored the region
// it was given and opened zoomed inside the circle, so neither the circle's
// edge nor the ICSA badge was in view. iPhone kept the region either way.

export function BranchMap({ branches, focus, fix }: { branches: Branch[]; focus: Branch; fix: Fix | null }) {
  const t = useAppTheme();
  const points = [{ lat: focus.latitude, lng: focus.longitude, radiusM: focus.radius_m }];
  if (fix) points.push({ lat: fix.lat, lng: fix.lng, radiusM: 0 });
  const region = regionFor(points);
  const map = useRef<MapView>(null);
  if (!region) return null;
  // The region's two corners: fitting to them shows the whole area on both platforms.
  const corners = [
    { latitude: region.latitude - region.latitudeDelta / 2, longitude: region.longitude - region.longitudeDelta / 2 },
    { latitude: region.latitude + region.latitudeDelta / 2, longitude: region.longitude + region.longitudeDelta / 2 },
  ];
  const fit = () =>
    map.current?.fitToCoordinates(corners, { edgePadding: { top: 0, right: 0, bottom: 0, left: 0 }, animated: false });

  return (
    <View
      style={[styles.frame, { borderColor: t.colors.border, borderRadius: t.radius.xl }]}
      accessible
      accessibilityLabel={`Map of ${focus.name} and its ${focus.radius_m} metre check-in area${fix ? ', with where you checked in' : ''}`}
    >
      <MapView
        key={fix ? `at-${fix.lat},${fix.lng}` : 'branches'}
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onMapReady={fit}
        onLayout={fit}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsUserLocation={false}
        showsCompass={false}
        userInterfaceStyle={t.scheme}
        pointerEvents="none"
      >
        {branches.map((b) => (
          <Circle
            key={b.id}
            center={{ latitude: b.latitude, longitude: b.longitude }}
            radius={b.radius_m}
            strokeColor={t.colors.primary}
            fillColor={t.colors.primary + '22'}
            strokeWidth={2}
            lineDashPattern={[6, 6]}
          />
        ))}
        {branches.map((b) => (
          // With the student's dot on the map, the badge stands above the branch
          // point like a pin, so the dot never covers it (iPhone, 7 Nov 2026).
          <Marker
            key={'m' + b.id}
            coordinate={{ latitude: b.latitude, longitude: b.longitude }}
            anchor={fix ? { x: 0.5, y: 1 } : { x: 0.5, y: 0.5 }}
          >
            <View style={fix ? styles.lift : undefined}>
              <View style={[styles.badge, { backgroundColor: t.colors.primary, borderRadius: t.radius.sm }]}>
                <AppText variant="label" color="onPrimary">
                  ICSA
                </AppText>
              </View>
            </View>
          </Marker>
        ))}
        {fix ? (
          <Marker coordinate={{ latitude: fix.lat, longitude: fix.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.halo, { backgroundColor: brand.green + '40' }]}>
              <View style={[styles.dot, { backgroundColor: brand.green, borderColor: brand.white }]} />
            </View>
          </Marker>
        ) : null}
      </MapView>
      <View style={[styles.label, { backgroundColor: t.colors.surface, borderRadius: t.radius.pill }]}>
        <AppText variant="caption" numberOfLines={1}>
          {`${focus.name} · check-in area ${focus.radius_m} m`}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 220, overflow: 'hidden', borderWidth: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 6 },
  lift: { paddingBottom: 20 },
  halo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  label: { position: 'absolute', left: 12, bottom: 12, maxWidth: '85%', paddingHorizontal: 12, paddingVertical: 6 },
});
