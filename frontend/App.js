import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';
import { name as appName } from './app.json';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import CompleteProfileScreen from './src/screens/CompleteProfileScreen';
import AvatarSelectionScreen from './src/screens/AvatarSelectionScreen';
import AvatarCustomizationScreen from './src/screens/AvatarCustomizationScreen';
import PatientHomeScreen from './src/screens/PatientHomeScreen';
import ScanAnalysisScreen from './src/screens/ScanAnalysisScreen';
import ScanReportScreen from './src/screens/ScanReportScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} options={{ title: 'Complete Profile', headerShown: false }} />
        <Stack.Screen name="AvatarSelection" component={AvatarSelectionScreen} options={{ title: 'Choose Avatar', headerShown: false }} />
        <Stack.Screen name="AvatarCustomization" component={AvatarCustomizationScreen} options={{ title: 'Customize Avatar', headerShown: false }} />
        <Stack.Screen name="PatientHome" component={PatientHomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ScanAnalysis" component={ScanAnalysisScreen} options={{ title: 'Scan Analysis', headerShown: false }} />
        <Stack.Screen name="ScanReport" component={ScanReportScreen} options={{ title: 'Scan Report', headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

registerRootComponent(App);

AppRegistry.registerComponent(appName, () => App);