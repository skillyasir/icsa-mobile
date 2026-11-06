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
// over it.

export function BranchMap({ branches, focus, fix }: { branches: Branch[]; focus: Branch; fix: Fix | null }) {
  const t = useAppTheme();
  const points = [{ lat: focus.latitude, lng: focus.longitude, radiusM: focus.radius_m }];
  if (fix) points.push({ lat: fix.lat, lng: fix.lng, radiusM: 0 });
  const region = regionFor(points);
  if (!region) return null;

  return (
    <View
      style={[styles.frame, { borderColor: t.colors.border, borderRadius: t.radius.xl }]}
      accessible
      accessibilityLabel={`Map of ${focus.name} and its ${focus.radius_m} metre check-in area${fix ? ', with where you checked in' : ''}`}
    >
      <MapView
        style={StyleSheet.absoluteFill}
        region={region}
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
          <Marker key={'m' + b.id} coordinate={{ latitude: b.latitude, longitude: b.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.badge, { backgroundColor: t.colors.primary, borderRadius: t.radius.sm }]}>
              <AppText variant="label" color="onPrimary">
                ICSA
              </AppText>
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
  halo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  label: { position: 'absolute', left: 12, bottom: 12, maxWidth: '85%', paddingHorizontal: 12, paddingVertical: 6 },
});
