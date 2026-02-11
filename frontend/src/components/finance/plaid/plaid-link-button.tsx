'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { Loader2, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '../api';

interface PlaidLinkButtonProps {
  itemId?: string;
  label?: string;
  onLinked?: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function PlaidLinkButton({
  itemId,
  label = 'Connect Bank (Plaid)',
  onLinked,
  variant = 'outline',
  size = 'default',
}: PlaidLinkButtonProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const createToken = async () => {
      try {
        const response = await api.post('/plaid_integration/create_link_token/', itemId ? { item_id: itemId } : {});
        setToken(response.data.link_token);
      } catch (e) {
        console.error('Error fetching link token', e);
      }
    };
    createToken();
  }, [itemId]);

  const onSuccess = useCallback(async (publicToken: string, metadata: any) => {
    setLoading(true);
    try {
      const institutionId = metadata?.institution?.institution_id ?? null;
      const institutionName = metadata?.institution?.name ?? null;
      await api.post('/plaid_integration/exchange_public_token/', {
          public_token: publicToken,
          institution_id: institutionId,
          institution_name: institutionName,
      });
      router.refresh();
      if (onLinked) onLinked();
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
    <Button 
      onClick={() => open()} 
      disabled={!ready || loading}
      variant={variant}
      size={size}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Building2 className="mr-2 h-4 w-4" />
      )}
      {loading ? 'Connecting...' : label}
    </Button>
  );
}
