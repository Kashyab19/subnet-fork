import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper function to generate unique share IDs (adjective-noun-number pattern)
const adjectives = [
  'swift', 'bright', 'clever', 'bold', 'calm', 'keen', 'quick', 'sharp', 'wise', 'brave',
  'gentle', 'noble', 'proud', 'silent', 'smooth', 'steady', 'strong', 'swift', 'tall', 'wild',
  'ancient', 'cosmic', 'digital', 'eternal', 'fierce', 'golden', 'hidden', 'magic', 'mystic', 'quantum',
  'radiant', 'stellar', 'timeless', 'vibrant', 'zenith'
];

const nouns = [
  'eagle', 'wolf', 'lion', 'tiger', 'bear', 'hawk', 'fox', 'raven', 'dragon', 'phoenix',
  'star', 'moon', 'sun', 'comet', 'nebula', 'galaxy', 'planet', 'asteroid', 'cosmos', 'orbit',
  'code', 'byte', 'pixel', 'node', 'link', 'cloud', 'stream', 'wave', 'pulse', 'signal',
  'agent', 'mind', 'soul', 'spirit', 'heart', 'flame', 'crystal', 'gem', 'pearl', 'diamond'
];

export function generateShareId(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);
  return `${adjective}-${noun}-${number}`;
}

export function getShareUrl(shareId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/agent/${shareId}`;
  }
  // Server-side fallback
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/agent/${shareId}`;
}
