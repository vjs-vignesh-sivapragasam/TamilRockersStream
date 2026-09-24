import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import {
  ShieldCheck,
  ShieldAlert,
  X,
  Lock,
  Layers,
  Zap,
  CheckCircle,
} from 'lucide-react-native';
import { Colors } from '../../constants/theme';

interface BrowserShieldModalProps {
  visible: boolean;
  onClose: () => void;
  adBlockEnabled: boolean;
  onToggleAdBlock: (val: boolean) => void;
  blockedCount: number;
  strictMode: boolean;
  onToggleStrictMode: (val: boolean) => void;
}

export const BrowserShieldModal: React.FC<BrowserShieldModalProps> = ({
  visible,
  onClose,
  adBlockEnabled,
  onToggleAdBlock,
  blockedCount,
  strictMode,
  onToggleStrictMode,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <ShieldCheck color={adBlockEnabled ? '#46d369' : '#888'} size={24} />
              <Text style={styles.headerTitle}>Ad Shield & Privacy</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="#AAA" size={20} />
            </TouchableOpacity>
          </View>

          {/* Master Protection Switch */}
          <View style={styles.masterRow}>
            <View style={styles.masterText}>
              <Text style={styles.masterTitle}>Shield Protection</Text>
              <Text style={styles.masterSubtitle}>
                {adBlockEnabled ? 'Active and filtering requests' : 'Protection paused'}
              </Text>
            </View>
            <Switch
              value={adBlockEnabled}
              onValueChange={onToggleAdBlock}
              thumbColor="#FFFFFF"
              trackColor={{ false: '#3A3A3A', true: '#46d369' }}
            />
          </View>

          {/* Stats Breakdown Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{blockedCount}</Text>
              <Text style={styles.statLabel}>Ads Blocked</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{Math.round(blockedCount * 1.4)}</Text>
              <Text style={styles.statLabel}>Trackers Stopped</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{Math.round(blockedCount * 0.8)}</Text>
              <Text style={styles.statLabel}>Popups Neutralized</Text>
            </View>
          </View>

          {/* Additional Features List */}
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Lock color="#46d369" size={16} />
              <Text style={styles.featureText}>Clickjack transparent overlay removal</Text>
            </View>
            <View style={styles.featureItem}>
              <Zap color="#46d369" size={16} />
              <Text style={styles.featureText}>Automatic `window.open` popup neutralization</Text>
            </View>
            <View style={styles.featureItem}>
              <Layers color="#46d369" size={16} />
              <Text style={styles.featureText}>External protocol hijack prevention</Text>
            </View>
          </View>

          {/* Strict Mode Toggle */}
          <View style={styles.strictRow}>
            <View style={styles.strictText}>
              <Text style={styles.strictTitle}>Strict Cosmetic Filtering</Text>
              <Text style={styles.strictSubtitle}>Force-hide floating banner placements</Text>
            </View>
            <Switch
              value={strictMode}
              onValueChange={onToggleStrictMode}
              thumbColor="#FFFFFF"
              trackColor={{ false: '#3A3A3A', true: Colors.netflixRed }}
            />
          </View>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#333333',
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  masterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    padding: 12,
    borderRadius: 8,
    gap: 10,
  },
  masterText: {
    flex: 1,
    gap: 2,
  },
  masterTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  masterSubtitle: {
    color: '#9E9E9E',
    fontSize: 11,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#252525',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    color: '#46d369',
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: '#8E8E8E',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  featureList: {
    gap: 8,
    backgroundColor: '#181818',
    padding: 10,
    borderRadius: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    color: '#CCCCCC',
    fontSize: 11,
  },
  strictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  strictText: {
    flex: 1,
    gap: 2,
  },
  strictTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  strictSubtitle: {
    color: '#888',
    fontSize: 11,
  },
  doneBtn: {
    backgroundColor: Colors.netflixRed,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
