import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

export async function checkForUpdates() {
  try {
    if (!Updates.isEnabled) return;
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      Alert.alert('Update available', 'A new version is ready. Restart now?', [
        { text: 'Later' },
        { text: 'Restart', onPress: () => Updates.reloadAsync() },
      ]);
    }
  } catch (err) {
    console.log('Update check failed:', err?.message || err);
  }
}
