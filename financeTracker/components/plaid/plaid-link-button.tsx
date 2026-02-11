'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function PlaidLinkButton() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const createToken = async () => {
      try {
        const response = await fetch('/api/plaid/create-link-token', {
            method: 'POST',
        });
        if (!response.ok) {
           console.error('Failed to create link token');
           return;
        }
        const data = await response.json();
        setToken(data.link_token);
      } catch (e) {
        console.error('Error fetching link token', e);
      }
    };
    createToken();
  }, []);

  const onSuccess = useCallback(async (publicToken: string, metadata: any) => {
    setLoading(true);
    try {
      await fetch('/api/plaid/exchange-public-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_token: publicToken,
          institution_id: metadata.institution.institution_id,
          institution_name: metadata.institution.name,
        }),
      });
      router.refresh();
      // Optionally show success toast/message
    } catch (err) {
      console.error('Error exchanging token', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const config: Parameters<typeof usePlaidLink>[0] = {
    token,
    onSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  return (
    <Button onClick={() => open()} disabled={!ready || loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Building2 className="mr-2 h-4 w-4" />
      )}
      {loading ? 'Connecting...' : 'Connect Bank (Plaid)'}
    </Button>
  );
}
