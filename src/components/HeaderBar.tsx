import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Cast, Bell } from 'lucide-react-native';
import { Colors } from '../constants/theme';

interface HeaderBarProps {
  onSearchPress?: () => void;
  onFilterPress?: (filter: string) => void;
  activeFilter?: string;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onSearchPress,
  onFilterPress,
  activeFilter = 'All',
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
      {/* Top action row */}
      <View style={styles.topRow}>
        <View style={styles.leftGroup}>
          <Text style={styles.logoText}>
            <Text style={styles.logoV}>V</Text>
            <Text style={styles.logoFlex}>Flix</Text>
          </Text>
        </View>
        <View style={styles.rightGroup}>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Cast color={Colors.textPrimary} size={22} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={onSearchPress}>
            <Search color={Colors.textPrimary} size={22} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Bell color={Colors.textPrimary} size={22} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarBtn} activeOpacity={0.7}>
            <Image
              source={require('../../assets/vignesh.jpg')}
              style={styles.avatar}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Subcategory Navigation Pills */}
      <View style={styles.pillsRow}>
        {['TV Shows', 'Movies', 'Categories'].map((tab) => {
          const isActive = activeFilter === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => onFilterPress?.(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  netflixLogo: {
    color: Colors.netflixRed,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  logoText: {
    fontSize: 28,
    letterSpacing: -0.5,
  },
  logoV: {
    color: Colors.netflixRed,
    fontWeight: '900',
    fontSize: 30,
  },
  logoFlex: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 26,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBtn: {
    padding: 4,
  },
  avatarBtn: {
    marginLeft: 4,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  pillActive: {
    backgroundColor: Colors.netflixRed,
    borderColor: Colors.netflixRed,
  },
  pillText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
