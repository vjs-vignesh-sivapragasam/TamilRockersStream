import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { X, BookmarkPlus } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { BookmarkItem } from '../../types/browser';

interface BrowserAddBookmarkModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (bookmark: BookmarkItem) => void;
  defaultUrl?: string;
  defaultTitle?: string;
}

const COLOR_SWATCHES = ['#E50914', '#01b4e4', '#f5c518', '#fa320a', '#4285f4', '#8a2be2', '#20b2aa'];

export const BrowserAddBookmarkModal: React.FC<BrowserAddBookmarkModalProps> = ({
  visible,
  onClose,
  onSave,
  defaultUrl = '',
  defaultTitle = '',
}) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<'Cinema' | 'Media' | 'Search' | 'Custom'>('Custom');
  const [selectedColor, setSelectedColor] = useState(COLOR_SWATCHES[0]);

  useEffect(() => {
    if (visible) {
      setUrl(defaultUrl || '');
      setTitle(defaultTitle || '');
    }
  }, [visible, defaultUrl, defaultTitle]);

  const handleSave = () => {
    let cleanUrl = url.trim();
    if (!cleanUrl) {
      Alert.alert('Error', 'Please enter a valid website URL');
      return;
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const cleanTitle = title.trim() || cleanUrl.replace(/^https?:\/\//i, '').split('/')[0];
    const newBookmark: BookmarkItem = {
      id: Date.now().toString(),
      title: cleanTitle,
      url: cleanUrl,
      category,
      color: selectedColor,
      iconLetter: cleanTitle.slice(0, 2).toUpperCase(),
    };

    onSave(newBookmark);
    onClose();
    Alert.alert('Bookmark Saved', `"${cleanTitle}" added to your Speed Dial.`);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <BookmarkPlus color={Colors.netflixRed} size={20} />
              <Text style={styles.headerTitle}>Add to Speed Dial</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="#888" size={20} />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Website Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. My Cinema Portal"
              placeholderTextColor="#666"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Website URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://example.com"
              placeholderTextColor="#666"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.catRow}>
              {(['Cinema', 'Media', 'Search', 'Custom'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catBtn, category === cat && styles.catBtnActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catBtnText, category === cat && styles.catBtnTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Icon Theme Color</Text>
            <View style={styles.colorRow}>
              {COLOR_SWATCHES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c },
                    selectedColor === c && styles.colorCircleSelected,
                  ]}
                  onPress={() => setSelectedColor(c)}
                />
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
            <Text style={styles.saveBtnText}>Save Shortcut</Text>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: '#999999',
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#141414',
    color: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  catRow: {
    flexDirection: 'row',
    gap: 8,
  },
  catBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#141414',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  catBtnActive: {
    backgroundColor: Colors.netflixRed,
    borderColor: Colors.netflixRed,
  },
  catBtnText: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
  },
  catBtnTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  saveBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});
