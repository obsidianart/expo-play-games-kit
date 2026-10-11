import * as PlayGamesKit from 'expo-play-games-kit';
import { useEffect, useState } from 'react';
import { Button, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

// Replace with real ids from Play Console / App Store Connect to test.
const DEMO_ACHIEVEMENT = {
  android: 'CgkIxxxxxxxxEAIQAg',
  ios: 'demo_achievement',
};

// Configure a separate incremental achievement with 10 total steps.
const DEMO_PROGRESS_ACHIEVEMENT = {
  android: 'YOUR_INCREMENTAL_ACHIEVEMENT_ID',
  ios: 'demo_progress',
};

export default function App() {
  const [authState, setAuthState] = useState<PlayGamesKit.AuthState | null>(null);
  const [lastResult, setLastResult] = useState('—');
  const capabilities = PlayGamesKit.getCapabilities();

  useEffect(() => {
    PlayGamesKit.isAuthenticated().then(setAuthState);
    const subscription = PlayGamesKit.addAuthenticationListener(setAuthState);
    return () => subscription.remove();
  }, []);

  const run = (label: string, action: () => Promise<unknown>) => async () => {
    try {
      const result = await action();
      setLastResult(`${label}: ${JSON.stringify(result) ?? 'ok'}`);
    } catch (error) {
      setLastResult(`${label} failed: ${String(error)}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>expo-play-games-kit</Text>

        <Group name="Authentication">
          <Text>
            {authState?.isAuthenticated
              ? `Signed in as ${authState.player?.displayName ?? 'unknown player'}`
              : 'Not signed in'}
          </Text>
          <Button title="Sign in" onPress={run('signIn', () => PlayGamesKit.signIn())} />
          <Button title="Get player" onPress={run('getPlayer', () => PlayGamesKit.getPlayer())} />
        </Group>

        <Group name="Achievements">
          <Button
            title="Unlock demo achievement"
            onPress={run('unlock', () => PlayGamesKit.unlockAchievement(DEMO_ACHIEVEMENT))}
          />
          <Button
            title="Set progress 5/10"
            onPress={run('setSteps', () => PlayGamesKit.setAchievementSteps(DEMO_PROGRESS_ACHIEVEMENT, 5, 10))}
          />
          <Button
            title="Show achievements UI"
            onPress={run('showAchievements', () => PlayGamesKit.showAchievements())}
          />
        </Group>

        <Group name="Game Stats (Android)">
          <Text>Requires the event schema described in example/README.md.</Text>
          <Button
            title="Record level_solved"
            disabled={!capabilities.gameStats}
            onPress={run('recordEvent', () =>
              PlayGamesKit.recordGameEvent('level_solved', { score: 812 })
            )}
          />
          <Button
            title="Set progression to 5"
            disabled={!capabilities.gameStats}
            onPress={run('progress', () => PlayGamesKit.recordProgress(5))}
          />
          <Button
            title="Request stats upload"
            disabled={!capabilities.gameStats}
            onPress={run('upload', () => PlayGamesKit.uploadGameEvents())}
          />
        </Group>

        <Group name="Recall (Android)">
          <Text>Requests a session only. Account linking needs your backend.</Text>
          <Button
            title="Request Recall session"
            disabled={!capabilities.recall}
            onPress={run('recall', async () => {
              await PlayGamesKit.requestRecallAccess();
              return 'Session received (hidden)';
            })}
          />
        </Group>

        <Group name="Capabilities">
          <Text>{JSON.stringify(capabilities, null, 2)}</Text>
        </Group>

        <Group name="Last result">
          <Text>{lastResult}</Text>
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader}>{name}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eee' },
  content: { padding: 20, gap: 12 },
  header: { fontSize: 26, fontWeight: 'bold', margin: 10 },
  group: { margin: 10, backgroundColor: '#fff', borderRadius: 10, padding: 16, gap: 8 },
  groupHeader: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
});
