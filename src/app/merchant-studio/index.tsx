import { Redirect } from 'expo-router';

// Merchant Studio was retired — it duplicated the seller Products screen.
// Deep links land on the canonical page instead.
export default function MerchantStudioRedirect() {
  return <Redirect href="/seller/products" />;
}
