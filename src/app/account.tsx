import { useRouter } from 'expo-router';
import { useEffect } from 'react';

// The account tab redirects to the buyer dashboard
export default function AccountScreen() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/buyer' as any);
  }, [router]);
  return null;
}
