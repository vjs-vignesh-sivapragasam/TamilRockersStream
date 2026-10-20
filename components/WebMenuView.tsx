import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Platform,
    StyleSheet,
    Animated,
    Modal,
    TouchableWithoutFeedback,
    ScrollView,
    UIManager,
} from 'react-native';

export interface MenuAction {
    id: string;
    title: string;
    subtitle?: string;
    state?: 'on' | 'off';
    titleColor?: string;
}

export interface WebMenuProps {
    title?: string;
    actions?: MenuAction[] | any[];
    onPressAction?: (id: string | any) => void;
    onOpenMenu?: () => void;
    onCloseMenu?: () => void;
    children?: React.ReactNode;
    style?: any;
    themeVariant?: string;
    shouldOpenOnLongPress?: boolean;
    [key: string]: any;
}

export const isMenuViewAvailable = (() => {
    if (Platform.OS === 'web') return false;
    try {
        if (!UIManager) return false;
        return Boolean(
            UIManager.getViewManagerConfig?.('MenuView') ||
            (UIManager as any)?.hasViewManagerConfig?.('MenuView') ||
            UIManager.getViewManagerConfig?.('RNCPopupMenuView') ||
            (UIManager as any)?.hasViewManagerConfig?.('RNCPopupMenuView')
        );
    } catch {
        return false;
    }
})();

export const WebMenu = forwardRef<any, WebMenuProps>(({
    title,
    actions = [],
    onPressAction,
    onOpenMenu,
    onCloseMenu,
    children,
    style,
}, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;

    const openMenu = () => {
        if (isOpen) return;
        setIsOpen(true);
        onOpenMenu?.();

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const closeMenu = () => {
        if (!isOpen) return;
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 140,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 0.95,
                duration: 140,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setIsOpen(false);
            onCloseMenu?.();
        });
    };

    useImperativeHandle(ref, () => ({
        show: () => openMenu(),
        open: () => openMenu(),
        close: () => closeMenu(),
    }));

    const handleActionPress = (actionId: string) => {
        if (typeof onPressAction === 'function') {
            try {
                (onPressAction as any)(actionId);
            } catch {
                try {
                    (onPressAction as any)({ nativeEvent: { event: actionId }, id: actionId });
                } catch (err) {
                    console.warn('[WebMenu] Error calling onPressAction:', err);
                }
            }
        }
        closeMenu();
    };

    return (
        <View style={[styles.container, style]}>
            <TouchableOpacity onPress={openMenu} activeOpacity={0.7}>
                {children}
            </TouchableOpacity>

            <Modal
                visible={isOpen}
                transparent
                animationType="none"
                supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
                onRequestClose={closeMenu}
            >
                <TouchableWithoutFeedback onPress={closeMenu}>
                    <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
                        <TouchableWithoutFeedback>
                            <Animated.View
                                style={[
                                    styles.modalCard,
                                    {
                                        transform: [{ scale: scaleAnim }],
                                    },
                                ]}
                            >
                                <View style={styles.menuHeader}>
                                    <Text style={styles.menuTitle} numberOfLines={1}>{title}</Text>
                                    <TouchableOpacity onPress={closeMenu} style={styles.closeBtn} activeOpacity={0.7}>
                                        <Text style={styles.closeBtnText}>✕</Text>
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={styles.actionsList} showsVerticalScrollIndicator={false}>
                                    {actions.map((action: any, index: number) => (
                                        <TouchableOpacity
                                            key={action.id || index}
                                            style={[
                                                styles.menuItem,
                                                index < actions.length - 1 && styles.menuItemBorder,
                                            ]}
                                            onPress={() => handleActionPress(action.id)}
                                            activeOpacity={0.65}
                                        >
                                            <View style={styles.menuItemContent}>
                                                <Text
                                                    style={[
                                                        styles.menuItemTitle,
                                                        { color: action.titleColor || '#FFFFFF' },
                                                        action.state === 'on' && styles.menuItemSelected,
                                                    ]}
                                                >
                                                    {action.title}
                                                </Text>
                                                {action.subtitle ? (
                                                    <Text style={styles.menuItemSubtitle}>{action.subtitle}</Text>
                                                ) : null}
                                            </View>
                                            {action.state === 'on' ? (
                                                <View style={styles.checkmarkBadge}>
                                                    <Text style={styles.checkmarkText}>✓</Text>
                                                </View>
                                            ) : null}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </Animated.View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
});

export const UniversalMenu = forwardRef<any, WebMenuProps>((props, ref) => {
    if (isMenuViewAvailable) {
        try {
            const { MenuView } = require('@react-native-menu/menu');
            if (MenuView) {
                return <MenuView ref={ref} {...props} />;
            }
        } catch {}
    }

    const normalizedOnPressAction = (param: any) => {
        const actionId = typeof param === 'string' ? param : (param?.nativeEvent?.event || param?.id || String(param));
        if (typeof props.onPressAction === 'function') {
            try {
                props.onPressAction(actionId);
            } catch {
                try {
                    props.onPressAction({ nativeEvent: { event: actionId }, id: actionId });
                } catch (err) {
                    console.warn('[UniversalMenu] Error calling onPressAction:', err);
                }
            }
        }
    };

    return <WebMenu ref={ref} {...props} onPressAction={normalizedOnPressAction} />;
});

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalCard: {
        width: '100%',
        maxWidth: 380,
        maxHeight: '82%',
        backgroundColor: '#1E1E22',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 25,
    },
    menuHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.12)',
        backgroundColor: '#26262B',
    },
    menuTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.3,
        flex: 1,
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    closeBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    actionsList: {
        paddingVertical: 4,
    },
    menuItem: {
        paddingHorizontal: 18,
        paddingVertical: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    menuItemBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    menuItemContent: {
        flex: 1,
        paddingRight: 10,
    },
    menuItemTitle: {
        fontSize: 15,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    menuItemSelected: {
        fontWeight: '700',
        color: '#0A84FF',
    },
    menuItemSubtitle: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 3,
    },
    checkmarkBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#0A84FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkmarkText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold',
    },
});