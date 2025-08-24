import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function useIsOwner(plant, forceOwner = false) {
  const [isOwner, setIsOwner] = useState(!!forceOwner);

  useEffect(() => {
    if (forceOwner) { setIsOwner(true); return; }
    let mounted = true;
    (async () => {
      try {
        const [email, currentUserId] = await Promise.all([
          AsyncStorage.getItem('userEmail'),
          AsyncStorage.getItem('currentUserId'),
        ]);
        const me = currentUserId || email || '';
        const sellerId =
          plant?.sellerId ||
          plant?.seller?.id ||
          plant?.seller?.email ||
          '';
        if (mounted) setIsOwner(!!me && !!sellerId && me === String(sellerId));
      } catch {
        if (mounted) setIsOwner(false);
      }
    })();
    return () => { mounted = false; };
  }, [plant, forceOwner]);

  return isOwner;
}
