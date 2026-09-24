import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';

interface BrowserToolbarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
}

export const BrowserToolbar: React.FC<BrowserToolbarProps> = ({
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.btn, !canGoBack && styles.btnDisabled]}
        onPress={onGoBack}
        disabled={!canGoBack}
        activeOpacity={0.7}
      >
        <ArrowLeft color={canGoBack ? '#FFFFFF' : '#444444'} size={20} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, !canGoForward && styles.btnDisabled]}
        onPress={onGoForward}
        disabled={!canGoForward}
        activeOpacity={0.7}
      >
        <ArrowRight color={canGoForward ? '#FFFFFF' : '#444444'} size={20} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderTopWidth: 0.5,
    borderTopColor: '#222222',
    paddingVertical: 5,
    paddingHorizontal: 40,
  },
  btn: {
    padding: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  btnDisabled: {
    opacity: 0.3,
  },
});
