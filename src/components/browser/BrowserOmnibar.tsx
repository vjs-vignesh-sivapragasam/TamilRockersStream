import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  X,
  Search,
} from 'lucide-react-native';

interface BrowserOmnibarProps {
  urlInput: string;
  onChangeUrl: (text: string) => void;
  onSubmitUrl: () => void;
  onClear: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onOpenShield?: () => void;
  onOpenTabs: () => void;
  tabCount: number;
  adBlockActive?: boolean;
  blockedCount?: number;
  currentUrl?: string;
}

export const BrowserOmnibar: React.FC<BrowserOmnibarProps> = ({
  urlInput,
  onChangeUrl,
  onSubmitUrl,
  onClear,
  onFocus,
  onBlur,
  onOpenTabs,
  tabCount,
}) => {
  return (
    <View style={styles.container}>
      {/* Address Bar Input Capsule */}
      <View style={styles.capsule}>
        <Search color="#888888" size={16} style={{ marginLeft: 4 }} />

        <TextInput
          style={styles.input}
          value={urlInput}
          onChangeText={onChangeUrl}
          onSubmitEditing={onSubmitUrl}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Search or enter web address..."
          placeholderTextColor="#777777"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          selectTextOnFocus
        />

        {urlInput.length > 0 && (
          <TouchableOpacity onPress={onClear} style={styles.clearBtn} activeOpacity={0.7}>
            <X color="#888888" size={14} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs Counter Button */}
      <TouchableOpacity
        style={styles.tabsBtn}
        onPress={onOpenTabs}
        activeOpacity={0.7}
      >
        <Text style={styles.tabsCountText}>{tabCount}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 10,
    backgroundColor: '#121212',
  },
  capsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    gap: 8,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
  tabsBtn: {
    width: 32,
    height: 32,
    borderRadius: 7,
    borderWidth: 1.8,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
});
