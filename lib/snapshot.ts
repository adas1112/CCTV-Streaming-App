import { Snapshot } from '@/types/camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const SNAPSHOTS_STORAGE_KEY = 'cctv_snapshots';
const SNAPSHOT_DIR = FileSystem.documentDirectory + 'snapshots/';

// Ensure snapshot directory exists
const ensureDirExists = async () => {
    const dirInfo = await FileSystem.getInfoAsync(SNAPSHOT_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(SNAPSHOT_DIR, { intermediates: true });
    }
};

export async function saveSnapshot(
    cameraId: string,
    cameraName: string,
    location: string,
    imageUri: string // Can be a temporary file uri or base64
): Promise<Snapshot> {
    try {
        await ensureDirExists();

        const timestamp = new Date();
        const fileName = `snapshot_${timestamp.getTime()}.jpg`;
        const newPath = SNAPSHOT_DIR + fileName;

        // Move or copy the image to our permanent directory
        // If it's a remote URL (mock), we might need to download it, but for now assuming local temp file
        // For mock testing, if it is a remote URL, we just use it as is, or download it.
        // To enable offline access, let's download/copy.

        if (imageUri.startsWith('http')) {
            await FileSystem.downloadAsync(imageUri, newPath);
        } else {
            await FileSystem.copyAsync({
                from: imageUri,
                to: newPath
            });
        }

        const newSnapshot: Snapshot = {
            id: Math.random().toString(36).substr(2, 9),
            cameraId,
            cameraName,
            location,
            timestamp: timestamp.toLocaleString(),
            date: timestamp.toISOString(),
            imageUri: newPath
        };

        // Save metadata to AsyncStorage
        const existingSnapshots = await getSnapshots();
        const updatedSnapshots = [newSnapshot, ...existingSnapshots];
        await AsyncStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(updatedSnapshots));

        return newSnapshot;
    } catch (error) {
        console.error('Error saving snapshot:', error);
        throw new Error('Failed to save snapshot');
    }
}

export async function getSnapshots(): Promise<Snapshot[]> {
    try {
        const jsonValue = await AsyncStorage.getItem(SNAPSHOTS_STORAGE_KEY);
        return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (error) {
        console.error('Error getting snapshots:', error);
        return [];
    }
}

export async function deleteSnapshot(id: string): Promise<void> {
    try {
        const snapshots = await getSnapshots();
        const snapshotToDelete = snapshots.find(s => s.id === id);

        if (snapshotToDelete) {
            // Delete file from filesystem
            await FileSystem.deleteAsync(snapshotToDelete.imageUri, { idempotent: true });

            // Update storage
            const updatedSnapshots = snapshots.filter(s => s.id !== id);
            await AsyncStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(updatedSnapshots));
        }
    } catch (error) {
        console.error('Error deleting snapshot:', error);
        throw new Error('Failed to delete snapshot');
    }
}

export async function clearAllSnapshots(): Promise<void> {
    try {
        await FileSystem.deleteAsync(SNAPSHOT_DIR, { idempotent: true });
        await AsyncStorage.removeItem(SNAPSHOTS_STORAGE_KEY);
        await ensureDirExists(); // Recreate dir
    } catch (error) {
        console.error('Error clearing snapshots:', error);
        throw new Error('Failed to clear snapshots');
    }
}
