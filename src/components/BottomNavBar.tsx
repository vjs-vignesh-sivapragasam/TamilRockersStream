import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Clapperboard,
  Search,
  Bookmark,
  Globe,
  ArrowDownToLine,
  SlidersHorizontal,
} from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { useDownloads } from '../context/DownloadContext';

export type TabKey = 'home' | 'search' | 'mylist' | 'browser' | 'downloads' | 'settings';

interface BottomNavBarProps {
  activeTab: TabKey;
  onTabSelect: (tab: TabKey) => void;
  downloadBadgeCount?: number;
}

interface TabConfig {
  key: TabKey;
  label: string;
  icon: any;
  badge?: number;
}

/* ─────────────────────────── Tab Item ─────────────────────────── */
function TabItem({
  tab,
  isActive,
  onPress,
  primaryColor,
}: {
  tab: TabConfig;
  isActive: boolean;
  onPress: () => void;
  primaryColor: string;
}) {
  // Animated values
  const bounce     = useRef(new Animated.Value(1)).current;
  const labelAnim  = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const bgAnim     = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const iconY      = useRef(new Animated.Value(isActive ? -2 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(labelAnim,  { toValue: isActive ? 1 : 0, duration: 160, useNativeDriver: true }),
      Animated.timing(bgAnim,     { toValue: isActive ? 1 : 0, duration: 200, useNativeDriver: false }),
      Animated.spring(iconY,      { toValue: isActive ? -3 : 0, friction: 7, tension: 100, useNativeDriver: true }),
    ]).start();
  }, [isActive, labelAnim, bgAnim, iconY]);

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(bounce, { toValue: 0.78, friction: 5, tension: 300, useNativeDriver: true }),
      Animated.spring(bounce, { toValue: 1,    friction: 4, tension: 200, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const Icon = tab.icon;

  const iconColor     = isActive ? primaryColor : Colors.textSecondary;
  const iconStroke    = isActive ? 2.5 : 1.8;
  const iconSize      = isActive ? 22 : 20;

  return (
    <TouchableOpacity style={styles.tabItem} onPress={handlePress} activeOpacity={1}>
      <Animated.View style={[styles.tabInner, { transform: [{ scale: bounce }] }]}>

        {/* Icon lifted when active */}
        <Animated.View style={{ transform: [{ translateY: iconY }] }}>
          <View style={styles.iconWrap}>
            <Icon color={iconColor} size={iconSize} strokeWidth={iconStroke} />

            {/* Badge */}
            {tab.badge ? (
              <View style={[styles.badge, { backgroundColor: primaryColor }]}>
                <Text style={styles.badgeText}>
                  {tab.badge > 99 ? '99+' : tab.badge}
                </Text>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* Label fades in when active */}
        <Animated.Text
          numberOfLines={1}
          style={[
            styles.tabLabel,
            {
              color: isActive ? primaryColor : Colors.textSecondary,
              fontWeight: isActive ? '700' : '500',
              opacity: labelAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
            },
          ]}
        >
          {tab.label}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

/* ─────────────────────────── Nav Bar ─────────────────────────── */
export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabSelect,
  downloadBadgeCount = 0,
}) => {
  const insets = useSafeAreaInsets();
  const { themeKey } = useDownloads();
  const primaryColor = Colors.primary;

  const tabs: TabConfig[] = [
    { key: 'home',      label: 'Home',      icon: Clapperboard },
    { key: 'search',    label: 'Search',    icon: Search },
    { key: 'mylist',    label: 'My List',   icon: Bookmark },
    { key: 'browser',   label: 'Browser',   icon: Globe },
    { key: 'downloads', label: 'Downloads', icon: ArrowDownToLine, badge: downloadBadgeCount || undefined },
    { key: 'settings',  label: 'Settings',  icon: SlidersHorizontal },
  ];

  return (
    <View style={[styles.outerWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* Separator glow line */}
      <View style={styles.topLine} />

      <View style={styles.tabsRow}>
        {tabs.map((t) => (
          <TabItem
            key={t.key}
            tab={t}
            isActive={activeTab === t.key}
            onPress={() => onTabSelect(t.key)}
            primaryColor={primaryColor}
          />
        ))}
      </View>
    </View>
  );
};

/* ─────────────────────────── Styles ─────────────────────────── */
const styles = StyleSheet.create({
  outerWrap: {
    backgroundColor: Colors.navBg,
    // Strong shadow to lift the bar
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 30,
  },
  topLine: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 2,
    paddingTop: 6,
    paddingBottom: 4,
  },

  /* Tab */
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    width: '100%',
    gap: 3,
  },

  /* Soft red pill behind icon when active */
  pillBg: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.navActivePill,
    // Red underlay glow
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },

  /* Icon */
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  /* Badge */
  badge: {
    position: 'absolute',
    top: -5,
    right: -7,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: Colors.navBg,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
  },

  /* Label */
  tabLabel: {
    fontSize: 9.5,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
});
