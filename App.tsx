import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity } from 'react-native';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [activeTab, setActiveTab] = React.useState('Steps');
  const [pedometerPermission, setPedometerPermission] = React.useState<string | null>(null);
  const [todaySteps, setTodaySteps] = React.useState<number | null>(null);
  const [yesterdaySteps, setYesterdaySteps] = React.useState<number | null>(null);
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

  // Function to load yesterday's step data for calendar
  const loadYesterdaySteps = async () => {
    try {
      const yesterdayDate = '2025-06-22'; // June 22nd
      const savedSteps = await loadTodaySteps(yesterdayDate);
      
      if (savedSteps !== null) {
        setYesterdaySteps(savedSteps);
      } else {
        setYesterdaySteps(null);
      }
    } catch (error) {
      console.error('Error loading yesterday\'s step data:', error);
      setYesterdaySteps(null);
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
        setPedometerPermission(status);
        
        if (status === 'granted') {
          console.log('✅ Pedometer permissions granted! Ready to track steps.');
          // Fetch today's steps once permissions are granted
          await fetchTodaySteps();
          // Load yesterday's step data for calendar
          await loadYesterdaySteps();
        } else {
          console.log('❌ Pedometer permissions denied or restricted.');
        }
      } else {
        console.log('❌ Pedometer not available on this device.');
        setPedometerPermission('unavailable');
        // Still test with mock data for storage functionality
        console.log('Pedometer unavailable, but testing with mock data');
        await fetchTodaySteps();
        // Load yesterday's step data for calendar
        await loadYesterdaySteps();
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

  // Mock data for 30 days with different activity levels (0-4)
  const generateMockData = () => {
    const data = [];
    for (let i = 1; i <= 30; i++) {
      data.push({
        day: i,
        activity: Math.floor(Math.random() * 5), // 0-4 activity levels
      });
    }
    return data;
  };

  const habitData = generateMockData();

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
    const weeks: React.ReactElement[] = [];
    let currentWeek: React.ReactElement[] = [];
    
    // June 1st, 2025 falls on a Sunday (day 0), so no empty cells needed at the start
    const startDay = 0; // 0 = Sunday
    
    // Add empty cells for the beginning of the month if needed
    for (let i = 0; i < startDay; i++) {
      currentWeek.push(
        <View key={`empty-start-${i}`} style={styles.dayCell} />
      );
    }
    
    // Add all days of June (30 days)
    habitData.forEach((dayData, index) => {
      // Check if this is today's date (June 23rd) or yesterday (June 22nd)
      const isToday = dayData.day === 23;
      const isYesterday = dayData.day === 22;
      
      // Get color based on whether it's a special day or not
      let backgroundColor;
      if (isToday) {
        backgroundColor = getCalendarColorForSteps(todaySteps || 0);
      } else if (isYesterday && yesterdaySteps !== null) {
        backgroundColor = getCalendarColorForSteps(yesterdaySteps);
      } else if (isYesterday && yesterdaySteps === null) {
        backgroundColor = getActivityColor(dayData.activity);
      } else {
        backgroundColor = getActivityColor(dayData.activity);
      }
      
      currentWeek.push(
        <View 
          key={dayData.day} 
          style={[
            styles.dayCell, 
            { backgroundColor }
          ]}
        >
          <Text style={styles.dayNumber}>{dayData.day}</Text>
        </View>
      );
      
      // If we've filled a week (7 days), start a new week
      if ((startDay + index + 1) % 7 === 0) {
        weeks.push(
          <View key={`week-${weeks.length}`} style={styles.weekRow}>
            {currentWeek}
          </View>
        );
        currentWeek = [];
      }
    });
    
    // Add empty cells at the end to complete the last week if needed
    const remainingCells = 7 - currentWeek.length;
    if (remainingCells < 7 && remainingCells > 0) {
      for (let i = 0; i < remainingCells; i++) {
        currentWeek.push(
          <View key={`empty-end-${i}`} style={styles.dayCell} />
        );
      }
      weeks.push(
        <View key={`week-${weeks.length}`} style={styles.weekRow}>
          {currentWeek}
        </View>
      );
    }
    
    return weeks;
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
            <Text style={styles.cardLabel}>JUNE 2025</Text>
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