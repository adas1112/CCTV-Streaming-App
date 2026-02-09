import { StreamState, VLCPlayer } from '@/components/VLCPlayer';
import { saveSnapshot } from '@/lib/snapshot';
import { getCameraById } from '@/lib/storage';
import { Camera as CameraType } from '@/types/camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Camera, RotateCw, WifiOff } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

// VLC Player is now used for both iOS and Android
// No need for separate player component

export default function LiveStreamScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [camera, setCamera] = useState<CameraType | null>(null);
  const [streamState, setStreamState] = useState<StreamState>('loading');
  const [retryCount, setRetryCount] = useState(0);

  // Animation values
  const pulseScale = useSharedValue(1);

  // Construct RTSP URL from camera data (raw credentials as user requested)
  const getRtspUrl = (): string => {
    if (!camera) return '';

    const { username, password, ip, port, protocol } = camera;

    if (protocol === 'RTSP') {
      console.log(`[LiveStream] Using RAW credentials (user requested)`);
      console.log(`[LiveStream] User: ${username}, Pass: ${password}`);

      const auth = username && password ? `${username}:${password}@` : '';
      const finalUrl = `rtsp://${auth}${ip}:${port}`;
      console.log(`[LiveStream] Final URL: ${finalUrl}`);
      return finalUrl;
    }

    return '';
  };

  const rtspUrl = getRtspUrl();

  // Load camera data from storage
  useEffect(() => {
    const loadCamera = async () => {
      if (params.cameraId) {
        const cameraData = await getCameraById(params.cameraId as string);
        if (cameraData) {
          setCamera(cameraData);
        } else {
          Alert.alert('Error', 'Camera not found');
          router.back();
        }
      }
    };
    loadCamera();
  }, [params.cameraId]);

  // Handle reconnect logic
  const handleReconnect = () => {
    setStreamState('loading');
    setRetryCount(prev => prev + 1);
  };

  const handleStateChange = (newState: StreamState) => {
    if (streamState === 'playing' && newState === 'loading') return;
    setStreamState(newState);
  };

  // Animations
  useEffect(() => {
    pulseScale.value = withRepeat(withTiming(1.2, { duration: 1000 }), -1, true);
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));

  const handleSnapshot = async () => {
    if (!camera) return;

    try {
      const mockImageUri = 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b';

      await saveSnapshot(
        camera.id,
        camera.name,
        camera.location || 'Unknown Location',
        mockImageUri
      );

      Alert.alert(
        'Snapshot Captured',
        'Snapshot saved to gallery successfully!',
        [
          { text: 'View Gallery', onPress: () => router.push('/snapshot-gallery') },
          { text: 'OK', style: 'cancel' }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save snapshot');
      console.error(error);
    }
  };

  const renderStreamContent = () => {
    // Note: iOS limitation removed - VLC player supports RTSP on both platforms

    if (streamState === 'error') {
      return (
        <View className="absolute inset-0 items-center justify-center bg-black/90 px-6">
          <WifiOff size={48} color="#ef4444" />
          <Text className="text-white text-xl font-bold text-center mt-4">Connection Failed</Text>
          <Text className="text-gray-400 text-center mt-2 mb-6">Unable to connect to camera stream.</Text>
          <TouchableOpacity onPress={handleReconnect} className="bg-primary px-8 py-3 rounded-lg flex-row items-center gap-2">
            <RotateCw size={20} color="white" />
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (streamState === 'loading' || streamState === 'buffering') {
      return (
        <View className="absolute inset-0 items-center justify-center bg-black/40 pointer-events-none">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-white text-lg font-semibold mt-4">
            {streamState === 'loading' ? 'Connecting...' : 'Buffering...'}
          </Text>
        </View>
      );
    }

    return null;
  };

  if (!camera) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <StatusBar barStyle="light-content" />

      <View className="flex-1 relative">
        {/* VLC Video Player - Works on both iOS and Android */}
        {rtspUrl ? (
          <VLCPlayer
            key={`${rtspUrl}-${retryCount}`}
            url={rtspUrl}
            onStateChange={handleStateChange}
            style={styles.video}
          />
        ) : (
          <View style={styles.video} className="bg-black" />
        )}

        {/* Overlays */}
        {renderStreamContent()}

        {/* UI Overlay */}
        <View className="absolute top-0 left-0 right-0 p-4 flex-row justify-between items-start pointer-events-box-none">
          <TouchableOpacity onPress={() => router.back()} className="bg-black/40 p-2 rounded-full">
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>

          {streamState === 'playing' && (
            <View className="flex-row items-center gap-2 bg-black/60 px-3 py-1 rounded-full">
              <Animated.View style={pulseStyle}>
                <View className="w-2 h-2 bg-red-500 rounded-full" />
              </Animated.View>
              <Text className="text-white text-xs font-bold">LIVE</Text>
            </View>
          )}
        </View>

        {/* Bottom Controls */}
        <View className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 pt-20">
          <Text className="text-white text-xl font-bold">{camera.name}</Text>
          <Text className="text-gray-300 text-sm mb-4">{camera.location}</Text>

          <View className="flex-row justify-between items-center">
            <View className="flex-row gap-4" />
            <View className="flex-row gap-4">
              <TouchableOpacity onPress={handleSnapshot} className="bg-white/20 p-3 rounded-full">
                <Camera size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: 'black',
  },
});