import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, Animated, Easing, TouchableOpacity } from 'react-native';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [showWelcome, setShowWelcome] = React.useState<boolean>(true);
  const [welcomeLoaded, setWelcomeLoaded] = React.useState<boolean>(false);
  const [pedometerPermission, setPedometerPermission] = React.useState<string | null>(null);
  const [todaySteps, setTodaySteps] = React.useState<number | null>(null);
  const [stepError, setStepError] = React.useState<string | null>(null);
  const [showProgress, setShowProgress] = React.useState<boolean>(false);
  const [currentFilledBoxes, setCurrentFilledBoxes] = React.useState<number>(0);
  const [showConfetti, setShowConfetti] = React.useState<boolean>(false);
  const stepCountOpacity = React.useRef(new Animated.Value(0)).current;

  // Function to fetch today's actual step count
  const fetchTodaySteps = async () => {
    try {
      console.log('Fetching today\'s step count...');
      
      // Get today's date range (start of day to now)
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Get today's date for saving step data
      const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
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

  // Function to request pedometer permissions
  const requestPedometerPermissions = async () => {
    try {
      console.log('Requesting pedometer permissions...');
      
      // Clear all saved step data to fix timezone issues from previous versions
      await clearAllStepData();
      
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
        } else {
          console.log('❌ Pedometer permissions denied or restricted.');
        }
      } else {
        console.log('❌ Pedometer not available on this device.');
        setPedometerPermission('unavailable');
        // Still test with mock data for storage functionality
        console.log('Pedometer unavailable, but testing with mock data');
        await fetchTodaySteps();
      }
    } catch (error) {
      console.error('Error requesting pedometer permissions:', error);
      setPedometerPermission('error');
    }
  };

  // Request permissions when component mounts, but only after welcome screen is dismissed
  React.useEffect(() => {
    if (!showWelcome) {
      requestPedometerPermissions();
    }
  }, [showWelcome]);

  // Add delay before showing progress boxes, then fill them sequentially
  React.useEffect(() => {
    const initialTimer = setTimeout(() => {
      setShowProgress(true);
      
      // Start filling boxes one by one after the initial delay
      const targetFilledBoxes = Math.floor((todaySteps || 0) / 1000);
      let currentBox = 0;
      
      const fillInterval = setInterval(() => {
        if (currentBox < targetFilledBoxes) {
          setCurrentFilledBoxes(currentBox + 1);
          currentBox++;
        } else {
          clearInterval(fillInterval);
          
          // Check if we should show confetti after boxes finish filling
          if (todaySteps && todaySteps >= 10000) {
            setShowConfetti(true);
            startConfettiAnimation();
            console.log('🎉 Confetti triggered! User hit 10K+ steps:', todaySteps);
          }
        }
      }, 275); // Fill one box every 275ms
      
      return () => clearInterval(fillInterval);
    }, 1000);

    return () => clearTimeout(initialTimer);
  }, [todaySteps]);

  // Fade in the step count after a longer delay with gentle animation
  React.useEffect(() => {
    const fadeTimer = setTimeout(() => {
      Animated.timing(stepCountOpacity, {
        toValue: 1,
        duration: 2500, // 2.5 second fade-in
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }).start();
    }, 650); // 650ms initial delay

    return () => clearTimeout(fadeTimer);
  }, [stepCountOpacity]);

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

  // Function to check if welcome screen has been dismissed
  const checkWelcomeStatus = async () => {
    try {
      console.log('🔍 Checking welcome screen status...');
      const welcomeDismissed = await AsyncStorage.getItem('welcome_dismissed');
      console.log('Welcome dismissed status:', welcomeDismissed);
      
      if (welcomeDismissed === 'true') {
        setShowWelcome(false);
      }
      setWelcomeLoaded(true);
    } catch (error) {
      console.error('❌ Error checking welcome status:', error);
      setWelcomeLoaded(true); // Set loaded to true even on error to prevent infinite loading
    }
  };

  // Function to save welcome dismissal to AsyncStorage
  const saveWelcomeDismissed = async () => {
    try {
      console.log('💾 Saving welcome dismissed status...');
      await AsyncStorage.setItem('welcome_dismissed', 'true');
      console.log('✅ Welcome dismissed status saved');
    } catch (error) {
      console.error('❌ Error saving welcome dismissed status:', error);
    }
  };

  // Check welcome status on app startup
  React.useEffect(() => {
    checkWelcomeStatus();
  }, []);

  // Helper function to generate progress message
  const getProgressMessage = (stepCount: number | null): string => {
    // Check if permissions are denied and we don't have step data
    if (stepCount === null && (pedometerPermission === 'denied' || pedometerPermission === 'error')) {
      return 'Motion tracking is disabled';
    }
    
    if (stepCount === null) {
      return 'Loading today\'s progress...';
    }
    
    if (stepCount >= 10000) {
      return 'You walked 10K+ steps today. Congrats! 🎉';
    } else {
      const stepsNeeded = 10000 - stepCount;
      
      // Array of encouragement messages
      const encouragements = [
        'Keep going!',
        'You got this!',
        'Let\'s go!',
        'Almost there!',
        'Stay strong!',
        'Keep moving!',
        'You can do it!'
      ];
      
      // Use current date to select encouragement message (stays consistent throughout the day)
      const today = new Date();
      const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      const encouragementIndex = dayOfYear % encouragements.length;
      const encouragement = encouragements[encouragementIndex];
      
      return `${stepsNeeded.toLocaleString()} steps to hit 10K\n${encouragement}`;
    }
  };

  // Function to generate random confetti pieces with animations
  const generateConfettiPieces = () => {
    const colors = ['#ff4444', '#4444ff', '#ffff44', '#44ff44', '#ff44ff', '#ff8844']; // red, blue, yellow, green, purple, orange
    const pieces = [];
    
    // Generate 20 confetti pieces
    for (let i = 0; i < 20; i++) {
      const isCircle = Math.random() > 0.5; // 50/50 chance for circle vs square
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = Math.random() * 8 + 6; // Random size between 6-14
      const left = Math.random() * 85; // Random position (0-85% to avoid edges)
      const initialTop = Math.random() * 30 + 10; // Start higher up (10-40% from top)
      
      // Create animated value for each piece's vertical position
      const animatedTop = new Animated.Value(initialTop);
      
      // Random fall duration between 2-3 seconds for varied speeds
      const fallDuration = Math.random() * 1000 + 2000; // 2000-3000ms
      
      pieces.push({
        id: i,
        isCircle,
        color,
        size,
        left,
        initialTop,
        animatedTop,
        fallDuration,
      });
    }
    
    return pieces;
  };

  // Store confetti pieces in state to maintain animations
  const [confettiPieces, setConfettiPieces] = React.useState<any[]>([]);

  // Function to handle "Get Started" button press
  const handleGetStarted = async () => {
    await saveWelcomeDismissed();
    setShowWelcome(false);
  };

  // Function to retry getting step data (for when permissions are denied)
  const handleRetryPermissions = () => {
    console.log('Retrying pedometer permissions...');
    requestPedometerPermissions();
  };

  // Function to start confetti animation
  const startConfettiAnimation = () => {
    const pieces = generateConfettiPieces();
    setConfettiPieces(pieces);
    
    // Start falling animation for all pieces
    pieces.forEach((piece) => {
      Animated.timing(piece.animatedTop, {
        toValue: 110, // Fall to 110% (off screen)
        duration: piece.fallDuration,
        useNativeDriver: false, // Can't use native driver for layout properties
        easing: Easing.out(Easing.quad), // Gentle easing for realistic fall
      }).start(() => {
        // Animation completed - piece has fallen off screen
        console.log(`Confetti piece ${piece.id} finished falling`);
      });
    });

    // Clean up confetti after all animations should be done (3.5 seconds max)
    setTimeout(() => {
      setConfettiPieces([]);
      setShowConfetti(false);
      console.log('🧹 Confetti cleaned up');
    }, 3500);
  };

  // Function to render animated confetti pieces
  const renderConfetti = () => {
    if (!showConfetti || confettiPieces.length === 0) return null;
    
    return (
      <View style={styles.confettiContainer}>
        {confettiPieces.map((piece) => (
          <Animated.View
            key={piece.id}
            style={[
              styles.confettiPiece,
              {
                backgroundColor: piece.color,
                width: piece.size,
                height: piece.size,
                borderRadius: piece.isCircle ? piece.size / 2 : 2,
                left: `${piece.left}%`,
                top: piece.animatedTop.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        ))}
      </View>
    );
  };

  // Show loading while checking welcome status
  if (!welcomeLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.welcomeContainer}>
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeSubtitle}>Loading...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Render welcome screen
  if (showWelcome) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.welcomeContainer}>
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>Welcome to Step Tracker</Text>
            <Text style={styles.welcomeSubtitle}>Track your daily steps and reach your 10K goal</Text>
            <Text style={styles.welcomeDescription}>We'll ask for motion access to count your steps</Text>
            <TouchableOpacity style={styles.getStartedButton} onPress={handleGetStarted}>
              <Text style={styles.getStartedButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>STEP TRACKER</Text>
      </View>
      <View style={styles.statsContainer}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>STEPS TODAY</Text>
          <Animated.Text style={[styles.cardNumber, { opacity: stepCountOpacity }]}>{formatStepCount(todaySteps)}</Animated.Text>
          {stepError && (
            <Text style={styles.errorText}>{stepError}</Text>
          )}
        </View>
        <View style={styles.card}>
          <Text style={[styles.cardLabel, { marginBottom: 16 }]}>DAILY PROGRESS</Text>
          <View style={styles.boxRow}>
            {Array.from({ length: 10 }, (_, index) => {
              let boxColor = '#f0f0f0'; // Default gray
              
              if (showProgress && index < currentFilledBoxes) {
                // Progressive green colors for each box (1K to 10K steps)
                const progressColors = [
                  '#c6e48b', // Box 1 (1K steps): Light green
                  '#a3d977', // Box 2 (2K steps): Slightly darker
                  '#7bc96f', // Box 3 (3K steps): Medium light
                  '#5fb85f', // Box 4 (4K steps): Medium
                  '#4aa54a', // Box 5 (5K steps): Getting darker
                  '#3d9140', // Box 6 (6K steps): Darker
                  '#307d36', // Box 7 (7K steps): Much darker
                  '#256a2c', // Box 8 (8K steps): Very dark
                  '#1b5622', // Box 9 (9K steps): Almost there
                  '#0f4318', // Box 10 (10K steps): Achievement dark green
                ];
                boxColor = progressColors[index];
              }
              
              return (
                <View 
                  key={index} 
                  style={[
                    styles.grayBox, 
                    { backgroundColor: boxColor }
                  ]} 
                />
              );
            })}
          </View>
          <View style={styles.labelRow}>
            {Array.from({ length: 10 }, (_, index) => (
              <View key={index} style={styles.labelCell}>
                <Text style={styles.boxLabel}>
                  {index === 0 ? '1K' : index === 9 ? '10K' : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {getProgressMessage(todaySteps)}
          </Text>
          {todaySteps === null && (pedometerPermission === 'denied' || pedometerPermission === 'error') && (
            <View style={styles.permissionCard}>
              <Text style={styles.permissionInstructions}>To track your steps, go to:</Text>
              <Text style={styles.permissionPath}>Settings → StepTracker → Motion & Fitness</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRetryPermissions}>
                <Text style={styles.retryButtonText}>Check Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      {renderConfetti()}
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
    paddingTop: 20,
    flex: 1,
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
    width: '100%',
  },
  cardLabel: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
    marginBottom: 12,
    letterSpacing: 1,
  },
  cardNumber: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#000',
  },
  errorText: {
    fontSize: 12,
    color: '#ff4444',
    marginTop: 8,
    textAlign: 'center',
  },
  progressContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  grayBox: {
    width: 24,
    height: 24,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 2,
    borderRadius: 4,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  confettiPiece: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  labelCell: {
    width: 24,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  boxLabel: {
    fontSize: 10,
    color: '#999',
    fontWeight: '500',
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  welcomeCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 1,
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  welcomeDescription: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  getStartedButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    minWidth: 160,
  },
  getStartedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  permissionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  permissionInstructions: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionPath: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});