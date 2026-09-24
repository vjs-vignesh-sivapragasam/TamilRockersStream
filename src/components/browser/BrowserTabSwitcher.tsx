import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, X, Globe, Trash2 } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { BrowserTab } from '../../types/browser';

interface BrowserTabSwitcherProps {
  visible: boolean;
  tabs: BrowserTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onCloseModal: () => void;
}

const { width } = Dimensions.get('window');

export const BrowserTabSwitcher: React.FC<BrowserTabSwitcherProps> = ({
  visible,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onCloseModal,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onCloseModal}
    >
      <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Open Tabs ({tabs.length})</Text>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={onCloseModal}
            activeOpacity={0.8}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Cards Grid */}
        <ScrollView
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabCard, isActive && styles.tabCardActive]}
                activeOpacity={0.85}
                onPress={() => onSelectTab(tab.id)}
              >
                {/* Tab Top Bar */}
                <View style={styles.tabTopBar}>
                  <Globe color={isActive ? Colors.netflixRed : '#888'} size={14} />
                  <Text style={styles.tabCardTitle} numberOfLines={1}>
                    {tab.title || tab.url || 'New Tab'}
                  </Text>
                  {tabs.length > 1 && (
                    <TouchableOpacity
                      style={styles.closeTabBtn}
                      onPress={() => onCloseTab(tab.id)}
                    >
                      <X color="#FFF" size={14} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Tab Preview Surface */}
                <View style={styles.tabPreview}>
                  <Text style={styles.tabUrlText} numberOfLines={2}>
                    {tab.url || 'Speed Dial Start Page'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Bottom Toolbar: New Tab */}
        <View style={[styles.bottomToolbar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.newTabBtn}
            onPress={onNewTab}
            activeOpacity={0.85}
          >
            <Plus color="#000000" size={20} />
            <Text style={styles.newTabBtnText}>New Tab</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    paddingHorizontal: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  doneBtn: {
    backgroundColor: '#262626',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 80,
  },
  tabCard: {
    width: (width - 40) / 2,
    height: 180,
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#303030',
    overflow: 'hidden',
  },
  tabCardActive: {
    borderColor: Colors.netflixRed,
    backgroundColor: '#242424',
  },
  tabTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2B2B2B',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  tabCardTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  closeTabBtn: {
    padding: 2,
  },
  tabPreview: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabUrlText: {
    color: '#777777',
    fontSize: 12,
    textAlign: 'center',
  },
  bottomToolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#181818',
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 0.5,
    borderTopColor: '#282828',
    alignItems: 'center',
  },
  newTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    gap: 6,
  },
  newTabBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
});
