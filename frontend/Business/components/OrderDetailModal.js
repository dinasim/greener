// Business/components/OrderDetailModal.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Platform,
  Linking,
  Share,
  FlatList,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

export default function OrderDetailModal({
  visible = false,
  order = null,
  onClose = () => {},
  onUpdateStatus = () => {},
  onContactCustomer = () => {},
  isLoading = false,
  businessInfo = {},
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);

  // Animation refs
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const modalContentRef = useRef(null); // Accessibility fix

  // ---- Currency helpers (default to ILS) ----
  const CURRENCY = (businessInfo?.currency || 'ILS').toUpperCase();
  const CURRENCY_SYMBOL =
    businessInfo?.currencySymbol ||
    (CURRENCY === 'ILS' ? '₪' : CURRENCY === 'USD' ? '$' : CURRENCY === 'EUR' ? '€' : '₪');

  const fmt = (v) => {
    const num = Number(v) || 0;
    try {
      return new Intl.NumberFormat('en-IL', {
        style: 'currency',
        currency: CURRENCY,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    } catch {
      // Fallback if Intl currency isn't available in the runtime
      return `${CURRENCY_SYMBOL}${num.toFixed(2)}`;
    }
  };

  useEffect(() => {
    if (visible && order) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [visible, order]);

  // --- helpers (web & native)
  const sanitizePhone = (p) => (p || '').replace(/[^\d+]/g, '');

  const openURL = async (url) => {
    try {
      if (Platform.OS === 'web') {
        window.location.href = url;
      } else {
        const supported = await Linking.canOpenURL(url);
        if (supported) await Linking.openURL(url);
        else Alert.alert('Cannot open', url);
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not open link');
    }
  };

  // Build share text once
  const buildShareText = () => {
    const itemsText = (order.items || [])
      .map((it) => {
        const total = it.totalPrice ?? (it.unitPrice || 0) * (it.quantity || 0);
        return `• ${it.quantity}x ${it.name} - ${fmt(total)}`;
      })
      .join('\n');

    return (
      `Order Summary\n\n` +
      `Order: ${order.confirmationNumber}\n` +
      `Customer: ${order.customerName}\n` +
      `Total: ${fmt(order.total || 0)}\n` +
      `Status: ${(order.status || '').toUpperCase()}\n\n` +
      (itemsText ? `Items:\n${itemsText}` : '')
    );
  };

  // ✅ Share (native Share API, web navigator.share or clipboard)
  const handleShareOrder = async () => {
    try {
      const message = buildShareText();
      const title = `Order ${order.confirmationNumber}`;

      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ title, text: message });
        } else if (
          typeof navigator !== 'undefined' &&
          navigator.clipboard &&
          navigator.clipboard.writeText
        ) {
          await navigator.clipboard.writeText(message);
          Alert.alert('Copied', 'Order summary copied to clipboard.');
        } else {
          // last-resort alert to let user copy manually
          window.prompt('Copy the order summary:', message);
        }
      } else {
        await Share.share({ title, message });
      }
    } catch (error) {
      // user cancelled or an error occurred
      if (error?.message) {
        console.log('Share error:', error.message);
      }
    }
  };

  // Status update
  const handleStatusUpdate = async (newStatus) => {
    setIsUpdating(true);
    setShowStatusMenu(false);

    try {
      await onUpdateStatus(order.id, newStatus);
      Alert.alert('✅ Status Updated', `Order status changed to ${newStatus.toUpperCase()}`, [
        { text: 'OK' },
      ]);
    } catch (error) {
      Alert.alert('Error', `Failed to update status: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Contact customer
  const handleContactCustomer = () => {
    if (!order.customerPhone && !order.customerEmail) {
      Alert.alert('No Contact Info', 'Customer contact information is not available');
      return;
    }

    if (Platform.OS === 'web') {
      setShowContactMenu(true);
      return;
    }

    const options = [];

    if (order.customerPhone) {
      const phone = sanitizePhone(order.customerPhone);
      options.push({
        text: '📱 Call Customer',
        onPress: () => openURL(`tel:${phone}`),
      });

      options.push({
        text: '💬 Send SMS',
        onPress: () => {
          const message = `Hi ${order.customerName}, your order ${order.confirmationNumber} is ready for pickup at ${
            businessInfo.businessName || 'our store'
          }!`;
          openURL(`sms:${phone}?body=${encodeURIComponent(message)}`);
        },
      });
    }

    if (order.customerEmail) {
      options.push({
        text: '📧 Send Email',
        onPress: () => {
          const subject = `Order ${order.confirmationNumber} Update`;
          const body = `Hi ${order.customerName},\n\nYour order is ready for pickup!\n\nOrder: ${
            order.confirmationNumber
          }\nTotal: ${fmt(order.total || 0)}\n\nThank you,\n${
            businessInfo.businessName || 'Your Plant Store'
          }`;
          openURL(
            `mailto:${order.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
          );
        },
      });
    }

    options.push({
      text: '💬 Chat with Customer',
      onPress: () => onContactCustomer(order, 'chat'),
    });

    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(
      `Contact ${order.customerName}`,
      `Choose how to contact the customer about order ${order.confirmationNumber}`,
      options
    );
  };

  // Colors/icons
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#FFA000';
      case 'confirmed':
        return '#2196F3';
      case 'ready':
        return '#9C27B0';
      case 'completed':
        return '#4CAF50';
      case 'cancelled':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return 'hourglass-empty';
      case 'confirmed':
        return 'check-circle-outline';
      case 'ready':
        return 'local-shipping';
      case 'completed':
        return 'check-circle';
      case 'cancelled':
        return 'cancel';
      default:
        return 'help-outline';
    }
  };

  const getNextStatusOptions = (currentStatus) => {
    switch (currentStatus) {
      case 'pending':
        return [
          { status: 'confirmed', label: 'Confirm Order', icon: 'check-circle-outline', color: '#2196F3' },
          { status: 'cancelled', label: 'Cancel Order', icon: 'cancel', color: '#F44336' },
        ];
      case 'confirmed':
        return [
          { status: 'ready', label: 'Mark as Ready', icon: 'local-shipping', color: '#9C27B0' },
          { status: 'cancelled', label: 'Cancel Order', icon: 'cancel', color: '#F44336' },
        ];
      case 'ready':
        return [{ status: 'completed', label: 'Complete Order', icon: 'check-circle', color: '#4CAF50' }];
      default:
        return [];
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const renderOrderItem = ({ item, index }) => (
    <View style={[styles.orderItem, index === 0 && styles.firstOrderItem]}>
      <View style={styles.itemIcon}>
        <MaterialCommunityIcons
          name={item.productType === 'plant' ? 'leaf' : 'cube-outline'}
          size={20}
          color="#4CAF50"
        />
      </View>

      <View style={styles.itemDetails}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.itemUnit}>{`${fmt(item.unitPrice || 0)} each`}</Text>
      </View>

      <View style={styles.itemQuantity}>
        <Text style={styles.quantityLabel}>Qty</Text>
        <Text style={styles.quantityValue}>{item.quantity}</Text>
      </View>

      <View style={styles.itemTotal}>
        <Text style={styles.totalValue}>
          {fmt(item.totalPrice ?? (item.unitPrice || 0) * (item.quantity || 0))}
        </Text>
      </View>
    </View>
  );

  if (!visible || !order) return null;

  const statusOptions = getNextStatusOptions(order.status);

  // Web accessibility fix
  function handleCloseModal() {
    if (typeof document !== 'undefined' && modalContentRef.current) {
      const active = document.activeElement;
      if (active && modalContentRef.current.contains(active)) active.blur();
    }
    onClose();
  }

  const contactIconName =
    order?.customerPhone && order?.customerEmail
      ? 'chat'
      : order?.customerPhone
      ? 'phone'
      : order?.customerEmail
      ? 'email'
      : 'chat';

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={handleCloseModal}>
      <View style={styles.overlay}>
        <Animated.View
          ref={modalContentRef}
          style={[styles.modalContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(order.status) }]}>
                <MaterialIcons name={getStatusIcon(order.status)} size={20} color="#fff" />
              </View>
              <View>
                <Text style={styles.headerTitle}>#{order.confirmationNumber}</Text>
                <Text style={styles.headerSubtitle}>
                  {`${formatDate(order.orderDate)} • ${getTimeAgo(order.orderDate)}`}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity style={[styles.headerAction, { marginRight: 8 }]} onPress={handleShareOrder}>
                <MaterialIcons name="share" size={20} color="#666" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <MaterialIcons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Order Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Status</Text>
              <View style={styles.statusContainer}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                  <MaterialIcons name={getStatusIcon(order.status)} size={16} color="#fff" />
                  <Text style={styles.statusText}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Text>
                </View>

                {statusOptions.length > 0 && (
                  <TouchableOpacity
                    style={styles.updateStatusButton}
                    onPress={() => setShowStatusMenu(true)}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="#4CAF50" />
                    ) : (
                      <View style={styles.rowInline}>
                        <MaterialIcons name="edit" size={16} color="#4CAF50" />
                        <Text style={styles.updateStatusText}>Update Status</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Customer Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer Information</Text>
              <View style={styles.customerCard}>
                <View style={styles.customerHeader}>
                  <View style={styles.customerIcon}>
                    <MaterialIcons name="person" size={24} color="#4CAF50" />
                  </View>
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerName}>{order.customerName}</Text>
                    {!!order.customerEmail && <Text style={styles.customerEmail}>{order.customerEmail}</Text>}
                    {!!order.customerPhone && <Text style={styles.customerPhone}>{order.customerPhone}</Text>}
                  </View>
                  <TouchableOpacity
                    style={styles.contactButton}
                    onPress={handleContactCustomer}
                    accessibilityRole="button"
                    accessibilityLabel="Contact customer"
                  >
                    <MaterialIcons name={contactIconName} size={18} color="#4CAF50" />
                    <Text style={styles.contactButtonText}>Contact</Text>
                    <MaterialIcons name="arrow-drop-down" size={18} color="#4CAF50" />
                  </TouchableOpacity>
                </View>

                {order.communication?.preferredMethod && (
                  <View className="communicationPref" style={styles.communicationPref}>
                    <Text style={styles.prefLabel}>Preferred contact:</Text>
                    <Text style={styles.prefValue}>
                      {order.communication.preferredMethod.charAt(0).toUpperCase() +
                        order.communication.preferredMethod.slice(1)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Order Items */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Items ({order.items?.length || 0})</Text>

              <View style={styles.itemsContainer}>
                <FlatList
                  data={order.items || []}
                  renderItem={renderOrderItem}
                  keyExtractor={(item, index) => `${item.id}-${index}`}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
                />
              </View>
            </View>

            {/* Order Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Summary</Text>
              <View style={styles.summaryContainer}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal:</Text>
                  <Text style={styles.summaryValue}>{fmt(order.total || 0)}</Text>
                </View>

                {!!order.tax && order.tax > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Tax:</Text>
                    <Text style={styles.summaryValue}>{fmt(order.tax)}</Text>
                  </View>
                )}

                {!!order.discount && order.discount > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Discount:</Text>
                    <Text style={[styles.summaryValue, styles.discountValue]}>-{fmt(order.discount)}</Text>
                  </View>
                )}

                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total:</Text>
                  <Text style={styles.totalValue}>{fmt(order.total || 0)}</Text>
                </View>
              </View>
            </View>

            {/* Order Notes */}
            {!!order.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Order Notes</Text>
                <View style={styles.notesContainer}>
                  <Text style={styles.notesText}>{order.notes}</Text>
                </View>
              </View>
            )}

            {/* Pickup Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pickup Information</Text>
              <View style={styles.pickupContainer}>
                <View style={styles.pickupItem}>
                  <MaterialIcons name="event" size={16} color="#666" />
                  <Text style={styles.pickupLabel}>Order Date:</Text>
                  <Text style={styles.pickupValue}>{formatDate(order.orderDate)}</Text>
                </View>

                <View style={styles.pickupItem}>
                  <MaterialIcons name="payment" size={16} color="#666" />
                  <Text style={styles.pickupLabel}>Payment:</Text>
                  <Text style={styles.pickupValue}>Pay on pickup</Text>
                </View>

                <View style={styles.pickupItem}>
                  <MaterialIcons name="location-on" size={16} color="#666" />
                  <Text style={styles.pickupLabel}>Location:</Text>
                  <Text style={styles.pickupValue}>{businessInfo.address || 'Store location'}</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Status Update Menu */}
          {showStatusMenu && (
            <View style={styles.statusMenuOverlay}>
              <View style={styles.statusMenu}>
                <Text style={styles.statusMenuTitle}>Update Order Status</Text>

                {statusOptions.map((option) => (
                  <TouchableOpacity
                    key={option.status}
                    style={[styles.statusOption, { borderLeftColor: option.color }]}
                    onPress={() => handleStatusUpdate(option.status)}
                  >
                    <View style={styles.rowInline}>
                      <MaterialIcons name={option.icon} size={20} color={option.color} />
                      <Text style={styles.statusOptionText}>{option.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity style={styles.statusCancel} onPress={() => setShowStatusMenu(false)}>
                  <Text style={styles.statusCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Contact Menu (web only) */}
          {Platform.OS === 'web' && showContactMenu && (
            <View style={styles.statusMenuOverlay}>
              <View style={styles.statusMenu}>
                <Text style={styles.statusMenuTitle}>Contact {order.customerName}</Text>

                {!!order.customerPhone && (
                  <TouchableOpacity
                    style={[styles.statusOption, { borderLeftColor: '#4CAF50' }]}
                    onPress={() => {
                      setShowContactMenu(false);
                      openURL(`tel:${sanitizePhone(order.customerPhone)}`);
                    }}
                  >
                    <View style={styles.rowInline}>
                      <MaterialIcons name="phone" size={20} color="#4CAF50" />
                      <Text style={styles.statusOptionText}>Call</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {!!order.customerPhone && (
                  <TouchableOpacity
                    style={[styles.statusOption, { borderLeftColor: '#2196F3' }]}
                    onPress={() => {
                      setShowContactMenu(false);
                      const msg = `Hi ${order.customerName}, your order ${order.confirmationNumber} is ready for pickup at ${
                        businessInfo.businessName || 'our store'
                      }!`;
                      openURL(`sms:${sanitizePhone(order.customerPhone)}?body=${encodeURIComponent(msg)}`);
                    }}
                  >
                    <View style={styles.rowInline}>
                      <MaterialIcons name="sms" size={20} color="#2196F3" />
                      <Text style={styles.statusOptionText}>SMS</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {!!order.customerEmail && (
                  <TouchableOpacity
                    style={[styles.statusOption, { borderLeftColor: '#9C27B0' }]}
                    onPress={() => {
                      setShowContactMenu(false);
                      const subject = `Order ${order.confirmationNumber} Update`;
                      const body = `Hi ${order.customerName},\n\nYour order is ready for pickup!\n\nOrder: ${
                        order.confirmationNumber
                      }\nTotal: ${fmt(order.total || 0)}\n\nThank you,\n${
                        businessInfo.businessName || 'Your Plant Store'
                      }`;
                      openURL(
                        `mailto:${order.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
                      );
                    }}
                  >
                    <View style={styles.rowInline}>
                      <MaterialIcons name="email" size={20} color="#9C27B0" />
                      <Text style={styles.statusOptionText}>Email</Text>
                    </View>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.statusOption, { borderLeftColor: '#607D8B' }]}
                  onPress={() => {
                    setShowContactMenu(false);
                    onContactCustomer(order, 'chat');
                  }}
                >
                  <View style={styles.rowInline}>
                    <MaterialIcons name="chat" size={20} color="#607D8B" />
                    <Text style={styles.statusOptionText}>Chat</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.statusCancel} onPress={() => setShowContactMenu(false)}>
                  <Text style={styles.statusCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '95%',
    maxHeight: '90%',
    maxWidth: 500,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAction: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  updateStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
    backgroundColor: '#f0f9f3',
  },
  updateStatusText: {
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 6,
  },
  customerCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  customerEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  customerPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  contactButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactButtonText: {
    marginLeft: 6,
    marginRight: 2,
    color: '#4CAF50',
    fontWeight: '600',
  },
  communicationPref: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  prefLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  prefValue: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  itemsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  firstOrderItem: {
    paddingTop: 16,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f9f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  itemUnit: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  itemQuantity: {
    alignItems: 'center',
    marginRight: 16,
  },
  quantityLabel: {
    fontSize: 10,
    color: '#666',
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  itemTotal: {
    alignItems: 'flex-end',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  itemSeparator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
  },
  summaryContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  discountValue: {
    color: '#4CAF50',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  notesContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  pickupContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
  },
  pickupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickupLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    marginRight: 8,
    minWidth: 80,
  },
  pickupValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  statusMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  statusMenuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
    borderLeftWidth: 3,
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  statusCancel: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  statusCancelText: {
    fontSize: 14,
    color: '#666',
  },
  rowInline: { flexDirection: 'row', alignItems: 'center' },
});
