import { getPublicEnv } from '../lib/env';

export default function Health() {
  const { url } = getPublicEnv();
  const last4 = url.slice(-4);

  return (
    <div className="p-8 font-mono">
      <h1 className="text-2xl font-bold mb-4">OK</h1>
      <p className="text-gray-600">
        Supabase URL loaded (ends with: <span className="font-bold text-black">...{last4}</span>)
      </p>
    </div>
  );
}
