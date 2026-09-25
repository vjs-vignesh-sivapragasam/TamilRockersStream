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
  Home,
  Search,
  Globe,
  ArrowDownToLine,
  SlidersHorizontal,
  Radio,
} from 'lucide-react-native';
import { Colors } from '../constants/theme';

export type TabKey = 'home' | 'finder' | 'browser' | 'online' | 'downloads' | 'settings';

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

const RED = Colors.primary;
const INACTIVE = Colors.textSecondary;
const NAV_BG = Colors.navBg;
const PILL_BG = Colors.navActivePill;

/* ─────────────────────────── Tab Item ─────────────────────────── */
function TabItem({
  tab,
  isActive,
  onPress,
}: {
  tab: TabConfig;
  isActive: boolean;
  onPress: () => void;
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

  const pillBgOpacity = bgAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const iconColor     = isActive ? RED : INACTIVE;
  const iconStroke    = isActive ? 2.5 : 1.8;
  const iconSize      = isActive ? 24 : 22;

  return (
    <TouchableOpacity style={styles.tabItem} onPress={handlePress} activeOpacity={1}>
      <Animated.View style={[styles.tabInner, { transform: [{ scale: bounce }] }]}>

        {/* Icon lifted when active */}
        <Animated.View style={{ transform: [{ translateY: iconY }] }}>
          <View style={styles.iconWrap}>
            <Icon color={iconColor} size={iconSize} strokeWidth={iconStroke} />

            {/* Badge */}
            {tab.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {tab.badge > 99 ? '99+' : tab.badge}
                </Text>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* Label fades in when active */}
        <Animated.Text
          style={[
            styles.tabLabel,
            {
              color: isActive ? RED : INACTIVE,
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

  const tabs: TabConfig[] = [
    { key: 'home',      label: 'Home',      icon: Home },
    { key: 'finder',    label: 'Finder',    icon: Search },
    { key: 'browser',   label: 'Browser',   icon: Globe },
    { key: 'online',    label: 'Online',    icon: Radio },
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
          />
        ))}
      </View>
    </View>
  );
};

/* ─────────────────────────── Styles ─────────────────────────── */
const styles = StyleSheet.create({
  outerWrap: {
    backgroundColor: NAV_BG,
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
    paddingHorizontal: 6,
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
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 60,
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
    backgroundColor: PILL_BG,
    // Red underlay glow
    shadowColor: RED,
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
    backgroundColor: RED,
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: NAV_BG,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
  },

  /* Label */
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
});
