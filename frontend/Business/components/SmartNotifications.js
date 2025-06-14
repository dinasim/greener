// Business/components/SmartNotifications.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default class SmartNotifications {
  constructor() {
    this.initialized = false;
    this.weatherCache = new Map();
    this.scheduledNotifications = new Map();
    this.init();
  }

  async init() {
    try {
      // Request permissions
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          console.warn('Notification permissions not granted');
          return;
        }
      }

      // Set up notification categories
      await this.setupNotificationCategories();
      
      this.initialized = true;
      console.log('Smart Notifications initialized');
    } catch (error) {
      console.error('Error initializing Smart Notifications:', error);
    }
  }

  async setupNotificationCategories() {
    try {
      await Notifications.setNotificationCategoryAsync('watering', [
        {
          identifier: 'mark_watered',
          buttonTitle: 'Mark as Watered',
          options: { opensAppToForeground: false },
        },
        {
          identifier: 'snooze_1h',
          buttonTitle: 'Remind in 1h',
          options: { opensAppToForeground: false },
        },
      ]);

      await Notifications.setNotificationCategoryAsync('seasonal_care', [
        {
          identifier: 'view_tips',
          buttonTitle: 'View Tips',
          options: { opensAppToForeground: true },
        },
        {
          identifier: 'dismiss',
          buttonTitle: 'Dismiss',
          options: { opensAppToForeground: false },
        },
      ]);

      await Notifications.setNotificationCategoryAsync('weather_alert', [
        {
          identifier: 'adjust_schedule',
          buttonTitle: 'Adjust Schedule',
          options: { opensAppToForeground: true },
        },
        {
          identifier: 'keep_schedule',
          buttonTitle: 'Keep Current',
          options: { opensAppToForeground: false },
        },
      ]);
    } catch (error) {
      console.error('Error setting up notification categories:', error);
    }
  }

  // Weather-based watering adjustments
  async checkWeatherAndAdjustWatering(businessId, location) {
    try {
      const weatherData = await this.getWeatherData(location);
      
      if (!weatherData) return null;

      const adjustments = this.calculateWateringAdjustments(weatherData);
      
      if (adjustments.shouldNotify) {
        await this.sendWeatherBasedNotification(businessId, adjustments);
      }

      return adjustments;
    } catch (error) {
      console.error('Error checking weather for watering adjustments:', error);
      return null;
    }
  }

  async getWeatherData(location) {
    try {
      const cacheKey = `${location.lat}_${location.lon}`;
      const cached = this.weatherCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
        return cached.data;
      }

      const response = await fetch(
        `${API_BASE_URL}/business-weather-get?lat=${location.lat}&lon=${location.lon}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!response.ok) {
        throw new Error('Weather API request failed');
      }

      const weatherData = await response.json();
      
      // Cache the weather data
      this.weatherCache.set(cacheKey, {
        data: weatherData,
        timestamp: Date.now()
      });

      return weatherData;
    } catch (error) {
      console.error('Error fetching weather data:', error);
      return null;
    }
  }

  calculateWateringAdjustments(weatherData) {
    const {
      current,
      forecast = [],
      precipitation,
      humidity,
      temperature
    } = weatherData;

    let adjustments = {
      shouldNotify: false,
      adjustmentType: 'none',
      message: '',
      recommendedAction: '',
      delayDays: 0,
      urgency: 'normal'
    };

    // Check for recent or upcoming rain
    const recentRain = precipitation?.last24h > 5; // mm
    const upcomingRain = forecast.some(day => 
      day.precipitation > 5 && 
      new Date(day.date) <= new Date(Date.now() + 48 * 60 * 60 * 1000)
    );

    // High humidity check
    const highHumidity = humidity > 80;

    // Temperature extremes
    const hotWeather = temperature > 30; // Celsius
    const coldWeather = temperature < 10; // Celsius

    if (recentRain) {
      adjustments = {
        shouldNotify: true,
        adjustmentType: 'delay',
        message: '🌧️ Recent rainfall detected',
        recommendedAction: 'Consider delaying watering by 1-2 days',
        delayDays: 2,
        urgency: 'low'
      };
    } else if (upcomingRain) {
      adjustments = {
        shouldNotify: true,
        adjustmentType: 'delay',
        message: '🌦️ Rain expected in next 48 hours',
        recommendedAction: 'Skip watering - rain will provide moisture',
        delayDays: 1,
        urgency: 'normal'
      };
    } else if (highHumidity && !hotWeather) {
      adjustments = {
        shouldNotify: true,
        adjustmentType: 'reduce',
        message: '💧 High humidity levels detected',
        recommendedAction: 'Reduce watering frequency slightly',
        delayDays: 1,
        urgency: 'low'
      };
    } else if (hotWeather) {
      adjustments = {
        shouldNotify: true,
        adjustmentType: 'increase',
        message: '🌡️ High temperatures detected',
        recommendedAction: 'Consider more frequent watering',
        delayDays: -1, // Advance watering
        urgency: 'high'
      };
    } else if (coldWeather) {
      adjustments = {
        shouldNotify: true,
        adjustmentType: 'delay',
        message: '❄️ Cold weather detected',
        recommendedAction: 'Reduce watering frequency in cold conditions',
        delayDays: 1,
        urgency: 'normal'
      };
    }

    return adjustments;
  }

  async sendWeatherBasedNotification(businessId, adjustments) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Weather-Based Watering Alert',
          body: `${adjustments.message}\n${adjustments.recommendedAction}`,
          categoryIdentifier: 'weather_alert',
          data: {
            type: 'weather_adjustment',
            businessId,
            adjustments,
            timestamp: new Date().toISOString()
          },
          sound: adjustments.urgency === 'high' ? 'default' : null,
          priority: adjustments.urgency === 'high' ? 'high' : 'normal',
        },
        trigger: null, // Send immediately
      });

      console.log('Weather-based notification sent:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Error sending weather notification:', error);
      return null;
    }
  }

  // Seasonal care reminders
  async scheduleSeasonalReminders(businessId, userLocation) {
    try {
      const currentSeason = this.getCurrentSeason(userLocation);
      const seasonalTasks = this.getSeasonalTasks(currentSeason);

      for (const task of seasonalTasks) {
        await this.scheduleSeasonalTask(businessId, task, currentSeason);
      }

      console.log(`Scheduled ${seasonalTasks.length} seasonal reminders for ${currentSeason}`);
    } catch (error) {
      console.error('Error scheduling seasonal reminders:', error);
    }
  }

  getCurrentSeason(userLocation) {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const isNorthernHemisphere = userLocation.lat > 0;

    let season;
    if (isNorthernHemisphere) {
      if (month >= 3 && month <= 5) season = 'spring';
      else if (month >= 6 && month <= 8) season = 'summer';
      else if (month >= 9 && month <= 11) season = 'autumn';
      else season = 'winter';
    } else {
      // Southern hemisphere - seasons are opposite
      if (month >= 3 && month <= 5) season = 'autumn';
      else if (month >= 6 && month <= 8) season = 'winter';
      else if (month >= 9 && month <= 11) season = 'spring';
      else season = 'summer';
    }

    return season;
  }

  getSeasonalTasks(season) {
    const tasks = {
      spring: [
        {
          id: 'spring_repotting',
          title: '🌱 Spring Repotting Time',
          body: 'Many plants benefit from repotting in spring when they start their growing season.',
          triggerDays: 7,
          category: 'repotting',
          urgency: 'normal'
        },
        {
          id: 'spring_fertilizing',
          title: '🌿 Begin Spring Fertilizing',
          body: 'Start feeding your plants as they enter their active growing period.',
          triggerDays: 14,
          category: 'fertilizing',
          urgency: 'normal'
        },
        {
          id: 'spring_pruning',
          title: '✂️ Spring Pruning',
          body: 'Prune dead or damaged growth to encourage healthy spring growth.',
          triggerDays: 21,
          category: 'pruning',
          urgency: 'low'
        }
      ],
      summer: [
        {
          id: 'summer_watering',
          title: '💧 Increase Summer Watering',
          body: 'Plants need more water during hot summer months. Check soil moisture more frequently.',
          triggerDays: 3,
          category: 'watering',
          urgency: 'high'
        },
        {
          id: 'summer_shade',
          title: '☀️ Provide Summer Shade',
          body: 'Protect plants from intense afternoon sun with shade cloth or repositioning.',
          triggerDays: 7,
          category: 'light_management',
          urgency: 'normal'
        }
      ],
      autumn: [
        {
          id: 'autumn_fertilizer_reduction',
          title: '🍂 Reduce Autumn Fertilizing',
          body: 'Start reducing fertilizer as plants prepare for dormancy.',
          triggerDays: 10,
          category: 'fertilizing',
          urgency: 'normal'
        },
        {
          id: 'autumn_watering_reduction',
          title: '🍃 Adjust Watering for Fall',
          body: 'Reduce watering frequency as plant growth slows and humidity increases.',
          triggerDays: 14,
          category: 'watering',
          urgency: 'normal'
        }
      ],
      winter: [
        {
          id: 'winter_watering_minimal',
          title: '❄️ Minimal Winter Watering',
          body: 'Most plants need much less water in winter. Check soil before watering.',
          triggerDays: 5,
          category: 'watering',
          urgency: 'high'
        },
        {
          id: 'winter_humidity',
          title: '💨 Winter Humidity Care',
          body: 'Indoor heating can dry the air. Consider humidifiers or pebble trays.',
          triggerDays: 7,
          category: 'humidity',
          urgency: 'normal'
        },
        {
          id: 'winter_light',
          title: '💡 Winter Light Adjustment',
          body: 'Move plants closer to windows or add grow lights during shorter days.',
          triggerDays: 14,
          category: 'light_management',
          urgency: 'normal'
        }
      ]
    };

    return tasks[season] || [];
  }

  async scheduleSeasonalTask(businessId, task, season) {
    try {
      const triggerDate = new Date();
      triggerDate.setDate(triggerDate.getDate() + task.triggerDays);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: task.title,
          body: task.body,
          categoryIdentifier: 'seasonal_care',
          data: {
            type: 'seasonal_reminder',
            businessId,
            taskId: task.id,
            season,
            category: task.category,
            timestamp: new Date().toISOString()
          },
          sound: task.urgency === 'high' ? 'default' : null,
        },
        trigger: {
          date: triggerDate,
        },
      });

      this.scheduledNotifications.set(`${businessId}_${task.id}`, notificationId);
      console.log(`Scheduled seasonal task: ${task.id} for ${triggerDate}`);
      
      return notificationId;
    } catch (error) {
      console.error('Error scheduling seasonal task:', error);
      return null;
    }
  }

  // Plant-specific smart reminders
  async scheduleSmartPlantReminders(businessId, plants) {
    try {
      for (const plant of plants) {
        await this.scheduleSmartPlantReminder(businessId, plant);
      }
    } catch (error) {
      console.error('Error scheduling smart plant reminders:', error);
    }
  }

  async scheduleSmartPlantReminder(businessId, plant) {
    try {
      const careSchedule = this.calculateSmartCareSchedule(plant);
      
      for (const reminder of careSchedule) {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: reminder.title,
            body: reminder.body,
            categoryIdentifier: reminder.category,
            data: {
              type: 'smart_plant_reminder',
              businessId,
              plantId: plant.id,
              plantName: plant.name || plant.common_name,
              reminderType: reminder.type,
              timestamp: new Date().toISOString()
            },
            sound: reminder.urgent ? 'default' : null,
          },
          trigger: {
            date: reminder.triggerDate,
          },
        });

        console.log(`Scheduled smart reminder for ${plant.name}: ${reminder.type}`);
      }
    } catch (error) {
      console.error('Error scheduling smart plant reminder:', error);
    }
  }

  calculateSmartCareSchedule(plant) {
    const schedule = [];
    const now = new Date();
    
    // Watering reminder
    if (plant.wateringSchedule && plant.wateringSchedule.needsWatering) {
      const wateringDate = new Date(now);
      wateringDate.setHours(7, 0, 0, 0); // 7 AM next day
      wateringDate.setDate(wateringDate.getDate() + 1);
      
      schedule.push({
        type: 'watering',
        title: `💧 ${plant.name || plant.common_name} needs watering`,
        body: `It's time to water your ${plant.name || plant.common_name}. Check soil moisture first.`,
        triggerDate: wateringDate,
        category: 'watering',
        urgent: false
      });
    }

    // Fertilizing reminder (monthly)
    const fertilizeDate = new Date(now);
    fertilizeDate.setDate(fertilizeDate.getDate() + 30);
    fertilizeDate.setHours(9, 0, 0, 0);
    
    schedule.push({
      type: 'fertilizing',
      title: `🌿 Time to fertilize ${plant.name || plant.common_name}`,
      body: `Monthly fertilizing helps keep your ${plant.name || plant.common_name} healthy and growing.`,
      triggerDate: fertilizeDate,
      category: 'seasonal_care',
      urgent: false
    });

    // Health check reminder (bi-weekly)
    const healthCheckDate = new Date(now);
    healthCheckDate.setDate(healthCheckDate.getDate() + 14);
    healthCheckDate.setHours(10, 0, 0, 0);
    
    schedule.push({
      type: 'health_check',
      title: `🔍 Health check for ${plant.name || plant.common_name}`,
      body: `Check for pests, diseases, and overall plant health. Look for any changes in leaves or growth.`,
      triggerDate: healthCheckDate,
      category: 'seasonal_care',
      urgent: false
    });

    return schedule;
  }

  // Cancel notifications
  async cancelNotification(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('Cancelled notification:', notificationId);
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  }

  async cancelAllBusinessNotifications(businessId) {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      for (const notification of scheduledNotifications) {
        if (notification.content.data?.businessId === businessId) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }
      
      console.log(`Cancelled all notifications for business: ${businessId}`);
    } catch (error) {
      console.error('Error cancelling business notifications:', error);
    }
  }

  // Analytics and insights
  async getNotificationAnalytics(businessId) {
    try {
      const delivered = await Notifications.getPresentedNotificationsAsync();
      const businessNotifications = delivered.filter(
        notification => notification.request.content.data?.businessId === businessId
      );

      const analytics = {
        totalDelivered: businessNotifications.length,
        byType: {},
        byCategory: {},
        effectiveness: {
          opened: 0,
          dismissed: 0,
          actionTaken: 0
        }
      };

      businessNotifications.forEach(notification => {
        const type = notification.request.content.data?.type || 'unknown';
        const category = notification.request.content.data?.category || 'general';
        
        analytics.byType[type] = (analytics.byType[type] || 0) + 1;
        analytics.byCategory[category] = (analytics.byCategory[category] || 0) + 1;
      });

      return analytics;
    } catch (error) {
      console.error('Error getting notification analytics:', error);
      return null;
    }
  }
}

// Export singleton instance
export const smartNotifications = new SmartNotifications();