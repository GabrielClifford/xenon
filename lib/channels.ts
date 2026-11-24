import type { ElementType } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Camera, Globe, MessageCircle, Music, Search, Users } from 'lucide-react';

export type ChannelId = 'website' | 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'google';

export const channels: { id: ChannelId; label: string; icon: ElementType; tip: string }[] = [
  { id: 'website', label: 'Online Store', icon: Globe, tip: 'Your main link. Put it on business cards, flyers and your shop sign.' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, tip: 'Add this link to your WhatsApp Business profile and send it to customers in chats.' },
  { id: 'instagram', label: 'Instagram', icon: Camera, tip: 'Put this link in your Instagram bio.' },
  { id: 'facebook', label: 'Facebook', icon: Users, tip: 'Add this link to your Facebook page and posts.' },
  { id: 'tiktok', label: 'TikTok', icon: Music, tip: 'Add this link to your TikTok bio.' },
  { id: 'google', label: 'Google', icon: Search, tip: 'Add this link as the website on your Google Business Profile.' },
];

export const sourceOrder = ['direct', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'google', 'other'] as const;

export const sourceLabels: Record<string, string> = {
  direct: 'Direct link',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google: 'Google',
  other: 'Other',
};

export type SourceCount = { source: string; visits: number };

export async function loadSources(supabase: SupabaseClient, businessId: string): Promise<SourceCount[]> {
  const { data, error } = await supabase.rpc('visit_sources', { p_business: businessId, p_days: 7 });
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { source: string; visits: number | string }[]) {
    const key = (sourceOrder as readonly string[]).includes(r.source) ? r.source : 'other';
    counts.set(key, (counts.get(key) ?? 0) + Number(r.visits));
  }
  return sourceOrder.map((s) => ({ source: s, visits: counts.get(s) ?? 0 }));
}
