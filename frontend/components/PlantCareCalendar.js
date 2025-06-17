import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CARE_TYPES = {
  water: { 
    icon: 'water', 
    color: '#2196F3', 
    label: 'Water',
    bgColor: '#E3F2FD'
  },
  feed: { 
    icon: 'leaf', 
    color: '#4CAF50', 
    label: 'Feed',
    bgColor: '#E8F5E8'
  },
  repot: { 
    icon: 'pot-mix', 
    color: '#FF9800', 
    label: 'Repot',
    bgColor: '#FFF3E0'
  },
  prune: { 
    icon: 'content-cut', 
    color: '#9C27B0', 
    label: 'Prune',
    bgColor: '#F3E5F5'
  }
};

export default function PlantCareCalendar({ plants = [], onTaskComplete, onRefresh }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'month'
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [careSchedule, setCareSchedule] = useState({});

  useEffect(() => {
    generateCareSchedule();
  }, [plants]);

  const generateCareSchedule = () => {
    const schedule = {};
    const today = new Date();
    
    plants.forEach(plant => {
      // Water schedule
      if (plant.next_water) {
        const waterDate = new Date(plant.next_water);
        const dateKey = waterDate.toDateString();
        
        if (!schedule[dateKey]) schedule[dateKey] = [];
        schedule[dateKey].push({
          id: `${plant.id}-water`,
          plantId: plant.id,
          plantName: plant.nickname || plant.common_name,
          type: 'water',
          date: waterDate,
          completed: false,
          overdue: waterDate < today
        });
      }

      // Feed schedule
      if (plant.next_feed) {
        const feedDate = new Date(plant.next_feed);
        const dateKey = feedDate.toDateString();
        
        if (!schedule[dateKey]) schedule[dateKey] = [];
        schedule[dateKey].push({
          id: `${plant.id}-feed`,
          plantId: plant.id,
          plantName: plant.nickname || plant.common_name,
          type: 'feed',
          date: feedDate,
          completed: false,
          overdue: feedDate < today
        });
      }

      // Repot schedule
      if (plant.next_repot) {
        const repotDate = new Date(plant.next_repot);
        const dateKey = repotDate.toDateString();
        
        if (!schedule[dateKey]) schedule[dateKey] = [];
        schedule[dateKey].push({
          id: `${plant.id}-repot`,
          plantId: plant.id,
          plantName: plant.nickname || plant.common_name,
          type: 'repot',
          date: repotDate,
          completed: false,
          overdue: repotDate < today
        });
      }
    });

    setCareSchedule(schedule);
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const getWeekDates = (date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      weekDates.push(currentDate);
    }
    return weekDates;
  };

  const getMonthDates = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from Sunday before first day
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());
    
    // End on Saturday after last day
    const endDate = new Date(lastDay);
    endDate.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
    
    const monthDates = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      monthDates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return monthDates;
  };

  const getTasksForDate = (date) => {
    const dateKey = date.toDateString();
    return careSchedule[dateKey] || [];
  };

  const handleDatePress = (date) => {
    const tasks = getTasksForDate(date);
    if (tasks.length > 0) {
      setSelectedDate(date);
      setSelectedTasks(tasks);
      setModalVisible(true);
    }
  };

  const handleTaskComplete = async (task) => {
    setLoading(true);
    try {
      // Update the task locally
      const updatedTasks = selectedTasks.map(t => 
        t.id === task.id ? { ...t, completed: true } : t
      );
      setSelectedTasks(updatedTasks);

      // Update in schedule
      const dateKey = task.date.toDateString();
      const updatedSchedule = { ...careSchedule };
      if (updatedSchedule[dateKey]) {
        updatedSchedule[dateKey] = updatedSchedule[dateKey].map(t => 
          t.id === task.id ? { ...t, completed: true } : t
        );
      }
      setCareSchedule(updatedSchedule);

      // Call parent callback
      if (onTaskComplete) {
        await onTaskComplete(task);
      }

      // Refresh plant data
      if (onRefresh) {
        await onRefresh();
      }

      Alert.alert('Success', `${task.plantName} ${task.type} completed!`);
      
    } catch (error) {
      console.error('Error completing task:', error);
      Alert.alert('Error', 'Failed to complete task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(currentDate.getDate() + (direction * 7));
    } else {
      newDate.setMonth(currentDate.getMonth() + direction);
    }
    setCurrentDate(newDate);
  };

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate);
    
    return (
      <View style={styles.weekContainer}>
        <View style={styles.weekHeader}>
          {DAYS_OF_WEEK.map((day, index) => (
            <Text key={day} style={styles.dayHeader}>{day}</Text>
          ))}
        </View>
        
        <View style={styles.weekDates}>
          {weekDates.map((date, index) => {
            const tasks = getTasksForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateCell,
                  isToday && styles.todayCell,
                  !isCurrentMonth && styles.otherMonthCell
                ]}
                onPress={() => handleDatePress(date)}
              >
                <Text style={[
                  styles.dateText,
                  isToday && styles.todayText,
                  !isCurrentMonth && styles.otherMonthText
                ]}>
                  {date.getDate()}
                </Text>
                
                {tasks.length > 0 && (
                  <View style={styles.tasksIndicator}>
                    {tasks.slice(0, 3).map((task, taskIndex) => (
                      <View
                        key={taskIndex}
                        style={[
                          styles.taskDot,
                          { backgroundColor: CARE_TYPES[task.type]?.color || '#999' },
                          task.overdue && styles.overdueDot,
                          task.completed && styles.completedDot
                        ]}
                      />
                    ))}
                    {tasks.length > 3 && (
                      <Text style={styles.moreTasksText}>+{tasks.length - 3}</Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderMonthView = () => {
    const monthDates = getMonthDates(currentDate);
    const weeks = [];
    
    for (let i = 0; i < monthDates.length; i += 7) {
      weeks.push(monthDates.slice(i, i + 7));
    }
    
    return (
      <View style={styles.monthContainer}>
        <View style={styles.weekHeader}>
          {DAYS_OF_WEEK.map((day) => (
            <Text key={day} style={styles.dayHeader}>{day}</Text>
          ))}
        </View>
        
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {week.map((date, dayIndex) => {
              const tasks = getTasksForDate(date);
              const isToday = date.toDateString() === new Date().toDateString();
              const isCurrentMonth = date.getMonth() === currentDate.getMonth();
              
              return (
                <TouchableOpacity
                  key={dayIndex}
                  style={[
                    styles.monthDateCell,
                    isToday && styles.todayCell,
                    !isCurrentMonth && styles.otherMonthCell
                  ]}
                  onPress={() => handleDatePress(date)}
                >
                  <Text style={[
                    styles.monthDateText,
                    isToday && styles.todayText,
                    !isCurrentMonth && styles.otherMonthText
                  ]}>
                    {date.getDate()}
                  </Text>
                  
                  {tasks.length > 0 && (
                    <View style={styles.monthTasksIndicator}>
                      {tasks.slice(0, 2).map((task, taskIndex) => (
                        <View
                          key={taskIndex}
                          style={[
                            styles.monthTaskDot,
                            { backgroundColor: CARE_TYPES[task.type]?.color || '#999' },
                            task.overdue && styles.overdueDot,
                            task.completed && styles.completedDot
                          ]}
                        />
                      ))}
                      {tasks.length > 2 && (
                        <Text style={styles.monthMoreTasksText}>+</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const renderTaskModal = () => {
    return (
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDate && formatDate(selectedDate)}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.tasksContainer}>
              {selectedTasks.map((task) => (
                <View key={task.id} style={styles.taskItem}>
                  <View style={styles.taskInfo}>
                    <View style={[
                      styles.taskIcon,
                      { backgroundColor: CARE_TYPES[task.type]?.bgColor || '#f5f5f5' }
                    ]}>
                      <MaterialCommunityIcons
                        name={CARE_TYPES[task.type]?.icon || 'help'}
                        size={20}
                        color={CARE_TYPES[task.type]?.color || '#666'}
                      />
                    </View>
                    
                    <View style={styles.taskDetails}>
                      <Text style={styles.taskPlantName}>{task.plantName}</Text>
                      <Text style={styles.taskType}>
                        {CARE_TYPES[task.type]?.label || task.type}
                      </Text>
                      {task.overdue && (
                        <Text style={styles.overdueText}>Overdue</Text>
                      )}
                    </View>
                  </View>
                  
                  <TouchableOpacity
                    style={[
                      styles.completeButton,
                      task.completed && styles.completedButton
                    ]}
                    onPress={() => handleTaskComplete(task)}
                    disabled={task.completed || loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <MaterialIcons
                        name={task.completed ? "check" : "check-circle"}
                        size={20}
                        color="#fff"
                      />
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigateDate(-1)}
          style={styles.navButton}
        >
          <MaterialIcons name="chevron-left" size={24} color="#4CAF50" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.dateTitle}>
          <Text style={styles.dateText}>
            {viewMode === 'week' 
              ? `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
            }
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => navigateDate(1)}
          style={styles.navButton}
        >
          <MaterialIcons name="chevron-right" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'week' && styles.activeToggle]}
          onPress={() => setViewMode('week')}
        >
          <Text style={[styles.toggleText, viewMode === 'week' && styles.activeToggleText]}>
            Week
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'month' && styles.activeToggle]}
          onPress={() => setViewMode('month')}
        >
          <Text style={[styles.toggleText, viewMode === 'month' && styles.activeToggleText]}>
            Month
          </Text>
        </TouchableOpacity>
      </View>

      {/* Calendar View */}
      {viewMode === 'week' ? renderWeekView() : renderMonthView()}

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Care Types:</Text>
        <View style={styles.legendItems}>
          {Object.entries(CARE_TYPES).map(([key, type]) => (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: type.color }]} />
              <Text style={styles.legendText}>{type.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Task Modal */}
      {renderTaskModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTitle: {
    flex: 1,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeToggle: {
    backgroundColor: '#4CAF50',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeToggleText: {
    color: '#fff',
  },
  weekContainer: {
    paddingHorizontal: 16,
  },
  monthContainer: {
    paddingHorizontal: 16,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    paddingVertical: 8,
  },
  weekDates: {
    flexDirection: 'row',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dateCell: {
    flex: 1,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    margin: 1,
    padding: 8,
    alignItems: 'center',
  },
  monthDateCell: {
    flex: 1,
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    margin: 0.5,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  todayCell: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
  },
  otherMonthCell: {
    backgroundColor: '#f9f9f9',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  monthDateText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  todayText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  otherMonthText: {
    color: '#ccc',
  },
  tasksIndicator: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    alignItems: 'center',
  },
  monthTasksIndicator: {
    flexDirection: 'row',
    marginTop: 2,
    alignItems: 'center',
  },
  taskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    margin: 1,
  },
  monthTaskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    margin: 1,
  },
  overdueDot: {
    borderWidth: 2,
    borderColor: '#f44336',
  },
  completedDot: {
    opacity: 0.5,
  },
  moreTasksText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 2,
  },
  monthMoreTasksText: {
    fontSize: 8,
    color: '#666',
    marginLeft: 1,
  },
  legend: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasksContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 8,
  },
  taskInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  taskIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  taskDetails: {
    flex: 1,
  },
  taskPlantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  taskType: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  overdueText: {
    fontSize: 12,
    color: '#f44336',
    fontWeight: '500',
    marginTop: 2,
  },
  completeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedButton: {
    backgroundColor: '#81c784',
  },
});