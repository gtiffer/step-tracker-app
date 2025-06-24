import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity } from 'react-native';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [activeTab, setActiveTab] = React.useState('Steps');
  const [pedometerPermission, setPedometerPermission] = React.useState<string | null>(null);
  const [todaySteps, setTodaySteps] = React.useState<number | null>(null);
  const [weeklyStepData, setWeeklyStepData] = React.useState<{[key: string]: number}>({});
  const [weekDateRange, setWeekDateRange] = React.useState<string>('');
  const [stepError, setStepError] = React.useState<string | null>(null);

  // Function to fetch today's actual step count
  const fetchTodaySteps = async () => {
    try {
      console.log('Fetching today\'s step count...');
      
      // Get today's date range (start of day to now)
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Try to load saved data first
      const todayDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const savedSteps = await loadTodaySteps(todayDate);
      
      console.log('Date range:', startOfDay, 'to', now);
      
      // Check if pedometer is available first
      const isAvailable = await Pedometer.isAvailableAsync();
      
      let result;
      if (isAvailable) {
        // Get real step count from pedometer
        result = await Pedometer.getStepCountAsync(startOfDay, now);
      } else {
        // Use mock data for simulator testing
        console.log('Using mock data for simulator testing');
        result = { steps: 5432 };
      }
      
      console.log('Step count result:', result);
      console.log('Today\'s steps:', result.steps);
      
      // Test the 10K achievement function
      checkIfDayHit10K(result.steps);
      
      // Test the calendar color function
      getCalendarColorForSteps(result.steps);
      
      setTodaySteps(result.steps);
      setStepError(null);
      
      // Save today's step data to local storage
      console.log('Saving steps with date format:', todayDate);
      await saveTodaySteps(result.steps, todayDate);
      
    } catch (error) {
      console.error('Error fetching step count:', error);
      setStepError('Failed to fetch step data');
      setTodaySteps(null);
    }
  };

  // Function to load all weekly step data for calendar
  const loadWeeklyStepData = async () => {
    try {
      console.log('Loading weekly step data for calendar...');
      const now = new Date();
      
      // Calculate the start of the current week (Sunday)
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - currentDay);
      startOfWeek.setHours(0, 0, 0, 0);
      
      // Calculate the end of the current week (Saturday)
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      
      console.log('📅 Current week range:');
      console.log('  Start (Sunday):', startOfWeek.toDateString());
      console.log('  End (Saturday):', endOfWeek.toDateString());
      
      // Format the week date range for display
      const formatDate = (date: Date) => {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
        return `${months[date.getMonth()]} ${date.getDate()}`;
      };
      
      const weekRange = `Week of ${formatDate(startOfWeek)}-${formatDate(endOfWeek)}, ${startOfWeek.getFullYear()}`;
      setWeekDateRange(weekRange);
      console.log('📅 Week display:', weekRange);
      
      const weekData: {[key: string]: number} = {};
      
      // Check if pedometer is available for fetching historical data
      const isAvailable = await Pedometer.isAvailableAsync();
      
      // Load step data for each day of the current week (7 days)
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const targetDate = new Date(startOfWeek);
        targetDate.setDate(startOfWeek.getDate() + dayOffset);
        
        const dateString = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        const dayKey = `day_${dayOffset}`; // day_0 = Sunday, day_1 = Monday, etc.
        
        let savedSteps = await loadTodaySteps(dateString);
        
        if (savedSteps !== null) {
          // Use existing saved data
          weekData[dayKey] = savedSteps;
          console.log(`${targetDate.toDateString()}: Using saved data (${savedSteps} steps)`);
        } else if (isAvailable) {
          // Fetch historical data from Apple Health
          try {
            console.log(`🔍 HEALTH DEBUG - ${targetDate.toDateString()}: Fetching from Apple Health...`);
            
            // Create full day range for this specific day
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);
            
            console.log(`🔍 HEALTH DEBUG - Requested date: ${dateString}`);
            console.log(`🔍 HEALTH DEBUG - Start time: ${startOfDay.toISOString()}`);
            console.log(`🔍 HEALTH DEBUG - End time: ${endOfDay.toISOString()}`);
            console.log(`🔍 HEALTH DEBUG - Days ago: ${Math.floor((now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60 * 24))}`);
            
            // Get complete step count for this day from Apple Health
            const result = await Pedometer.getStepCountAsync(startOfDay, endOfDay);
            const daySteps = result.steps;
            
            console.log(`🔍 HEALTH DEBUG - API Response:`, result);
            console.log(`🔍 HEALTH DEBUG - Steps returned: ${daySteps}`);
            
            // Check if we got valid data
            if (daySteps === 0) {
              console.log(`⚠️ HEALTH DEBUG - Zero steps returned for ${dateString} - may indicate no data available`);
            } else if (daySteps > 0) {
              console.log(`✅ HEALTH DEBUG - Valid step data retrieved for ${dateString}`);
            }
            
            console.log(`${targetDate.toDateString()}: Retrieved ${daySteps} steps from Health`);
            
            // Save to AsyncStorage for future use
            await saveTodaySteps(daySteps, dateString);
            
            // Add to week data
            weekData[dayKey] = daySteps;
            
          } catch (dayError: any) {
            console.error(`🔍 HEALTH DEBUG - Error fetching ${targetDate.toDateString()} from Health:`, dayError);
            console.error(`🔍 HEALTH DEBUG - Error type:`, dayError.constructor.name);
            console.error(`🔍 HEALTH DEBUG - Error message:`, dayError.message);
            
            // Check for specific error types
            if (dayError.message && dayError.message.includes('permission')) {
              console.error(`🔍 HEALTH DEBUG - Permission-related error for ${targetDate.toDateString()}`);
            } else if (dayError.message && dayError.message.includes('data')) {
              console.error(`🔍 HEALTH DEBUG - Data availability error for ${targetDate.toDateString()}`);
            } else if (dayError.message && dayError.message.includes('range')) {
              console.error(`🔍 HEALTH DEBUG - Date range error for ${targetDate.toDateString()}`);
            }
            
            // Leave this day out of weekData (will show gray)
          }
        } else {
          console.log(`${targetDate.toDateString()}: No saved data and pedometer unavailable`);
          // Leave this day out of weekData (will show gray)
        }
      }
      
      console.log('Loaded step data for', Object.keys(weekData).length, 'days out of 7 days in current week');
      
      // Log API optimization
      console.log('🔍 API OPTIMIZATION:');
      console.log('📱 Using weekly view (7 days) instead of monthly (30 days)');
      console.log('⚡ Reduced API calls by ~75% compared to monthly view');
      console.log('🎯 Working within 8-day API limitation effectively');
      console.log(`📈 Data availability: ${Object.keys(weekData).length} out of 7 days retrieved`);
      
      if (Object.keys(weekData).length >= 5) {
        console.log('✅ GOOD COVERAGE: Most days in the week have step data');
      } else if (Object.keys(weekData).length >= 3) {
        console.log('⚠️ PARTIAL COVERAGE: Some days in the week have step data');
      } else {
        console.log('❌ LOW COVERAGE: Few days in the week have step data');
      }
      
      setWeeklyStepData(weekData);
      
    } catch (error) {
      console.error('Error loading weekly step data:', error);
    }
  };

  // Function to request pedometer permissions
  const requestPedometerPermissions = async () => {
    try {
      console.log('Requesting pedometer permissions...');
      
      // Check if pedometer is available on the device
      const isAvailable = await Pedometer.isAvailableAsync();
      console.log('Pedometer available:', isAvailable);
      
      if (isAvailable) {
        // Request permissions
        const { status } = await Pedometer.requestPermissionsAsync();
        console.log('Pedometer permission status:', status);
        
        // Get current permissions to see what we actually have
        const currentPermissions = await Pedometer.getPermissionsAsync();
        console.log('🔍 PERMISSION DEBUG - Current permissions:', currentPermissions);
        console.log('🔍 PERMISSION DEBUG - Granted:', currentPermissions.granted);
        console.log('🔍 PERMISSION DEBUG - Can ask again:', currentPermissions.canAskAgain);
        
        setPedometerPermission(status);
        
        if (status === 'granted') {
          console.log('✅ Pedometer permissions granted! Ready to track steps.');
          // Fetch today's steps once permissions are granted
          await fetchTodaySteps();
          // Load all weekly step data for calendar
          await loadWeeklyStepData();
        } else {
          console.log('❌ Pedometer permissions denied or restricted.');
        }
      } else {
        console.log('❌ Pedometer not available on this device.');
        setPedometerPermission('unavailable');
        // Still test with mock data for storage functionality
        console.log('Pedometer unavailable, but testing with mock data');
        await fetchTodaySteps();
        // Load all weekly step data for calendar
        await loadWeeklyStepData();
      }
    } catch (error) {
      console.error('Error requesting pedometer permissions:', error);
      setPedometerPermission('error');
    }
  };

  // Request permissions when component mounts
  React.useEffect(() => {
    requestPedometerPermissions();
  }, []);

  // Function to get color based on activity level
  const getActivityColor = (level: number): string => {
    const colors: { [key: number]: string } = {
      0: '#f0f0f0', // Gray for no activity
      1: '#c6e48b', // Light green
      2: '#7bc96f', // Medium light green
      3: '#239a3b', // Medium green
      4: '#196127', // Dark green
    };
    return colors[level];
  };

  // Function to render calendar grid
  const renderCalendarGrid = () => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - currentDay);
    
    const weekDays: React.ReactElement[] = [];
    
    // Generate 7 days for the current week (Sunday through Saturday)
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDate = new Date(startOfWeek);
      targetDate.setDate(startOfWeek.getDate() + dayOffset);
      
      const dayKey = `day_${dayOffset}`;
      const isToday = targetDate.toDateString() === now.toDateString();
      
      // Get color based on available step data
      let backgroundColor;
      if (isToday && todaySteps !== null) {
        backgroundColor = getCalendarColorForSteps(todaySteps);
      } else if (weeklyStepData[dayKey] !== undefined) {
        backgroundColor = getCalendarColorForSteps(weeklyStepData[dayKey]);
      } else {
        backgroundColor = '#f0f0f0'; // Gray for no data
      }
      
      weekDays.push(
        <View 
          key={dayOffset} 
          style={[
            styles.dayCell, 
            { backgroundColor }
          ]}
        >
          <Text style={styles.dayNumber}>{targetDate.getDate()}</Text>
        </View>
      );
    }
    
    // Return a single row with all 7 days
    return (
      <View style={styles.weekRow}>
        {weekDays}
      </View>
    );
  };

  // Function to render day headers
  const renderDayHeaders = () => {
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return (
      <View style={styles.headerRow}>
        {dayLabels.map((day, index) => (
          <View key={index} style={styles.headerCell}>
            <Text style={styles.headerText}>{day}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Helper function to format step count
  const formatStepCount = (steps: number | null): string => {
    if (steps === null) return '---';
    return steps.toLocaleString(); // Formats with commas (e.g., 7,842)
  };

  // Function to save today's step data to local storage
  const saveTodaySteps = async (stepCount: number, date: string) => {
    try {
      console.log('💾 Saving step data to AsyncStorage...');
      console.log('Step count:', stepCount);
      console.log('Date:', date);
      
      // Create a simple key-value pair for storage
      const key = `steps_${date}`;
      const value = stepCount.toString();
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(key, value);
      
      console.log('✅ Successfully saved step data:', key, '=', value);
      
    } catch (error) {
      console.error('❌ Error saving step data to AsyncStorage:', error);
    }
  };

  // Function to clear all saved step data from AsyncStorage
  const clearAllStepData = async () => {
    try {
      console.log('🧹 Clearing all saved step data from AsyncStorage...');
      
      // Get all keys from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Filter keys that start with 'steps_'
      const stepKeys = allKeys.filter(key => key.startsWith('steps_'));
      
      console.log('🔍 Found step data keys:', stepKeys);
      console.log(`🗑️ Clearing ${stepKeys.length} saved step data entries`);
      
      if (stepKeys.length > 0) {
        // Remove all step data keys
        await AsyncStorage.multiRemove(stepKeys);
        
        console.log('✅ Successfully cleared all step data:');
        stepKeys.forEach(key => console.log(`   - Removed: ${key}`));
      } else {
        console.log('ℹ️ No step data found to clear');
      }
      
    } catch (error) {
      console.error('❌ Error clearing step data from AsyncStorage:', error);
    }
  };

  // Function to load today's step data from local storage
  const loadTodaySteps = async (date: string): Promise<number | null> => {
    try {
      console.log('📖 Loading step data from AsyncStorage...');
      console.log('Date:', date);
      
      // Create the key to look for
      const key = `steps_${date}`;
      console.log('Looking for key:', key);
      
      // Try to load from AsyncStorage
      const value = await AsyncStorage.getItem(key);
      
      if (value !== null) {
        const stepCount = parseInt(value, 10);
        console.log('✅ Found saved step data:', key, '=', value);
        console.log('Parsed step count:', stepCount);
        return stepCount;
      } else {
        console.log('❌ No saved step data found for:', key);
        return null;
      }
      
    } catch (error) {
      console.error('❌ Error loading step data from AsyncStorage:', error);
      return null;
    }
  };

  // Function to check if a day hit the 10K+ step achievement
  const checkIfDayHit10K = (stepCount: number): boolean => {
    const hit10K = stepCount >= 10000;
    console.log(`🎯 10K check: ${stepCount} steps = ${hit10K ? '✅ Achievement!' : '❌ Not quite'}`);
    return hit10K;
  };

  // Function to get calendar color based on step count
  const getCalendarColorForSteps = (stepCount: number): string => {
    const isAchievement = checkIfDayHit10K(stepCount);
    const color = isAchievement ? '#239a3b' : '#f0f0f0'; // Green for 10K+, gray for under
    console.log(`🎨 Color for ${stepCount} steps: ${color} (${isAchievement ? 'Achievement Green' : 'Gray'})`);
    return color;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>STEP TRACKER</Text>
      </View>
      {activeTab === 'Steps' ? (
        <View style={styles.statsContainer}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>TODAY</Text>
            <Text style={styles.cardNumber}>{formatStepCount(todaySteps)}</Text>
            {stepError && (
              <Text style={styles.errorText}>{stepError}</Text>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.statsContainer}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{weekDateRange || 'LOADING WEEK...'}</Text>
            <View style={styles.calendarContainer}>
              {renderDayHeaders()}
              {renderCalendarGrid()}
            </View>
            <View style={styles.legendContainer}>
              <Text style={styles.legendText}>Less</Text>
              <View style={styles.legendDots}>
                {[0, 1, 2, 3, 4].map(level => (
                  <View 
                    key={level}
                    style={[
                      styles.legendDot,
                      { backgroundColor: getActivityColor(level) }
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.legendText}>More</Text>
            </View>
          </View>
        </View>
      )}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => setActiveTab('Steps')}
        >
          <Text style={styles.navIcon}>𝖿</Text>
          <Text style={activeTab === 'Steps' ? styles.navLabel : styles.navLabelInactive}>
            Steps
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => setActiveTab('Habits')}
        >
          <Text style={styles.navIcon}>⊡</Text>
          <Text style={activeTab === 'Habits' ? styles.navLabel : styles.navLabelInactive}>
            Habits
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 2,
  },
  statsContainer: {
    paddingHorizontal: 30,
    paddingTop: 40,
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 40,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    maxWidth: 350,
    alignSelf: 'center',
  },
  cardLabel: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
    marginBottom: 12,
    letterSpacing: 1,
  },
  cardNumber: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#000',
  },
  calendarContainer: {
    marginTop: 20,
    width: '100%',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dayCell: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    justifyContent: 'center',
  },
  legendText: {
    fontSize: 12,
    color: '#999',
    marginHorizontal: 8,
  },
  legendDots: {
    flexDirection: 'row',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerCell: {
    width: 32,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  errorText: {
    fontSize: 12,
    color: '#ff4444',
    marginTop: 8,
    textAlign: 'center',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 4,
    color: '#000',
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  navLabelInactive: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
});